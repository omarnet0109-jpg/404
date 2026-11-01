#!/usr/bin/env python3
"""Static quality gate for the exact 60-second 'الشباك' storyboard.

This validates JSON metadata only. It does not establish actual generated-video
identity, voice authenticity, lip sync, or visual continuity; those require
separate inspection of the rendered media.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SCENE = ROOT / "scenes" / "episode-01" / "scene-001.json"
AUDIO = ROOT / "audio" / "episode-01-dialogue.json"
BIBLE = ROOT / "characters" / "character_bible.json"
SETTINGS = ROOT / "series.json"

EXPECTED = [
    ("sh03", 8, 14, "LAYLA", "أنا سألت على حي النخيل بره... كلهم قالولي مفيش حارة بالاسم ده!"),
    ("sh04", 14, 18, "SABER", "الخرايط مش بتعرف كل حاجة يا بنتي."),
    ("sh05", 18, 21, "LAYLA", "طب وإيه حكاية الورقة دي؟"),
    ("sh06", 21, 28, "WIDAD", "قانون الليلة... بعد الساعة 12، محدش يفتح شباك... مهما حصل."),
    ("sh07", 28, 32, "LAYLA", "ليه؟ هو فيه إيه؟"),
    ("sh08", 32, 39, "SABER", "أنا بفتح شباكي من أربعين سنة! هو النهارده هيتقفل ليه؟"),
    ("sh10", 43, 45, "WIDAD", "يا صابر! بلاش العند ده!"),
    ("sh14", 54, 57, "LAYLA", "هو فتح الشباك؟"),
    ("sh15", 57, 59, "WIDAD", "إحنا اتأخرنا..."),
]
VOICES = {"LAYLA": "layla_ar_eg", "WIDAD": "widad_ar_eg", "SABER": "saber_ar_eg"}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def check() -> dict:
    scene, audio, bible, settings = (load_json(path) for path in (SCENE, AUDIO, BIBLE, SETTINGS))
    shots = scene["shots"]
    assert scene["scene_id"] == "episode-01-scene-001"
    assert len(shots) == 16, f"Expected 16 shots, got {len(shots)}"
    assert scene["duration_seconds"] == 60
    assert scene["aspect_ratio"] == "9:16"
    assert scene["fps"] == 24
    assert settings["video"] == {"width": 1080, "height": 1920, "fps": 24, "aspect_ratio": "9:16"}
    assert set(bible["allowed_characters"]) == set(VOICES)
    assert len(bible["reference_images"]) == 4

    cursor = 0
    actual_speech = []
    for shot in shots:
        start, end = shot["start_seconds"], shot["end_seconds"]
        assert start == cursor, f"Gap or overlap before shot {shot['shot_id']}"
        assert end > start, f"Shot has zero or negative duration: {shot['shot_id']}"
        assert end <= 60
        assert shot["duration_seconds"] == end - start
        assert isinstance(shot["seed"], int) and shot["seed"] >= 0
        assert shot["camera_reference"] == "ensemble"
        assert "ensemble" in [x["id"] for x in bible["reference_images"]]
        assert set(shot["visual_references"]).issubset({x["id"] for x in bible["reference_images"]})
        speaker, dialogue, voice = shot["speaker"], shot["dialogue_ar"], shot["voice_id"]
        if speaker is None:
            assert dialogue == "" and voice is None, f"Silent shot has speech: {shot['shot_id']}"
        else:
            assert speaker in VOICES and voice == VOICES[speaker]
            assert dialogue.strip()
            assert speaker in shot["visual_references"], f"Speaker ref missing: {shot['shot_id']}"
            actual_speech.append((shot["shot_id"], start, end, speaker, dialogue))
        cursor = end
    assert cursor == 60, "Story does not reach exactly 60 seconds"
    assert actual_speech == EXPECTED, "Wrong character, time, or dialogue relative to approved script"

    audio_lines = [
        (line["shot_id"], line["start"], line["end"], line["speaker"], line["text"])
        for line in audio["dialogue_only"]
    ]
    assert audio["locale"] == "ar-EG" and audio["total_seconds"] == 60
    assert audio_lines == EXPECTED, "Audio timeline mismatches scene storyboard"
    assert audio["required_voice_profiles"].keys() == set(VOICES.values())
    for line in audio["dialogue_only"]:
        assert line["voice"] == VOICES[line["speaker"]]

    return {
        "scene": scene["scene_id"],
        "duration_seconds": cursor,
        "shots": len(shots),
        "dialogue_lines": len(actual_speech),
        "voice_ids": VOICES,
        "frames_at_24fps": 60 * 24,
        "static_check": "PASS",
        "rendered_video_verified": False,
        "facial_lip_sync_verified": False,
    }


if __name__ == "__main__":
    try:
        print(json.dumps(check(), ensure_ascii=False, indent=2))
    except (AssertionError, KeyError, ValueError, OSError) as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
