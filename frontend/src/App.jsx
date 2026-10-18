import React, {useEffect, useLayoutEffect, useState} from 'react';
import {
  AudioLines,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  GraduationCap,
  MessagesSquare,
  MicVocal,
  Pencil,
  PenTool,
  SlidersHorizontal,
  Square,
  Users,
  Volume2,
} from 'lucide-react';

import Figure from './components/Figure.jsx';
import InkEditor from './components/InkEditor.jsx';
import InterviewerCollection from './components/InterviewerCollection.jsx';
import {checkHealth, request} from './engine/api.js';
import {setFigureState} from './engine/figure.js';
import {getInterviewerName, onInterviewerChange} from './engine/ink.js';
import {currentVoice, onVoicesChange, selectVoice, speak, stopVoice, voiceId, voices} from './engine/voice.js';
import Review from './Review.jsx';
import InterviewRoom from './room/InterviewRoom.jsx';
import {
  configure,
  currentTopic,
  focusList,
  focusOptions,
  getState,
  go,
  selectSession,
  startInterview,
  topicOptions,
  useAppState,
} from './store.js';

function Navigation({view}) {
  return (
    <aside className="sidebar">
      <a
        href="#"
        className="brand"
        onClick={e => {
          e.preventDefault();
          go('home');
        }}
      >
        <AudioLines />
        <span>cadence</span>
      </a>
      <nav aria-label="Main navigation">
        <button className={'nav-item ' + (['home', 'setup'].includes(view) ? 'active' : '')} onClick={() => go('home')}>
          Practice
        </button>
        <button className={'nav-item ' + (['history', 'summary'].includes(view) ? 'active' : '')} onClick={() => go('history')}>
          History
        </button>
      </nav>
    </aside>
  );
}

function Home({exploring, setExploring}) {
  return (
    <>
      <section className="workspace-intro">
        <div className="workspace-title" hidden={exploring}>
          <h1>Cadence</h1>
          <p className="landing-description">
            <strong>Your personal speaking coach.</strong>
            <span>A little practice for your next big conversation.</span>
          </p>
          <button className="main-button explore-button" onClick={() => setExploring(true)}>
            Explore <ArrowRight />
          </button>
        </div>
        <Figure view="home" />
      </section>
      {exploring && (
        <section className="workspace-modes" aria-label="Practice modes">
          <button className="workspace-mode" onClick={() => go('setup')}>
            <div>
              <h2>Interview</h2>
              <ArrowUpRight />
            </div>
            <ChoiceHand />
          </button>
          <button className="workspace-mode" onClick={() => go('speaking')}>
            <div>
              <h2>Public speaking</h2>
              <MicVocal />
            </div>
            <small className="choice-soon">Coming soon</small>
            <ChoiceHand />
          </button>
        </section>
      )}
    </>
  );
}

function ChoiceHand() {
  return (
    <svg className="choice-hand" viewBox="0 0 400 300" fill="none" aria-hidden="true">
      <path d="M64 320 C100 279 113 248 145 226 C164 213 184 206 199 191 C211 180 220 163 230 164 C245 166 233 189 216 204 C206 213 194 219 185 218 C173 217 183 208 199 212 C222 219 248 217 267 206 C288 194 306 174 321 159 C331 149 342 142 347 149 C354 159 330 181 316 193 C301 207 286 217 273 221 C290 211 316 191 330 181 C344 171 353 171 354 180 C355 190 325 214 311 223 C300 230 286 236 278 236 C290 229 313 214 326 210 C340 205 345 213 335 223 C322 236 303 246 286 251 C276 254 268 254 265 252 C277 245 294 240 306 241 C318 244 302 257 288 262 C262 272 235 265 213 278 C194 290 185 308 173 327" />
    </svg>
  );
}

/** Interviewer card on the setup page: the figure, its name, voice picker and the two editors. */
function Character() {
  const [name, setName] = useState(getInterviewerName),
    [voiceList, setVoiceList] = useState(voices),
    [selected, setSelected] = useState(''),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(''),
    [dialog, setDialog] = useState(null); // 'ink' | 'collection'
  useEffect(() => {
    const sync = () => {
      setName(getInterviewerName());
      setVoiceList(voices());
      const voice = currentVoice();
      setSelected(voice ? voiceId(voice) : '');
    };
    sync();
    const offInterviewer = onInterviewerChange(sync),
      offVoices = onVoicesChange(sync);
    return () => {
      stopVoice();
      offInterviewer();
      offVoices();
    };
  }, []);
  function stop() {
    stopVoice();
    setPlaying(false);
    setFigureState('listening');
  }
  function preview() {
    if (playing) {
      stop();
      return;
    }
    setError('');
    setPlaying(true);
    setFigureState('speaking');
    speak({
      text: 'Tell me about a project you are proud of. Take your time.',
      onend: () => {
        setPlaying(false);
        setFigureState('listening');
      },
      onerror: () => {
        setPlaying(false);
        setFigureState('listening');
        setError('Could not play. Try another voice.');
      },
    });
  }
  return (
    <aside className="moon-coach">
      <button
        type="button"
        className="icon-button collection-interviewer"
        title="Saved interviewers"
        aria-label="Saved interviewers"
        onClick={() => {
          stop();
          setDialog('collection');
        }}
      >
        <Bookmark />
      </button>
      <button
        type="button"
        className="icon-button edit-interviewer"
        title="Draw on interviewer"
        aria-label="Draw on interviewer"
        onClick={() => {
          stop();
          setDialog('ink');
        }}
      >
        <Pencil />
      </button>
      <Figure view="setup" />
      <div className="workspace-voice">
        <div className="interviewer-name" hidden={!name}>
          {name}
        </div>
        <div className="browser-voice-field">
          <div className="browser-voice-picker">
            <select
              aria-label="Interviewer voice"
              value={selected}
              disabled={!voiceList.length}
              onChange={e => {
                stop();
                selectVoice(e.target.value);
                setSelected(e.target.value);
              }}
            >
              {voiceList.length ? (
                voiceList.map(v => (
                  <option key={voiceId(v)} value={voiceId(v)}>
                    {v.name} ({v.lang})
                  </option>
                ))
              ) : (
                <option value="">No local English voices available</option>
              )}
            </select>
            <button
              type="button"
              className="icon-button"
              title={playing ? 'Stop preview' : 'Preview voice'}
              aria-label={playing ? 'Stop preview' : 'Preview voice'}
              disabled={!voiceList.length}
              onClick={preview}
            >
              {playing ? <Square /> : <Volume2 />}
            </button>
          </div>
          <p id="voicePreviewStatus" className="field-note" role="status">
            {error}
          </p>
        </div>
      </div>
      {dialog === 'ink' && <InkEditor onClose={() => setDialog(null)} />}
      {dialog === 'collection' && (
        <InterviewerCollection
          onClose={() => setDialog(null)}
          onVoiceMissing={() => setError('Saved voice unavailable. Using the default voice.')}
        />
      )}
    </aside>
  );
}

function Setup() {
  const {config} = useAppState();
  const [health, setHealth] = useState('checking'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const icons = [PenTool, BriefcaseBusiness, GraduationCap, Users];
  useEffect(() => {
    let active = true;
    checkHealth().then(result => {
      if (active) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, []);
  async function start(e) {
    e.preventDefault();
    if (busy || health !== 'ready') return;
    setBusy(true);
    setError('');
    try {
      const result = await request('interview/question', {
        topic: currentTopic(config),
        context: config.context,
        focus: focusList(config),
        tone: config.tone,
        history: [],
      });
      if (getState().view !== 'setup') return;
      if (!result.question?.trim()) throw Error('The server returned an empty question.');
      startInterview(result.question);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="setup-heading">
        <button className="icon-button" aria-label="Back to practice" onClick={() => go('home')}>
          <ArrowLeft />
        </button>
        <h1>Interview</h1>
      </div>
      <div className="setup-layout">
        <form id="setupForm" onSubmit={start}>
          <fieldset className="setup-topic">
            <legend>Topic</legend>
            <div className="topic-grid">
              {topicOptions.map(([topic], i) => {
                const Icon = icons[i],
                  active = config.topic === topic && !config.custom;
                return (
                  <button
                    type="button"
                    key={topic}
                    className={'topic ' + (active ? 'selected' : '')}
                    aria-pressed={active}
                    onClick={() => configure({topic, custom: ''})}
                  >
                    <Icon />
                    <span>{topic}</span>
                    <Check />
                  </button>
                );
              })}
            </div>
            <input
              id="custom"
              aria-label="Custom topic"
              maxLength={160}
              placeholder="Or add your own..."
              value={config.custom}
              onChange={e => configure({custom: e.target.value})}
            />
          </fieldset>
          <fieldset className="setup-focus">
            <legend>Focus</legend>
            <div className="focus-options">
              {focusOptions.map(f => (
                <label className="focus-option" key={f}>
                  <input
                    type="checkbox"
                    checked={config.focus.includes(f)}
                    onChange={e =>
                      configure({focus: e.target.checked ? [...config.focus, f] : config.focus.filter(v => v !== f)})
                    }
                  />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>
          <details className="setup-details">
            <summary>
              <SlidersHorizontal />
              Personalize <ChevronDown />
            </summary>
            <div className="setup-details-body">
              <label className="field-label" htmlFor="extra">
                Other focus
              </label>
              <input
                id="extra"
                value={config.extra}
                maxLength={200}
                placeholder="What else matters?"
                onChange={e => configure({extra: e.target.value})}
              />
              <label className="field-label" htmlFor="context">
                Background
              </label>
              <textarea
                id="context"
                value={config.context}
                maxLength={3000}
                placeholder="Your experience or the role you're pursuing"
                onChange={e => configure({context: e.target.value})}
              />
              <div className="inline-fields">
                <div>
                  <label className="field-label" htmlFor="rounds">
                    Questions
                  </label>
                  <select id="rounds" value={config.rounds} onChange={e => configure({rounds: e.target.value})}>
                    {[4, 6, 8].map(n => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="tone">
                    Style
                  </label>
                  <select id="tone" value={config.tone} onChange={e => configure({tone: e.target.value})}>
                    <option>Supportive</option>
                    <option>Direct</option>
                  </select>
                </div>
              </div>
            </div>
          </details>
          <label className="team-consent">
            <input type="checkbox" required />
            <span>Send my audio and answers to the AI service.</span>
          </label>
          <div className="setup-footer">
            <span className="small-label" role="status">
              {
                {
                  checking: 'Checking connection...',
                  ready: 'Ready to practice',
                  key: 'API key needed on server',
                  offline: 'Server unavailable. Refresh to retry.',
                }[health]
              }
            </span>
            <button type="submit" className="main-button" disabled={busy || health !== 'ready'}>
              {busy ? 'Preparing...' : 'Begin'}
              <ArrowRight />
            </button>
          </div>
          <p className="error" role="alert">
            {error}
          </p>
        </form>
        <Character />
      </div>
    </>
  );
}

function History({sessions}) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your conversations.</h1>
          <p>{sessions.length} saved sessions · Stored in this browser</p>
        </div>
      </div>
      <div className="workspace-history">
        {sessions.length ? (
          sessions.map(s => (
            <button key={s.id} className="history-row" onClick={() => selectSession(s)}>
              <span className="row-icon">
                <MessagesSquare />
              </span>
              <div>
                <h3>{s.topic}</h3>
                <p>
                  {s.date} · {s.turns.length} answers
                </p>
              </div>
              <div className="row-end">
                <span>View session</span>
                <ArrowUpRight />
              </div>
            </button>
          ))
        ) : (
          <div className="workspace-history-empty">
            <AudioLines />
            <h2>Room for your first conversation.</h2>
            <button className="text-button" onClick={() => go('setup')}>
              Start an interview <ArrowRight />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function App() {
  const {view, navigation, sessions, selectedSession, interview} = useAppState();
  const [exploring, setExploring] = useState(false);
  // Every navigation returns the home page to its landing state.
  useEffect(() => setExploring(false), [navigation]);
  useLayoutEffect(() => {
    if (view === 'room') return; // the interview room sets its own body classes
    document.body.dataset.theme = 'moon';
    document.body.className =
      'moon moon-workspace' +
      (view === 'setup' ? ' moon-setup' : view === 'home' ? (exploring ? ' moon-exploring' : ' moon-landing') : '');
  }, [view, exploring]);
  if (view === 'room') return <InterviewRoom key={interview.id} opening={interview.opening} />;
  return (
    <div className="shell">
      <Navigation view={view} />
      <main className="main">
        <div className="content">
          {view === 'home' ? (
            <Home exploring={exploring} setExploring={setExploring} />
          ) : view === 'setup' ? (
            <Setup />
          ) : view === 'history' ? (
            <History sessions={sessions} />
          ) : view === 'summary' ? (
            <Review session={selectedSession} />
          ) : (
            <>
              <div className="page-head">
                <h1>Public speaking</h1>
              </div>
              <div className="workspace-history-empty">
                <MicVocal />
                <h2>Coming next</h2>
                <button className="text-button" onClick={() => go('setup')}>
                  Practice an interview <ArrowRight />
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
