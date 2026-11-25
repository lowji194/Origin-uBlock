#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
make mv3-chromium
dir=dist/build/uBOLite.chromium
(cd origin/ui && npm ci --no-audit --no-fund && npm run build)
# Overlay the independent Vite app on the engine's public entry points.
cp origin/ui/dist/popup.html origin/ui/dist/dashboard.html "$dir/"
mkdir -p "$dir/assets"
cp -R origin/ui/dist/assets/. "$dir/assets/"
# Original popup/dashboard UI modules are no longer referenced by these entry points.
mkdir -p "$dir/licenses/origin-ui"
for dep in vue @vue/runtime-dom @vue/runtime-core @vue/reactivity @vue/shared lucide-vue-next tailwindcss; do
  name=${dep//\//-}
  for f in origin/ui/node_modules/"$dep"/LICENSE origin/ui/node_modules/"$dep"/LICENSE.md origin/ui/node_modules/"$dep"/LICENSE.txt; do
    if [ -f "$f" ]; then cp "$f" "$dir/licenses/origin-ui/$name.txt"; break; fi
  done
done
python3 - "$dir" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1])/'manifest.json'; d=json.loads(p.read_text())
assert d['manifest_version']==3 and d['declarative_net_request']['rule_resources']
d['version']='2.0.0'; d['version_name']='2.0.0'
d['permissions']=[p for p in d['permissions'] if p!='declarativeNetRequestFeedback']
p.write_text(json.dumps(d,indent=2)+'\n')
PY
mkdir -p dist/origin
out="$(pwd)/dist/origin/Origin-uBlock-2.0.0-chromium.zip"
rm -f "$out"
(cd "$dir" && zip -qr "$out" . -x log.txt 'rulesets/debug/*')
python3 origin/verify.py "$out"
