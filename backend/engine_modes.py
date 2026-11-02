"""Engine selection policy for a free-first, paid-later 404 Studio.

This does NOT provide GPU compute. It prevents accidentally activating a paid
video provider before an explicitly implemented and tested adapter exists.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import os


class EngineNotAvailable(RuntimeError):
    """Chosen provider is not implemented or cannot safely run."""


@dataclass(frozen=True)
class EngineMode:
    id: str
    provider: str
    provider_billing_enabled: bool
    gpu_required: bool
    video_engine_ready: bool
    upgrade_supported_later: bool
    caveat: str

    def public_status(self) -> dict:
        return asdict(self)


def select_engine(mode: str | None = None) -> EngineMode:
    chosen = (mode or os.environ.get("STUDIO_ENGINE_MODE", "free-comfyui")).strip().lower()
    if chosen == "free-comfyui":
        return EngineMode(
            id="free-comfyui",
            provider="comfyui",
            provider_billing_enabled=False,
            gpu_required=True,
            video_engine_ready=False,  # Actual availability is evaluated by /api/health.
            upgrade_supported_later=True,
            caveat=(
                "ComfyUI and open models have no provider API subscription, "
                "but a usable GPU/server is still required and may cost money."
            ),
        )
    if chosen == "paid-cloud":
        raise EngineNotAvailable(
            "Paid cloud engines are intentionally disabled. "
            "Implement, test and explicitly authorize a paid adapter before enabling one."
        )
    raise EngineNotAvailable(f"Unknown STUDIO_ENGINE_MODE: {chosen!r}")


def available_engine_modes() -> list[dict]:
    return [
        {
            "id": "free-comfyui", "label_ar": "مجاني — ComfyUI مفتوح المصدر",
            "active": True, "billing_automatic": False,
            "requires_gpu": True,
            "capabilities": ["storyboard", "reference_upload", "video_render_when_gpu_connected"],
        },
        {
            "id": "paid-cloud", "label_ar": "مدفوع مستقبلاً — غير مفعّل",
            "active": False, "billing_automatic": False,
            "requires_manual_approval": True,
            "capabilities": [],
        },
    ]
