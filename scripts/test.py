"""Run real engine and distribution tests without installing dependencies."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
node = shutil.which('node')
if not node:
    sys.exit('完整测试需要 Node.js 20+；启动预览不需要 Node.js')
engine_tests = sorted((ROOT / 'skills/flowlens/assets/viewer/tests').glob('*.test.js'))
for command in [[node, '--test', *map(str, engine_tests)], [sys.executable, '-m', 'unittest', 'discover', '-s', str(ROOT / 'tests'), '-v']]:
    result = subprocess.run(command, cwd=ROOT)
    if result.returncode:
        sys.exit(result.returncode)
