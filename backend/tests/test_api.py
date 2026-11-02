"""Offline bridge tests: must pass without GPU, models, keys or network."""
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch
from fastapi import HTTPException
from pydantic import ValidationError

import backend.api as api


class BridgeTests(TestCase):
    def test_typed_placeholders(self):
        graph={"1":{"inputs":{
            "positive":"{{PROMPT}}", "image":"{{REFERENCE_IMAGE}}",
            "width":"{{WIDTH}}", "frames":"{{FRAMES}}",
            "label":"frames={{FRAMES}}",
        }}}
        output=api.inject_workflow(graph, {
            "{{PROMPT}}":"A motion shot", "{{REFERENCE_IMAGE}}":"uploaded.png",
            "{{WIDTH}}":704, "{{FRAMES}}":120,
        })
        self.assertEqual(output["1"]["inputs"]["width"],704)
        self.assertEqual(output["1"]["inputs"]["frames"],120)
        self.assertEqual(output["1"]["inputs"]["image"],"uploaded.png")
        self.assertEqual(output["1"]["inputs"]["label"],"frames=120")

    def test_reference_placeholder_is_required(self):
        with self.assertRaisesRegex(ValueError,"REFERENCE_IMAGE"):
            api.inject_workflow({"x":"{{PROMPT}}"},{"{{PROMPT}}":"hello"})

    def test_unknown_placeholder_rejected(self):
        with self.assertRaisesRegex(ValueError,"Unresolved"):
            api.inject_workflow(
                {"a":"{{PROMPT}}","b":"{{REFERENCE_IMAGE}}","c":"{{UNKNOWN}}"},
                {"{{PROMPT}}":"prompt","{{REFERENCE_IMAGE}}":"file.png"}
            )

    def test_video_result_only_accepts_real_output(self):
        entry={"outputs":{"4":{"images":[{"filename":"preview.png"}]},
                          "9":{"gifs":[{"filename":"render.mp4","type":"output"}],
                               "videos":[{"filename":"temp.mp4","type":"temp"},
                                         {"filename":"frame.jpg","type":"output"}]}}}
        self.assertEqual([v["filename"] for v in api.available_videos(entry)],["render.mp4"])

    def test_scene_is_canonical(self):
        scene=api.scene_data()
        self.assertEqual(len(scene["shots"]),16)
        self.assertEqual(sum(x["duration_seconds"] for x in scene["shots"]),60)

    def test_mandatory_token(self):
        with patch.object(api,"API_TOKEN","super-secret-application-key"):
            api.require_token("Bearer super-secret-application-key")
            with self.assertRaises(HTTPException) as ctx:
                api.require_token("Bearer wrong")
            self.assertEqual(ctx.exception.status_code,401)

    def test_no_key_is_not_open_api(self):
        with patch.object(api,"API_TOKEN",""):
            with self.assertRaises(HTTPException) as ctx:
                api.require_token(None)
            self.assertEqual(ctx.exception.status_code,503)

    def test_render_fields_are_bounded(self):
        good={"shot_id":"sh03","prompt":"A cinematic shot showing Layla","frames":144,
              "seed":404,"reference_asset_id":"1234567890abcdef"}
        api.RenderRequest(**good)
        with self.assertRaises(ValidationError):
            api.RenderRequest(**{**good,"frames":10000})

    def test_local_sqlite_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(api,"DB_FILE",Path(tmp)/"jobs.db"):
                with api.open_db() as db:
                    db.execute("INSERT INTO assets VALUES (?,?,?)",("ref","image.png","LAYLA"))
                    db.commit()
                with api.open_db() as db:
                    row=db.execute("SELECT filename FROM assets WHERE id='ref'").fetchone()
                    self.assertEqual(row["filename"],"image.png")
