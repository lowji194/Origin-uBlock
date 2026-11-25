# Origin uBlock
Independent, unofficial GPL-3.0 fork of [uBlock Origin / uBO Lite](https://github.com/gorhill/uBlock).
Vietnamese-first Chromium Manifest V3 edition; upstream DNR engine and UI functions retained.
Custom popup, sidebar dashboard, automatic system light/dark theme, ABPVN public list enabled.
No premium/VIP lists are bundled. Upstream copyright and license notices remain intact.
## Build
Linux or WSL: install git, make, Node.js 24, npm, jq, zip, Python 3.
```bash
git clone --recurse-submodules https://github.com/lowji194/Origin-uBlock.git
cd Origin-uBlock
bash origin/build.sh
```
Unzip dist/origin/Origin-uBlock-2.0.0-chromium.zip and load the directory at chrome://extensions in developer mode.
The per-tab badge count is shown only if the browser exposes a numeric count; it is not a separate count of ads and trackers.
This fork does not claim official uBlock Origin affiliation. See LICENSE.txt and upstream README for engine details.

## 1.1.0 product UI
Overview, privacy filter switches, allowlist CRUD, global pause/restore, local opt-in observed badge statistics, per-tab matched-rule snapshot. No telemetry, no full network history. MV3 APIs do not guarantee complete counters or independent ad/tracker totals. Built-in rules refresh on new builds; custom lists use upstream import/update.

## 2.0.0 — Full UI Rewrite
The independent UI is at `origin/ui` (Vue, TypeScript, Tailwind, Lucide, Vite).
`origin/build.sh` builds the upstream MV3 engine and overlays the Vite popup/dashboard; dependencies are pinned via package-lock.json.
Engine and element-picker tools retain upstream GPL code. The UI communicates via runtime messaging; no remote JS execution or external CDN assets.
Run `node origin/smoke.mjs dist/build/uBOLite.chromium` for browser verification. Set ORIGIN_SCREENSHOTS to a local output directory to capture screenshots.
