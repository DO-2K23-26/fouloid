#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import os

script_path = None

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length) if length else b''

    def send_json(self, code, body):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body.encode() if isinstance(body, str) else body)

    def do_GET(self):
        if self.path in ('/healthz', '/readiness-healthz'):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            self.run_script(b'')

    def do_POST(self):
        body = self.read_body()
        if self.path in ('/specialize', '/v2/specialize'):
            global script_path
            try:
                data = json.loads(body) if body else {}
                script_path = data.get('filepath', '/userfunc/user')
            except Exception:
                script_path = '/userfunc/user'
            self.send_response(202)
            self.end_headers()
        else:
            self.run_script(body)

    def run_script(self, body):
        global script_path
        if not script_path:
            self.send_json(500, '{"error":"not specialized"}')
            return
        env = os.environ.copy()
        env['REQUEST_METHOD'] = self.command
        env['CONTENT_TYPE'] = self.headers.get('Content-Type', '')
        try:
            result = subprocess.run(
                ['bash', script_path],
                input=body,
                capture_output=True,
                env=env,
                timeout=60,
            )
            if result.returncode == 0:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.stdout)
            else:
                err = result.stderr.decode(errors='replace') or result.stdout.decode(errors='replace')
                self.send_json(500, json.dumps({'error': err}))
        except subprocess.TimeoutExpired:
            self.send_json(500, '{"error":"timeout"}')
        except Exception as e:
            self.send_json(500, json.dumps({'error': str(e)}))

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8888))
    print(f'fission bash env listening on :{port}', flush=True)
    HTTPServer(('', port), Handler).serve_forever()
