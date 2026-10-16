"""Install this entire self-contained skill; no network and no symlink dependency."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import sys
import tempfile
from uuid import uuid4

SOURCE = Path(__file__).resolve().parents[1]
REQUIRED = ['SKILL.md', 'scripts/flowlens.py', 'scripts/install.py',
            'references/data-format.md', 'assets/viewer/index.html',
            'assets/viewer/src/schema.js', 'assets/viewer/tools/serve.py']
IGNORE = shutil.ignore_patterns('__pycache__', '*.pyc', '.DS_Store', '.flowlens-install.json')


def install(destination, update=False):
    for relative in REQUIRED:
        if not (SOURCE / relative).is_file():
            raise ValueError('skill 包不完整，缺少 ' + relative)
    if any(path.is_symlink() for path in SOURCE.rglob('*')):
        raise ValueError('skill 包包含符号链接，请使用完整的普通文件副本')
    parent = Path(destination).expanduser().resolve()
    target = parent / 'flowlens'
    if target.resolve() == SOURCE:
        print(json.dumps({'installed': str(target), 'status': 'already-in-place'}))
        return
    if target.is_relative_to(SOURCE) or SOURCE.is_relative_to(target):
        raise ValueError('安装目录不能位于源 skill 内部或包含源 skill')
    if target.is_symlink():
        raise ValueError('已有同名路径是符号链接，未覆盖')
    backup = None
    if target.exists():
        if not update:
            raise ValueError('已有 flowlens skill；如需更新，请明确添加 --update')
        marker = target / '.flowlens-install.json'
        if not marker.is_file() or json.loads(marker.read_text(encoding='utf-8')).get('name') != 'flowlens':
            raise ValueError('已有同名目录不是本安装器管理的 skill，未覆盖')
        backup = parent.parent / 'flowlens-skill-backups' / ('flowlens-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid4().hex[:8])
    parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.flowlens-install-', dir=str(parent)))
    try:
        shutil.copytree(SOURCE, stage, dirs_exist_ok=True, ignore=IGNORE)
        version = json.loads((stage / 'assets/viewer/package.json').read_text(encoding='utf-8'))['version']
        (stage / '.flowlens-install.json').write_text(json.dumps({'name': 'flowlens', 'format': 1, 'version': version}), encoding='utf-8')
        if backup:
            backup.parent.mkdir(parents=True, exist_ok=True)
            target.rename(backup)
        try:
            stage.rename(target)
        except OSError:
            if backup and backup.exists() and not target.exists():
                backup.rename(target)
            raise
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    print(json.dumps({'installed': str(target), 'version': version, 'backup': str(backup) if backup else None}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description='把完整 FlowLens skill 安装到 Codex 用户技能目录')
    parser.add_argument('--dest', default=str(Path.home() / '.agents' / 'skills'), help='技能父目录，安装到其 flowlens/ 子目录')
    parser.add_argument('--update', action='store_true', help='仅更新本安装器管理的旧版；先备份')
    args = parser.parse_args()
    try:
        install(args.dest, args.update)
    except (OSError, ValueError) as error:
        print('安装失败：{}'.format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
