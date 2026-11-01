#!/usr/bin/env python3
"""Assemble lipsynced videos + precisely assigned Arabic dialogue, never silence in place of dialogue.

Inputs:
  scenes/episode-01/scene-001.json
  renders/episode-01/clips/sh01.mp4 ... sh16.mp4
  renders/episode-01/voices/sh03.wav ... (all 9 talking shots)
FFmpeg is required. This tool does NOT create voices, mouth motion, or visual video.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def probe(path):
    obj = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
                          "format=duration:stream=codec_type,width,height",
                          "-of", "json", str(path)]).stdout)
    return float(obj.get("format", {}).get("duration") or 0), obj.get("streams", [])


def prepare(scene_path, clips_dir, voices_dir):
    scene = json.loads(scene_path.read_text(encoding="utf-8"))
    shots = scene["shots"]
    problems, jobs = [], []
    cursor = 0
    for s in shots:
        sid = s["shot_id"]
        start, end = s["start_seconds"], s["end_seconds"]
        if start != cursor or end <= start or s["duration_seconds"] != end - start:
            problems.append(f"{sid}: gap, overlap, or wrong shot duration")
        cursor = end
        clip = clips_dir / f"{sid}.mp4"
        voice = None
        if s.get("speaker"):
            if s["speaker"] not in {"LAYLA", "WIDAD", "SABER"} or not s.get("dialogue_ar"):
                problems.append(f"{sid}: invalid dialogue/speaker")
            choices = [voices_dir / (sid + ext) for ext in (".wav", ".mp3", ".m4a", ".flac")]
            found = [p for p in choices if p.is_file()]
            if len(found) != 1:
                problems.append(f"{sid}: must provide exactly one corresponding voice audio file")
            else:
                voice = found[0]
        if not clip.is_file():
            problems.append(f"{sid}: missing video {clip}")
        else:
            try:
                duration, streams = probe(clip)
                if not any(x.get("codec_type") == "video" for x in streams):
                    problems.append(f"{sid}: not a video")
                if duration < end - start - 0.1:
                    problems.append(f"{sid}: video too short ({duration:.2f}s)")
            except (subprocess.CalledProcessError, ValueError) as err:
                problems.append(f"{sid}: cannot read video: {err}")
        if voice:
            try:
                duration, streams = probe(voice)
                if not any(x.get("codec_type") == "audio" for x in streams) or duration < 0.25:
                    problems.append(f"{sid}: missing or empty voice")
                if duration > end - start + 0.1:
                    problems.append(f"{sid}: voice too long ({duration:.2f}s); revise timing rather than truncate words")
            except (subprocess.CalledProcessError, ValueError) as err:
                problems.append(f"{sid}: cannot read voice: {err}")
        jobs.append((s, clip, voice))
    if cursor != 60 or len(shots) != 16:
        problems.append(f"expect 60s/16 shots, found {cursor}s/{len(shots)} shots")
    return jobs, problems


def assemble(jobs, destination, width=1080, height=1920, fps=24):
    with tempfile.TemporaryDirectory(prefix="404-final-") as tmp:
        work = Path(tmp)
        segments = []
        for shot, clip, speech in jobs:
            duration = shot["duration_seconds"]
            output = work / f"{shot['shot_id']}.mp4"
            audio = (["-i", str(speech)] if speech else [
                "-f", "lavfi", "-t", str(duration), "-i", "anullsrc=r=48000:cl=stereo"])
            filters = (
                f"[0:v]fps={fps},scale={width}:{height}:force_original_aspect_ratio=increase,"
                f"crop={width}:{height},setsar=1,trim=duration={duration},setpts=PTS-STARTPTS[v];"
                f"[1:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:"
                f"channel_layouts=stereo,apad,atrim=duration={duration},asetpts=PTS-STARTPTS[a]"
            )
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                 "-i", str(clip), *audio, "-filter_complex", filters,
                 "-map", "[v]", "-map", "[a]", "-t", str(duration),
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                 "-pix_fmt", "yuv420p", "-r", str(fps),
                 "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
                 "-movflags", "+faststart", str(output)])
            segments.append(output)
        manifest = work / "concat.txt"
        manifest.write_text("".join(f"file '{p.name}'\n" for p in segments), encoding="utf-8")
        destination.parent.mkdir(parents=True, exist_ok=True)
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat",
             "-safe", "0", "-i", str(manifest), "-c", "copy", "-movflags",
             "+faststart", str(destination)])
        duration, streams = probe(destination)
        if abs(duration - 60) > 0.25 or not any(x.get("codec_type") == "audio" for x in streams):
            destination.unlink(missing_ok=True)
            raise RuntimeError(f"Output duration/audio QC failed: {duration:.3f}s")
    return destination


def main():
    parser = argparse.ArgumentParser(description="Build a 60s 404 episode only with complete visual + audio assets")
    parser.add_argument("--scene", type=Path, default=Path("scenes/episode-01/scene-001.json"))
    parser.add_argument("--clips-dir", type=Path, default=Path("renders/episode-01/clips"))
    parser.add_argument("--voices-dir", type=Path, default=Path("renders/episode-01/voices"))
    parser.add_argument("--output", type=Path, default=Path("renders/episode-01/final/404_e01_the_window_9x16.mp4"))
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        parser.error("Install FFmpeg and ffprobe")
    jobs, issues = prepare(args.scene, args.clips_dir, args.voices_dir)
    if issues:
        parser.exit(1, "Episode not complete:\n" + "\n".join(f"- {item}" for item in issues) + "\n")
    if args.check_only:
        print("All 16 clips and 9 voice tracks present; visual and lip-sync review still required.")
    else:
        print(f"Built: {assemble(jobs, args.output)}")


if __name__ == "__main__":
    main()
