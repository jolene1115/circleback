"""Offline resume extraction and interview-track checks."""
from io import BytesIO
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from backend.main import app
from backend.models import InterviewContext
from backend.routers.interview import get_client
from backend.services.resume import extract_resume_text, MAX_RESUME_BYTES
from backend.test_llm import feedback_from_transcription


def pdf(text=None, pages=1, encrypted=False):
    writer = PdfWriter()
    for _ in range(pages):
        page = writer.add_blank_page(width=612, height=792)
        if text:
            font = DictionaryObject({NameObject('/Type'): NameObject('/Font'),
                                     NameObject('/Subtype'): NameObject('/Type1'),
                                     NameObject('/BaseFont'): NameObject('/Helvetica')})
            page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
            stream = DecodedStreamObject()
            stream.set_data(f'BT /F1 12 Tf 50 700 Td ({text}) Tj ET'.encode())
            page[NameObject('/Contents')] = writer._add_object(stream)
    if encrypted:
        writer.encrypt('password')
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


class ResumeTests(unittest.TestCase):
    def test_extract_real_pdf_and_reject_unusable_files(self):
        self.assertIn('Campus app', extract_resume_text(pdf('Campus app')))
        for data in [b'not a PDF', b'', pdf(), pdf(pages=6), pdf('Secret', encrypted=True), b'x' * (MAX_RESUME_BYTES + 1)]:
            with self.subTest(size=len(data)), self.assertRaises(ValueError):
                extract_resume_text(data)

    def test_upload_endpoint(self):
        client = TestClient(app)
        response = client.post('/api/interview/resume', files={'file': ('resume.pdf', pdf('Campus app'), 'application/pdf')})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn('Campus app', response.json()['resumeText'])
        self.assertEqual(client.post('/api/interview/resume', files={'file': ('bad.pdf', b'bad')}).status_code, 422)
        self.assertEqual(client.post('/api/interview/resume', files={'file': ('big.pdf', b'x' * (MAX_RESUME_BYTES + 1))}).status_code, 413)

    def test_track_validation_and_legacy_question(self):
        self.assertEqual(InterviewContext().type, 'behavioral')
        for payload in [{'type': 'resume'}, {'type': 'resume', 'resumeText': ' '}, {'type': 'unknown'}]:
            with self.assertRaises(ValueError):
                InterviewContext(**payload)
        app.dependency_overrides[get_client] = lambda: object()
        try:
            client = TestClient(app)
            with patch('backend.routers.interview.generate_text', return_value='{"question":"Tell me about Campus app."}') as generate:
                self.assertEqual(client.post('/api/interview/question').status_code, 200)
                response = client.post('/api/interview/question', json={'type': 'resume', 'topic': 'Designer', 'resumeText': 'Campus app'})
                self.assertEqual(response.status_code, 200)
                self.assertIn('Campus app', generate.call_args.args[1])
                self.assertIn('resume deep dive', generate.call_args.args[1])
                self.assertEqual(client.post('/api/interview/question', json={'type': 'resume'}).status_code, 422)
        finally:
            app.dependency_overrides.clear()

    def test_resume_followup_keeps_context(self):
        with patch('backend.test_llm.generate_feedback') as generate:
            generate.return_value.model_dump.return_value = {'strength':'Clear', 'improvement':'Add detail', 'retry_challenge':'Your contribution?'}
            feedback_from_transcription(None, 'Question?', {'transcript':'I built it.'}, InterviewContext(type='resume', resumeText='Campus app').model_dump_json())
            prompt = generate.call_args.args[1]
            self.assertIn('Campus app', prompt)
            self.assertIn('Resume deep dive', prompt)
