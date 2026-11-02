#!/usr/bin/env python3
"""Run a REAL Wan 2.2 image-to-video clip via a PRIVATE/local ComfyUI API.

A GPU is mandatory. This CLI does not provide free compute, download model
weights, expose web servers, generate speech, or guarantee visual identity.
It verifies the original reference asset before queueing any task.

Run a one-second PREVIEW from a Colab notebook after installing the model:
  python production/free_wan22.py --reference /content/references/layla.png --actor LAYLA --shot sh05 --execute

Without --execute it prepares and validates the prompt but uses no GPU.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GRAPH = ROOT / "backend" / "workflows" / "wan22_ti2v_5b_api.json"
BIBLE = ROOT / "characters" / "character_bible.json"
SCENE = ROOT / "scenes" / "episode-01" / "scene-001.json"
ACTORS = {"LAYLA", "WIDAD", "SABER", "ensemble"}
MODEL_FIELDS = {"unet_name", "clip_name", "vae_name", "lora_name", "ckpt_name"}
VIDEO_ENDINGS = {".mp4", ".webm", ".mov"}


def canonical_reference(path: Path, actor: str) -> str:
    if actor not in ACTORS:
        raise ValueError("Reference actor must be LAYLA, WIDAD, SABER or ensemble.")
    manifest = json.loads(BIBLE.read_text(encoding="utf-8"))
    required = {item["id"]: item["sha256"] for item in manifest["reference_images"]}
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != required[actor]:
        raise ValueError(
            "The uploaded photo is not the exact approved 404 character reference. "
            "Use the original PNG without resaving or converting."
        )
    return actual


def prepare(shot_id: str, actor: str, reference: Path, *, frames: int, width: int, height: int,
            graph_path: Path = DEFAULT_GRAPH, seed: int = 404) -> dict:
    sha = canonical_reference(reference, actor)
    scene = json.loads(SCENE.read_text(encoding="utf-8"))
    shot = next((x for x in scene["shots"] if x["shot_id"] == shot_id), None)
    if shot is None:
        raise ValueError("Unknown shot in approved 404 episode.")
    speaker = shot.get("speaker")
    if actor != (speaker or "ensemble"):
        raise ValueError(f"Shot {shot_id} needs the {(speaker or 'ensemble')} reference; got {actor}.")
    if not 1 <= frames <= 145 or frames % 4 != 1:
        raise ValueError("For this Wan smoke test use 4n+1 frames in range 5..145, e.g. 25 or 33.")
    if width % 16 or height % 16 or width < 256 or height < 256 or width > 1280 or height > 1280:
        raise ValueError("Width/height must be multiples of 16 in the 256..1280 range.")
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    values = {
        "{{PROMPT}}": shot["prompt_en"],
        "{{NEGATIVE_PROMPT}}": shot.get("negative_prompt", "blurry, flicker, extra fingers, face changed"),
        "{{REFERENCE_IMAGE}}": "TO_BE_UPLOADED",
        "{{FRAMES}}": frames, "{{WIDTH}}": width, "{{HEIGHT}}": height, "{{SEED}}": seed,
    }
    def fill(node):
        if isinstance(node, dict):
            return {k: fill(v) for k, v in node.items()}
        if isinstance(node, list):
            return [fill(v) for v in node]
        if isinstance(node, str):
            return values.get(node, node)
        return node
    ready = fill(graph)
    expected = {"LoadImage", "Wan22ImageToVideoLatent", "SaveVideo"}
    classes = {node["class_type"] for node in ready.values()}
    if not expected.issubset(classes):
        raise ValueError("Video graph is missing mandatory image/video nodes.")
    if any("{{" in json.dumps(x) for x in ready.values()):
        raise ValueError("Unresolved API graph placeholders.")
    return {"graph": ready, "reference_sha": sha, "shot": shot, "classes": sorted(classes),
            "frames": frames, "resolution": [width, height], "reference_path": str(reference)}


def validate_comfy_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise ValueError("Free notebook accepts local ComfyUI only; no public HTTP/tunnels.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("ComfyUI URL should contain only loopback host and port.")
    return url.rstrip("/")


def run_task(plan: dict, server: str, output: Path, *, timeout: int = 1200) -> Path:
    # This runs only with an explicit CLI --execute. Never call automatically on import.
    import requests
    server = validate_comfy_url(server)
    info_response = requests.get(server + "/object_info", timeout=45)
    info_response.raise_for_status()
    info = info_response.json()
    missing_nodes = sorted(set(plan["classes"]) - set(info))
    if missing_nodes:
        raise RuntimeError(f"ComfyUI lacks video nodes: {missing_nodes}; update ComfyUI.")
    for node in plan["graph"].values():
        cls = node["class_type"]
        spec = info[cls].get("input", {}).get("required", {})
        for key, item in node["inputs"].items():
            if key not in MODEL_FIELDS or not isinstance(item, str):
                continue
            choices = spec.get(key)
            available = choices[0] if isinstance(choices, list) and choices else None
            if isinstance(available, list) and item not in available:
                raise RuntimeError(f"Missing model file in ComfyUI: {item}")
    image_path = Path(plan["reference_path"])
    mime = "image/png"
    with image_path.open("rb") as f:
        response = requests.post(
            server + "/upload/image",
            files={"image": (image_path.name, f, mime)},
            data={"type": "input", "overwrite": "false"}, timeout=90,
        )
    response.raise_for_status()
    uploaded = response.json().get("name")
    if not uploaded or Path(uploaded).name != uploaded:
        raise RuntimeError("ComfyUI refused the original reference photo.")
    graph = plan["graph"]
    for node in graph.values():
        if node["class_type"] == "LoadImage":
            node["inputs"]["image"] = uploaded
    result = requests.post(server + "/prompt", json={"prompt": graph, "client_id": "404-colab-notebook"}, timeout=90)
    result.raise_for_status()
    answer = result.json()
    if answer.get("error"):
        raise RuntimeError(f"ComfyUI graph was rejected: {answer['error']}")
    job_id = answer.get("prompt_id")
    if not job_id:
        raise RuntimeError("ComfyUI returned no prompt ID.")
    print("Queued real GPU job:", job_id, flush=True)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = requests.get(server + "/history/" + job_id, timeout=30)
        response.raise_for_status()
        history = response.json().get(job_id)
        if history:
            status = history.get("status", {}).get("status_str")
            if status == "error":
                raise RuntimeError("ComfyUI failed during GPU inference; inspect the local ComfyUI log.")
            if status == "success":
                for out in history.get("outputs", {}).values():
                    for typ in ("videos", "gifs", "animations"):
                        for entry in out.get(typ, []):
                            filename = entry.get("filename", "")
                            ext = Path(filename).suffix.lower()
                            if ext not in VIDEO_ENDINGS or entry.get("type", "output") != "output":
                                continue
                            vid = requests.get(server + "/view", params={
                                "filename": filename,
                                "subfolder": entry.get("subfolder", ""),
                                "type": "output",
                            }, timeout=180)
                            vid.raise_for_status()
                            if len(vid.content) < 1000:
                                raise RuntimeError("Video payload is empty or invalid.")
                            result_path = output.with_suffix(ext)
                            result_path.parent.mkdir(parents=True, exist_ok=True)
                            result_path.write_bytes(vid.content)
                            print("REAL generated video:", result_path, "bytes:", result_path.stat().st_size)
                            return result_path
                raise RuntimeError("Inference ended but ComfyUI did not export an MP4/WebM/MOV video.")
        time.sleep(6)
    raise TimeoutError("ComfyUI GPU job exceeded the notebook's time budget; no fake video created.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reference", type=Path, required=True)
    ap.add_argument("--actor", choices=sorted(ACTORS), default="LAYLA")
    ap.add_argument("--shot", default="sh05")
    ap.add_argument("--frames", type=int, default=33, help="Preview only: 33 frames = ~1.4 seconds at 24 fps")
    ap.add_argument("--width", type=int, default=352)
    ap.add_argument("--height", type=int, default=640)
    ap.add_argument("--server", default="http://127.0.0.1:8188")
    ap.add_argument("--output", type=Path, default=ROOT / "renders" / "wan22_layla_preview.mp4")
    ap.add_argument("--execute", action="store_true", help="Actually spend available GPU time")
    args = ap.parse_args()
    plan = prepare(args.shot, args.actor, args.reference, frames=args.frames,
                   width=args.width, height=args.height)
    print(json.dumps({k: v for k, v in plan.items() if k not in {"graph", "shot"}},
                     ensure_ascii=False, indent=2))
    print("Original shot dialogue is NOT synthesized by this script.")
    if not args.execute:
        print("DRY RUN; no GPU time used. Add --execute once models are installed.")
        return
    run_task(plan, args.server, args.output)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, TimeoutError) as err:
        print(f"FAILED: {err}", file=sys.stderr)
        sys.exit(1)
