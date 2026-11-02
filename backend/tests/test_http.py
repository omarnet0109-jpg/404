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

    def test_health_requires_workflow_nodes_installed_in_comfyui(self):
        async def comfy_status(method, route, **kwargs):
            if route == "/queue":
                return {"queue_running": [], "queue_pending": []}
            if route == "/object_info":
                return {"LoadImage": {}}
            raise AssertionError(route)

        with tempfile.TemporaryDirectory() as folder:
            workflow = Path(folder) / "video_api.json"
            workflow.write_text(json.dumps({
                "1": {"class_type": "LoadImage", "inputs": {"image": "{{REFERENCE_IMAGE}}"}},
                "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{PROMPT}}"}},
                "3": {"class_type": "SaveVideo", "inputs": {"video": ["2", 0]}},
            }), encoding="utf-8")
            with patch.object(api, "WORKFLOW_FILE", workflow), patch.object(api, "comfy", side_effect=comfy_status):
                result = self.client.get("/api/health", headers=self.headers)
        self.assertEqual(result.status_code, 200)
        body = result.json()
        self.assertTrue(body["comfyui_connected"])
        self.assertFalse(body["video_ready"])
        self.assertEqual(body["workflow_status"], "nodes_missing")
        self.assertEqual(body["missing_nodes"], ["CLIPTextEncode", "SaveVideo"])

    def test_health_requires_workflow_model_files_installed(self):
        async def comfy_status(method, route, **kwargs):
            if route == "/queue":
                return {}
            if route == "/object_info":
                return {
                    "UNETLoader": {"input": {"required": {"unet_name": [["another-model.safetensors"]]}}},
                    "LoadImage": {"input": {"required": {}}},
                    "CLIPTextEncode": {"input": {"required": {}}},
                    "SaveVideo": {"input": {"required": {}}},
                }
            raise AssertionError(route)

        with tempfile.TemporaryDirectory() as folder:
            workflow = Path(folder) / "video_api.json"
            workflow.write_text(json.dumps({
                "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan.safetensors"}},
                "2": {"class_type": "LoadImage", "inputs": {"image": "{{REFERENCE_IMAGE}}"}},
                "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{PROMPT}}"}},
                "4": {"class_type": "SaveVideo", "inputs": {"video": ["3", 0]}},
            }), encoding="utf-8")
            with patch.object(api, "WORKFLOW_FILE", workflow), patch.object(api, "comfy", side_effect=comfy_status):
                result = self.client.get("/api/health", headers=self.headers)
        body = result.json()
        self.assertFalse(body["video_ready"])
        self.assertEqual(body["workflow_status"], "models_missing")
        self.assertEqual(body["missing_models"], ["wan.safetensors"])

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

    def test_modified_character_photo_is_rejected(self):
        # Looks like a PNG but is NOT the exact original reference provided by the creator.
        data = bytes.fromhex("89504e470d0a1a0a") + b"replaced portrait"
        result = self.client.post("/api/assets", headers=self.headers, files={
            "image": ("layla.png", data, "image/png"),
        }, data={"reference_type": "LAYLA"})
        self.assertEqual(result.status_code, 422)
        self.assertIn("locked creator", result.json()["detail"])

    def test_reference_hashes_are_locked_to_only_three_characters_and_set(self):
        approved = api.approved_reference_hashes()
        self.assertEqual(set(approved), {"ensemble", "LAYLA", "WIDAD", "SABER"})
        self.assertTrue(all(len(x) == 64 for x in approved.values()))

    def test_daily_gpu_job_budget_blocks_more_requests(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            workflow = root / "video_api.json"
            workflow.write_text(
                json.dumps({
                    "1": {"class_type": "LoadImage", "inputs": {"image": "{{REFERENCE_IMAGE}}"}},
                    "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "{{PROMPT}}"}},
                    "3": {"class_type": "SaveVideo", "inputs": {"video": ["2", 0]}},
                }),
                encoding="utf-8"
            )
            with (
                patch.object(api, "WORKFLOW_FILE", workflow),
                patch.object(api, "DB_FILE", root / "test.db"),
                patch.object(api, "MAX_JOBS_PER_DAY", 1),
            ):
                with api.open_db() as db:
                    db.execute("INSERT INTO assets VALUES (?,?,?)", ("test-original", "ref.png", "LAYLA"))
                    db.execute(
                        "INSERT INTO jobs (id,prompt_id,shot_id) VALUES (?,?,?)",
                        ("existing", "00000000-0000-0000-0000-000000000001", "sh03")
                    )
                    db.commit()
                result = self.client.post("/api/render", headers=self.headers, json={
                    "shot_id": "sh03", "prompt": "A cinematic close up on Layla.",
                    "frames": 144, "seed": 40403, "reference_asset_id": "test-original",
                })
                self.assertEqual(result.status_code, 429)
                self.assertIn("Daily GPU", result.json()["detail"])

    def test_bad_job_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(api, "DB_FILE", Path(folder) / "test.db"):
            result = self.client.get("/api/jobs/not-a-guid", headers=self.headers)
        self.assertEqual(result.status_code, 422)


if __name__ == "__main__":
    import unittest
    unittest.main()
