"""Packaging contract: the production container must include runtime data files."""
from pathlib import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]


class DockerPackagingTests(TestCase):
    def test_runtime_required_project_files_are_copied(self):
        dockerfile = (ROOT / "backend" / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn(
            "COPY characters/character_bible.json /app/characters/character_bible.json",
            dockerfile,
            "Without the canonical character bible, approved_reference_hashes() fails at runtime.",
        )
        self.assertIn(
            "COPY scenes/episode-01/scene-001.json /app/scenes/episode-01/scene-001.json",
            dockerfile,
        )

    def test_bundled_wan_workflow_is_not_an_activated_paid_service(self):
        from backend.engine_modes import select_engine
        from backend.api import WORKFLOW_FILE

        self.assertEqual(select_engine("free-comfyui").provider, "comfyui")
        self.assertEqual(WORKFLOW_FILE.name, "video_api.json")
        self.assertTrue((ROOT / "backend" / "workflows" / "wan22_ti2v_5b_api.json").is_file())
