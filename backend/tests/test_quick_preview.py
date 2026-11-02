"""Fast mobile storyboard preview must stay usable without a GPU or notebook."""
from pathlib import Path
from unittest import TestCase

ROOT=Path(__file__).resolve().parents[2]
SITE=ROOT/"mobile-studio"

class QuickMobilePreviewTests(TestCase):
    def test_separate_lightweight_page_is_linked_from_app(self):
        html=(SITE/"studio-advanced.html").read_text(encoding="utf-8")
        quick=(SITE/"quick-preview.html").read_text(encoding="utf-8")
        self.assertIn('href="./quick-preview.html"',html)
        self.assertIn('id="screen"',quick)
        self.assertIn('id="play"',quick)
        self.assertIn('id="timeline"',quick)
        self.assertIn('id="exportPreview"',quick)
        self.assertIn('src="./quick-preview.js"',quick)
        self.assertNotIn("fonts.googleapis.com",quick)

    def test_preview_uses_real_scene_timing_and_clear_not_ai_label(self):
        source=(SITE/"quick-preview.js").read_text(encoding="utf-8")
        self.assertIn('fetch("./data/scene.json"',source)
        self.assertIn('shots.length!==16',source)
        self.assertIn('duration_seconds,0)!==60',source)
        self.assertIn("معاينة مرسومة فقط",source)
        self.assertIn("scene",source)

    def test_real_webm_export_but_no_fake_ai_output(self):
        code=(SITE/"quick-preview.js").read_text(encoding="utf-8")
        self.assertIn("canvas.captureStream(15)",code)
        self.assertIn("new MediaRecorder(stream",code)
        self.assertIn("404-storyboard-preview-5s.webm",code)
        self.assertIn("speech.split(/\\s+/)",code)
        self.assertIn("5",code)

    def test_offline_cached_and_external_font_removed(self):
        worker=(SITE/"sw.js").read_text(encoding="utf-8")
        self.assertIn("caches.match(event.request)",worker)
        self.assertNotIn('"./quick-preview.html"',worker)
        self.assertNotIn('"./quick-preview.js"',worker)
        css=(SITE/"app.css").read_text(encoding="utf-8")
        self.assertNotIn("@import",css)
