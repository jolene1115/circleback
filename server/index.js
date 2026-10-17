import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { transcribeAudio, resolveMimeType, MODEL } from './transcribe.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Let a local frontend (any port) call this API during development.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, keyConfigured: Boolean(process.env.GEMINI_API_KEY), model: MODEL });
});

// POST /api/transcribe  (multipart/form-data, field name "audio")
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file. Send it as form field "audio".' });
  }
  const mimeType = resolveMimeType(req.file.mimetype, req.file.originalname);
  if (!mimeType) {
    return res.status(400).json({ error: `Unsupported audio type: ${req.file.mimetype} (${req.file.originalname})` });
  }

  const start = Date.now();
  try {
    const result = await transcribeAudio(req.file.buffer, mimeType);
    res.json({ ...result, model: MODEL, ms: Date.now() - start });
  } catch (err) {
    const status = err.status || 500;
    const message = {
      429: 'Gemini free-tier rate limit hit. Wait a minute and try again.',
      503: 'Gemini is overloaded right now. Try again in a minute.',
    }[status] || err.message;
    console.error('[transcribe]', status, err.message);
    res.status(status).json({ error: message });
  }
});

// Turn multer errors (e.g. file too large) into JSON instead of an HTML page.
app.use((err, req, res, next) => {
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Transcribe API on http://localhost:${port}`);
  if (!process.env.GEMINI_API_KEY) console.warn('Warning: GEMINI_API_KEY is not set (see .env.example)');
});
