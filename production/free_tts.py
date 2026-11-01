#!/usr/bin/env python3
"""Free, open-weight Egyptian Arabic speech for 404 using VoiceTut-TTS.

Uses the creator's EXACT nine dialogue lines. Does not silently shorten text,
replace speech with music, or change speakers. Requires a local/cloud Python
runtime (GPU recommended); no paid API key. First preview each voice,
then mark approved in config/free_voices.json before making the episode audio.

Install (GPU runtime recommended):
    pip install git+https://github.com/k2-fsa/OmniVoice.git
    pip install voicetut-tts

Run:
    python production/free_tts.py --preview
    python production/free_tts.py --episode

Important: VoiceTut repo advertises Egyptian Arabic, but actor AGE and accent
must be auditioned. The voice selections here are PROVISIONAL.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
DIALOGUE=ROOT/"audio"/"episode-01-dialogue.json"
CONFIG=ROOT/"config"/"free_voices.json"
OUTPUT=ROOT/"renders"/"episode-01"/"voices"
PREVIEWS=ROOT/"renders"/"episode-01"/"voice_previews"
ACTORS=("LAYLA","WIDAD","SABER")
KNOWN_VOICES={
    "Ahmed","Ali","Hassan","Karim","Mahmoud","Mohammed",
    "Mostafa","Ramy","Shaker","Tareq","Yehia","Youssef",
    "Hadeer","Hanan","Mariam","Rana","Sarah","Yasmin","Yara"
}
PREVIEW_LINE={"LAYLA":"طب وإيه حكاية الورقة دي؟",
              "WIDAD":"يا صابر! بلاش العند ده!",
              "SABER":"الخرايط مش بتعرف كل حاجة يا بنتي."}

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def validate_config(config, require_approval):
    voices=config.get("voices", {})
    if set(voices)!=set(ACTORS) or any(voice not in KNOWN_VOICES for voice in voices.values()):
        raise ValueError("Choose one built-in VoiceTut voice for each of LAYLA, WIDAD, SABER.")
    if len(set(voices.values()))!=3:
        raise ValueError("Each character must have a distinct voice.")
    if require_approval and config.get("voices_previewed_and_approved") is not True:
        raise ValueError("Listen to voice previews then approve three voices in config/free_voices.json")
    return voices

def audio_seconds(file):
    p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                      "-of","default=noprint_wrappers=1:nokey=1",str(file)],
                     check=True,capture_output=True,text=True)
    return float(p.stdout.strip())

def synthesize(tts, text, speaker, output):
    output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():
        raise FileExistsError(f"Existing audio is protected: {output}")
    tts.synthesize(text,speaker=speaker,output=str(output))
    if not output.is_file():
        raise RuntimeError(f"Audio not created: {output}")
    return audio_seconds(output)

def main():
    parser=argparse.ArgumentParser(description="Free Egyptian voice producer for 404")
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preview",action="store_true",help="Generate one demo sentence per actor.")
    group.add_argument("--episode",action="store_true",help="Generate all nine approved lines.")
    args=parser.parse_args()
    config=read(CONFIG)
    voices=validate_config(config,args.episode)
    timeline=read(DIALOGUE)
    if timeline.get("locale")!="ar-EG" or len(timeline.get("dialogue_only",[]))!=9:
        raise ValueError("Approved Arabic dialogue timeline has changed.")
    try:
        from voicetut_tts import VoiceTutTTS
    except ImportError as exc:
        raise RuntimeError("Install the VoiceTut-TTS and OmniVoice dependencies first.") from exc
    tts=VoiceTutTTS.from_pretrained("mohammedaly22/VoiceTut-TTS")
    if args.preview:
        for actor in ACTORS:
            output=PREVIEWS/f"{actor.lower()}.wav"
            duration=synthesize(tts,PREVIEW_LINE[actor],voices[actor],output)
            print(f"Preview {actor} [{voices[actor]}]: {output} ({duration:.2f} s)")
        print("Voice age, timbre and authentic Egyptian accent need a listening review.")
        return
    for line in timeline["dialogue_only"]:
        actor=line["speaker"]
        if actor not in ACTORS:
            raise ValueError("A fourth actor is forbidden.")
        output=OUTPUT/f"{line['shot_id']}.wav"
        duration=synthesize(tts,line["text"],voices[actor],output)
        window=line["end"]-line["start"]
        if duration>window+0.1:
            raise RuntimeError(f"{line['shot_id']} duration {duration:.2f}s exceeds allotted {window}s. Keep full words; reschedule a shot and regenerate.")
        print(f"Audio {line['shot_id']} ({actor}): {duration:.2f}/{window}s, {output}")
    print("9 speech files generated. NEXT: lipsync/animation and human QC; not a final video.")

if __name__=="__main__":
    try:
        main()
    except (ValueError,RuntimeError,FileExistsError,subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}",file=sys.stderr)
        sys.exit(1)
