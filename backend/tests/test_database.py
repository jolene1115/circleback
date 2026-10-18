"""Offline API integration tests: python -m unittest discover -s backend/tests -v."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.services import db
from backend.routers import interview, speaking

FB = dict(strength='Clear example', improvement='Add detail', example_rewrite='I built [project] for [users].',
          retry_challenge='Explain the outcome',
          star_check=dict(situation=True, task=False, action=True, result=False), delivery_tip=None)
SPEAKING_FB = dict(summary='Clear', strengths=['Structure'], improvements=['Slow down'],
                   pointsCovered=[dict(point='intro', covered=True, evidence='"Hello everyone"')],
                   exampleRewrite='Hello everyone, today I will cover [topic].', deliveryTip=None,
                   nextTry='Add a closing line')
METRICS = dict(durationSec=30, wordsPerMinute=999, fillerCount=999, fillerWords={})


class DatabaseIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_path = db.DB_PATH
        db.DB_PATH = Path(self.temp.name) / 'test.db'
        app.dependency_overrides[interview.get_client] = lambda: object()
        self.client = TestClient(app)
        self.client.__enter__()
        self.user = self.client.post('/api/users', json={'name': ' Test '}).json()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        app.dependency_overrides.clear()
        db.DB_PATH = self.old_path
        self.temp.cleanup()

    def session(self, mode='interview'):
        response = self.client.post('/api/sessions', json={'userId': self.user['id'], 'mode': mode})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['id']

    def test_interview_roundtrip_and_restart(self):
        session_id = self.session()
        with patch.object(interview, 'feedback_from_transcription', return_value=FB):
            response = self.client.post('/api/interview/feedback', json={
                'sessionId': session_id, 'question': 'Tell me about yourself',
                'transcript': 'um I built a project', 'metrics': METRICS})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body.pop('metrics')['fillerCount'], 1)  # recomputed on the server, not the client's 999
        self.assertEqual(body, FB)
        with TestClient(app) as restarted:
            saved = restarted.get(f'/api/sessions/{session_id}/attempts').json()
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]['feedback'], FB)
        self.assertEqual(saved[0]['metrics']['fillerCount'], 1)
        self.assertEqual(saved[0]['metrics']['wordsPerMinute'], 10)
        self.assertEqual(self.client.get('/api/sessions', params={'userId': self.user['id']}).json()[0]['id'], session_id)

    def test_speaking_roundtrip(self):
        session_id = self.session('speaking')
        from backend.services.gemini import SpeakingFeedbackOut
        with patch.object(speaking, 'speaking_feedback', return_value=SpeakingFeedbackOut(**SPEAKING_FB)):
            response = self.client.post('/api/speaking/feedback', json={
                'sessionId': session_id, 'context': 'Class talk', 'points': ['intro'],
                'transcript': 'Hello everyone', 'metrics': METRICS})
        self.assertEqual(response.status_code, 200, response.text)
        saved = self.client.get(f'/api/sessions/{session_id}/attempts').json()
        self.assertEqual(saved[0]['feedback']['summary'], 'Clear')

    def test_validation_missing_records_and_pagination(self):
        self.assertEqual(self.client.post('/api/users', json={'name': '  '}).status_code, 422)
        self.assertEqual(self.client.post('/api/sessions', json={'userId': 'missing', 'mode': 'interview'}).status_code, 404)
        self.assertEqual(self.client.post('/api/sessions', json={'userId': self.user['id'], 'mode': 'bad'}).status_code, 422)
        session_id = self.session()
        payload = dict(question='Question', transcript='Answer', metrics=METRICS, feedback=FB)
        for _ in range(3):
            self.assertEqual(self.client.post(f'/api/sessions/{session_id}/attempts', json=payload).status_code, 200)
        first = self.client.get(f'/api/sessions/{session_id}/attempts?limit=1').json()
        second = self.client.get(f'/api/sessions/{session_id}/attempts?limit=1&offset=1').json()
        self.assertNotEqual(first[0]['id'], second[0]['id'])
        payload['metrics'] = dict(METRICS, durationSec=-1)
        self.assertEqual(self.client.post(f'/api/sessions/{session_id}/attempts', json=payload).status_code, 422)
        self.assertEqual(self.client.get('/api/sessions/missing/attempts').status_code, 404)

    def test_failed_feedback_does_not_save_and_wrong_mode_rejected(self):
        session_id = self.session()
        payload = dict(sessionId=session_id, question='Question', transcript='Answer', metrics=METRICS)
        with patch.object(interview, 'feedback_from_transcription', side_effect=ValueError('invalid')):
            self.assertEqual(self.client.post('/api/interview/feedback', json=payload).status_code, 502)
        self.assertEqual(self.client.get(f'/api/sessions/{session_id}/attempts').json(), [])
        payload['sessionId'] = self.session('speaking')
        self.assertEqual(self.client.post('/api/interview/feedback', json=payload).status_code, 422)

    def test_database_failure_returns_safe_error(self):
        import sqlite3
        with patch('backend.routes.users.get_user', side_effect=sqlite3.OperationalError('private detail')):
            with self.assertLogs('uvicorn.error', level='ERROR'):
                response = self.client.get('/api/users/example')
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private detail', response.text)

    def test_legacy_database_is_upgraded_without_data_loss(self):
        import sqlite3
        from contextlib import closing
        with closing(sqlite3.connect(db.DB_PATH)) as conn:
            conn.execute('DROP INDEX sessions_user_created')
            conn.execute('DROP INDEX attempts_session_created')
            conn.commit()
        db.init_db()
        self.assertEqual(db.get_user(self.user['id'])['name'], 'Test')
        with db.connection() as conn:
            self.assertIn('sessions_user_created', [r['name'] for r in conn.execute('PRAGMA index_list(sessions)')])


if __name__ == '__main__':
    unittest.main()
