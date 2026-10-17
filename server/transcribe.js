import { GoogleGenAI, Type } from '@google/genai';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Audio formats we accept, keyed by file extension.
// webm is what the browser's MediaRecorder produces; m4a is an iPhone voice memo.
export const MIME_BY_EXT = {
  webm: 'audio/webm',
  mp3: 'audio/mp3',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

const SUPPORTED_MIME = new Set(Object.values(MIME_BY_EXT).concat(['audio/mpeg', 'audio/x-m4a', 'audio/x-wav']));

// Pick a usable mime type: trust the upload's type if it's audio we support,
// otherwise fall back to the file extension (curl sends application/octet-stream).
export function resolveMimeType(mimeType, filename = '') {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (SUPPORTED_MIME.has(base)) return base;
  const ext = filename.split('.').pop().toLowerCase();
  return MIME_BY_EXT[ext] || null;
}

const PROMPT = `Transcribe this audio recording of someone practicing public speaking.

Rules:
- Transcribe VERBATIM. Keep every filler word (um, uh, like, you know, so, basically, actually, I mean), repeated words, and false starts exactly as spoken.
- Do NOT clean up grammar, remove disfluencies, or summarize.
- Use normal punctuation and sentence breaks.
- In fillerWords, list each filler word/phrase used and how many times it occurred.
- If there is no speech, return an empty transcript.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    fillerWords: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          count: { type: Type.INTEGER },
        },
        required: ['word', 'count'],
      },
    },
  },
  required: ['transcript', 'fillerWords'],
};

let client;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY is not set. Copy .env.example to .env and paste your key.');
    err.status = 500;
    throw err;
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Gemini returns 503 when the model is overloaded; that's usually brief, so retry with backoff.
async function withRetry(fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status !== 503 || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

/**
 * Transcribe an audio buffer with Gemini.
 * @returns {Promise<{ transcript: string, fillerWords: {word: string, count: number}[], wordCount: number }>}
 */
export async function transcribeAudio(buffer, mimeType) {
  const response = await withRetry(() => getClient().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: buffer.toString('base64') } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0,
    },
  }));

  const result = JSON.parse(response.text);
  const transcript = result.transcript.trim();
  return {
    transcript,
    fillerWords: result.fillerWords,
    wordCount: transcript ? transcript.split(/\s+/).length : 0,
  };
}
