// Quick test without the server:  npm run transcribe -- samples/my-recording.m4a
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { transcribeAudio, resolveMimeType, MODEL } from './transcribe.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run transcribe -- <path-to-audio-file>');
  process.exit(1);
}

const mimeType = resolveMimeType(null, file);
if (!mimeType) {
  console.error(`Unsupported file extension: ${file}`);
  process.exit(1);
}

try {
  const start = Date.now();
  const result = await transcribeAudio(await readFile(file), mimeType);
  console.log(JSON.stringify({ ...result, model: MODEL, ms: Date.now() - start }, null, 2));
} catch (err) {
  console.error('Error:', err.status || '', err.message);
  process.exit(1);
}
