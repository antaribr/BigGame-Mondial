#!/usr/bin/env python3
"""Tiny development server with SPA fallback for BigGame's clean routes."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import os

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8080"))
APP_PREFIXES = ("/team", "/advisor", "/admin")
APP_ROUTES = {"/", "/scoreboard"}


class BigGameHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        local_path = (ROOT / path.lstrip("/")).resolve()
        is_app_route = path in APP_ROUTES or any(
            path == prefix or path.startswith(prefix + "/") for prefix in APP_PREFIXES
        )

        if is_app_route and not local_path.is_file():
            self.path = "/index.html"
        super().do_GET()

    def end_headers(self):
        if urlparse(self.path).path == "/config.json":
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), BigGameHandler)
    print(f"BigGame running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping BigGame.")
    finally:
        server.server_close()
