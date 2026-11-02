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

## خط الإنتاج الثابت لكل الحلقات

- [أدوات الإنتاج وتعليمات التنفيذ](docs/PRODUCTION_STACK.md): Runway للحركة ومزامنة أداء الشخصيات + صوت مصري منفصل + FFmpeg.
- [مجمّع الحلقة النهائي](production/assemble_episode.py) يتحقق من وجود فيديو لكل لقطة وصوت حوار لكل جملة، ويرفض إخراج حلقة صامتة مكان الحوار.
- لا يثبت الاختبار البرمجي وحده تطابق الوجوه أو الشفايف؛ لا بد من مراجعة اللقطات الناتجة فعليًا.

```bash
python production/check_episode.py
python production/assemble_episode.py --check-only
python production/assemble_episode.py
```

**حالة التشغيل:** البنية والسكريبت جاهزان، لكن ربط محرك التوليد وحصولنا على ملفات فيديو وأصوات حقيقية لم يكتمل.

## المسار المجاني — بدون Runway مدفوع

- [تفاصيل المسار المجاني وحدوده](docs/FREE_PRODUCTION.md)
- [دفتر Google Colab للصوت المصري](notebooks/404_free_egyptian_audio.ipynb)
- [برنامج الصوت المصري المفتوح المصدر](production/free_tts.py)
- [أسماء الأصوات الثلاثة المقترحة (لم تعتمد بعد)](config/free_voices.json)

**ملحوظة:** الكود والأدوات المجانية لا يضمنوا فيديو 3D احترافي مدته دقيقة من غير GPU كافية. لا يوجد فيديو نهائي بالصوت إلى الآن، ولم ندفع أو نبدأ تشغيل خدمة مدفوعة.

## 🎬 الاستوديو المجاني من الموبايل

- **[افتح الاستوديو مباشرة في Google Colab](https://colab.research.google.com/github/omarnet0109-jpg/404/blob/main/notebooks/404_mobile_studio.ipynb)** — الفحص، استيراد المراجع الأربعة من حزمة ZIP، تجربة الأصوات المصرية، ثم إنشاء ملفات الصوت، والتحقق من جاهزية التجميع.
- [ملف الاستوديو على GitHub](notebooks/404_mobile_studio.ipynb)
- [تعليمات المسار المجاني](docs/FREE_PRODUCTION.md)
- الملف المرجعي المطلوب للتشغيل: `404_mobile_reference_assets.zip` (تم تسليمه في محادثة ChatGPT؛ لم تُرفع الصور الثنائية لهذا المستودع).
- **الوضع الحالي:** أعددنا الأدوات والملفات، **لم** نُنتج بعد الفيديو النهائي أو تحريك الشفايف؛ استوديو Colab يعتمد على توفر GPU مجانية وتفاعل صاحب حساب Google للتشغيل.


## 404 Studio — تطبيق موبايل قابل للتثبيت (PWA)

واجهة عربية جديدة داخل [mobile-studio/](mobile-studio/) لإدارة الحلقة الأولى، تعديل لقطاتها محليًا، تثبيت الشخصيات، وتصدير JSON. بها رفع مراجع صورة وإرسال طلب توليد إلى [backend/api.py](backend/api.py) عند توفر خادم GPU بخاصية ComfyUI وقالب workflow صالح. تصميم للهاتف ولا يتطلب تثبيت Python على الهاتف.

- **التطبيق:** [mobile-studio/index.html](mobile-studio/index.html)
- **خادم GPU الآمن:** [backend/api.py](backend/api.py)
- **التشغيل والنشر:** [mobile-studio/README.md](mobile-studio/README.md)
- **اختبارات واجهة الموبايل:** [.github/workflows/deploy-studio.yml](.github/workflows/deploy-studio.yml) (CI فقط؛ النشر من الفرع).
- **GitHub Pages:** داخل `Settings → Pages` اختر **Deploy from a branch** ثم `main` ثم `/(root)` ثم **Save**. الموقع المتوقع بعد نجاح النشر: `https://omarnet0109-jpg.github.io/404/` ويحوّلك إلى `/404/mobile-studio/`. لا تعتبره منشورًا قبل أن يُظهر GitHub حالة `Your site is live`.

> **ليس حلقة فيديو نهائية:** من دون سيرفر GPU وملف workflow فعلي لتوليد الفيديو، التطبيق يوفر أدوات تنظيم وإدارة فقط. توليد الكلام المصري ومزامنة الشفايف والربط الصوتي النهائي ما زالوا مراحل إنتاج منفصلة، وغير مدمجين كزر واحد في الـPWA بعد.
