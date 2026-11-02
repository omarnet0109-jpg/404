"""No-surprise billing policy regression tests."""
import os
from unittest import TestCase
from unittest.mock import patch

from backend.engine_modes import EngineNotAvailable, available_engine_modes, select_engine


class EngineModeTests(TestCase):
    def test_free_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            config = select_engine()
        self.assertEqual(config.id, "free-comfyui")
        self.assertFalse(config.provider_billing_enabled)
        self.assertTrue(config.gpu_required)
        self.assertFalse(config.video_engine_ready)

    def test_free_explicit(self):
        config = select_engine("free-comfyui")
        self.assertEqual(config.provider, "comfyui")

    def test_paid_cannot_activate_with_env_variable(self):
        with patch.dict(os.environ, {"STUDIO_ENGINE_MODE": "paid-cloud"}):
            with self.assertRaisesRegex(EngineNotAvailable, "intentionally disabled"):
                select_engine()

    def test_unrecognized_engine_is_rejected(self):
        with self.assertRaises(EngineNotAvailable):
            select_engine("random-provider")

    def test_profiles_advertise_future_paid_as_disabled(self):
        modes = available_engine_modes()
        self.assertEqual(len(modes), 2)
        self.assertTrue(modes[0]["active"])
        self.assertFalse(modes[1]["active"])
        self.assertTrue(modes[1]["requires_manual_approval"])
