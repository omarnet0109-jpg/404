#!/usr/bin/env python3
"""Generate exactly the approved Egyptian-Arabic lines through ElevenLabs.

Refuses to charge a provider until --execute is explicitly supplied and
all three distinct voice IDs are configured. Does not fake Egyptian accents.
No voice models/IDs are invented or inferred.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
TIMELINE = ROOT / "audio" / "episode-01-dialogue.json"
MODEL = "eleven_multilingual_v2"
API = "https://api.elevenlabs.io/v1/text-to-speech"
EXPECTED_VOICE_NAMES = {"LAYLA", "WIDAD", "SABER"}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def plan(config: dict, timeline: dict) -> list[dict]:
    voices = config.get("voices", {})
    if set(voices) != EXPECTED_VOICE_NAMES:
        raise ValueError("Configure exactly LAYLA, WIDAD, SABER voice IDs.")
    ids = [voices[x] for x in ("LAYLA", "WIDAD", "SABER")]
    if any(not isinstance(v, str) or not re.fullmatch(r"[a-zA-Z0-9]{8,128}", v) for v in ids):
        raise ValueError("Three valid ElevenLabs voice IDs are required; never use placeholder voices.")
    if len(set(ids)) != 3:
        raise ValueError("Three different voices are required.")
    if not config.get("voices_previewed_and_approved", False):
        raise ValueError("Preview and approve all three natural Egyptian accent voices first.")
    lines = timeline["dialogue_only"]
    jobs = []
    for line in lines:
        speaker = line["speaker"]
        if speaker not in voices or not line["text"].strip():
            raise ValueError("Invalid speaker or missing dialogue.")
        if line["end"] - line["start"] <= 0:
            raise ValueError("Invalid shot interval")
        jobs.append({
            "shot_id": line["shot_id"], "speaker": speaker,
            "voice_id": voices[speaker], "text": line["text"],
            "max_seconds": line["end"]-line["start"]
        })
    if len(jobs) != 9 or timeline["total_seconds"] != 60 or timeline["locale"] != "ar-EG":
        raise ValueError("Invalid episode timeline; expected nine Egyptian Arabic lines in 60s.")
    return jobs


def generate(job: dict, api_key: str, dest: Path) -> float:
    payload = {
        "text": job["text"],
        "model_id": MODEL,
        "voice_settings": {"stability": 0.55, "similarity_boost": 0.8}
    }
    req = Request(
        f"{API}/{job['voice_id']}?output_format=mp3_44100_128",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST")
    try:
        with urlopen(req, timeout=90) as response:
            data = response.read()
    except HTTPError as error:
        raise RuntimeError(f"TTS failed ({error.code}) for {job['shot_id']}; check credits and permissions") from error
    except URLError as error:
        raise RuntimeError(f"TTS connection failed for {job['shot_id']}") from error
    if len(data) < 500 or data[:1] == b"{":
        raise RuntimeError(f"Invalid audio returned for {job['shot_id']}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    if not shutil_which("ffprobe"):
        raise RuntimeError("ffprobe required for audio duration validation")
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(dest)
    ], check=True, capture_output=True, text=True)
    seconds = float(result.stdout.strip())
    if seconds > job["max_seconds"] + .10:
        raise RuntimeError(f"{job['shot_id']} generated {seconds:.2f}s, exceeds shot's {job['max_seconds']}s; requires speech pacing revision.")
    return seconds


def shutil_which(command: str) -> str | None:
    from shutil import which
    return which(command)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices", type=Path, default=ROOT / "config" / "voices.json")
    ap.add_argument("--outdir", type=Path, default=ROOT / "renders" / "episode-01" / "voices")
    ap.add_argument("--execute", action="store_true", help="Use provider credits to create speech.")
    args = ap.parse_args()
    if not args.voices.exists():
        ap.exit(2, f"Voice IDs not configured. Copy config/voices.example.json to {args.voices} and approve accents.\n")
    jobs = plan(load(args.voices), load(TIMELINE))
    print(json.dumps({"model": MODEL, "lines": jobs, "execution": args.execute}, ensure_ascii=False, indent=2))
    if not args.execute:
        print("Dry-run only. No credits used.")
        return
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        ap.exit(2, "Missing ELEVENLABS_API_KEY environment variable. Do not put keys in GitHub.\n")
    for job in jobs:
        out = args.outdir / f"{job['shot_id']}.mp3"
        if out.exists():
            raise RuntimeError(f"Refusing to overwrite existing approved audio {out}")
        print(f"Generating {job['shot_id']} with voice {job['speaker']}", flush=True)
        duration = generate(job, key, out)
        print(f"Saved {out} ({duration:.2f}s)")
    print("Audio files generated. Manual native ar-EG pronunciation approval remains required.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, subprocess.CalledProcessError, OSError) as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
