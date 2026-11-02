"""HTTP acceptance tests for the mobile app backend, without any GPU or API spend."""
import json
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient
import backend.api as api


class HTTPAcceptanceTests(TestCase):
    def setUp(self):
        self.client = TestClient(api.app)
        self.token_patch = patch.object(api, "API_TOKEN", "a-safe-test-token")
        self.token_patch.start()
        self.addCleanup(self.token_patch.stop)
        self.headers = {"Authorization": "Bearer a-safe-test-token"}

    def test_anonymous_requests_are_rejected(self):
        for url in ("/api/health", "/api/jobs/00000000-0000-0000-0000-000000000001"):
            with self.subTest(url=url):
                result = self.client.get(url)
                self.assertEqual(result.status_code, 401)

    def test_invalid_token_is_rejected(self):
        result = self.client.get("/api/health", headers={"Authorization": "Bearer wrong"})
        self.assertEqual(result.status_code, 401)

    def test_health_when_gpu_not_connected(self):
        async def disconnected(*args, **kwargs):
            raise api.HTTPException(status_code=502, detail="ComfyUI offline")
        with patch.object(api, "comfy", side_effect=disconnected):
            result = self.client.get("/api/health", headers=self.headers)
        self.assertEqual(result.status_code, 200)
        body = result.json()
        self.assertFalse(body["comfyui_connected"])
        self.assertFalse(body["video_ready"])

    def test_render_refuses_missing_workflow(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "missing.json"
            with patch.object(api, "WORKFLOW_FILE", path):
                res = self.client.post("/api/render", headers=self.headers, json={
                    "shot_id": "sh03", "prompt": "A cinematic view of Layla.",
                    "frames": 144, "seed": 40403,
                    "reference_asset_id": "does-not-exist",
                })
        self.assertEqual(res.status_code, 503)
        self.assertIn("workflow", res.json()["detail"].lower())

    def test_reject_new_characters_and_oversize_upload(self):
        # Invalid character ref is rejected before the server can write the file to ComfyUI.
        res = self.client.post("/api/assets", headers=self.headers, files={
            "image": ("test.png", b"\x89PNG\r\n\x1a\nimage-bytes", "image/png"),
        }, data={"reference_type": "NEW_ACTOR"})
        self.assertEqual(res.status_code, 422)

        too_big = b"\x89PNG\r\n\x1a\n" + b"x" * (15 * 1024 * 1024)
        res = self.client.post("/api/assets", headers=self.headers, files={
            "image": ("test.png", too_big, "image/png"),
        }, data={"reference_type": "LAYLA"})
        self.assertEqual(res.status_code, 413)

    def test_validate_timing_without_gpu(self):
        res = self.client.post("/api/render", headers=self.headers, json={
            "shot_id": "sh03", "prompt": "A cinema shot of Layla.",
            "frames": 721, "seed": 40403,
            "reference_asset_id": "1234567890",
        })
        self.assertEqual(res.status_code, 422)

    def test_bad_job_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(api, "DB_FILE", Path(folder) / "test.db"):
            result = self.client.get("/api/jobs/not-a-guid", headers=self.headers)
        self.assertEqual(result.status_code, 422)


if __name__ == "__main__":
    import unittest
    unittest.main()
