"""Mobile performance and offline safeguards, no device/GPU required."""
from pathlib import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
PWA = ROOT / "mobile-studio"


class MobilePerformanceTests(TestCase):
    def test_static_asset_bundle_is_small(self):
        # No multi-GB AI model or bundled video should enter the mobile app.
        names = ["index.html","app.css","app.js","quick-preview.html","quick-preview.js","sw.js"]
        total = sum((PWA/name).stat().st_size for name in names)
        self.assertLess(total, 170_000, "PWA static code grew too heavy for low-end mobile devices")
        for suffix in ("safetensors","ckpt","mp4"):
            self.assertFalse(list(PWA.rglob("*."+suffix)))

    def test_cached_static_loads_without_waiting_for_network(self):
        sw = (PWA/"sw.js").read_text(encoding="utf-8")
        self.assertIn('const CACHE = "404-studio-v9"',sw)
        self.assertIn("caches.match(event.request)",sw)
        self.assertIn("if (cached)",sw)
        self.assertIn("return cached",sw)
        self.assertIn("event.waitUntil(update.catch",sw)
        self.assertIn('url.pathname.includes("/api/")',sw)

    def test_quick_preview_caps_frames_to_reduce_phone_cpu(self):
        js=(PWA/"quick-preview.js").read_text(encoding="utf-8")
        self.assertIn("now-lastPaint>=1000/24",js)
        self.assertIn("requestAnimationFrame(loop)",js)

    def test_colab_is_optional_not_main_production_button(self):
        html=(PWA/"index.html").read_text(encoding="utf-8")
        self.assertIn('href="./quick-preview.html"',html)
        self.assertIn("Colab (اختياري للمطورين)",html)
        self.assertIn("مش فيديو AI",html)

