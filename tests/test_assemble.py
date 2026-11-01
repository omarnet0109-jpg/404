import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("assemble_404", ROOT / "production" / "assemble_episode.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AssemblySafetyTests(unittest.TestCase):
    def test_missing_speaking_voice_cannot_build(self):
        scene = ROOT / "scenes" / "episode-01" / "scene-001.json"
        with tempfile.TemporaryDirectory() as path:
            directory = Path(path)
            jobs, problems = module.prepare(scene, directory / "clips", directory / "voices")
            self.assertEqual(len(jobs), 16)
            self.assertGreaterEqual(len(problems), 25)
            self.assertTrue(any("voice" in problem for problem in problems))
            self.assertTrue(any("missing video" in problem for problem in problems))

    def test_nonexistent_assets_are_not_silently_accepted(self):
        scene = ROOT / "scenes" / "episode-01" / "scene-001.json"
        with tempfile.TemporaryDirectory() as path:
            jobs, problems = module.prepare(scene, Path(path), Path(path))
            self.assertNotEqual(problems, [])
            self.assertFalse(all(clip.exists() for _, clip, _ in jobs))


if __name__ == "__main__":
    unittest.main()
