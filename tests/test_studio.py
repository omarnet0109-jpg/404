"""Offline unit tests: no GPU, account, or network required."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

import studio

ROOT = Path(__file__).resolve().parents[1]


class StudioTests(unittest.TestCase):
    def setUp(self):
        self.scene = json.loads((ROOT / "templates" / "scene.json").read_text(encoding="utf-8"))
        self.settings = json.loads((ROOT / "series.json").read_text(encoding="utf-8"))

    def test_template_is_valid(self):
        studio.validate_scene(self.scene)

    def test_duplicate_shot_is_rejected(self):
        scene = copy.deepcopy(self.scene)
        scene["shots"].append(copy.deepcopy(scene["shots"][0]))
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            studio.validate_scene(scene)

    def test_empty_prompt_is_rejected(self):
        scene = copy.deepcopy(self.scene)
        scene["shots"][0]["prompt_en"] = "  "
        with self.assertRaisesRegex(ValueError, "prompt_en"):
            studio.validate_scene(scene)

    def test_manifest_calculates_frames(self):
        plan = studio.make_plan(self.scene, self.settings)
        self.assertEqual(plan["shots"][0]["frames"], 120)
        self.assertIn("cinematic", plan["shots"][0]["prompt"])

    def test_workflow_typed_placeholder_replacement(self):
        shot = studio.make_plan(self.scene, self.settings)["shots"][0]
        workflow = {"1": {"inputs": {
            "text": "{{PROMPT}}", "width": "{{WIDTH}}", "frames": "{{FRAMES}}",
            "seed": "{{SEED}}", "note": "seed={{SEED}}",
        }}}
        result = studio.inject_workflow(workflow, shot)
        self.assertEqual(result["1"]["inputs"]["width"], self.settings["video"]["width"])
        self.assertEqual(result["1"]["inputs"]["frames"], 120)
        self.assertEqual(result["1"]["inputs"]["seed"], 40401)
        self.assertEqual(result["1"]["inputs"]["note"], "seed=40401")

    def test_plan_is_written_to_disk(self):
        with tempfile.TemporaryDirectory() as tmp:
            plan, manifest = studio.save_plan(ROOT / "templates" / "scene.json", Path(tmp))
            self.assertTrue(manifest.is_file())
            self.assertEqual(json.loads(manifest.read_text(encoding="utf-8"))["scene_id"], plan["scene_id"])


if __name__ == "__main__":
    unittest.main()
