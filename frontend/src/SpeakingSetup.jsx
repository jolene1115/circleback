import React, {useEffect, useState} from 'react';
import {ArrowLeft, ArrowRight, ChevronDown, Plus, SlidersHorizontal, X} from 'lucide-react';

import {checkHealth} from './engine/api.js';
import './setup-page.css';
import {configureSpeech, go, startSpeech, useAppState} from './store.js';

const MAX_POINTS = 8;
const TIME_LIMITS = [
  ['', 'No limit'],
  ['60', '1 minute'],
  ['120', '2 minutes'],
  ['180', '3 minutes'],
  ['300', '5 minutes'],
];

/** Public speaking setup: what the speech is about, key points, optional time limit. */
export default function SpeakingSetup({Character}) {
  const {speech} = useAppState();
  const [health, setHealth] = useState('checking');
  const [point, setPoint] = useState('');

  useEffect(() => {
    let active = true;
    checkHealth().then(result => {
      if (active) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, []);

  function addPoint(e) {
    e.preventDefault();
    const value = point.trim();
    if (!value || speech.points.length >= MAX_POINTS || speech.points.includes(value)) return;
    configureSpeech({points: [...speech.points, value]});
    setPoint('');
  }

  function start(e) {
    e.preventDefault();
    if (health !== 'ready' || !speech.context.trim()) return;
    startSpeech();
  }

  return (
    <div className="interview-setup">
      <header className="setup-new-heading">
        <button type="button" className="icon-button" aria-label="Back to practice" onClick={() => go('home')}>
          <ArrowLeft />
        </button>
        <h1>Your next speech.</h1>
      </header>
      <form onSubmit={start} className="setup-new-form">
        <section className="setup-target">
          <label htmlFor="speech-context">What is your speech about?</label>
          <input
            id="speech-context"
            autoComplete="off"
            maxLength={300}
            required
            value={speech.context}
            placeholder="e.g. 2-minute class presentation on campus recycling"
            onChange={e => configureSpeech({context: e.target.value})}
          />
        </section>
        <section className="setup-practice-focus">
          <h2>Key points you want to make</h2>
          {speech.points.length > 0 && (
            <ol className="speech-points">
              {speech.points.map((p, i) => (
                <li key={p}>
                  <span>
                    {i + 1}. {p}
                  </span>
                  <button
                    type="button"
                    aria-label={'Remove ' + p}
                    title="Remove"
                    onClick={() => configureSpeech({points: speech.points.filter(x => x !== p)})}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="setup-add-focus speech-add-point">
            <input
              aria-label="Add a key point"
              maxLength={160}
              value={point}
              onChange={e => setPoint(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addPoint(e);
              }}
              placeholder={speech.points.length ? 'Add another point' : 'e.g. Why recycling matters'}
            />
            <button
              type="button"
              aria-label="Add point"
              title="Add point"
              disabled={!point.trim() || speech.points.length >= MAX_POINTS}
              onClick={addPoint}
            >
              <Plus size={17} />
            </button>
          </div>
        </section>
        <section className="setup-character">
          <h2>Your coach</h2>
          <Character />
        </section>
        <details className="setup-advanced">
          <summary><SlidersHorizontal size={16} />Session settings<ChevronDown size={16} /></summary>
          <div>
            <label>
              Target length
              <select value={speech.timeLimitSec} onChange={e => configureSpeech({timeLimitSec: e.target.value})}>
                {TIME_LIMITS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <label className="setup-permission">
          <input type="checkbox" required />
          <span>Audio and your speech are sent to Gemini for transcription and feedback.</span>
        </label>
        {health === 'key' && (
          <p role="alert" className="error">
            Set up an API key on the server to start.
          </p>
        )}
        {health === 'offline' && (
          <p role="alert" className="error">
            Server unavailable. Refresh to retry.
          </p>
        )}
        <footer className="setup-start">
          <span>{speech.points.length ? `${speech.points.length} key ${speech.points.length === 1 ? 'point' : 'points'}` : 'Add your key points (optional)'}</span>
          <button className="main-button" type="submit" disabled={health !== 'ready' || !speech.context.trim()}>
            Start practicing
            <ArrowRight size={18} />
          </button>
        </footer>
      </form>
    </div>
  );
}
