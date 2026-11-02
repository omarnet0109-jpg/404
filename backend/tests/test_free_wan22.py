"""Offline checks for the free Wan 2.2 video tool, no GPU/network required."""
import hashlib
import json
from pathlib import Path
import tempfile
from unittest import TestCase
from unittest.mock import patch
import ast

from production import free_wan22 as wan

ROOT = Path(__file__).resolve().parents[2]

class WanFreeRunnerTests(TestCase):
    def setup_fake_original(self, base):
        original = Path(base) / "approved.png"
        original.write_bytes(b"\x89PNG\r\n\x1a\n404-original-test")
        bible = Path(base) / "bible.json"
        bible.write_text(json.dumps({"reference_images":[
            {"id":"LAYLA", "sha256":hashlib.sha256(original.read_bytes()).hexdigest()},
            {"id":"SABER", "sha256":"0"*64},
            {"id":"WIDAD", "sha256":"0"*64},
            {"id":"ensemble", "sha256":"0"*64}
        ]}),encoding="utf-8")
        return original, bible

    def test_canonical_reference_rejects_replaced_photo(self):
        with tempfile.TemporaryDirectory() as temp:
            original, bible = self.setup_fake_original(temp)
            with patch.object(wan, "BIBLE", bible):
                self.assertEqual(wan.canonical_reference(original, "LAYLA"),
                                 hashlib.sha256(original.read_bytes()).hexdigest())
                original.write_bytes(original.read_bytes()+b"modified")
                with self.assertRaisesRegex(ValueError, "not the exact approved"):
                    wan.canonical_reference(original, "LAYLA")

    def test_plan_respects_locked_speaker_and_video_graph(self):
        with tempfile.TemporaryDirectory() as temp:
            original, bible = self.setup_fake_original(temp)
            with patch.object(wan, "BIBLE", bible):
                p = wan.prepare("sh05", "LAYLA", original, frames=33, width=352, height=640)
                self.assertEqual(p["frames"],33)
                self.assertEqual(p["graph"]["55"]["inputs"]["width"],352)
                self.assertEqual(p["graph"]["55"]["inputs"]["length"],33)
                self.assertEqual(p["graph"]["56"]["inputs"]["image"],"TO_BE_UPLOADED")
                with self.assertRaisesRegex(ValueError, "needs the"):
                    wan.prepare("sh04", "LAYLA", original, frames=33,width=352,height=640)

    def test_invalid_video_frames_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            original, bible = self.setup_fake_original(temp)
            with patch.object(wan, "BIBLE", bible):
                with self.assertRaisesRegex(ValueError,"4n\+1"):
                    wan.prepare("sh05","LAYLA",original,frames=32,width=352,height=640)

    def test_comfyui_is_loopback_only(self):
        self.assertEqual(wan.validate_comfy_url("http://127.0.0.1:8188/"),
                         "http://127.0.0.1:8188")
        for url in ("https://public-server.example", "http://0.0.0.0:8188",
                    "http://192.168.1.10:8188"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                wan.validate_comfy_url(url)

    def test_mobile_studio_links_to_free_gpu_lab_with_local_review(self):
        html=(ROOT/"mobile-studio"/"index.html").read_text(encoding="utf-8")
        code=(ROOT/"mobile-studio"/"app.js").read_text(encoding="utf-8")
        self.assertIn("notebooks/404_wan22_free_video.ipynb",html)
        self.assertIn('id="localPreviewInput"',html)
        self.assertIn('id="localPreviewBox"',html)
        self.assertIn('$("localPreviewInput").addEventListener("change"',code)
        self.assertIn("URL.createObjectURL(file)",code)

    def test_free_colab_notebook_cells_compile_and_reference_valid_runner(self):
        notebook = json.loads((ROOT/"notebooks"/"404_wan22_free_video.ipynb").read_text(encoding="utf-8"))
        self.assertEqual(notebook["nbformat"],4)
        code = []
        for c in notebook["cells"]:
            if c["cell_type"]=="code":
                source="".join(c["source"])
                ast.parse(source)
                code.append(source)
        allcode="\n".join(code)
        self.assertIn("production/free_wan22.py",allcode)
        self.assertIn("--execute",allcode)
        self.assertIn("127.0.0.1",allcode)
        self.assertNotIn("cloudflared",allcode)
        self.assertNotIn("ngrok",allcode)

