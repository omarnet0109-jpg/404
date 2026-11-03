"""Mobile performance and offline safeguards, no device/GPU required."""
from pathlib import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
PWA = ROOT / "mobile-studio"


class MobilePerformanceTests(TestCase):
    def test_static_asset_bundle_is_small(self):
        # No multi-GB AI model or bundled video should enter the mobile app.
        names = ["index.html","simple.css","simple.js","simple-characters.js","voice-identities.js","ai-speakers.js","media-vault.js","sw.js"]
        total = sum((PWA/name).stat().st_size for name in names)
        self.assertLess(total, 50_000, "PWA static code grew too heavy for low-end mobile devices")
        for suffix in ("safetensors","ckpt","mp4"):
            self.assertFalse(list(PWA.rglob("*."+suffix)))

    def test_cached_static_loads_without_waiting_for_network(self):
        sw = (PWA/"sw.js").read_text(encoding="utf-8")
        self.assertIn('const CACHE = "404-studio-v21"',sw)
        self.assertIn("caches.match(event.request)",sw)
        self.assertIn("if (cached)",sw)
        self.assertIn("return cached",sw)
        self.assertIn("event.waitUntil(update.catch",sw)
        self.assertIn('url.pathname.includes("/api/")',sw)

    def test_free_gpu_is_public_opt_in_and_no_paid_key(self):
        html = (PWA/"free-gpu.html").read_text(encoding="utf-8")
        js = (PWA/"free-gpu.js").read_text(encoding="utf-8")
        self.assertIn("huggingface.co/spaces/zerogpu-aoti/wan2-2-fp8da-aoti-faster", html)
        self.assertIn('id="consent"', html)
        self.assertIn('if(!$("consent").checked)', js)
        self.assertIn('handle_file(file)', js)
        self.assertIn('app.submit("/generate_video",args)', js)
        self.assertIn('const ID="zerogpu-aoti/wan2-2-fp8da-aoti-faster"', js)
        self.assertNotIn("hf_abcdefghijkl", js)
        self.assertIn("مش سيرفر مملوك", html)

    def test_main_application_links_to_free_gpu(self):
        html = (PWA/"index.html").read_text(encoding="utf-8")
        self.assertIn('id="generateVideo"', html)
        self.assertIn('href="./free-gpu.html"', (PWA/"studio-advanced.html").read_text(encoding="utf-8"))
        sw = (PWA/"sw.js").read_text(encoding="utf-8")
        self.assertIn('"./simple.js"', sw)
        self.assertIn('"./simple-characters.js"', sw)
        self.assertNotIn('"./free-gpu.html"', sw)

    def test_quick_preview_caps_frames_to_reduce_phone_cpu(self):
        js=(PWA/"quick-preview.js").read_text(encoding="utf-8")
        self.assertIn("now-lastPaint>=1000/24",js)
        self.assertIn("requestAnimationFrame(loop)",js)

    def test_colab_is_optional_not_main_production_button(self):
        html=(PWA/"studio-advanced.html").read_text(encoding="utf-8")
        self.assertIn('href="./quick-preview.html"',html)
        self.assertIn("Colab (اختياري للمطورين)",html)
        self.assertIn("مش فيديو AI",html)

