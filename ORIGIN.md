# Origin uBlock (Lowji Edition)

Independent, unofficial GPL-3.0 fork of [uBlock Origin / uBO Lite](https://github.com/gorhill/uBlock).
Vietnamese-first Chromium Manifest V3 edition; upstream DNR engine, scriptlets, and element picker retained.
Curated 18-ruleset lineup (AdGuard Base/Tracking/DNS/Spyware URL/Social/Annoyances, EasyList/EasyPrivacy, uBlock Filters, Lowji194 Vietnam Filter Desktop, and ABPVN List) with `Zero Acceptable Ads` and active `Allow User Scripts` detection.
No premium/VIP lists are bundled. Upstream copyright and license notices remain intact.

## Build
Linux or WSL: install `git`, `make`, `Node.js 24`, `npm`, `jq`, `zip`, `Python 3`.
```bash
git clone --recurse-submodules https://github.com/lowji194/Origin-uBlock.git
cd Origin-uBlock
bash origin/build.sh
```
Unzip `dist/origin/Origin-uBlock-2.1.0-chromium.zip` and load the directory at `chrome://extensions` in developer mode. For custom URL filter cosmetic/scriptlet rules, enable **Allow User Scripts** on the extension details page.
The per-tab badge count is shown only if the browser exposes a numeric count; it is not a separate count of ads and trackers.
This fork does not claim official uBlock Origin, AdGuard, or Adblock Plus affiliation. See [LICENSE.txt](LICENSE.txt) and [README.upstream.md](README.upstream.md) for engine details.

## 1.1.0 product UI
Overview, privacy filter switches, allowlist CRUD, global pause/restore, local opt-in observed badge statistics, per-tab matched-rule snapshot. No telemetry, no full network history. MV3 APIs do not guarantee complete counters or independent ad/tracker totals. Built-in rules refresh on new builds; custom lists use upstream import/update.

## 2.0.0 — Independent UI
The UI is located at `origin/ui` (Vue, TypeScript, Tailwind CSS, Lucide, Vite), combining Stealth DNR shields, timed snooze pauses, quick protection presets, site controls, bulk allowlisting, quick rule builder, and DNR rule inspection.
`origin/build.sh` builds the upstream MV3 engine and overlays the Vite popup/dashboard; dependencies are pinned via `origin/ui/package-lock.json`.
Engine and element-picker tools retain upstream GPL code. The UI communicates via runtime messaging; no remote JS execution or external CDN assets.

## 2.1.0 — Origin uBlock (Lowji Edition)
- Branded as **Origin uBlock (Lowji Edition)** while keeping compact toolbar naming (`Origin uBlock`) and upstream GPL-3.0 credits.
- Streamlined from 56 to **18 curated filter lists**, natively bundling `Lowji194 – Vietnam Filter (Desktop)` (`vie-vn-desktop`) with 🇻🇳 flag alongside `ABPVN List`, AdGuard Base/Tracking/DNS, EasyList/EasyPrivacy, and uBlock Filters.
- Cancelled overly broad blanket `doubleclick.net` / `pagead2.googlesyndication.com` XHR `noop` redirects via `$badfilter` in `platform/mv3/rulesets.json` so network blockers take precedence properly while keeping specific script surrogates intact.
- Added active `Allow User Scripts` status pills, warning banners, and quick extension-details shortcuts in Custom Filter Lists (`FiltersView.vue`) and Custom Rules (`RulesView.vue`).
- Added shared `SiteFooter` (`Thế Lợi · theloi.io.vn`) and `DonateModal` (`/img/donate-qr.jpg`) across Popup and Dashboard.
- Run `node origin/smoke.mjs dist/build/uBOLite.chromium` for browser verification (`CHROME_BIN` supported). Set `ORIGIN_SCREENSHOTS` to capture refreshed PNG previews.
