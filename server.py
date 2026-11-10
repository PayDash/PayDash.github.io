# Local dev server with no-cache headers — plain reloads always get fresh
# files (Safari's memory cache loves to serve stale JS without these).
# Usage: python3 server.py  →  http://localhost:8123
import http.server

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet

if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("", 8123), NoCacheHandler)
    print("serving on http://localhost:8123 — no-cache headers on")
    server.serve_forever()
