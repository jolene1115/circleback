import React, {useEffect, useState} from 'react';
import {ArrowLeft, ArrowRight, AudioLines, Check, ChevronDown, ChevronUp, MessageCircle, Minus, MoveUpRight, RotateCw} from 'lucide-react';

import {go, retryQuestion, retrySession} from './store.js';
const STAR = ['situation', 'task', 'action', 'result'];
const PACE_RANGE = [110, 170]; // English practice guide, not a score
const MIN_PACE_SECONDS = 15; // shorter answers are too short to judge pace

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const title = word => word[0].toUpperCase() + word.slice(1);

// Pace and filler notes come from the numbers computed on the server, not from the AI.
function paceNote(m) {
  if (m.durationSec < MIN_PACE_SECONDS) return 'This answer is too short for a reliable pace comparison. Try a complete example before adjusting your speed.';
  if (m.wordsPerMinute > PACE_RANGE[1]) return 'You spoke quickly. Pause briefly between the parts of your story so each one lands.';
  if (m.wordsPerMinute < PACE_RANGE[0]) return 'Your pace was on the slow side. Keep moving between ideas and trim long pauses.';
  return 'Your pace was in a comfortable range for an interview.';
}

function fillerNote(m) {
  const fillers = Object.entries(m.fillerWords || {});
  if (!fillers.length) return 'No listed filler words were found in the transcript.';
  return `You used ${plural(m.fillerCount, 'filler word')}: ${fillers.map(([word, n]) => `“${word}” ×${n}`).join(', ')}.`;
}

function Delivery({metrics, organization}) {
  return (
    <section className="review-delivery">
      <h3 className="review-delivery-title"><AudioLines />Speaking delivery</h3>
      {metrics && <>
        <div className="review-stats">
          <div><small>Duration</small><strong>{Math.round(metrics.durationSec)}s</strong></div>
          <div><small>Average pace</small><strong>{metrics.wordsPerMinute}<span>wpm</span></strong></div>
          <div><small>Possible fillers</small><strong>{metrics.fillerCount}</strong></div>
        </div>
        <div className="review-detail">
          <h4>Pace &amp; rhythm</h4>
          <p>{paceNote(metrics)}</p>
          <small>English practice guide: roughly {PACE_RANGE[0]}–{PACE_RANGE[1]} wpm, not a score. Includes recorded silence.</small>
        </div>
        <div className="review-detail">
          <h4>Filler words</h4>
          <p>{fillerNote(metrics)}</p>
          <small>Transcript estimate; ordinary words can be flagged, and transcription may omit fillers.</small>
        </div>
      </>}
      {organization && <div className="review-detail"><h4>Verbal organization</h4><p>{organization}</p></div>}
      <small className="review-disclaimer">Pronunciation, intonation, volume and pause timing have not been analyzed.</small>
    </section>
  );
}

export default function Review({session}) {
  const [index, setIndex] = useState(0);
  const [answerOpen, setAnswerOpen] = useState(true);
  useEffect(() => setIndex(0), [session?.id]);
  if (!session?.turns?.length) return null;

  const turns = session.turns;
  const turn = turns[Math.min(index, turns.length - 1)];
  const feedback = turn.feedback;
  const metrics = feedback?.metrics;

  return (
    <div className="review">
      <button className="review-back" onClick={() => go('history')}><ArrowLeft />History</button>

      <header className="review-head">
        <div>
          <p className="review-meta"><span>{session.date}</span><span>{plural(turns.length, 'answer')}</span></p>
          <h1>Your next step.</h1>
          <p className="review-topic">{session.topic}</p>
        </div>
        <button className="review-outline" onClick={() => retrySession(session)}><RotateCw />Practice again</button>
      </header>

      <div className="review-tabs" role="tablist" aria-label="Answers">
        {turns.map((t, i) => (
          <button key={i} role="tab" aria-selected={i === index} className={i === index ? 'active' : ''} onClick={() => setIndex(i)}>
            Answer {i + 1}{t.feedback && <span className="review-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="review-question"><MessageCircle /><h2>{turn.q}</h2></div>

      <div className="review-body">
        <div className="review-main">
          {feedback ? <>
            <section className="review-block">
              <h3 className="review-keep"><Check />Keep this</h3>
              <p>{feedback.strength}</p>
            </section>
            <section className="review-block">
              <h3 className="review-next"><MoveUpRight />Next time</h3>
              <p>{feedback.improvement}</p>
            </section>
          </> : <p className="review-empty">No AI feedback was saved for this answer.</p>}

          {(metrics || feedback?.organization_tip) && <Delivery metrics={metrics} organization={feedback?.organization_tip} />}

          <section className="review-answer">
            <button className="review-answer-toggle" aria-expanded={answerOpen} onClick={() => setAnswerOpen(!answerOpen)}>
              Your answer{answerOpen ? <ChevronUp /> : <ChevronDown />}
            </button>
            {answerOpen && <p>{turn.a}</p>}
          </section>
        </div>

        <aside className="review-side">
          {feedback?.star_check && (
            <section>
              <h3 className="review-side-title">Story structure</h3>
              <ul className="review-star">
                {STAR.map(part => (
                  <li key={part}>
                    <span>{title(part)}</span>
                    {feedback.star_check[part]
                      ? <span className="review-present"><Check />Present</span>
                      : <span className="review-missing"><Minus />Add detail</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {feedback?.retry_challenge && (
            <section>
              <h3 className="review-side-title">Try next</h3>
              <p className="review-try">{feedback.retry_challenge}</p>
            </section>
          )}
          <button className="review-outline review-retry" onClick={() => retryQuestion(session, turn.q)}>
            <RotateCw />Retry this question
          </button>
        </aside>
      </div>

      <footer className="review-pager">
        <span>{index + 1} / {turns.length}</span>
        <div>
          <button aria-label="Previous answer" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft /></button>
          <button aria-label="Next answer" disabled={index === turns.length - 1} onClick={() => setIndex(index + 1)}><ArrowRight /></button>
        </div>
      </footer>
    </div>
  );
}
