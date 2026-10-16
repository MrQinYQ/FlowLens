from contextlib import contextmanager
import json
from pathlib import Path
import queue
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
VIEWER = ROOT / 'skills/flowlens/assets/viewer'
SERVER = VIEWER / 'tools/serve.py'


@contextmanager
def server(project, port=0):
    process = subprocess.Popen([sys.executable, str(SERVER), '--project', str(project), '--port', str(port)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    lines = queue.Queue()
    threading.Thread(target=lambda: [lines.put(line) for line in process.stdout], daemon=True).start()
    try:
        first = lines.get(timeout=8)
        if not first.startswith('FLOWLENS_URL='):
            raise AssertionError('unexpected server output: ' + first)
        yield first.strip().split('=', 1)[1]
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        process.stdout.close()
        process.stderr.close()


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='flowlens-server-test-')
        self.project = Path(self.temp.name) / 'workspace'
        shutil.copytree(VIEWER, self.project, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))

    def tearDown(self):
        self.temp.cleanup()

    def test_health_runtime_and_assets_are_served_on_loopback(self):
        with server(self.project) as url:
            self.assertTrue(url.startswith('http://127.0.0.1:'))
            with urlopen(url + '/__flowlens__/health', timeout=3) as response:
                self.assertEqual(json.loads(response.read())['app'], 'flowlens')
            with urlopen(url + '/src/main.js', timeout=3) as response:
                self.assertIn(b'viewer.config.json', response.read())
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
            with urlopen(url + '/', timeout=3) as response:
                self.assertEqual(response.status, 200)

    def test_occupied_port_is_skipped_without_touching_other_socket(self):
        with socket.socket() as occupied:
            occupied.bind(('127.0.0.1', 0))
            occupied.listen()
            port = occupied.getsockname()[1]
            with server(self.project, port) as url:
                self.assertNotEqual(int(url.rsplit(':', 1)[1]), port)
                self.assertEqual(occupied.getsockname()[1], port)

    def test_hidden_and_symlink_escape_paths_are_blocked(self):
        (self.project / '.secret.txt').write_text('test fixture')
        outside = Path(self.temp.name) / 'outside.txt'
        outside.write_text('outside test fixture')
        (self.project / 'outside.txt').symlink_to(outside)
        (self.project / 'hidden-alias.txt').symlink_to(self.project / '.secret.txt')
        (self.project / 'docs').mkdir()
        (self.project / 'docs/index.html').symlink_to(outside)
        with server(self.project) as url:
            for path in ['/.secret.txt', '/%2esecret.txt', '/outside.txt', '/hidden-alias.txt', '/docs/']:
                with self.subTest(path=path):
                    with self.assertRaises(HTTPError) as caught:
                        urlopen(url + path, timeout=3)
                    self.assertEqual(caught.exception.code, 403)

if __name__ == '__main__':
    unittest.main()
