"""Regression checks: do not pretend a selected local image is ready to render."""
from pathlib import Path
from unittest import TestCase


ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "mobile-studio" / "index.html"
JS = ROOT / "mobile-studio" / "app.js"


class MobileEngineGateTests(TestCase):
    def test_user_is_not_asked_for_server_keys(self):
        html = HTML.read_text(encoding="utf-8")
        self.assertIn("مش مطلوب منك تكتب عنوان أو مفتاح", html)
        self.assertIn('<details class="panel" id="advancedServerSetup">', html)
        self.assertIn("فتح المشاهد الجاهزة", html)

    def test_unconnected_render_and_upload_are_disabled_by_default(self):
        html = HTML.read_text(encoding="utf-8")
        self.assertIn('id="renderButton" disabled', html)
        self.assertIn('id="uploadButton" disabled', html)
        self.assertIn("ComfyUI الخاص غير متصل", html)
        self.assertIn("توليد لقطة حقيقية على GPU مجانية عامة", html)

    def test_online_state_controls_both_actions(self):
        code = JS.read_text(encoding="utf-8")
        self.assertIn('engineReady=Boolean(online)', code)
        self.assertIn('$("uploadButton").disabled=!engineReady', code)
        self.assertIn('$("renderButton").disabled=!engineReady', code)
        self.assertIn('$("referenceFile").disabled=!engineReady', code)

    def test_frontend_uses_backend_video_readiness_contract(self):
        code = JS.read_text(encoding="utf-8")
        check = code.split("async function checkServer(){", 1)[1].split("async function upload(){", 1)[0]
        self.assertIn("data.video_ready", check)
        self.assertNotIn("data.comfyui_connected&&data.workflow_configured", check)

    def test_settings_status_updates_with_the_live_engine_state(self):
        html = HTML.read_text(encoding="utf-8")
        code = JS.read_text(encoding="utf-8")
        self.assertIn('id="simpleEngineTitle"', html)
        self.assertIn('id="simpleEngineMessage"', html)
        self.assertIn('$("simpleEngineTitle").textContent=', code)
        self.assertIn('$("simpleEngineMessage").textContent=', code)

    def test_no_server_is_checked_before_reference_upload(self):
        code = JS.read_text(encoding="utf-8")
        render = code.split("async function render(){", 1)[1].split("async function pollJob", 1)[0]
        self.assertLess(render.index("if(!engineReady)"), render.index("if(!ref)"))
        upload = code.split("async function upload(){", 1)[1].split("async function render(){", 1)[0]
        self.assertLess(upload.index("if(!engineReady)"), upload.index('const file=$("referenceFile")'))

    def test_ui_explains_gpu_is_external_and_free_is_not_guaranteed(self):
        html = HTML.read_text(encoding="utf-8")
        self.assertIn("ComfyUI", html)
        self.assertIn("GPU", html)
        self.assertIn("مش مطلوب منك ترفع صورة أو تدفع اشتراك الآن", html)
