"""Простой HTTP-сервис заметок на стандартной библиотеке Python.

Запуск:
    NOTES_API_KEY=<ключ> python app.py

Эндпоинты:
    GET    /notes?page=1&size=10   список заметок с пагинацией
    GET    /notes/search?q=текст   поиск по заголовку
    GET    /notes/<id>             одна заметка
    POST   /notes                  создать заметку {"title": "...", "body": "...", "tags": [...]}
    DELETE /notes/<id>             удалить заметку (нужен заголовок X-Api-Key)
    GET    /stats                  статистика

Настройки через переменные окружения:
    NOTES_DB_PATH  путь к файлу SQLite (по умолчанию notes.db)
    NOTES_API_KEY  ключ для удаления заметок (без него удаление запрещено)
    NOTES_HOST     адрес (по умолчанию 127.0.0.1)
    NOTES_PORT     порт (по умолчанию 8080)
"""

import hmac
import json
import os
import sqlite3
from contextlib import closing
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

DB_PATH = os.environ.get("NOTES_DB_PATH", "notes.db")
API_KEY = os.environ.get("NOTES_API_KEY", "")
HOST = os.environ.get("NOTES_HOST", "127.0.0.1")
PORT = int(os.environ.get("NOTES_PORT", "8080"))

MAX_PAGE_SIZE = 100


class BadRequest(Exception):
    pass


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with closing(get_connection()) as conn:
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


def row_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "tags": row["tags"].split(",") if row["tags"] else [],
    }


def normalize_tags(tags):
    seen = set()
    result = []
    for tag in tags:
        tag = tag.strip().lower()
        if tag and tag not in seen:
            seen.add(tag)
            result.append(tag)
    return result


def list_notes(page, size):
    offset = (page - 1) * size
    with closing(get_connection()) as conn:
        rows = conn.execute(
            "SELECT * FROM notes ORDER BY id LIMIT ? OFFSET ?", (size, offset)
        ).fetchall()
    return [row_to_dict(r) for r in rows]


def escape_like(value):
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_notes(query):
    pattern = f"%{escape_like(query)}%"
    with closing(get_connection()) as conn:
        rows = conn.execute(
            "SELECT * FROM notes WHERE title LIKE ? ESCAPE '\\' ORDER BY id",
            (pattern,),
        ).fetchall()
    return [row_to_dict(r) for r in rows]


def get_note(note_id):
    with closing(get_connection()) as conn:
        row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
    return row_to_dict(row) if row else None


def create_note(title, body, tags):
    with closing(get_connection()) as conn:
        cur = conn.execute(
            "INSERT INTO notes (title, body, tags) VALUES (?, ?, ?)",
            (title, body, ",".join(normalize_tags(tags))),
        )
        conn.commit()
        note_id = cur.lastrowid
    return get_note(note_id)


def delete_note(note_id):
    with closing(get_connection()) as conn:
        cur = conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        conn.commit()
        return cur.rowcount > 0


def get_stats():
    with closing(get_connection()) as conn:
        total, total_len = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(LENGTH(body)), 0) FROM notes"
        ).fetchone()
    avg = round(total_len / total, 2) if total else 0
    return {"total": total, "avg_body_length": avg}


def parse_positive_int(value, name, maximum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise BadRequest(f"{name} must be an integer")
    if number < 1:
        raise BadRequest(f"{name} must be >= 1")
    if maximum is not None and number > maximum:
        raise BadRequest(f"{name} must be <= {maximum}")
    return number


def validate_note_payload(data):
    if not isinstance(data, dict):
        raise BadRequest("body must be a JSON object")
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise BadRequest("title is required")
    body = data.get("body", "")
    
    tags = data.get("tags", [])
    if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
        raise BadRequest("tags must be a list of strings")
    return title.strip(), body, tags


class NotesHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_no_content(self):
        self.send_response(204)
        self.end_headers()

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            return json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise BadRequest("invalid JSON")

    def _path_parts(self):
        return [p for p in urlparse(self.path).path.split("/") if p]

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            parts = self._path_parts()

            if parts == ["notes"]:
                page = parse_positive_int(params.get("page", ["1"])[0], "page")
                size = parse_positive_int(
                    params.get("size", ["10"])[0], "size", MAX_PAGE_SIZE
                )
                self._send_json(200, list_notes(page, size))
            elif parts == ["notes", "search"]:
                query = params.get("q", [""])[0]
                self._send_json(200, search_notes(query))
            elif len(parts) == 2 and parts[0] == "notes":
                note = get_note(parse_positive_int(parts[1], "id"))
                if note is None:
                    self._send_json(404, {"error": "note not found"})
                else:
                    self._send_json(200, note)
            elif parts == ["stats"]:
                self._send_json(200, get_stats())
            else:
                self._send_json(404, {"error": "not found"})
        except BadRequest as e:
            self._send_json(400, {"error": str(e)})

    def do_POST(self):
        if self._path_parts() != ["notes"]:
            self._send_json(404, {"error": "not found"})
            return
        try:
            title, body, tags = validate_note_payload(self._read_json())
        except BadRequest as e:
            self._send_json(400, {"error": str(e)})
            return
        note = create_note(title, body, tags)
        self._send_json(201, note)

    def do_DELETE(self):
        parts = self._path_parts()
        if len(parts) != 2 or parts[0] != "notes":
            self._send_json(404, {"error": "not found"})
            return
        provided = self.headers.get("X-Api-Key", "")
        if not API_KEY or not hmac.compare_digest(provided, API_KEY):
            self._send_json(403, {"error": "forbidden"})
            return
        try:
            note_id = parse_positive_int(parts[1], "id")
        except BadRequest as e:
            self._send_json(400, {"error": str(e)})
            return
        if not delete_note(note_id):
            self._send_json(404, {"error": "note not found"})
            return
        self._send_no_content()


def main():
    init_db()
    if not API_KEY:
        print("Warning: NOTES_API_KEY is not set, deleting notes is disabled")
    server = HTTPServer((HOST, PORT), NotesHandler)
    print(f"Notes service listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
