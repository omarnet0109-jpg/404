# 404 — Stable production pipeline (episode by episode)

## Why we do not generate all 60 seconds at once
16 shots with three locked actors and nine single-speaker Egyptian dialogue lines need independent visual, voice, lip-sync and edit checks. A one-shot model prompt is not a reliable way to guarantee precise cast identity, dialogue ownership, location continuity or lip sync.

## Locked sources
- Characters: `characters/character_bible.json`. Only LAYLA, WIDAD, SABER. Their clothes/faces, camera positions, environment and identity do not change.
- Approved episode: `scenes/episode-01/scene-001.json`. 16 consecutive shots, 60 seconds.
- Voices: `audio/episode-01-dialogue.json`. Exactly 9 lines; stable voice IDs; no overlaps.
- Visual reference files must be uploaded to the provider as real images, not merely described in prompts. Repository `assets/references/` is reserved but currently contains no image binaries.

## Tools (chosen, not yet connected)
1. **Runway** (source/reference frame images + short silent motion shots, character speech/face performance in Character Script to Video, or Act-Two when actual driving performance video exists). Runway Gen-4 References supports up to 3 references in one image generation; use the combined ensemble reference and the speaker reference when composing a shot. Do not assume Act-Two can take raw audio instead of a driving video; use Character Script to Video Audio mode for directly uploaded spoken audio.
2. **ElevenLabs**, or another voice provider with verified native Egyptian voices, for ONE fixed voice per character. *Arabic supported does not prove natural Egyptian dialect.* Preview sample lines before committing. If ElevenLabs does not produce acceptable Egyptian Arabic in tests, use a verified `ar-EG` voice provider such as Azure Speech and review differentiation of the two women.
3. **FFmpeg** for final composition and timing. No fake speech and no silent replacement of talking shots.
4. **GitHub** for source-of-truth scripts and automatic static validation. It is not a video compute platform.

## Order of operations for each episode
1. Approve unchanged characters/location and exact script/time windows.
2. Pick three voices after listening to a short same-voice sample each. Save voice ID, model and settings. Use EXACT line from the dialogue JSON, no inserted narration.
3. Generate one base reference frame per camera angle (use images and frame continuity), and verify set/wardrobe/characters.
4. Animate short non-speaking video shots from locked frames. For dialogue shots generate one speaking character per shot. Use uploaded matching Arabic audio in Character Script to Video or Act-Two workflow with a required driving performance video. Other cast members must keep mouths closed; use reaction shots or composites if the generator animates their mouths.
5. Verify EACH generated talking shot: correct voice, native dialect, synced mouth, appearance, one speaker only, stable background. Reject any failing shot rather than patching silently.
6. Put final approved clips as `renders/episode-01/clips/sh01.mp4` through `sh16.mp4`, and matching spoken line audio files as `renders/episode-01/voices/sh03.wav`, `sh04.wav`, etc. Only talking shots need voice audio.
7. `python production/check_episode.py`
8. `python production/assemble_episode.py --check-only` — refuses missing clips/audio or mismatched line duration.
9. `python production/assemble_episode.py` — exports one 1080x1920, 24fps MP4, 60 seconds. It uses the canonical separate line audio to prevent swapped speakers.
10. Final human QC on a real MP4: no visual swaps, audio matches text, mouths move correctly, 9:16 frame, black end, no subtitles, no new extras, sound effects appropriate. FFmpeg itself cannot prove lip sync/identity; manual video inspection is mandatory.

## Technical notes
- Provider native output may be 720x1280, upscale/render during final assembly to 1080x1920. Upscaling is not new detail.
- Do not try to fit long Egyptian sentences by chopping words: re-time dialogue shots within the total episode only with creator approval.
- Final dialogue timings are hard windows, but sound generation can run long. The composer rejects tracks exceeding a window.
- The current assembler intentionally excludes background effects unless rendered into a separate sound design mix. Add scene sound effects at controlled low volume after dialogue tracks pass review.
- Use the original owned/authorized voices and images only. Do not impersonate an identifiable person's voice without authorization.
- Keep API keys in each provider's secure connection or GitHub Secrets, never in repository source.
- Costs can rise with re-generations. Do not trigger paid generations or claim final delivery without successful provider connection, cost visibility and generation confirmation.

## Blockers as of now
- Runway not confirmed connected from ChatGPT.
- Egyptian voice provider not connected and three voice samples not approved.
- Original reference image bytes not yet uploaded to this GitHub repository or Runway account.
- No final 3D video or dialogue has been generated. The 60s animatic is timing-only.
