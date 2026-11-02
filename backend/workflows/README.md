# ComfyUI workflow — an actual exported video graph is required

The repository includes `wan22_ti2v_5b_api.json`, derived from ComfyUI's official native Wan 2.2 TI2V 5B template. After installing and testing the three model files listed below, copy it to `video_api.json` on the private GPU server. The bridge deliberately does not activate the example automatically.

```bash
cp backend/workflows/wan22_ti2v_5b_api.json backend/workflows/video_api.json
```

Required files: `wan2.2_ti2v_5B_fp16.safetensors` in `models/diffusion_models/`, `umt5_xxl_fp8_e4m3fn_scaled.safetensors` in `models/text_encoders/`, and `wan2.2_vae.safetensors` in `models/vae/`. ComfyUI's official guide says native offloading can fit the 5B workflow on 8 GB VRAM, but free GPU availability and runtime length are not guaranteed.

For another model, export a WORKING API format workflow from ComfyUI with a LoadImage input, prompt/negative prompt text inputs, correct checkpoints, and a SaveVideo/VideoCombine output, then save it as `video_api.json`.

Replace the following *literal input values* in that exported JSON, preserving node IDs and connections:
- positive prompt text: `{{PROMPT}}`
- LoadImage filename: `{{REFERENCE_IMAGE}}`
- negative prompt if connected: `{{NEGATIVE_PROMPT}}`
- seed (integer): `{{SEED}}`
- frame count (integer): `{{FRAMES}}`
- width/height (integers): `{{WIDTH}}`, `{{HEIGHT}}`

The backend validates API format, placeholders, a video output node, installed ComfyUI node classes, and model filenames before enabling the mobile render button. Those checks do not prove visual quality; the graph still needs a real GPU render.

**Important**: Output must include a saved MP4/WebM/MOV file in the ComfyUI history output, not only preview images. The server rejects a completed job with no video.

Keep ComfyUI private on 127.0.0.1:8188 or within a trusted private network. Never expose the raw ComfyUI HTTP server directly to the internet.
