import json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    assert z.testzip() is None
    names=set(z.namelist()); m=json.loads(z.read('manifest.json'))
    assert m['manifest_version']==3
    assert m['version']=='1.0.0'
    assert m['action']['default_popup'] in names
    assert m['options_page'] in names
    assert m['background']['service_worker'].lstrip('/') in names
    assert 'css/origin-popup.css' in names and 'css/origin-dashboard.css' in names
    rules=m['declarative_net_request']['rule_resources']
    assert rules and any(r['enabled'] for r in rules)
    for r in rules:
        data=json.loads(z.read(r['path'].lstrip('/')))
        assert isinstance(data,list)
        assert len({x['id'] for x in data})==len(data)
    vi=json.loads(z.read('_locales/vi/messages.json')); assert vi['extName']['message']=='Origin uBlock'
    print('Verified MV3 package:', len(rules),'rulesets;',len(names),'entries')
