import json
cmd=None
for line in open('/root/.claude/projects/-home-user/791d8bb7-851b-50fc-a666-a0e4b98b2f7f.jsonl'):
    if 'const NOEL = [' not in line: continue
    try: d=json.loads(line)
    except: continue
    for c in d.get('message',{}).get('content',[]) if isinstance(d.get('message',{}).get('content'),list) else []:
        if c.get('type')=='tool_use' and 'const NOEL = [' in json.dumps(c.get('input',{})): cmd=c['input'].get('command')
body=cmd.split("<<'EOF'\n",1)[1].rsplit("\nEOF",1)[0]
body=body.replace('a=s.index("  aventures: {\\n    vue: \'exterieur\', plan: \'aventures\'"); b=s.index("  fiche: {")','a=s.index("  aventures: {\\n    vue: \'exterieur\', plan: \'aventures\'"); b=s.index("  fiche: {", a)')
assert 'b=s.index("  fiche: {", a)' in body
open('noel.py','w').write(body); print(len(body))