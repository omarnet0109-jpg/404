# 404 Studio — Ownership, privacy and saved video files

## Implemented now

- `mobile-studio/media-vault.js`: stores the *binary video file* as a Blob in the browser's IndexedDB. The stored item includes actor ID, shot ID, original prompt, source, timestamp, filename and size.
- `mobile-studio/library.html` / `library.js`: play past saved videos, add an existing downloaded MP4, export each video back to the phone's Downloads as backup, and delete old clips.
- `mobile-studio/free-gpu.js`: attempts to download and save a newly generated ZeroGPU clip automatically after the actual result URL arrives, **not** just its expiring remote URL. When cross-origin CORS rules block downloading, the app explains that the user needs to download MP4 and import it into the library.
- `navigator.storage.persist()` request attempts to prevent automatic browser eviction; it does **not** protect against manual data deletion.

### Concrete limits

Video files are saved **only in this browser profile on this device**. They are not synced to Google Drive, GitHub, or another phone. The media files are accessible to others who use the same unlocked mobile phone/browser profile. Private/incognito browser tabs or a different browser have separate storage.

Free GPU runs take place on an independently operated *public* Hugging Face service. Uploading character photos and generating video sends them outside this browser with the user's consent. Public Gradio cached output files can be available to anyone possessing the file URL, and may be deleted by the provider later. Do not assume this is a confidential private rendering service.

Downloaded files in the phone's Downloads folder are the recommended backup. Browser storage is not a durable project archive, particularly when space runs low, the browser is removed, or site data are cleared.

## Critical: the current application is NOT private

`https://omarnet0109-jpg.github.io/404/mobile-studio/` is a public GitHub Pages URL, and the `omarnet0109-jpg/404` repository is publicly readable. Other people without contributor permissions **cannot change repository contents**, but they can see publicly committed files, the storyboard, JavaScript and static references. They can edit a *copy* of the storyboard saved in their own browser; this does not change the owner's drafts.

There is no password protection, server-side authentication, user authorization, or encrypted cross-device storage. A password input or front-end PIN in static JavaScript would not secure this website and must not be advertised as genuine protection.

GitHub documentation says GitHub Pages sites are publicly viewable even when their repository is private, unless the organization uses Enterprise-specific private Pages access control:
https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Safe no-surprise path to genuinely private hosting (not deployed yet)

Recommended: migrate the mobile static app to **Cloudflare Pages**, and protect the actual `*.pages.dev` production URL with **Cloudflare Access** (one-time email sign-in, allow **only the owner's email**).

1. User must connect/create their own Cloudflare account. Do not request passwords or OTPs via chat or commit any access tokens.
2. Deploy `mobile-studio/` as the Pages build/output directory. Avoid publishing secrets or proprietary voice recordings to the repo or build artifacts.
3. In Cloudflare Pages configure a genuine Access policy on the *production* Pages domain (a preview-only policy is insufficient). Restrict the Allow rule to one owner email; deny everyone else.
4. Verify from a logged-out/incognito phone that the app HTML, `/data/scene.json` and JavaScript cannot be fetched without Access authorization.
5. When verified, disable the old **public GitHub Pages deployment**, then change the source GitHub repository to **private**. Be aware this can disable the current GitHub Pages deployment before the new one is usable. Keep a tested private-host URL before changing visibility.
6. For persistent **cross-device** media storage, add a private object bucket and authenticated upload endpoint (not included in the free local-only version); enforce per-user ACL on every media operation and set backup/retention rules.

Official Cloudflare docs:
https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain
https://developers.cloudflare.com/workers/configuration/cloudflare-access/

**Do not** change the GitHub repository visibility until the private alternative is tested and the user authorizes migrating the production link.

## Acceptance checks

1. Generate a video on the phone, then open `library.html` and see a playable real file.
2. Close all browser tabs, reopen the same URL in the same Chrome profile, and check the file is still playable.
3. Download a backup MP4 and test playback outside the browser.
4. Verify that incognito cannot read the private deployment before calling the website access-restricted.
