"""Materialize, validate and launch the runtime bundled in this skill."""
import argparse
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile

SKILL = Path(__file__).resolve().parents[1]
VIEWER = SKILL / 'assets' / 'viewer'
IGNORE = shutil.ignore_patterns('__pycache__', '*.pyc', '.DS_Store')


def check_tree(source):
    if source.is_symlink() or any(path.is_symlink() for path in source.rglob('*')):
        raise ValueError('复制来源包含符号链接，请提供独立的普通文件目录')


def read_data(path):
    source = Path(path).expanduser().resolve()
    if source.stat().st_size > 2 * 1024 * 1024:
        raise ValueError('项目 JSON 不能超过 2 MB')
    def invalid_constant(value):
        raise ValueError('JSON 不能包含 {}'.format(value))
    data = json.loads(source.read_text(encoding='utf-8'), parse_constant=invalid_constant)
    if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('screens'), list) or not data['screens']:
        raise ValueError('JSON 必须是 version=1 且至少包含一个 screen 的 FlowLens 项目')
    return data


def validate(path, required=True):
    node = shutil.which('node')
    if not node:
        if required:
            raise ValueError('完整数据校验需要 Node.js 20+；本地查看只需 Python，浏览器也会执行完整校验')
        return 'json-only'
    result = subprocess.run([node, str(VIEWER / 'tools' / 'validate.mjs'), str(Path(path).resolve())], capture_output=True, text=True)
    if result.returncode:
        raise ValueError(result.stderr.strip() or '数据校验失败')
    if required:
        print(result.stdout.strip())
    return 'schema'


def init_project(output, data=None, assets=None):
    target = Path(output).expanduser().absolute()
    if target.is_symlink() or (target.exists() and (not target.is_dir() or any(target.iterdir()))):
        raise ValueError('目标目录非空或是符号链接，请选择新的工作目录；未覆盖现有内容')
    if target.resolve().is_relative_to(VIEWER):
        raise ValueError('工作目录不能位于 skill 内置运行时代码内部')
    project_data = read_data(data) if data else None
    validation = validate(data, required=False) if data else 'bundled-demo'
    asset_source = Path(assets).expanduser().resolve() if assets else None
    if asset_source:
        if not asset_source.is_dir():
            raise ValueError('--assets 必须是图片资源目录')
        check_tree(asset_source)
        if target.resolve().is_relative_to(asset_source):
            raise ValueError('工作目录不能放在待复制的图片资源目录内部')
    check_tree(VIEWER)
    target.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.flowlens-init-', dir=str(target.parent)))
    try:
        shutil.copytree(VIEWER, stage, dirs_exist_ok=True, ignore=IGNORE)
        if project_data:
            (stage / 'project.json').write_text(json.dumps(project_data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            config_path = stage / 'viewer.config.json'
            config = json.loads(config_path.read_text(encoding='utf-8'))
            config['initialProject'] = './project.json'
            config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        if asset_source:
            shutil.copytree(asset_source, stage / 'assets', dirs_exist_ok=True, ignore=IGNORE)
        (stage / '.flowlens-project.json').write_text(json.dumps({'format': 1, 'runtime': '1.0.0'}), encoding='utf-8')
        if target.exists():
            target.rmdir()  # Only an empty directory is replaceable.
        stage.rename(target)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    print(json.dumps({'project': str(target.resolve()), 'validation': validation, 'start': [sys.executable, str(target / 'tools' / 'serve.py')]}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description='FlowLens：从内置运行时代码生成、校验与启动本地原型')
    commands = parser.add_subparsers(dest='command', required=True)
    create = commands.add_parser('init', help='创建独立目录；不改安装目录，不覆盖已有项目')
    create.add_argument('--output', required=True)
    create.add_argument('--data', help='符合 v1 格式的项目 JSON')
    create.add_argument('--assets', help='复制到新工作目录 assets/ 的图片目录')
    start = commands.add_parser('serve', help='启动指定工作目录，端口占用时自动避让')
    start.add_argument('--project', required=True)
    start.add_argument('--port', type=int, default=4173)
    start.add_argument('--strict-port', action='store_true')
    check = commands.add_parser('validate', help='使用 Node.js 执行完整项目数据校验')
    check.add_argument('data')
    args = parser.parse_args()
    try:
        if args.command == 'init':
            init_project(args.output, args.data, args.assets)
        elif args.command == 'validate':
            read_data(args.data)
            validate(args.data)
        else:
            project = Path(args.project).expanduser().resolve()
            server_file = project / 'tools' / 'serve.py'
            if not server_file.is_file():
                raise ValueError('工作目录缺少 tools/serve.py，请先执行 init')
            # Always run the server implementation bundled with this skill.
            # A user-supplied project directory is content, not executable Python.
            server = runpy.run_path(str(VIEWER / 'tools' / 'serve.py'))
            server['serve'](project, args.port, args.strict_port)
    except (OSError, ValueError) as error:
        print('FlowLens：{}'.format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
