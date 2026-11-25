from pathlib import Path
import json
from PIL import Image, ImageDraw
base=Path('platform/mv3/extension')
for f in (base/'_locales').glob('*/messages.json'):
    d=json.loads(f.read_text())
    d['extName']['message']='Origin uBlock (Lowji Edition)'
    d['dashboardName']['message']='Origin uBlock (Lowji Edition) — Dashboard' if f.parent.name!='vi' else 'Origin uBlock (Lowji Edition) — Bảng điều khiển'
    if f.parent.name in ('en','vi'):
        vi=f.parent.name=='vi'
        for k,v in {
            'originTagline': 'Bảo vệ quyền riêng tư' if vi else 'Privacy & protection',
            'originOn':'Đang bảo vệ trang web' if vi else 'Protection is active',
            'originOff':'Đã tạm dừng bảo vệ' if vi else 'Protection is paused',
            'originUnavailable':'Trang này không hỗ trợ lọc' if vi else 'Protection unavailable on this page',
            'originPower':'Bật hoặc tắt bảo vệ' if vi else 'Toggle site protection',
            'originCount':'Yêu cầu đã chặn trên tab' if vi else 'Blocked requests on this tab',
            'originSettings':'Trung tâm bảo vệ' if vi else 'Protection center',
            'originIntro':'Quản lý mức lọc, bộ lọc và ngoại lệ của bạn.' if vi else 'Manage filtering, filter lists and site exceptions.',
            'originFork':'Bản fork độc lập, không liên kết với uBlock Origin.' if vi else 'Independent fork, not affiliated with uBlock Origin.',
        }.items(): d[k]={'message':v}
    f.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
for f in Path('platform/mv3').glob('*/manifest.json'):
    d=json.loads(f.read_text())
    d['short_name']='Origin uBlock'
    f.write_text(json.dumps(d,indent=2)+'\n')
# Keep upstream credits; replace artwork for all enabled/disabled toolbar states.
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="4" y="4" width="120" height="120" rx="30" fill="#087f78"/><path d="M64 20L99 34V64Q99 91 64 108Q29 91 29 64V34Z" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="M46 63L59 76L82 49" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
(base/'img/ublock.svg').write_text(svg)
for f in (base/'img').glob('icon_*.png'):
    n=int(f.stem.split('_')[1]); im=Image.new('RGBA',(512,512)); p=ImageDraw.Draw(im)
    p.rounded_rectangle((16,16,496,496),radius=120,fill='#64748b' if '_off' in f.stem else '#087f78')
    p.line([(256,80),(396,136),(396,256),(376,316),(330,371),(256,432),(182,371),(136,316),(116,256),(116,136),(256,80)],fill='white',width=28,joint='curve')
    p.line([(184,252),(236,304),(328,196)],fill='white',width=36,joint='curve')
    im.resize((n,n),Image.Resampling.LANCZOS).save(f)
