# ComfyUI workflow — an actual exported video graph is required

Export a WORKING API format workflow from ComfyUI with a model such as Wan 2.2 TI2V (image to video), a LoadImage input, prompt/negative prompt text inputs, correct model checkpoints, and a SaveVideo/VideoCombine output.
Save the exported API JSON to `backend/workflows/video_api.json` ON THE PRIVATE SERVER. It is not included because checkpoint names and custom nodes vary between installations.

Replace the following *literal input values* in that exported JSON, preserving node IDs and connections:
- positive prompt text: `{{PROMPT}}`
- LoadImage filename: `{{REFERENCE_IMAGE}}`
- negative prompt if connected: `{{NEGATIVE_PROMPT}}`
- seed (integer): `{{SEED}}`
- frame count (integer): `{{FRAMES}}`
- width/height (integers): `{{WIDTH}}`, `{{HEIGHT}}`

The backend validates that PROMPT and REFERENCE_IMAGE are in the workflow and substitutes the other tokens when present. Those placeholders cannot generate a workflow from scratch; real video model files and nodes must be installed and the graph tested.

**Important**: Output must include a saved MP4/WebM/MOV file in the ComfyUI history output, not only preview images. The server rejects a completed job with no video.

Keep ComfyUI private on 127.0.0.1:8188 or within a trusted private network. Never expose the raw ComfyUI HTTP server directly to the internet.
