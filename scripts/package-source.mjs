// Reproducible source distribution. Excludes generated downloads to prevent archive nesting.
import { execFileSync } from 'node:child_process';
import { mkdir,copyFile } from 'node:fs/promises';
await mkdir('public/downloads',{recursive:true});
await copyFile('docs/开发文档.md','public/downloads/development.md');
execFileSync('python3',['-c',`
import subprocess,zipfile,pathlib
raw=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'])
paths=sorted(set(p.decode() for p in raw.split(b'\\0') if p))
with zipfile.ZipFile('public/downloads/source-v0.8.3.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in paths:
  f=pathlib.Path(p)
  if not f.is_file() or p.startswith(('public/downloads/','artifacts/','references/','dist/','pids/')) or p.startswith('.env'):continue
  info=zipfile.ZipInfo('webmaster-v0.8.3/'+p,(2026,11,10,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,f.read_bytes())
print('Prepared source-v0.8.3.zip without generated downloads or runtime data.')
`],{stdio:'inherit'});
