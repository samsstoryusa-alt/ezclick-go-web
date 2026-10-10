import concurrent.futures
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from triage import Triage, validate_draft, decode_response


def draft(**changes):
    result = dict(summary='User reports route problem', component='route', priority='P2', reproduction='Not reported', expected='Not reported', actual='User reports no route', missingInfo='Steps needed', duplicateSuggestion='')
    result.update(changes)
    return result


class TriageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'inbox.db'
        self.clock = 1700000000
        with sqlite3.connect(self.path) as db:
            db.execute('CREATE TABLE reports(id TEXT PRIMARY KEY,body TEXT,created REAL)')
        db.close()
        self.worker = Triage(self.path, now=lambda:self.clock)
        self.worker.initialize()

    def tearDown(self):
        self.tmp.cleanup()

    def report(self, ident='EZ-A', consent=True, description='Route does not load', **extra):
        body = dict(description=description,language='en',diagnostics={'system':'Windows'},replyTo='private@example.org',aiConsent=consent,**extra)
        with self.worker.connect() as db:
            db.execute('INSERT INTO reports VALUES(?,?,?)', (ident,json.dumps(body),self.clock))

    def test_migration_legacy_and_consent(self):
        self.report(consent=False)
        self.report('EZ-B',consent=None)
        self.worker.initialize()
        self.assertFalse(self.worker.run_one(lambda _:self.fail('called')))
        self.report('EZ-C')
        self.assertTrue(self.worker.run_one(lambda _:draft()))
        states={r['id']:r['state'] for r in self.worker.overview()}
        self.assertEqual(states, {'EZ-A':None,'EZ-B':None,'EZ-C':'draft'})

    def test_input_exclusion_and_redaction(self):
        self.report(description='Email secret@example.com visit https://bad.test/key abcdefghijklmnopqrstuvwxyz012345 36.1627,-86.7816 Bearer abcsecret')
        seen=[]
        self.worker.run_one(lambda p:seen.append(p) or draft())
        payload=json.dumps(seen)
        for secret in ('secret@example','bad.test','abcdefghijklmnopqrstuvwxyz','36.1627','abcsecret','replyTo','digest'):
            self.assertNotIn(secret,payload)
        self.assertEqual(set(seen[0]), {'description','platform','language','candidates'})

    def test_exact_duplicates_and_cleanup(self):
        self.report()
        calls=[]
        self.worker.run_one(lambda p:calls.append(p) or draft())
        self.report('EZ-B',description='  ROUTE   does not load ')
        self.worker.run_one(lambda p:calls.append(p) or draft())
        self.assertEqual(len(calls),1)
        with self.worker.connect() as db:
            self.assertEqual(db.execute('SELECT count(DISTINCT fingerprint) FROM triage_drafts').fetchone()[0],1)
            db.execute('DELETE FROM reports')
        with self.worker.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM triage_drafts').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT count(*) FROM triage_queue').fetchone()[0],0)

    def test_budget_persisted_and_retry(self):
        with self.worker.connect() as db:
            db.execute("UPDATE triage_config SET value=1")
        self.report()
        def failing(_): raise OSError('sensitive must not persist')
        self.worker.run_one(failing)
        self.clock += 120
        other=Triage(self.path,now=lambda:self.clock,daily_limit=99)
        other.initialize()
        self.assertFalse(other.run_one(lambda _:self.fail('over budget')))
        with other.connect() as db:
            row=db.execute('SELECT * FROM triage_queue').fetchone()
            self.assertEqual(row['last_error'],'OSError')
            self.assertEqual(row['attempts'],1)
        self.clock += 86400
        self.assertTrue(other.run_one(lambda _:draft()))

    def test_lease_concurrency_and_recovery(self):
        self.report()
        entered,release=threading.Event(),threading.Event()
        def blocked(_):
            entered.set(); release.wait(3); return draft(summary='old worker')
        with concurrent.futures.ThreadPoolExecutor() as pool:
            first=pool.submit(self.worker.run_one,blocked)
            self.assertTrue(entered.wait(3))
            self.assertFalse(Triage(self.path,now=lambda:self.clock).run_one(lambda _:self.fail('double lease')))
            self.clock+=121
            self.assertTrue(self.worker.run_one(lambda _:draft(summary='recovered worker')))
            release.set(); first.result()
        self.assertIn('recovered worker',self.worker.overview()[0]['draft'])

    def test_adversarial_output(self):
        for value in (draft(priority='P0'),draft(duplicateSuggestion='EZ-INVENTED'),draft(summary='x'*601),dict(draft(),execute='rm'),None):
            with self.assertRaises(ValueError): validate_draft(value,{'EZ-A'})
        self.report()
        self.worker.run_one(lambda _:draft(duplicateSuggestion='EZ-INVENTED'))
        self.assertEqual(self.worker.overview()[0]['last_error'],'ValueError')

    def test_incomplete_http_responses_rejected(self):
        for reason,content in [('length',json.dumps(draft())),('stop','{"summary":'),('content_filter','{}')]:
            raw=json.dumps({'choices':[{'finish_reason':reason,'message':{'content':content}}]})
            with self.assertRaises(ValueError): decode_response(raw)
        with self.assertRaises(ValueError): decode_response(b'{"choices":')

    def test_retries_stop_at_manual(self):
        self.report()
        def failing(_): raise TimeoutError()
        for _ in range(5):
            self.assertTrue(self.worker.run_one(failing))
            self.clock+=4000
        self.assertFalse(self.worker.run_one(lambda _:self.fail('unbounded retry')))
        self.assertEqual(self.worker.overview()[0]['state'],'manual')

    def test_expired_reports_not_sent(self):
        self.report()
        self.clock+=31*86400
        self.assertFalse(self.worker.run_one(lambda _:self.fail('expired sent')))

    def test_crashed_fifth_lease_becomes_manual(self):
        self.report()
        self.worker.initialize()
        with self.worker.connect() as db:
            db.execute("UPDATE triage_queue SET state='leased',attempts=5,lease_until=?,lease_token='crashed'", (self.clock-1,))
        self.assertFalse(self.worker.run_one(lambda _:self.fail('sixth attempt')))
        self.assertEqual(self.worker.overview()[0]['state'],'manual')

    def test_exact_duplicate_does_not_reuse_expired_source(self):
        self.report()
        self.worker.run_one(lambda _:draft(summary='expired draft'))
        self.clock += 31*86400
        self.report('EZ-B')
        calls=[]
        self.worker.run_one(lambda p:calls.append(p) or draft(summary='new draft'))
        self.assertEqual(len(calls),1)
        self.assertEqual(calls[0]['candidates'],[])
        self.assertIn('new draft',{r['id']:r for r in self.worker.overview()}['EZ-B']['draft'])

    def test_suggestion_fk_cleanup(self):
        self.report()
        self.worker.run_one(lambda _:draft())
        self.report('EZ-B',description='Different problem with the route')
        self.worker.run_one(lambda _:draft(duplicateSuggestion='EZ-A'))
        with self.worker.connect() as db:
            self.assertEqual(db.execute("SELECT suggested_duplicate FROM triage_drafts WHERE report_id='EZ-B'").fetchone()[0],'EZ-A')
            db.execute("DELETE FROM reports WHERE id='EZ-A'")
            self.assertIsNone(db.execute("SELECT suggested_duplicate FROM triage_drafts WHERE report_id='EZ-B'").fetchone()[0])


if __name__ == '__main__': unittest.main()
