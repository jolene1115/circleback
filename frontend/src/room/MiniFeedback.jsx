import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, ChevronDown, ChevronUp, Minus, MoveUpRight} from 'lucide-react';

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

/**
 * Feedback shown after each answer. Same look as the end-of-session summary (Feedback.jsx), condensed.
 * Handles interview feedback (strength, improvement, star_check) and speech feedback
 * (strengths[], improvements[], pointsCovered, timeCheck). `onFinish` adds a "See summary" button.
 */
export default function MiniFeedback({feedback, answer, last, onContinue, continueLabel, onFinish}) {
  const button = useRef(null);
  const [showAnswer, setShowAnswer] = useState(false);
  useEffect(() => button.current?.focus(), []);
  const metrics = feedback.metrics,
    star = feedback.star_check,
    points = feedback.pointsCovered,
    time = feedback.timeCheck;
  const strength = feedback.strength || feedback.strengths?.[0],
    improvement = feedback.improvement || feedback.improvements?.[0];
  return (
    <section className="answer-feedback" aria-live="polite" aria-label="Feedback on your answer">
      <div className="mini-body">
        <div className="mini-main">
          <div className="mini-block">
            <h3 className="mini-keep">
              <Check />
              Keep this
            </h3>
            <p>{strength}</p>
          </div>
          <div className="mini-block">
            <h3 className="mini-next">
              <MoveUpRight />
              Next time
            </h3>
            <p>{improvement}</p>
          </div>
          {metrics && (
            <div className="mini-stats">
              <Stat label="Duration" value={metrics.durationSec > 0 ? Math.round(metrics.durationSec) + 's' : 'Not measured'} />
              <Stat label="Average pace" value={metrics.durationSec > 0 ? metrics.wordsPerMinute : 'Not measured'} unit={metrics.durationSec > 0 ? 'wpm' : undefined} />
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
                  {star[part] === true ? (
                    <span className="mini-present">
                      <Check />
                      Present
                    </span>
                  ) : (
                    <span className="mini-missing">
                      <Minus />
                      {star[part] === false ? 'Add detail' : 'Not assessed'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}
        {!star && (points?.length > 0 || time) && (
          <aside className="mini-side">
            {points?.length > 0 && (
              <>
                <h4>Key points</h4>
                <ul>
                  {points.map(p => (
                    <li key={p.point}>
                      <span>{p.point}</span>
                      {p.covered ? (
                        <span className="mini-present">
                          <Check />
                          Covered
                        </span>
                      ) : (
                        <span className="mini-missing">
                          <Minus />
                          Missed
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {time && (
              <p className="mini-time">
                {Math.round(time.durationSec)}s of {time.limitSec}s
                {time.overBySec > 0 ? ` · ${Math.round(time.overBySec)}s over` : ` · ${Math.round(-time.overBySec)}s under`}
              </p>
            )}
          </aside>
        )}
      </div>
      {showAnswer && (
        <div className="mini-answer" id="mini-answer">
          <h4>Your answer</h4>
          <p>{answer || 'No transcript saved.'}</p>
        </div>
      )}
      <div className="mini-foot">
        <button
          type="button"
          className="mini-toggle"
          aria-expanded={showAnswer}
          aria-controls="mini-answer"
          onClick={() => setShowAnswer(!showAnswer)}
        >
          {showAnswer ? 'Hide your answer' : 'Show your answer'}
          {showAnswer ? <ChevronUp /> : <ChevronDown />}
        </button>
        <div className="mini-actions">
          {onFinish && (
            <button type="button" className="mini-continue mini-secondary" onClick={onFinish}>
              See summary
            </button>
          )}
          <button ref={button} type="button" className="mini-continue" onClick={onContinue}>
            {continueLabel || (last ? 'See summary' : 'Next question')}
            <ArrowRight />
          </button>
        </div>
      </div>
    </section>
  );
}
