import importlib.util
import json
from pathlib import Path
import smtplib
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("support_service", Path(__file__).with_name("service.py"))
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)


def report(**updates):
    return {"requestId": str(uuid.uuid4()), "description": "Test: map did not finish loading.", "replyTo": "tester@example.com", "language": "en", "diagnostics": None, **updates}


DIAGNOSTICS = {"build": "2026-10-06T20:00:00.000Z", "browser": "Safari 26", "system": "iOS", "device": "phone", "viewport": "390x844", "language": "en", "quality": "balanced", "units": "us", "online": True, "map": "ready", "routeActive": True}


class InboxTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.now = 10000000
        self.inbox = service.Inbox(self.temp.name, now=lambda: self.now)

    def tearDown(self):
        self.temp.cleanup()

    def count(self):
        with self.inbox.connect() as db:
            return db.execute("SELECT COUNT(*) FROM reports").fetchone()[0]

    def test_lost_response_retry_and_restart_make_one_ticket(self):
        payload = report()
        with ThreadPoolExecutor(max_workers=8) as pool:
            ids = list(pool.map(lambda _: self.inbox.submit(payload, "192.0.2.1"), range(12)))
        self.assertEqual(len(set(ids)), 1)
        self.assertEqual(self.count(), 1)
        restarted = service.Inbox(self.temp.name, now=lambda: self.now)
        self.assertEqual(restarted.submit(payload, "192.0.2.2"), ids[0])
        with self.assertRaises(service.Rejected) as failure:
            restarted.submit({**payload, "description": "Changed description, same key"}, "192.0.2.2")
        self.assertEqual(failure.exception.status, 409)

    def test_failure_is_durable_and_retried_with_stable_message_id(self):
        ticket = self.inbox.submit(report(), "192.0.2.3")
        with patch.object(service, "smtp_send", side_effect=smtplib.SMTPServerDisconnected):
            self.inbox.deliver_one(service.smtp_send)
        with self.inbox.connect() as db:
            row = db.execute("SELECT * FROM reports").fetchone()
        self.assertEqual(row["state"], "queued")
        self.assertEqual(row["last_error"], "SMTPServerDisconnected")
        self.assertFalse(self.inbox.deliver_one(lambda _: self.fail("Too early")))
        self.now += 61
        messages = []
        self.inbox.deliver_one(lambda value: messages.append(service.message_for(value, "dispatch@ezclickgo.com", "support@ezclickgo.com")))
        self.assertEqual(messages[0]["Message-ID"], f"<{ticket}@weather.ezclickgo.com>")
        self.assertEqual(messages[0]["To"], "support@ezclickgo.com")
        self.assertEqual(messages[0]["Reply-To"], "tester@example.com")
        self.assertFalse(self.inbox.deliver_one(lambda _: self.fail("Duplicate delivery")))

    def test_ai_consent_is_explicit_and_legacy_retry_survives_upgrade(self):
        payload = report()
        first = self.inbox.submit(payload, "192.0.2.8")
        self.assertEqual(self.inbox.submit({**payload, "aiConsent": False}, "192.0.2.8"), first)
        with self.inbox.connect() as db:
            body = json.loads(db.execute("SELECT body FROM reports WHERE id=?", (first,)).fetchone()[0])
            self.assertNotIn("aiConsent", body)
            self.assertEqual(db.execute("PRAGMA foreign_keys").fetchone()[0], 1)
        with self.assertRaises(service.Rejected) as failure:
            self.inbox.submit({**payload, "aiConsent": True}, "192.0.2.8")
        self.assertEqual(failure.exception.status, 409)
        ticket = self.inbox.submit(report(aiConsent=True), "192.0.2.8")
        with self.inbox.connect() as db:
            self.assertIs(json.loads(db.execute("SELECT body FROM reports WHERE id=?", (ticket,)).fetchone()[0])["aiConsent"], True)
        for value in (1, "true", None, []):
            with self.assertRaises(service.Rejected):
                self.inbox.submit(report(aiConsent=value), "192.0.2.8")

    def test_recipient_injection_and_private_diagnostics_are_rejected(self):
        invalid = [report(replyTo="user@example.com\r\nBcc: victim@example.com"), report(to="victim@example.com"), report(description="short"), report(diagnostics={**DIAGNOSTICS, "gps": [1, 2]}), report(diagnostics={**DIAGNOSTICS, "browser": "https://secret/token"}), report(language=["en"]), report(diagnostics={**DIAGNOSTICS, "online": 1})]
        for payload in invalid:
            with self.subTest(payload=payload), self.assertRaises(service.Rejected):
                self.inbox.submit(payload, "192.0.2.4")
        self.assertEqual(self.count(), 0)
        self.inbox.submit(report(diagnostics=DIAGNOSTICS), "192.0.2.4")
        self.inbox.submit(report(replyTo=""), "192.0.2.4")
        with self.inbox.connect() as db:
            dump = "\n".join(db.iterdump())
        self.assertNotIn("192.0.2.4", dump)

    def test_rate_limit_does_not_block_idempotent_retry_and_expires(self):
        payload = report()
        first = self.inbox.submit(payload, "192.0.2.5")
        for _ in range(19):
            self.inbox.submit(report(), "192.0.2.5")
        with self.assertRaises(service.Rejected) as failure:
            self.inbox.submit(report(), "192.0.2.5")
        self.assertEqual(failure.exception.status, 429)
        self.assertEqual(self.inbox.submit(payload, "192.0.2.5"), first)
        self.now += 3601
        self.inbox.submit(report(), "192.0.2.5")

    def test_retention_removes_report_text_and_network_hashes(self):
        self.inbox.submit(report(description="A unique report privacy marker"), "192.0.2.6")
        self.now += service.RETENTION + 1
        self.inbox.cleanup()
        self.assertEqual(self.count(), 0)
        with self.inbox.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM rate").fetchone()[0], 0)
        self.assertNotIn(b"A unique report privacy marker", self.inbox.path.read_bytes())

    def test_tls_failure_never_sends_plaintext(self):
        ticket = self.inbox.submit(report(), "192.0.2.7")
        with self.inbox.connect() as db:
            row = dict(db.execute("SELECT * FROM reports WHERE id=?", (ticket,)).fetchone())
        with patch.object(service.smtplib, "SMTP") as client:
            connection = client.return_value.__enter__.return_value
            connection.starttls.side_effect = smtplib.SMTPNotSupportedError()
            with self.assertRaises(smtplib.SMTPNotSupportedError):
                service.smtp_send(row)
            connection.send_message.assert_not_called()


class HTTPTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.inbox = service.Inbox(self.temp.name)
        self.server = service.SupportServer(("127.0.0.1", 0), self.inbox, ["https://weather.ezclickgo.com"])
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, body, path="/reports", headers=None):
        request = urllib.request.Request(self.url + path, data=body, headers={"Origin": "https://weather.ezclickgo.com", "Content-Type": "application/json", **(headers or {})})
        try:
            response = urllib.request.urlopen(request, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def test_real_http_to_durable_queue_and_private_read_boundary(self):
        payload = json.dumps(report()).encode()
        status, data = self.request(payload)
        self.assertEqual(status, 202)
        self.assertRegex(data["ticketId"], r"^EZ-[A-F0-9]{12}$")
        self.assertEqual(self.request(payload)[1], data)
        with self.inbox.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM reports").fetchone()[0], 1)
        with self.assertRaises(urllib.error.HTTPError) as failure:
            urllib.request.urlopen(self.url + "/reports")
        self.assertEqual(failure.exception.code, 404)

    def test_origin_content_type_oversize_and_storage_failure(self):
        payload = json.dumps(report()).encode()
        self.assertEqual(self.request(payload, headers={"Origin": "https://attacker.example"})[0], 403)
        self.assertEqual(self.request(payload, headers={"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request(payload, headers={"Sec-Fetch-Site": "cross-site"})[0], 403)
        self.assertEqual(self.request(b"x" * (service.MAX_BODY + 1))[0], 413)
        self.assertEqual(self.request(json.dumps(report(description="气" * 6000), ensure_ascii=False).encode())[0], 202)
        self.assertEqual(self.request(b"{malformed")[0], 400)
        with patch.object(self.inbox, "submit", side_effect=sqlite3.OperationalError("private storage details")):
            status, data = self.request(payload)
            self.assertEqual(status, 503)
            self.assertEqual(data, {"error": "temporarily_unavailable"})


if __name__ == "__main__":
    unittest.main()
