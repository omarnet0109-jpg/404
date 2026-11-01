#!/usr/bin/env python3
"""404 production studio: validate scenes, build shot manifests, render via ComfyUI."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv"}


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def validate_scene(scene: dict) -> None:
    if not isinstance(scene, dict):
        raise ValueError("Scene must be a JSON object")
    scene_id = scene.get("scene_id")
    if not isinstance(scene_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]+", scene_id):
        raise ValueError("scene_id must contain only English letters, numbers, _ or -")
    if not isinstance(scene.get("description_ar"), str) or not scene["description_ar"].strip():
        raise ValueError("description_ar is required")
    shots = scene.get("shots")
    if not isinstance(shots, list) or not shots:
        raise ValueError("shots must be a nonempty array")
    seen = set()
    for index, shot in enumerate(shots, start=1):
        if not isinstance(shot, dict):
            raise ValueError(f"Shot {index} must be an object")
        shot_id = shot.get("shot_id")
        if not isinstance(shot_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]+", shot_id):
            raise ValueError(f"Shot {index} has an invalid shot_id")
        if shot_id in seen:
            raise ValueError(f"Duplicate shot_id: {shot_id}")
        seen.add(shot_id)
        if not isinstance(shot.get("prompt_en"), str) or not shot["prompt_en"].strip():
            raise ValueError(f"{shot_id}: prompt_en is required")
        duration = shot.get("duration_seconds")
        if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not 0 < duration <= 30:
            raise ValueError(f"{shot_id}: duration_seconds must be >0 and <=30")
        if "seed" in shot and (isinstance(shot["seed"], bool) or not isinstance(shot["seed"], int) or shot["seed"] < 0):
            raise ValueError(f"{shot_id}: seed must be a nonnegative integer")


def load_scene(path: Path) -> dict:
    scene = read_json(path)
    validate_scene(scene)
    return scene


def deterministic_seed(scene_id: str, shot_id: str) -> int:
    value = hashlib.sha256(f"{scene_id}/{shot_id}".encode()).digest()
    return int.from_bytes(value[:4], "big")


def make_plan(scene: dict, settings: dict) -> dict:
    validate_scene(scene)
    video = settings["video"]
    fps = int(video["fps"])
    width, height = int(video["width"]), int(video["height"])
    if min(fps, width, height) <= 0:
        raise ValueError("video width, height and fps must be positive")
    style = str(settings.get("visual_style", "")).strip()
    refs = str(scene.get("character_reference_notes", "")).strip()
    shot_plans = []
    for shot in scene["shots"]:
        prompt = " ".join(part for part in (style, shot["prompt_en"].strip(), refs) if part)
        shot_plans.append({
            "shot_id": shot["shot_id"],
            "description_ar": shot.get("description_ar", ""),
            "prompt": prompt,
            "negative_prompt": shot.get("negative_prompt", ""),
            "duration_seconds": shot["duration_seconds"],
            "frames": max(1, round(shot["duration_seconds"] * fps)),
            "seed": shot.get("seed", deterministic_seed(scene["scene_id"], shot["shot_id"])),
            "width": width,
            "height": height,
        })
    return {
        "series": settings.get("title", "404"),
        "scene_id": scene["scene_id"],
        "episode": scene.get("episode"),
        "title_ar": scene.get("title_ar", ""),
        "shots": shot_plans,
    }


def save_plan(scene_path: Path, output_root: Path = ROOT / "build") -> tuple[dict, Path]:
    scene = load_scene(scene_path)
    plan = make_plan(scene, read_json(ROOT / "series.json"))
    output_dir = output_root / scene["scene_id"]
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = output_dir / "manifest.json"
    manifest.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return plan, manifest


def inject_workflow(template: dict, shot: dict) -> dict:
    substitutions = {
        "{{PROMPT}}": shot["prompt"],
        "{{NEGATIVE_PROMPT}}": shot["negative_prompt"],
        "{{WIDTH}}": shot["width"],
        "{{HEIGHT}}": shot["height"],
        "{{FRAMES}}": shot["frames"],
        "{{SEED}}": shot["seed"],
    }
    if "{{PROMPT}}" not in json.dumps(template):
        raise ValueError("ComfyUI API workflow must contain {{PROMPT}}")

    def replace(value):
        if isinstance(value, dict):
            return {key: replace(inner) for key, inner in value.items()}
        if isinstance(value, list):
            return [replace(inner) for inner in value]
        if isinstance(value, str):
            if value in substitutions:
                return substitutions[value]
            for token, replacement in substitutions.items():
                value = value.replace(token, str(replacement))
        return value

    return replace(template)


def comfy_request(base_url: str, route: str, payload: dict | None = None) -> dict:
    url = base_url.rstrip("/") + route
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(url, data=body, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=60) as response:
        return json.load(response)


def download_output(base_url: str, item: dict, destination: Path) -> Path:
    filename = Path(str(item["filename"])).name
    query = urlencode({
        "filename": item["filename"],
        "subfolder": item.get("subfolder", ""),
        "type": item.get("type", "output"),
    })
    request = Request(base_url.rstrip("/") + "/view?" + query)
    with urlopen(request, timeout=180) as response:
        data = response.read()
    if not data:
        raise RuntimeError(f"Empty file returned for {filename}")
    destination.write_bytes(data)
    return destination


def render_scene(scene_path: Path, workflow_path: Path, base_url: str, timeout_seconds: int) -> list[Path]:
    plan, manifest = save_plan(scene_path)
    workflow = read_json(workflow_path)
    produced = []
    for shot in plan["shots"]:
        shot_dir = manifest.parent / shot["shot_id"]
        shot_dir.mkdir(exist_ok=True)
        request_body = {"prompt": inject_workflow(workflow, shot)}
        response = comfy_request(base_url, "/prompt", request_body)
        prompt_id = response.get("prompt_id")
        if not prompt_id:
            raise RuntimeError(f"{shot['shot_id']}: ComfyUI did not return a prompt_id: {response}")
        print(f"Queued {shot['shot_id']} as {prompt_id}", flush=True)
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            history = comfy_request(base_url, f"/history/{prompt_id}")
            task = history.get(prompt_id)
            if task:
                status = task.get("status", {}).get("status_str")
                if status == "error":
                    raise RuntimeError(f"{shot['shot_id']}: ComfyUI reported an error")
                if status != "success":
                    time.sleep(3)
                    continue
                videos = []
                for output in task.get("outputs", {}).values():
                    for group in ("videos", "gifs", "animations"):
                        for item in output.get(group, []):
                            if Path(str(item.get("filename", ""))).suffix.lower() in VIDEO_EXTENSIONS:
                                videos.append(item)
                if not videos:
                    raise RuntimeError(
                        f"{shot['shot_id']}: no video files in completed ComfyUI output. "
                        "Configure the workflow to export MP4/WebM/MOV."
                    )
                for index, item in enumerate(videos, start=1):
                    extension = Path(item["filename"]).suffix.lower()
                    target = shot_dir / f"{shot['shot_id']}-{index}{extension}"
                    produced.append(download_output(base_url, item, target))
                print(f"Saved {shot['shot_id']}: {len(videos)} video(s)", flush=True)
                break
            time.sleep(3)
        else:
            raise TimeoutError(f"{shot['shot_id']} exceeded {timeout_seconds} seconds")
    return produced


def main() -> None:
    parser = argparse.ArgumentParser(description="404 AI series production studio")
    sub = parser.add_subparsers(dest="command", required=True)
    validate = sub.add_parser("validate", help="Validate one scene JSON")
    validate.add_argument("scene", type=Path)
    plan = sub.add_parser("plan", help="Create a production manifest")
    plan.add_argument("scene", type=Path)
    sub.add_parser("validate-scenes", help="Validate all approved scenes in scenes/")
    render = sub.add_parser("render", help="Queue shots into a running ComfyUI video workflow")
    render.add_argument("scene", type=Path)
    render.add_argument("--workflow", type=Path, required=True)
    render.add_argument("--url", default=os.getenv("COMFYUI_URL", "http://127.0.0.1:8188"))
    render.add_argument("--timeout-seconds", type=int, default=1800)
    args = parser.parse_args()
    try:
        if args.command == "validate":
            scene = load_scene(args.scene)
            print(f"Valid: {scene['scene_id']} ({len(scene['shots'])} shot(s))")
        elif args.command == "plan":
            production_plan, path = save_plan(args.scene)
            print(f"Planned {len(production_plan['shots'])} shot(s): {path}")
        elif args.command == "validate-scenes":
            paths = sorted((ROOT / "scenes").rglob("*.json")) if (ROOT / "scenes").exists() else []
            for path in paths:
                load_scene(path)
                print(f"Valid: {path.relative_to(ROOT)}")
            print(f"Checked {len(paths)} production scene(s)")
        elif args.command == "render":
            files = render_scene(args.scene, args.workflow, args.url, args.timeout_seconds)
            print(f"Rendered {len(files)} video file(s)")
    except (ValueError, FileNotFoundError, KeyError, TimeoutError, RuntimeError) as exc:
        parser.exit(1, f"ERROR: {exc}\n")


if __name__ == "__main__":
    main()
