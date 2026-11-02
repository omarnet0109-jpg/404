# 404 Studio — Free-first production architecture

## Decision (2026-11-02)
We will start on a no-subscription software stack, with a **paid provider extension point later**.
This is *not* a promise of free cloud GPU or cinematic 4K generation for free.

## Current free baseline (implemented)
| Component | Stack | What really works |
| --- | --- | --- |
| Mobile user interface | PWA, vanilla HTML/CSS/JS, GitHub Pages | Open from phone, storyboard edits, saved local drafts, character view |
| Story data | Episode/character JSON | 16 shots, nine Egyptian Arabic lines, immutable reference hashes |
| Security & API | FastAPI, SQLite, token auth | Image upload, workflow substitution, job queue and completed video download when GPU is connected |
| Engine | ComfyUI, open-source video model configured by owner | Not connected today; no GPU/model/checkpoint included |
| Preview/voice experiments | Mobile Colab notebook, VoiceTut-TTS | Notebook code prepared; voice demos not approved for commercial publication |
| Assembly | Python + FFmpeg | Real clips/audio required; never silently replaces spoken lines |

## What is currently **not done**
- No GPU provider connected, so there is **no real generated AI shot or finished 60-second episode**.
- No exported/tested ComfyUI Wan 2.2 video workflow or working checkpoint in the server.
- No integrated Egyptian speech + synchronized lip movement in PWA.
- No automatic 4K quality guarantee. Resolution upscaling is different from model detail.

## Engine choice
The backend uses `STUDIO_ENGINE_MODE=free-comfyui` by default.
`backend/engine_modes.py` lists a future `paid-cloud` profile **disabled**. Setting it in
environment variables intentionally throws an error. A later paid provider must implement
the interface, pass automated regression tests, and require explicit owner approval.
No paid keys or purchase links are included, and no billing or purchases happen automatically.

## Definition of success for first real render
1. Obtain an authorized GPU runtime (a local machine, an eligible free temporary service, or later a paid rental explicitly approved by owner).
2. Install ComfyUI + video model and export a tested API workflow.
3. Connect FastAPI over HTTPS (never expose raw port 8188), and upload the **exact** approved character photo.
4. Render **one 5–6 second portrait video** from the phone and check identity, background and camera motion.
5. Separately test native Egyptian dialogue and lip sync; don't accept the silent animatic as final.
6. Expand to all 16 shots and assemble only after acceptance of video + voice.

## Paid migration (future; not enabled)
- Keep the exact same mobile URL and scene format.
- Introduce a new cloud adapter behind the backend, not provider keys in the mobile client.
- Set explicit price ceilings / daily spend limits and show per-job estimates **before** the user's approval.
- Compare at least one free and one paid result using the same reference and prompt.
- No auto upgrade, no surprise billing, no mixing voices or replacement of the canon.

## Testable safety rules
- Every uploaded production image must hash-match the four canonical references.
- Nine dialogue lines and speaker assignments are invariant.
- Token authentication is mandatory for GPU work.
- `STUDIO_DAILY_JOB_LIMIT=12` provides a local usage bound; it does **not** calculate financial costs.
- The mobile UI should never claim a render succeeded unless ComfyUI history contains a real video file.

See [backend/engine_modes.py](../backend/engine_modes.py),
[backend/tests/test_engine_modes.py](../backend/tests/test_engine_modes.py),
[mobile-studio/README.md](../mobile-studio/README.md).
