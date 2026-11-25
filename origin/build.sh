#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
make mv3-chromium
dir=dist/build/uBOLite.chromium
python3 - "$dir" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1])/'manifest.json'; d=json.loads(p.read_text())
assert d['manifest_version']==3 and d['declarative_net_request']['rule_resources']
d['version']='1.0.0'; d['version_name']='1.0.0'
d['permissions']=[p for p in d['permissions'] if p!='declarativeNetRequestFeedback']
p.write_text(json.dumps(d,indent=2)+'\n')
PY
mkdir -p dist/origin
out="$(pwd)/dist/origin/Origin-uBlock-1.0.0-chromium.zip"
rm -f "$out"
(cd "$dir" && zip -qr "$out" . -x log.txt 'rulesets/debug/*')
python3 origin/verify.py "$out"
