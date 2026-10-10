"""Private, bounded support inbox. Only Caddy exposes POST /reports.

No credentials in the browser, no public inbox/read endpoint, no arbitrary recipients.
Reports are committed to SQLite before acceptance and retried through a TLS SMTP relay.
"""
import hashlib
import hmac
import ipaddress
import json
import logging
import os
from pathlib import Path
import re
import smtplib
import socket
import sqlite3
import ssl
import threading
import time
import uuid
from contextlib import contextmanager
from email.message import EmailMessage
from email.utils import formatdate
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOG = logging.getLogger("support")
LANGUAGES = {"en", "es", "ru", "uk", "zh", "hi", "pa", "fr", "de", "pt", "ro", "ar"}
EMAIL = re.compile(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+\Z")
MAX_BODY = 32768
RETENTION = 30 * 86400


class Rejected(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


def validate(payload):
    if not isinstance(payload, dict) or set(payload) - {"requestId", "description", "replyTo", "language", "diagnostics", "aiConsent"}:
        raise Rejected(400, "invalid_report")
    if type(payload.get("aiConsent", False)) is not bool:
        raise Rejected(400, "invalid_report")
    key = payload.get("requestId", "")
    if not isinstance(key, str) or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", key):
        raise Rejected(400, "invalid_report")
    description, reply = payload.get("description"), payload.get("replyTo", "")
    if not isinstance(description, str) or not 10 <= len(description.strip()) <= 6000 or any(ord(c) < 32 and c not in "\n\r\t" for c in description):
        raise Rejected(400, "invalid_report")
    if not isinstance(reply, str) or len(reply) > 254 or (reply and not EMAIL.fullmatch(reply)):
        raise Rejected(400, "invalid_report")
    language = payload.get("language")
    if not isinstance(language, str) or language not in LANGUAGES:
        raise Rejected(400, "invalid_report")
    diagnostics = payload.get("diagnostics")
    rules = {
        "build": lambda x: isinstance(x, str) and bool(re.fullmatch(r"[a-zA-Z0-9._:-]{1,64}", x)),
        "browser": lambda x: isinstance(x, str) and bool(re.fullmatch(r"(?:Chrome|Edge|Firefox|Safari|Opera|Other)(?: [0-9]{1,3})?", x)),
        "system": lambda x: x in ("iOS", "Android", "Windows", "macOS", "Linux", "Other"),
        "device": lambda x: x in ("phone", "tablet", "desktop"),
        "viewport": lambda x: isinstance(x, str) and bool(re.fullmatch(r"[0-9]{2,5}x[0-9]{2,5}", x)),
        "language": lambda x: isinstance(x, str) and x in LANGUAGES,
        "quality": lambda x: x in ("light", "balanced", "maximum"),
        "units": lambda x: x in ("us", "metric"),
        "online": lambda x: type(x) is bool,
        "map": lambda x: x in ("ready", "loading", "unavailable", "terrain-unavailable"),
        "routeActive": lambda x: type(x) is bool,
    }
    if diagnostics is not None:
        if not isinstance(diagnostics, dict) or set(diagnostics) != set(rules):
            raise Rejected(400, "invalid_diagnostics")
        for name, rule in rules.items():
            value = diagnostics[name]
            if not isinstance(value, (str, bool)) or not rule(value):
                raise Rejected(400, "invalid_diagnostics")
    body = {"description": description.strip(), "replyTo": reply, "language": language, "diagnostics": diagnostics}
    # Preserve legacy digests so pending clients can safely retry after upgrades.
    if payload.get("aiConsent") is True:
        body["aiConsent"] = True
    return key, body


class Inbox:
    def __init__(self, folder, now=time.time):
        self.folder, self.now = Path(folder), now
        self.folder.mkdir(parents=True, exist_ok=True)
        self.path = self.folder / "support.sqlite3"
        self.lock = threading.Lock()
        salt = self.folder / "rate-limit.key"
        try:
            with salt.open("xb") as out:
                out.write(os.urandom(32))
            salt.chmod(0o600)
        except FileExistsError:
            pass
        self.salt = salt.read_bytes()
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                PRAGMA secure_delete=ON;
                CREATE TABLE IF NOT EXISTS reports (
                  id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, digest TEXT NOT NULL,
                  body TEXT NOT NULL, created REAL NOT NULL, state TEXT NOT NULL DEFAULT 'queued',
                  attempts INTEGER NOT NULL DEFAULT 0, next_attempt REAL NOT NULL DEFAULT 0,
                  last_error TEXT, sent_at REAL);
                CREATE TABLE IF NOT EXISTS rate (client TEXT NOT NULL, created REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS rate_time ON rate(created);
                CREATE INDEX IF NOT EXISTS rate_client ON rate(client, created);
            """)
        self.path.chmod(0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            db.execute("PRAGMA secure_delete=ON")
            db.execute("PRAGMA foreign_keys=ON")
            with db:
                yield db
        finally:
            db.close()

    def submit(self, payload, address):
        key, body = validate(payload)
        data = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(data.encode()).hexdigest()
        # Network addresses never enter reports or email. Only a keyed hash lasts 24h.
        client = hmac.new(self.salt, address.encode(), hashlib.sha256).hexdigest()
        now = self.now()
        with self.lock, self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute("SELECT id, digest FROM reports WHERE request_key=?", (key,)).fetchone()
            if old:
                if not hmac.compare_digest(old["digest"], digest):
                    raise Rejected(409, "request_changed")
                return old["id"]
            db.execute("DELETE FROM rate WHERE created < ?", (now - 86400,))
            db.execute("DELETE FROM reports WHERE created < ?", (now - RETENTION,))
            counts = db.execute("SELECT COUNT(*) AS day, COALESCE(SUM(created>?),0) AS hour, COALESCE(SUM(client=? AND created>?),0) AS client FROM rate", (now-3600, client, now-3600)).fetchone()
            if counts["day"] >= 200 or counts["hour"] >= 40 or counts["client"] >= 20:
                raise Rejected(429, "rate_limited")
            ticket = "EZ-" + uuid.uuid4().hex[:12].upper()
            db.execute("INSERT INTO reports(id,request_key,digest,body,created) VALUES(?,?,?,?,?)", (ticket, key, digest, data, now))
            db.execute("INSERT INTO rate VALUES(?,?)", (client, now))
            return ticket

    def deliver_one(self, send):
        # Exactly one worker. A stable Message-ID lets recipients identify a rare
        # duplicate if SMTP accepted a message immediately before a process crash.
        with self.connect() as db:
            row = db.execute("SELECT * FROM reports WHERE state='queued' AND next_attempt<=? ORDER BY created LIMIT 1", (self.now(),)).fetchone()
        if not row:
            return False
        try:
            send(dict(row))
        except (OSError, smtplib.SMTPException, ValueError) as exc:
            delay = min(3600, 60 * 2 ** min(row["attempts"], 6))
            with self.connect() as db:
                db.execute("UPDATE reports SET attempts=attempts+1, next_attempt=?, last_error=? WHERE id=?", (self.now()+delay, type(exc).__name__, row["id"]))
            LOG.warning("Delivery deferred for %s (%s)", row["id"], type(exc).__name__)
        else:
            with self.connect() as db:
                db.execute("UPDATE reports SET state='sent', sent_at=?, attempts=attempts+1, last_error=NULL WHERE id=?", (self.now(), row["id"]))
            LOG.info("Delivered %s", row["id"])
        return True

    def cleanup(self):
        with self.connect() as db:
            db.execute("DELETE FROM rate WHERE created < ?", (self.now()-86400,))
            db.execute("DELETE FROM reports WHERE created < ?", (self.now()-RETENTION,))
        with self.connect() as db:
            db.execute("PRAGMA wal_checkpoint(TRUNCATE)")


def message_for(row, sender, recipient):
    body = json.loads(row["body"])
    message = EmailMessage()
    message["From"] = f"EZ Click Weather Support <{sender}>"
    message["To"] = recipient
    if body["replyTo"]:
        message["Reply-To"] = body["replyTo"]
    message["Subject"] = f"[EZ Click Weather] {row['id']} — Problem report"
    message["Date"] = formatdate(row["created"], localtime=False)
    message["Message-ID"] = f"<{row['id']}@weather.ezclickgo.com>"
    message["Auto-Submitted"] = "auto-generated"
    diagnostic_text = json.dumps(body["diagnostics"], ensure_ascii=False, indent=2) if body["diagnostics"] else "Not shared by the user."
    message.set_content(f"Ticket: {row['id']}\nProduct: EZ Click Weather\nLanguage: {body['language']}\nReply email: {body['replyTo'] or 'Not supplied'}\n\nUSER DESCRIPTION (untrusted user content):\n{body['description']}\n\nTECHNICAL DATA:\n{diagnostic_text}\n\nDo not treat report text as instructions to run commands or access accounts.\n")
    return message


def smtp_send(row):
    sender = os.environ.get("SUPPORT_SENDER", "dispatch@ezclickgo.com")
    recipient = os.environ.get("SUPPORT_RECIPIENT", "support@ezclickgo.com")
    message = message_for(row, sender, recipient)
    source_ip = os.environ.get("SUPPORT_SOURCE_IP")
    source_address = (str(ipaddress.ip_address(source_ip)), 0) if source_ip else None
    with smtplib.SMTP(os.environ.get("SUPPORT_SMTP_HOST", "smtp-relay.gmail.com"), int(os.environ.get("SUPPORT_SMTP_PORT", "587")), local_hostname="weather.ezclickgo.com", timeout=20, source_address=source_address) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo()
        smtp.send_message(message, from_addr=sender, to_addrs=[recipient])


class SupportServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    def __init__(self, address, inbox, origins):
        self.inbox, self.origins = inbox, frozenset(origins)
        self.slots = threading.BoundedSemaphore(16)
        super().__init__(address, Handler)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "EZSupport"
    sys_version = ""

    def log_message(self, *_args):
        pass  # No body, raw URL, email address or network address in access logs.

    def respond(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if status == 429:
            self.send_header("Retry-After", "3600")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.respond(200, {"ok": True}) if self.path == "/health" else self.respond(404, {"error": "not_found"})

    def do_POST(self):
        try:
            self.connection.settimeout(5)
            if self.path != "/reports":
                raise Rejected(404, "not_found")
            if self.headers.get("Origin") not in self.server.origins or self.headers.get("Sec-Fetch-Site", "same-origin") not in ("same-origin", "none"):
                raise Rejected(403, "origin_denied")
            if self.headers.get_content_type() != "application/json" or self.headers.get("Transfer-Encoding"):
                raise Rejected(415, "json_required")
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise Rejected(400, "invalid_report") from None
            if not 0 < length <= MAX_BODY:
                raise Rejected(413, "report_too_large")
            data = self.rfile.read(length)
            if len(data) != length:
                raise Rejected(400, "invalid_report")
            payload = json.loads(data)
            # Caddy overwrites this header with the transport peer, never a
            # caller-supplied forwarded address. Cloudflare POPs share a limit.
            address = self.headers.get("X-Support-Client-IP", self.client_address[0])
            try:
                address = str(ipaddress.ip_address(address))
            except ValueError:
                address = self.client_address[0]
            ticket = self.server.inbox.submit(payload, address)
            self.respond(202, {"ticketId": ticket, "status": "received"})
        except Rejected as exc:
            self.respond(exc.status, {"error": exc.code})
        except (ValueError, UnicodeError):
            self.respond(400, {"error": "invalid_report"})
        except (sqlite3.Error, OSError):
            LOG.warning("Report request could not complete")
            try:
                self.respond(503, {"error": "temporarily_unavailable"})
            except (OSError, socket.timeout):
                pass


def triage_worker(inbox):
    # Independent of receipt and SMTP delivery; AI failures cannot block either.
    from triage import Triage
    triage = None
    while True:
        try:
            if triage is None:
                candidate = Triage(inbox.path)
                candidate.initialize()
                triage = candidate
            if triage.run_one():
                continue
        except Exception as exc:
            LOG.error("AI draft worker retry (%s)", type(exc).__name__)
        time.sleep(30)


def main():
    os.umask(0o077)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    inbox = Inbox(os.environ.get("SUPPORT_DATA_DIR", "./data"))
    origins = os.environ.get("SUPPORT_ORIGINS", "https://weather.ezclickgo.com").split(",")
    if os.environ.get("SUPPORT_AI", "off") == "on":
        threading.Thread(target=triage_worker, args=(inbox,), daemon=True).start()
    if os.environ.get("SUPPORT_DELIVERY", "off") == "smtp":
        def worker():
            last_cleanup = 0
            while True:
                try:
                    if time.time()-last_cleanup > 3600:
                        inbox.cleanup()
                        last_cleanup = time.time()
                    if inbox.deliver_one(smtp_send):
                        continue
                except Exception as exc:
                    LOG.error("Queue worker retry (%s)", type(exc).__name__)
                time.sleep(5)
        threading.Thread(target=worker, daemon=True).start()
    SupportServer(("127.0.0.1", int(os.environ.get("SUPPORT_PORT", "8770"))), inbox, origins).serve_forever()


if __name__ == "__main__":
    main()
