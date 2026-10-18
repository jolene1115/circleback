import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import app
from backend.services import db


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_path = db.DB_PATH
        db.DB_PATH = Path(self.temp.name) / 'accounts.db'
        self.a = TestClient(app)
        self.a.__enter__()
        self.b = TestClient(app)
        self.b.__enter__()

    def tearDown(self):
        self.b.__exit__(None, None, None)
        self.a.__exit__(None, None, None)
        db.DB_PATH = self.old_path
        self.temp.cleanup()

    def signup(self, client, email='alex@example.com'):
        r = client.post('/api/account/signup', json={'name':'Alex', 'email':email, 'password':'a long test password'})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def test_cross_device_history_and_account_isolation(self):
        user = self.signup(self.a)
        entry = dict(id='old-interview', mode='speaking', timeLimitSec=60, topic='Design', date='Oct 17, 2026', turns=[dict(q='Question', a='Answer', feedback={'strength':'Clear'})])
        self.assertEqual(self.a.post('/api/account/history', json={'entries':[entry]}).status_code, 200)
        self.assertEqual(self.b.get('/api/account/history').status_code, 401)
        r = self.b.post('/api/account/login', json={'email':'ALEX@example.com', 'password':'a long test password'})
        self.assertEqual(r.json()['id'], user['id'])
        self.assertEqual(self.b.get('/api/account/history').json()[0]['turns'][0]['a'], 'Answer')
        saved = self.b.get('/api/account/history').json()[0]
        self.assertEqual(saved['mode'], 'speaking')
        self.assertEqual(saved['timeLimitSec'], 60)
        self.b.post('/api/account/history', json={'entries':[entry]})
        self.assertEqual(len(self.a.get('/api/account/history').json()), 1)
        self.b.post('/api/account/logout')
        self.assertEqual(self.b.get('/api/account/me').status_code, 401)
        self.signup(self.b, 'other@example.com')
        self.assertEqual(self.b.get('/api/account/history').json(), [])
        self.assertEqual(len(self.a.get('/api/account/history').json()), 1)

    def test_password_cookie_validation_and_origin(self):
        self.signup(self.a)
        with db.connection() as conn:
            hashed = conn.execute('SELECT passwordHash FROM accounts').fetchone()[0]
            self.assertNotIn('a long test password', hashed)
            self.assertNotEqual(conn.execute('SELECT tokenHash FROM account_tokens').fetchone()[0], self.a.cookies.get('circleback_session'))
        self.assertEqual(self.b.post('/api/account/login', json={'email':'alex@example.com', 'password':'wrong password'}).status_code, 401)
        self.assertEqual(self.b.post('/api/account/signup', json={'name':'Alex', 'email':'bad', 'password':'short'}).status_code, 422)
        self.assertEqual(self.a.post('/api/account/history', json={'entries':[]}, headers={'Origin':'https://evil.example'}).status_code, 403)
        self.assertEqual(self.a.post('/api/account/history', json={'entries':[{'id':'x','topic':'x','date':'x','turns':[{'q':3,'a':4}]}]}).status_code, 422)

    def test_legacy_routes_cannot_bypass_account_ownership(self):
        user = self.signup(self.a)
        self.assertEqual(self.b.get('/api/users/' + user['id']).status_code, 401)
        self.assertEqual(self.b.get('/api/sessions', params={'userId':user['id']}).status_code, 401)
        session = self.a.post('/api/sessions', json={'userId':user['id'], 'mode':'interview'}).json()
        self.assertEqual(self.b.get('/api/sessions/' + session['id']).status_code, 401)
        self.signup(self.b, 'other@example.com')
        self.assertEqual(self.b.get('/api/sessions/' + session['id'] + '/attempts').status_code, 404)
        self.assertEqual(self.a.get('/api/sessions/' + session['id']).status_code, 200)

    def test_expiry_and_rate_limit(self):
        self.signup(self.a)
        with db.connection() as conn:
            conn.execute('UPDATE account_tokens SET expires=0')
        self.assertEqual(self.a.get('/api/account/me').status_code, 401)
        for _ in range(10):
            response = self.b.post('/api/account/login', json={'email':'alex@example.com', 'password':'wrong password'})
        self.assertEqual(response.status_code, 429)
