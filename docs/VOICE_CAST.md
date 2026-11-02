# 404 Studio — Egyptian Voice Cast (technical contract)

## Starting point (2026-11-02)
The first AI video preview is silent. 404 Studio now has a mobile **Voice Lab** at
https://omarnet0109-jpg.github.io/404/mobile-studio/voice-studio.html

The app uses the public free-tier Hugging Face ZeroGPU
[mohammedaly22/VoiceTut-TTS](https://huggingface.co/spaces/mohammedaly22/VoiceTut-TTS)
via Gradio `/synthesize`. It is not an owned, always-on voice server; availability and queues vary.

The upstream Gradio implementation at
https://github.com/MohammedAly22/VoiceTuT-TTS/blob/main/voicetut_tts/server.py
specifies exactly 10 arguments:
`text, language, voice_mode, speaker, ref_audio, ref_text, num_step, guidance, speed, normalize`.

We call `["<original line>", "arz", "builtin" | "clone", <speaker>, <file or null>,
<reference transcript or empty>, 32, 2.0, 1.0, true]`.

## Identity lock

| Character | Permanent ID | Demo voice (trial only) | Licensed voice identity for publication |
| --- | --- | --- | --- |
| ليلى | `LAYLA` | `Yasmin` | Audition then lock a voice recording with explicit permitted use |
| الحاجة وداد | `WIDAD` | `Hanan` | Audition then lock a separate consented voice recording |
| عم صابر | `SABER` | `Shaker` | Audition then lock a separate consented voice recording |

Those three preset speaker names are provisional *trials only*, not approved production actors.
The user can audition alternate demo speakers per actor, and the choices stay on that
phone via localStorage.

For production use, choose **licensed recording**, upload a clear reference WAV/MP3,
type the exact transcript heard in it, affirm the voice owner's permission, then use
`🔒 حفظ وتثبيت صوت الشخصية`. The browser saves the reference in IndexedDB;
the profile records SHA-256, fixed character ID, model name and reference text.
Every new spoken sentence by that actor reuses the same reference. A mismatch aborts
generation rather than swapping speakers.

**Scope of guarantee:** canonical reference file / settings stay pinned, but the
neural voice may still vary in prosody, accent and speed, so the generated sound
must be auditioned. Model/version pinning to an owned server is the later production path.

**Backup:** the downloaded `404-character-voice-profiles.json` contains the profile
metadata, not the original reference recordings. The reference audio is private to
that browser's IndexedDB, subject to browser storage deletion and quota. Keep
original licensed WAV/MP3 backups outside the app.

## Permissions & publishing

The VoiceTut *model* is Apache-2.0, **but the author explicitly says its built-in
speaker voices are NOT cleared for commercial videos** (including monetized YouTube).
Use them strictly for local testing. Recording consent from a licensed actor or your
own voice is required for any commercial release.

Source: https://github.com/MohammedAly22/VoiceTuT-TTS/issues/2

Only explicit generation via the user's button sends text or reference audio to the
third-party public HF Space. Local audition preferences and owned clips remain in
the browser until that point. Never upload private or third-party recordings
without the speaker's permission.

## Episode 01 synchronization

- Exact dialogue source: `audio/episode-01-dialogue.json` (9 speaker-locked lines).
- The lab keeps each line unchanged and always selects only that actor's voice.
- The lab warns if the WAV exceeds the assigned shot's dialogue window.
- Voice synthesis **does not animate lips** or automatically mux a video. Only
  after approved audio files exist can a dedicated media pipeline synchronize
  dialogue, perform lip-sync, and assemble the final MP4.

## Tests

- `node --check mobile-studio/voice-studio.js`
- `node --test mobile-studio/tests/voice-studio.test.cjs`
- GitHub Actions `.github/workflows/deploy-studio.yml` runs the tests.
- Final audio can only be claimed when a real WAV has been downloaded and listened to.
