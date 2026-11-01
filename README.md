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


## الحلقة الأولى: الشباك (60 ثانية)
- [السيناريو المقفل: 16 لقطة، 0–60 ثانية](scenes/episode-01/scene-001.json)
- [ثبات الشخصيات الثلاثة والديكور](characters/character_bible.json)
- [توزيع الحوار والأصوات المصرية: 9 جمل](audio/episode-01-dialogue.json)
- [التحقق من التوقيت والمتحدثين](production/check_episode.py)

```bash
python production/check_episode.py
python studio.py plan scenes/episode-01/scene-001.json
```

**مهم:** توجد ملفات الصور المرجعية الأصلية في حزمة منفصلة ضمن مرفقات المحادثة، لكن الصور الثنائية نفسها لم تُرفع بعد داخل `assets/references/` بالمستودع. أسماء الصور وبصمات SHA256 موجودة في Character Bible. الربط بمُولّد الفيديو والأصوات والليب-سينك ما زال مطلوبًا؛ لذلك لا تعتبر معاينة التوقيت المبنية على الصور الثابتة فيديو 3D نهائيًا.
