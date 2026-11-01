"""Validate that the mobile Colab studio is parseable and contains the agreed safeguards."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "notebooks" / "404_mobile_studio.ipynb"


class MobileStudioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        cls.cells = cls.notebook["cells"]

    def test_notebook_schema(self):
        self.assertEqual(self.notebook["nbformat"], 4)
        self.assertEqual(len(self.cells), 7)

    def test_python_cells_compile(self):
        for number, cell in enumerate(self.cells):
            if cell["cell_type"] == "code":
                with self.subTest(cell_number=number):
                    source = "".join(cell.get("source", []))
                    compile(source, str(NOTEBOOK) + f":cell_{number}", "exec")

    def test_no_automatic_voice_approval(self):
        source = "\n".join("".join(c["source"]) for c in self.cells)
        self.assertIn("أوافق_على_الأصوات_التجريبية = False", source)
        self.assertIn("--preview", source)
        self.assertIn("production/free_tts.py", source)

    def test_reference_hash_verification_and_no_fake_final(self):
        source = "\n".join("".join(c["source"]) for c in self.cells)
        self.assertIn("hashlib.sha256", source)
        self.assertIn("production/assemble_episode.py", source)
        self.assertIn("--check-only", source)


if __name__ == "__main__":
    unittest.main()
