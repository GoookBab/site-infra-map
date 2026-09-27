from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("run_project", ROOT / "scripts" / "run_project.py")
assert SPEC and SPEC.loader
RUN_PROJECT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUN_PROJECT)


class ProjectConfigTests(unittest.TestCase):
    def test_example_config_is_valid(self) -> None:
        config = RUN_PROJECT.load_project_config(ROOT / "examples" / "munjeong-project.json")
        self.assertEqual(config["project"]["slug"], "munjeong-court8")
        self.assertEqual(len(RUN_PROJECT.research_rows(config)), 10)

    def test_duplicate_names_are_rejected(self) -> None:
        config = json.loads((ROOT / "examples" / "munjeong-project.json").read_text(encoding="utf-8"))
        config["facilities"][0]["name"] = config["schools"][0]["name"]
        with self.assertRaises(RUN_PROJECT.ProjectConfigError):
            RUN_PROJECT.validate_project_config(config)

    def test_next_output_preserves_existing_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            original = Path(directory) / "deck.pptx"
            original.write_bytes(b"existing")
            self.assertEqual(RUN_PROJECT._next_output(original).name, "deck_v2.pptx")


if __name__ == "__main__":
    unittest.main()
