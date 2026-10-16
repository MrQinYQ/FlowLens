import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / 'skills' / 'flowlens'


def main():
    parser = argparse.ArgumentParser(description='打包包含运行时代码和安装器的独立 skill')
    parser.add_argument('--output', default=str(ROOT / 'dist' / 'flowlens-skill.zip'))
    args = parser.parse_args()
    output = Path(args.output).expanduser().resolve()
    if output.is_relative_to(SKILL):
        parser.error('压缩包不能写入待打包的 skill 内部')
    if not (SKILL / 'SKILL.md').is_file():
        parser.error('缺少 SKILL.md')
    files = [p for p in SKILL.rglob('*') if p.is_file() and not any(part.startswith('.') or part == '__pycache__' for part in p.relative_to(SKILL).parts) and p.suffix != '.pyc']
    if any(path.is_symlink() for path in SKILL.rglob('*')):
        parser.error('skill 不能包含符号链接')
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for path in sorted(files):
            archive.write(path, Path('flowlens') / path.relative_to(SKILL))
        manual = (ROOT / 'INSTALL.md').read_text(encoding='utf-8').replace('](skills/flowlens/', '](flowlens/')
        archive.writestr('INSTALL.md', manual)
    with ZipFile(output) as archive:
        if archive.testzip():
            raise ValueError('压缩包校验失败')
    print(json.dumps({'archive': str(output), 'files': len(files) + 1, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
