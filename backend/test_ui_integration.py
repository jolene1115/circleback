"""Offline API contract checks; never calls Gemini."""
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import app
from backend.routers.interview import get_client


class UIIntegrationTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides[get_client] = lambda: object()
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_frontend_and_health(self):
        self.assertTrue(self.client.get('/api/health').json()['ok'])
        self.assertIn('type="module"', self.client.get('/').text)
        self.assertEqual(self.client.get('/team-api.js').status_code, 200)

    @patch('backend.routers.interview.generate_text', return_value='{"question":"Tell me about your portfolio."}')
    def test_context_and_legacy_question(self, generate):
        response = self.client.post('/api/interview/question', json={
            'topic': 'Game design', 'context': 'Student', 'focus': ['Portfolio'], 'tone': 'Direct'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('Game design', generate.call_args.args[1])
        self.assertEqual(self.client.post('/api/interview/question').status_code, 200)

    @patch('backend.routers.interview.feedback_from_transcription', return_value={
        'strength': 'Clear example', 'improvement': 'Add results', 'retry_challenge': 'What changed?'})
    def test_feedback_context(self, feedback):
        response = self.client.post('/api/interview/feedback', json={
            'question': 'What did you build?', 'transcript': 'I built a prototype.',
            'interview': {'topic': 'Game design', 'history': [{'question': 'Intro?', 'answer': 'Student'}]}})
        self.assertEqual(response.status_code, 200)
        self.assertIn('Student', feedback.call_args.args[3])
        self.assertEqual(self.client.post('/api/interview/feedback', json={
            'question': 'Question?', 'transcript': ' '}).status_code, 422)

    def test_no_audio_error(self):
        self.assertEqual(self.client.post('/api/transcribe').status_code, 400)


if __name__ == '__main__':
    unittest.main()
