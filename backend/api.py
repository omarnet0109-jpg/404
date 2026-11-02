"""404 Studio secure ComfyUI bridge. Start with uvicorn backend.api:app.

This backend cannot render on its own. The GPU and an exported ComfyUI API
workflow (with an image-load node and a video-output node) must exist.

Security model: exact allowed CORS origins, mandatory API token, no arbitrary
remote workflow JSON, private ComfyUI URL, bounded image uploads, no public
file proxy. Do not expose ComfyUI port 8188 to the open internet.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sqlite3
import uuid
from urllib.parse import urlencode

import httpx
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.engine_modes import EngineNotAvailable, available_engine_modes, select_engine

BASE = Path(__file__).resolve().parents[1]
DB_FILE = Path(os.environ.get("STUDIO_DB_FILE", str(BASE / "backend" / "data" / "studio.db")))
COMFY_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
WORKFLOW_FILE = Path(os.environ.get("COMFYUI_WORKFLOW", str(BASE / "backend" / "workflows" / "video_api.json")))
API_TOKEN = os.environ.get("APP_API_TOKEN", "")
MAX_JOBS_PER_DAY = max(1, int(os.environ.get("STUDIO_DAILY_JOB_LIMIT", "12")))
ORIGINS = [
    x.strip() for x in os.environ.get(
        "APP_ALLOWED_ORIGINS",
        "https://omarnet0109-jpg.github.io,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",") if x.strip()
]
if "*" in ORIGINS:
    raise RuntimeError("Wildcard CORS is forbidden on the authenticated bridge.")
app = FastAPI(title="404 Studio / GPU Bridge", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=ORIGINS,
    allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"],
    allow_credentials=False,
)

VIDEO_EXT = {".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime"}
IMAGE_SIGNATURES = {
    ".png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    ".jpg": lambda b: b.startswith(b"\xff\xd8\xff"),
    ".jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    ".webp": lambda b: len(b) >= 12 and b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}


def open_db():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(DB_FILE), timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, filename TEXT NOT NULL, kind TEXT NOT NULL)")
    con.execute(
        "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, prompt_id TEXT NOT NULL, "
        "shot_id TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    con.commit()
    return con


def require_token(authorization: str | None = Header(None)):
    if not API_TOKEN:
        raise HTTPException(503, "APP_API_TOKEN has not been configured on the backend")
    if not authorization or not authorization.startswith("Bearer ") or not hmac.compare_digest(
        authorization[7:], API_TOKEN
    ):
        raise HTTPException(401, "Invalid studio access token")


def approved_reference_hashes() -> dict[str, str]:
    """Only the four creator-approved original PNGs may become cast assets."""
    bible = json.loads((BASE / "characters" / "character_bible.json").read_text(encoding="utf-8"))
    approved = {record["id"]: record["sha256"] for record in bible["reference_images"]}
    if set(approved) != {"ensemble", "LAYLA", "WIDAD", "SABER"}:
        raise ValueError("Unexpected characters in approved reference bible")
    return approved


def scene_data() -> dict:
    return json.loads((BASE / "scenes" / "episode-01" / "scene-001.json").read_text(encoding="utf-8"))


def inject_workflow(workflow: dict, values: dict) -> dict:
    """Require explicit positive prompt and reference-image placeholders."""
    document = json.dumps(workflow)
    for required in ("{{PROMPT}}", "{{REFERENCE_IMAGE}}"):
        if required not in document:
            raise ValueError(f"Exported API workflow must include {required}")

    def replace(node):
        if isinstance(node, dict):
            return {key: replace(value) for key, value in node.items()}
        if isinstance(node, list):
            return [replace(value) for value in node]
        if isinstance(node, str):
            if node in values:
                return values[node]
            for token, value in values.items():
                node = node.replace(token, str(value))
            if re.search(r"\{\{[A-Z_]+\}\}", node):
                raise ValueError("Unresolved workflow placeholder")
        return node

    return replace(workflow)


def inspect_workflow_template(path: Path | None = None) -> dict:
    """Validate a ComfyUI API graph without enqueueing a GPU job."""
    workflow_path = path or WORKFLOW_FILE
    if not workflow_path.is_file():
        return {"valid": False, "status": "missing", "error": "ComfyUI API workflow file is missing", "node_types": [], "model_requirements": []}
    try:
        workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"valid": False, "status": "invalid", "error": f"Workflow JSON is invalid: {exc}", "node_types": [], "model_requirements": []}
    if not isinstance(workflow, dict) or isinstance(workflow.get("nodes"), list):
        return {
            "valid": False, "status": "invalid",
            "error": "Workflow must be exported in ComfyUI API format, not UI format",
            "node_types": [], "model_requirements": [],
        }
    nodes = list(workflow.values())
    if not nodes or any(
        not isinstance(node, dict)
        or not isinstance(node.get("class_type"), str)
        or not isinstance(node.get("inputs"), dict)
        for node in nodes
    ):
        return {"valid": False, "status": "invalid", "error": "Workflow is not a ComfyUI API node graph", "node_types": [], "model_requirements": []}
    try:
        inject_workflow(workflow, {
            "{{PROMPT}}": "preflight prompt", "{{NEGATIVE_PROMPT}}": "preflight negative prompt",
            "{{REFERENCE_IMAGE}}": "preflight.png", "{{SEED}}": 404,
            "{{FRAMES}}": 24, "{{WIDTH}}": 704, "{{HEIGHT}}": 1280,
        })
    except ValueError as exc:
        return {"valid": False, "status": "invalid", "error": str(exc), "node_types": [], "model_requirements": []}
    node_types = sorted({node["class_type"] for node in nodes})
    model_keys = {"unet_name", "clip_name", "vae_name", "lora_name", "control_net_name", "checkpoint_name", "ckpt_name"}
    model_requirements = [
        {"class_type": node["class_type"], "input": key, "filename": value}
        for node in nodes for key, value in node["inputs"].items()
        if key in model_keys and isinstance(value, str)
    ]
    if not any(
        "video" in node_type.lower() and ("save" in node_type.lower() or "combine" in node_type.lower())
        for node_type in node_types
    ):
        return {
            "valid": False, "status": "invalid",
            "error": "Workflow must contain a video output node", "node_types": node_types,
            "model_requirements": model_requirements,
        }
    return {
        "valid": True, "status": "ready", "error": "", "node_types": node_types,
        "model_requirements": model_requirements,
    }


def missing_workflow_models(workflow: dict, object_info: dict) -> list[str]:
    """Compare filenames in loader nodes with ComfyUI's live model lists."""
    missing = []
    for requirement in workflow["model_requirements"]:
        node = object_info.get(requirement["class_type"], {})
        inputs = node.get("input", {}).get("required", {}) if isinstance(node, dict) else {}
        definition = inputs.get(requirement["input"])
        choices = definition[0] if isinstance(definition, list) and definition else None
        if isinstance(choices, list) and requirement["filename"] not in choices:
            missing.append(requirement["filename"])
    return sorted(set(missing))


def available_videos(history_entry: dict) -> list[dict]:
    result = []
    for output in history_entry.get("outputs", {}).values():
        if not isinstance(output, dict):
            continue
        for group in ("videos", "gifs", "animations"):
            for item in output.get(group, []):
                if not isinstance(item, dict) or not isinstance(item.get("filename"), str):
                    continue
                extension = Path(item["filename"]).suffix.lower()
                if extension in VIDEO_EXT and item.get("type", "output") == "output":
                    result.append({
                        "filename": item["filename"],
                        "subfolder": item.get("subfolder", ""),
                        "type": "output",
                        "mime": VIDEO_EXT[extension],
                    })
    return result


async def comfy(method: str, route: str, *, data=None, files=None):
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.request(method, COMFY_URL + route, json=data, files=files)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "ComfyUI unavailable or rejected the request") from exc


async def history_for(prompt_id: str) -> dict | None:
    data = await comfy("GET", "/history/" + prompt_id)
    return data.get(prompt_id)


def require_free_engine():
    try:
        return select_engine()
    except EngineNotAvailable as exc:
        raise HTTPException(503, str(exc)) from exc


@app.get("/api/engine-modes", dependencies=[Depends(require_token)])
async def engine_modes():
    return {"modes": available_engine_modes(), "selected": require_free_engine().id}


@app.get("/api/health", dependencies=[Depends(require_token)])
async def health():
    engine = require_free_engine()
    workflow = inspect_workflow_template()
    try:
        await comfy("GET", "/queue")
        connected = True
    except HTTPException:
        connected = False
    missing_nodes: list[str] = []
    missing_models: list[str] = []
    if connected and workflow["valid"]:
        try:
            object_info = await comfy("GET", "/object_info")
            available_nodes = set(object_info) if isinstance(object_info, dict) else set()
            missing_nodes = sorted(set(workflow["node_types"]) - available_nodes)
            if not missing_nodes:
                missing_models = missing_workflow_models(workflow, object_info)
        except HTTPException:
            connected = False
    workflow_status = "nodes_missing" if missing_nodes else "models_missing" if missing_models else workflow["status"]
    video_ready = bool(connected and workflow["valid"] and not missing_nodes and not missing_models)
    return {
        "name": "404 Studio", "comfyui_connected": connected,
        "workflow_configured": workflow["valid"],
        "workflow_status": workflow_status,
        "workflow_error": workflow["error"],
        "missing_nodes": missing_nodes,
        "missing_models": missing_models,
        "video_ready": video_ready,
        "engine": {**engine.public_status(), "video_engine_ready": video_ready},
        "message": "Video is generated on the remote GPU, not on the mobile device.",
    }


@app.post("/api/assets", dependencies=[Depends(require_token)])
async def upload_image(image: UploadFile = File(...), reference_type: str = Form(...)):
    require_free_engine()
    if reference_type not in {"ensemble", "LAYLA", "WIDAD", "SABER"}:
        raise HTTPException(422, "Unknown character reference")
    original = Path(image.filename or "").name
    ext = Path(original).suffix.lower()
    if ext not in IMAGE_SIGNATURES:
        raise HTTPException(415, "Only PNG, JPEG and WEBP images are supported")
    body = await image.read(15 * 1024 * 1024 + 1)
    if not body or len(body) > 15 * 1024 * 1024:
        raise HTTPException(413, "Image must be non-empty and no larger than 15 MB")
    if not IMAGE_SIGNATURES[ext](body):
        raise HTTPException(415, "Image contents do not match its file extension")
    approved_digest = approved_reference_hashes()[reference_type]
    if not hmac.compare_digest(hashlib.sha256(body).hexdigest(), approved_digest):
        raise HTTPException(422, "Reference image differs from the locked creator-approved original")
    safe_name = f"studio404_{uuid.uuid4().hex}{ext}"
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            res = await client.post(
                COMFY_URL + "/upload/image",
                files={"image": (safe_name, body, image.content_type or "application/octet-stream")},
                data={"type": "input", "overwrite": "false"},
            )
            res.raise_for_status()
            response = res.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "ComfyUI image upload failed") from exc
    filename = response.get("name")
    if not filename or Path(filename).name != filename:
        raise HTTPException(502, "ComfyUI returned an invalid uploaded image name")
    asset_id = str(uuid.uuid4())
    with open_db() as con:
        con.execute("INSERT INTO assets VALUES (?,?,?)", (asset_id, filename, reference_type))
        con.commit()
    return {"asset_id": asset_id, "reference_type": reference_type, "filename": filename}


class RenderRequest(BaseModel):
    shot_id: str = Field(pattern=r"^sh\d\d$")
    prompt: str = Field(min_length=10, max_length=5000)
    negative_prompt: str = Field(default="", max_length=1800)
    frames: int = Field(ge=1, le=720)
    seed: int = Field(ge=0, le=2147483647)
    reference_asset_id: str = Field(min_length=10, max_length=64)


@app.post("/api/render", dependencies=[Depends(require_token)])
async def render(request: RenderRequest):
    require_free_engine()
    workflow_check = inspect_workflow_template()
    if workflow_check["status"] == "missing":
        raise HTTPException(503, "Create a ComfyUI API workflow at COMFYUI_WORKFLOW first")
    if not workflow_check["valid"]:
        raise HTTPException(422, "ComfyUI video workflow template is invalid: " + workflow_check["error"])
    shot = next((s for s in scene_data()["shots"] if s["shot_id"] == request.shot_id), None)
    if shot is None:
        raise HTTPException(422, "Shot does not exist in approved episode")
    with open_db() as con:
        asset = con.execute("SELECT * FROM assets WHERE id=?", (request.reference_asset_id,)).fetchone()
        today = con.execute("SELECT COUNT(*) FROM jobs WHERE created >= datetime(\'now\',\'-1 day\')").fetchone()[0]
    if asset is None:
        raise HTTPException(404, "Reference image must be uploaded to this backend")
    expected = shot.get("speaker") or "ensemble"
    if asset["kind"] not in {expected, "ensemble"}:
        raise HTTPException(422, "Reference image does not match the scene speaker")
    if request.frames != round(float(shot["duration_seconds"]) * 24):
        raise HTTPException(422, "Frames must match the approved shot duration at 24 fps")
    if today >= MAX_JOBS_PER_DAY:
        raise HTTPException(429, "Daily GPU generation limit reached; review usage before running more jobs")
    try:
        raw = json.loads(WORKFLOW_FILE.read_text(encoding="utf-8"))
        workflow = inject_workflow(raw, {
            "{{PROMPT}}": request.prompt,
            "{{NEGATIVE_PROMPT}}": request.negative_prompt,
            "{{REFERENCE_IMAGE}}": asset["filename"],
            "{{SEED}}": request.seed,
            "{{FRAMES}}": request.frames,
            "{{WIDTH}}": 704,
            "{{HEIGHT}}": 1280,
        })
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        raise HTTPException(422, "ComfyUI video workflow template is invalid: " + str(exc)) from exc
    result = await comfy("POST", "/prompt", data={"prompt": workflow, "client_id": "studio404"})
    prompt_id = result.get("prompt_id")
    if not isinstance(prompt_id, str) or not re.fullmatch(r"[0-9a-fA-F-]{20,50}", prompt_id):
        raise HTTPException(502, "ComfyUI did not provide a valid prompt ID")
    job_id = str(uuid.uuid4())
    with open_db() as con:
        con.execute(
            "INSERT INTO jobs (id,prompt_id,shot_id) VALUES (?,?,?)",
            (job_id, prompt_id, request.shot_id),
        )
        con.commit()
    return {"job_id": job_id, "status": "queued", "shot_id": request.shot_id}


def get_job(job_id: str) -> sqlite3.Row:
    try:
        uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(422, "Invalid job ID") from exc
    with open_db() as con:
        record = con.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    if record is None:
        raise HTTPException(404, "Job not found")
    return record


@app.get("/api/jobs/{job_id}", dependencies=[Depends(require_token)])
async def job_status(job_id: str):
    record = get_job(job_id)
    task = await history_for(record["prompt_id"])
    if not task:
        return {"job_id": job_id, "status": "running", "videos": [], "message": "The GPU task is queued or rendering"}
    status = task.get("status", {}).get("status_str", "")
    if status == "error":
        return {"job_id": job_id, "status": "failed", "videos": [], "message": "ComfyUI reported generation error"}
    if status != "success":
        return {"job_id": job_id, "status": "running", "videos": [], "message": "Rendering is not complete"}
    videos = available_videos(task)
    if not videos:
        return {"job_id": job_id, "status": "failed", "videos": [], "message": "No video file exported from ComfyUI workflow"}
    return {
        "job_id": job_id, "status": "complete", "videos": [
            {"index": i, "mime": video["mime"]} for i, video in enumerate(videos)
        ], "message": "A video clip was rendered. Speech/lip sync is NOT verified.",
    }


@app.get("/api/jobs/{job_id}/video/{index}", dependencies=[Depends(require_token)])
async def download_video(job_id: str, index: int):
    if index < 0 or index > 12:
        raise HTTPException(422, "Video output index is out of range")
    record = get_job(job_id)
    task = await history_for(record["prompt_id"])
    videos = available_videos(task or {})
    if index >= len(videos):
        raise HTTPException(404, "Completed video was not found")
    video = videos[index]
    query = urlencode({k: video[k] for k in ("filename", "subfolder", "type")})
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            result = await client.get(COMFY_URL + "/view?" + query)
            result.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Could not retrieve the rendered video") from exc
    if not result.content:
        raise HTTPException(502, "Video output is empty")
    return Response(
        result.content, media_type=video["mime"],
        headers={"Cache-Control": "private, no-store"},
    )
