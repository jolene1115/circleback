import React, {useEffect, useRef} from 'react';
import {ArrowRight, Check, Minus, MoveUpRight} from 'lucide-react';

const STAR = ['situation', 'task', 'action', 'result'];

function Stat({label, value, unit}) {
  return (
    <div>
      <small>{label}</small>
      <strong>
        {value}
        {unit && <span>{unit}</span>}
      </strong>
    </div>
  );
}

/** Feedback shown after each answer. Same look as the end-of-session review (Review.jsx), condensed. */
export default function MiniFeedback({feedback, last, onContinue}) {
  const button = useRef(null);
  useEffect(() => button.current?.focus(), []);
  const metrics = feedback.metrics,
    star = feedback.star_check;
  return (
    <section className="answer-feedback" aria-live="polite" aria-label="Feedback on your answer">
      <div className="mini-body">
        <div className="mini-main">
          <div className="mini-block">
            <h3 className="mini-keep">
              <Check />
              Keep this
            </h3>
            <p>{feedback.strength}</p>
          </div>
          <div className="mini-block">
            <h3 className="mini-next">
              <MoveUpRight />
              Next time
            </h3>
            <p>{feedback.improvement}</p>
          </div>
          {metrics && (
            <div className="mini-stats">
              <Stat label="Duration" value={Math.round(metrics.durationSec) + 's'} />
              <Stat label="Average pace" value={metrics.wordsPerMinute} unit="wpm" />
              <Stat label="Possible fillers" value={metrics.fillerCount} />
            </div>
          )}
        </div>
        {star && (
          <aside className="mini-side">
            <h4>Story structure</h4>
            <ul>
              {STAR.map(part => (
                <li key={part}>
                  <span>{part[0].toUpperCase() + part.slice(1)}</span>
                  {star[part] ? (
                    <span className="mini-present">
                      <Check />
                      Present
                    </span>
                  ) : (
                    <span className="mini-missing">
                      <Minus />
                      Add detail
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      <div className="mini-foot">
        <button ref={button} type="button" className="mini-continue" onClick={onContinue}>
          {last ? 'See summary' : 'Next question'}
          <ArrowRight />
        </button>
      </div>
    </section>
  );
}
