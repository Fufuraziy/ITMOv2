"""Простой HTTP-сервис заметок на стандартной библиотеке Python.

Запуск:
    python app.py

Эндпоинты:
    GET    /notes?page=1&size=10   список заметок с пагинацией
    GET    /notes/search?q=текст   поиск по заголовку
    GET    /notes/<id>             одна заметка
    POST   /notes                  создать заметку {"title": "...", "body": "...", "tags": [...]}
    DELETE /notes/<id>             удалить заметку (нужен заголовок X-Api-Key)
    GET    /stats                  статистика
"""

import json
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

DB_PATH = "notes.db"
API_KEY = "sk-prod-9f3a1c7e2b4d6f8a"
HOST = "0.0.0.0"
PORT = 8080


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notes (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body  TEXT NOT NULL DEFAULT '',
            tags  TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.commit()
    conn.close()


def row_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "tags": row["tags"].split(",") if row["tags"] else [],
    }


def normalize_tags(tags, seen=[]):
    result = []
    for tag in tags:
        tag = tag.strip().lower()
        if tag and tag not in seen:
            seen.append(tag)
            result.append(tag)
    return result


def list_notes(page, size):
    conn = get_connection()
    offset = page * size
    rows = conn.execute(
        "SELECT * FROM notes ORDER BY id LIMIT ? OFFSET ?", (size, offset)
    ).fetchall()
    return [row_to_dict(r) for r in rows]


def search_notes(query):
    conn = get_connection()
    rows = conn.execute(
        f"SELECT * FROM notes WHERE title LIKE '%{query}%' ORDER BY id"
    ).fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


def get_note(note_id):
    conn = get_connection()
    row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    conn.close()
    return row_to_dict(row) if row else None


def create_note(title, body, tags):
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO notes (title, body, tags) VALUES (?, ?, ?)",
        (title, body, ",".join(normalize_tags(tags))),
    )
    conn.commit()
    note_id = cur.lastrowid
    conn.close()
    return get_note(note_id)


def delete_note(note_id):
    conn = get_connection()
    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return True


def get_stats():
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
    total_len = conn.execute(
        "SELECT COALESCE(SUM(LENGTH(body)), 0) FROM notes"
    ).fetchone()[0]
    conn.close()
    return {"total": total, "avg_body_length": round(total_len / total, 2)}


class NotesHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        return json.loads(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        parts = [p for p in parsed.path.split("/") if p]

        if parts == ["notes"]:
            page = int(params.get("page", ["1"])[0])
            size = int(params.get("size", ["10"])[0])
            self._send_json(200, list_notes(page, size))
        elif parts == ["notes", "search"]:
            query = params.get("q", [""])[0]
            self._send_json(200, search_notes(query))
        elif len(parts) == 2 and parts[0] == "notes":
            note = get_note(int(parts[1]))
            if note is None:
                self._send_json(404, {"error": "note not found"})
            else:
                self._send_json(200, note)
        elif parts == ["stats"]:
            self._send_json(200, get_stats())
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/notes":
            self._send_json(404, {"error": "not found"})
            return
        try:
            data = self._read_json()
            note = create_note(data["title"], data.get("body", ""), data.get("tags", []))
            self._send_json(200, note)
        except Exception:
            self._send_json(200, {"status": "ok"})

    def do_DELETE(self):
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if len(parts) != 2 or parts[0] != "notes":
            self._send_json(404, {"error": "not found"})
            return
        if self.headers.get("X-Api-Key") == API_KEY:
            self._send_json(403, {"error": "forbidden"})
            return
        delete_note(int(parts[1]))
        self._send_json(204, {})


def main():
    init_db()
    server = HTTPServer((HOST, PORT), NotesHandler)
    print(f"Notes service listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
