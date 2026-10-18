import React, {useEffect, useLayoutEffect, useState} from 'react';
import {
  AudioLines,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  MessagesSquare,
  MicVocal,
  Pencil,
  Square,
  UserRound,
  Volume2,
} from 'lucide-react';

import Figure from './components/Figure.jsx';
import InkEditor from './components/InkEditor.jsx';
import InterviewerCollection from './components/InterviewerCollection.jsx';
import {setFigureState, welcome} from './engine/figure.js';
import {getInterviewerName, onInterviewerChange} from './engine/ink.js';
import {currentVoice, onVoicesChange, selectVoice, speak, stopVoice, voiceId, voices} from './engine/voice.js';
import Account from './Account.jsx';
import Feedback from './Feedback.jsx';
import SetupPage from './SetupPage.jsx';
import SpeakingSetup from './SpeakingSetup.jsx';
import InterviewRoom from './room/InterviewRoom.jsx';
import {
  explorePractice,
  go,
  retryQuestion,
  retrySession,
  selectSession,
  useAppState,
} from './store.js';

function Navigation({view}) {
  const {user} = useAppState();
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
        <span>CircleBack</span>
      </a>
      <nav aria-label="Main navigation">
        <button className={'nav-item ' + (['home', 'setup', 'speaking'].includes(view) ? 'active' : '')} onClick={() => go('home')}>
          Practice
        </button>
        <button className={'nav-item ' + (['history', 'summary'].includes(view) ? 'active' : '')} onClick={() => go('history')}>
          History
        </button>
      </nav>
      <button className={'nav-item account-profile-link ' + (view === 'account' ? 'active' : '')} aria-label={user ? 'Your profile' : 'Log in / Sign up'} title={user ? 'Your profile' : 'Log in / Sign up'} onClick={() => go('account')}>
        <UserRound aria-hidden="true" /><span>{user ? user.name + ' · Profile' : 'Log in / Sign up'}</span>
      </button>
    </aside>
  );
}

function Home({exploring, setExploring}) {
  return (
    <>
      <section className="workspace-intro">
        <div className="workspace-title" hidden={exploring}>
          <span className="landing-tagline">Practice. Reflect. Repeat.</span>
          <h1>CircleBack</h1>
          <button
            className="main-button explore-button"
            onPointerEnter={() => welcome('hover')}
            onPointerLeave={() => welcome('leave')}
            onFocus={() => welcome('hover')}
            onBlur={() => welcome('leave')}
            onClick={() => {
              welcome('confirm');
              explorePractice();
            }}
          >
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
                        <ChoiceHand />
          </button>
        </section>
      )}
    </>
  );
}

function ChoiceHand() {
  return (
    <svg className="choice-hand" viewBox="0 120 400 210" fill="none" aria-hidden="true">
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
    setFigureState('thinking');
    speak({
      text: 'Tell me about a project you are proud of. Take your time.',
      onstart: () => setFigureState('speaking'),
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

function History({sessions}) {
  const {user, syncing, syncError} = useAppState();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your conversations.</h1>
          <p>{sessions.length} saved sessions · {user ? (syncError ? 'Saved on this device · Sync pending' : syncing ? 'Syncing your account' : 'Synced to your account') : 'Saved in this browser'}</p>
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
                  {s.mode === 'speaking' ? 'Speech · ' : ''}
                  {s.date} · {s.turns.length} {s.mode === 'speaking' ? 'attempts' : 'answers'}
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
          </div>
        )}
      </div>
    </>
  );
}

export default function App() {
  const {view, navigation, sessions, selectedSession, interview, user, syncError, syncing, showPracticeChoices} = useAppState();
  const [exploring, setExploring] = useState(false);
  // Login opens the mode choices; ordinary home navigation keeps the landing page.
  useEffect(() => setExploring(Boolean(showPracticeChoices)), [navigation, showPracticeChoices]);
  useLayoutEffect(() => {
    if (view === 'room') return; // the interview room sets its own body classes
    document.body.dataset.theme = 'moon';
    document.body.className =
      'moon moon-workspace' +
      (view === 'setup' || view === 'speaking' ? ' moon-setup' : view === 'home' ? (exploring ? ' moon-exploring' : ' moon-landing') : '');
  }, [view, exploring]);
  if (view === 'room') return <InterviewRoom key={interview.id} opening={interview.opening} mode={interview.mode} />;
  return (
    <div className="shell">
      <Navigation view={view} />
      <main className="main">
        <div className="content">
          {user && syncing && <p role="status" className="account-history-notice">Saving and refreshing account history…</p>}
          {syncError && view !== 'account' && <p role="alert" className="account-history-notice">{syncError} Your copy is kept on this device. <button className="text-button" onClick={() => go('account')}>Retry from your profile</button></p>}
          {view === 'account' ? <Account /> : view === 'home' ? (
            <Home exploring={exploring} setExploring={setExploring} />
          ) : view === 'setup' ? (
            <SetupPage Character={Character} />
          ) : view === 'history' ? (
            <History sessions={sessions} />
          ) : view === 'summary' ? (
            selectedSession ? (
            <Feedback
              key={selectedSession.id}
              session={selectedSession}
              onBack={() => go('history')}
              onPractice={() => retrySession(selectedSession)}
              onRetry={turn => retryQuestion(selectedSession, turn.q)}
            />
          ) : (
            <History sessions={sessions} />
          )
          ) : (
            <SpeakingSetup Character={Character} />
          )}
        </div>
      </main>
    </div>
  );
}
