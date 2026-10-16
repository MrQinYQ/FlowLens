"""Dependency-free loopback server for a standalone FlowLens workspace."""
import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit


class ViewerHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        decoded = unquote(urlsplit(self.path).path)
        if decoded == '/__flowlens__/health':
            body = json.dumps({'app': 'flowlens', 'version': '1.0.0'}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            from io import BytesIO
            return BytesIO(body)
        root = Path(self.directory).resolve()
        target = (root / decoded.lstrip('/')).resolve()
        outside = not target.is_relative_to(root)
        hidden_target = not outside and any(part.startswith('.') for part in target.relative_to(root).parts)
        if '\\' in decoded or any(part.startswith('.') for part in decoded.split('/') if part) or outside or hidden_target:
            self.send_error(403, 'This path is not part of the prototype')
            return None
        if target.is_dir():
            for name in ('index.html', 'index.htm'):
                candidate = target / name
                if candidate.is_file():
                    actual = candidate.resolve()
                    if not actual.is_relative_to(root) or any(part.startswith('.') for part in actual.relative_to(root).parts):
                        self.send_error(403, 'This index file is not part of the prototype')
                        return None
                    break
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404, 'Directory listing is disabled')
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, fmt, *args):
        if str(args[1]) not in ('200', '304'):
            super().log_message(fmt, *args)


def serve(project, port=4173, strict_port=False):
    root = Path(project).expanduser().resolve()
    if not (root / 'index.html').is_file() or not (root / 'src' / 'main.js').is_file():
        raise ValueError('目录中没有 FlowLens 查看器，请先执行 init')
    if port < 0 or port > 65535:
        raise ValueError('端口必须在 0 到 65535 之间')
    candidates = [port] if port == 0 or strict_port else range(port, min(65536, port + 21))
    server = None
    for candidate in candidates:
        try:
            server = ThreadingHTTPServer(('127.0.0.1', candidate), partial(ViewerHandler, directory=str(root)))
            break
        except OSError as error:
            if error.errno not in (errno.EADDRINUSE, 10048):
                raise
    if server is None:
        raise ValueError('请求端口已占用，请指定其他 --port；没有终止任何已有进程')
    url = 'http://127.0.0.1:{}'.format(server.server_address[1])
    print('FLOWLENS_URL=' + url, flush=True)
    print('PROJECT=' + str(root), flush=True)
    print('仅监听本机；按 Ctrl+C 停止。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser(description='启动 FlowLens 本地预览，无需安装 npm/pip 依赖')
    parser.add_argument('--project', default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument('--port', type=int, default=4173, help='被占用时自动尝试后续端口；0 为系统分配')
    parser.add_argument('--strict-port', action='store_true')
    args = parser.parse_args()
    try:
        serve(args.project, args.port, args.strict_port)
    except (OSError, ValueError) as error:
        print('无法启动：{}'.format(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
