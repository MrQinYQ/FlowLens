from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
node = shutil.which('node')
if not node:
    sys.exit('语法检查需要 Node.js 20+')
paths = list((ROOT / 'skills/flowlens/assets/viewer/src').glob('*.js')) + list((ROOT / 'skills/flowlens/assets/viewer/tools').glob('*.mjs'))
for path in paths:
    subprocess.run([node, '--check', str(path)], check=True)
python_paths = [*ROOT.glob('scripts/*.py'), *ROOT.glob('tests/*.py'), *ROOT.glob('skills/flowlens/scripts/*.py'), *ROOT.glob('skills/flowlens/assets/viewer/tools/*.py')]
for path in python_paths:
    compile(path.read_text(encoding='utf-8'), str(path), 'exec')
print('{} JavaScript / {} Python files: syntax OK'.format(len(paths), len(python_paths)))
