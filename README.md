# 404 — AI Series Studio

مشروع الإنتاج التقني لمسلسل **404**.

**طريقة التعاون:** صاحب العمل يرسل وصف المشهد بالعربي، والمساعد يحوّله إلى سيناريو لقطات وملفات إنتاج، ويحدّث المشروع على GitHub.

## تم تجهيزه
- `series.json` — مواصفات أولية للمشروع.
- `templates/scene.json` — قالب المشاهد.
- `studio.py` — تدقيق المشاهد، إنشاء manifest للقطات، والربط الاختياري مع محرك فيديو ComfyUI.
- `tests/` و `.github/workflows/validate.yml` — اختبارات ومراجعة تلقائية.
- `docs/PRODUCTION.md` — شرح آلية الإنتاج وحدودها.

**الحالة الحالية:** البنية الأساسية موجودة، لكن لم يتم إدخال المشهد الأول أو إعداد GPU / خدمة توليد فيديو. GitHub لا يولد الفيديو وحده، والمحرك الخارجي مطلوب قبل إخراج مقاطع فعلية.

## تشغيل سريع (Python 3.10+)

```bash
python -m unittest discover -s tests -v
python studio.py validate templates/scene.json
python studio.py plan templates/scene.json
```

المسار: `build/episode-01-scene-001/manifest.json` (من القالب فقط، وليس مشهدًا معتمدًا).

إرشادات الإنتاج: [docs/PRODUCTION.md](docs/PRODUCTION.md).
