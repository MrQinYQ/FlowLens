import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / 'skills' / 'flowlens'
CLI = SKILL / 'scripts' / 'flowlens.py'
INSTALL = SKILL / 'scripts' / 'install.py'
VIEWER = SKILL / 'assets' / 'viewer'


def run(script, *args):
    return subprocess.run([sys.executable, str(script), *map(str, args)], text=True, capture_output=True, timeout=20)


class DistributionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='flowlens-test-')
        self.base = Path(self.temp.name)
        self.data = self.base / 'input.json'
        self.data.write_text(json.dumps({'version': 1, 'id': 'independent', 'title': '独立数据', 'demo': False,
            'modules': [{'id': 'm', 'title': '模块'}], 'screens': [{'id': 'home', 'module': 'm', 'title': '首页',
            'x': 0, 'y': 0, 'components': [{'type': 'heading', 'text': '独立原型'}]}], 'transitions': []}), encoding='utf-8')

    def tearDown(self):
        self.temp.cleanup()

    def test_init_uses_supplied_data_without_editing_engine(self):
        output = self.base / '原型 with spaces'
        result = run(CLI, 'init', '--output', output, '--data', self.data)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads((output / 'project.json').read_text())['id'], 'independent')
        self.assertEqual(json.loads((output / 'viewer.config.json').read_text())['initialProject'], './project.json')
        self.assertEqual((output / 'src' / 'main.js').read_bytes(), (VIEWER / 'src' / 'main.js').read_bytes())
        self.assertTrue((output / 'tools' / 'serve.py').is_file())

    def test_existing_nonempty_output_is_preserved(self):
        output = self.base / 'existing'
        output.mkdir()
        sentinel = output / 'notes.txt'
        sentinel.write_text('keep me')
        result = run(CLI, 'init', '--output', output)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('非空', result.stderr)
        self.assertEqual(sentinel.read_text(), 'keep me')
        self.assertEqual(list(output.iterdir()), [sentinel])

    def test_invalid_json_does_not_leave_partial_project(self):
        self.data.write_text('{invalid')
        output = self.base / 'bad'
        result = run(CLI, 'init', '--output', output, '--data', self.data)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('FlowLens', result.stderr)
        self.assertFalse(output.exists())

    def test_local_asset_directory_is_copied(self):
        assets = self.base / 'mockups'
        assets.mkdir()
        (assets / 'screen.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        output = self.base / 'with-assets'
        result = run(CLI, 'init', '--output', output, '--data', self.data, '--assets', assets)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((output / 'assets' / 'screen.svg').is_file())

    def test_installed_skill_can_create_project_independently(self):
        dest = self.base / 'skills'
        result = run(INSTALL, '--dest', dest)
        self.assertEqual(result.returncode, 0, result.stderr)
        installed = dest / 'flowlens'
        self.assertFalse(installed.is_symlink())
        self.assertTrue((installed / 'SKILL.md').is_file())
        self.assertTrue((installed / 'assets' / 'viewer' / 'src' / 'schema.js').is_file())
        created = run(installed / 'scripts' / 'flowlens.py', 'init', '--output', self.base / 'independent', '--data', self.data)
        self.assertEqual(created.returncode, 0, created.stderr)

    def test_install_refuses_overwrite_and_update_preserves_backup(self):
        dest = self.base / 'skills'
        initial = run(INSTALL, '--dest', dest)
        self.assertEqual(initial.returncode, 0, initial.stderr)
        sentinel = dest / 'flowlens' / 'local-notes.txt'
        sentinel.write_text('preserve prior installation')
        refused = run(INSTALL, '--dest', dest)
        self.assertNotEqual(refused.returncode, 0)
        self.assertEqual(sentinel.read_text(), 'preserve prior installation')
        updated = run(INSTALL, '--dest', dest, '--update')
        self.assertEqual(updated.returncode, 0, updated.stderr)
        backup = Path(json.loads(updated.stdout)['backup'])
        self.assertEqual((backup / 'local-notes.txt').read_text(), 'preserve prior installation')
        self.assertFalse((dest / 'flowlens' / 'local-notes.txt').exists())

    def test_archive_is_self_contained_and_installable(self):
        archive = self.base / 'flowlens-skill.zip'
        result = run(ROOT / 'scripts' / 'package_skill.py', '--output', archive)
        self.assertEqual(result.returncode, 0, result.stderr)
        extracted = self.base / 'unpacked'
        with ZipFile(archive) as package:
            self.assertIsNone(package.testzip())
            self.assertIn('INSTALL.md', package.namelist())
            package.extractall(extracted)
        result = run(extracted / 'flowlens' / 'scripts' / 'install.py', '--dest', self.base / 'archive-install')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.base / 'archive-install' / 'flowlens' / 'assets' / 'viewer' / 'index.html').is_file())

if __name__ == '__main__':
    unittest.main()
