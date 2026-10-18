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
        self.assertEqual(self.client.get('/review.css').status_code, 200)

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

    @patch('backend.test_llm.generate_text', return_value='{"strength":"You started a response.","improvement":"Connect your answer to your motivation.","retry_challenge":"What interests you about this role?","star_check":{"situation":null,"task":null,"action":null,"result":null},"delivery_tip":"Start with one direct sentence."}')
    def test_non_star_answer_keeps_feedback_when_structure_is_unassessed(self, generate):
        response = self.client.post('/api/interview/feedback', json={
            'question': 'Why this internship?', 'transcript': 'Wait, we need to write this here.'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['star_check'], dict.fromkeys(['situation', 'task', 'action', 'result']))
        self.assertEqual(response.json()['improvement'], 'Connect your answer to your motivation.')

    @patch('backend.routers.interview.feedback_from_transcription', return_value={
        'strength': 'Clear example', 'improvement': 'Add results', 'retry_challenge': 'What changed?',
        'star_check': {'situation': True, 'task': False, 'action': True, 'result': False},
        'delivery_tip': 'Lead with your main point.'})
    def test_delivery_metrics_are_computed_and_returned_without_session(self, feedback):
        response = self.client.post('/api/interview/feedback', json={
            'question': 'Example?', 'transcript': 'Um I built a working prototype.',
            'metrics': {'durationSec': 30, 'wordsPerMinute': 999, 'fillerCount': 99, 'fillerWords': {}}})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['metrics']['wordsPerMinute'], 12)
        self.assertEqual(result['metrics']['fillerCount'], 1)
        self.assertEqual(result['metrics']['fillerWords'], {'um': 1})
        self.assertIsNone(result['metrics']['longPauses'])
        self.assertFalse(result['star_check']['result'])
        self.assertEqual(result['delivery_tip'], 'Lead with your main point.')


if __name__ == '__main__':
    unittest.main()
