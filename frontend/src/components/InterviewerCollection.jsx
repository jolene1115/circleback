import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {BookmarkPlus, Trash2, X} from 'lucide-react';

import {strokeMoonLine, traceRestingFigure} from '../engine/drawing.js';
import {setFigureState} from '../engine/figure.js';
import {getInk, getInterviewerName, loadCollection, paintInk, saveCollection, saveInterviewer} from '../engine/ink.js';
import {currentVoice, selectVoice, stopVoice, voiceId, voices} from '../engine/voice.js';

function Thumbnail({ink}) {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current.getContext('2d');
    c.scale(0.24, 0.24);
    traceRestingFigure(c, false);
    strokeMoonLine(c, '#e9eef2');
    paintInk(c, ink);
  }, [ink]);
  return <canvas ref={canvas} width="240" height="120" aria-hidden="true" />;
}

/** Modal listing saved interviewers (drawing + name + voice). `onVoiceMissing` is called if a preset's voice is gone. */
export default function InterviewerCollection({onClose, onVoiceMissing}) {
  const dialog = useRef(null),
    input = useRef(null);
  const [saved, setSaved] = useState(loadCollection);
  const [name, setName] = useState(getInterviewerName());
  const [status, setStatus] = useState('');

  useEffect(() => {
    const el = dialog.current,
      opener = document.activeElement;
    const closed = () => {
      onClose();
      opener?.focus();
    };
    el.addEventListener('close', closed, {once: true});
    el.showModal();
    return () => el.removeEventListener('close', closed);
  }, []);

  function persist(next) {
    if (saveCollection(next)) {
      setSaved(next);
      return true;
    }
    setStatus('Storage is full. Remove a saved interviewer and try again.');
    return false;
  }

  function saveCurrent(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      input.current.setCustomValidity('Enter a name.');
      input.current.reportValidity();
      return;
    }
    const voice = currentVoice();
    const preset = {
      id: crypto.randomUUID(),
      name: trimmed,
      ink: structuredClone(getInk()),
      voice: voice ? voiceId(voice) : '',
      voiceName: voice?.name || '',
    };
    if (persist([...saved, preset])) setStatus('Saved.');
  }

  function use(preset) {
    try {
      saveInterviewer(preset.ink, preset.name);
    } catch {
      setStatus('Could not apply this interviewer. Please try again.');
      return;
    }
    stopVoice();
    selectVoice(preset.voice);
    setFigureState('listening');
    dialog.current.close();
    if (preset.voice && !voices().some(v => voiceId(v) === preset.voice)) onVoiceMissing?.();
  }

  function remove(preset) {
    if (confirm('Delete "' + preset.name + '" from your collection?') && persist(saved.filter(p => p.id !== preset.id)))
      setStatus('Deleted.');
  }

  return createPortal(
    <dialog id="interviewerCollection" ref={dialog}>
      <form method="dialog" className="ink-header">
        <h2>Your interviewers</h2>
        <button className="icon-button" aria-label="Close collection" title="Close">
          <X />
        </button>
      </form>
      <form className="collection-save" onSubmit={saveCurrent}>
        <input
          ref={input}
          maxLength={40}
          required
          aria-label="Collection name"
          placeholder="Name this interviewer"
          value={name}
          onChange={e => {
            e.target.setCustomValidity('');
            setName(e.target.value);
          }}
        />
        <button className="icon-button" title="Save current interviewer" aria-label="Save current interviewer">
          <BookmarkPlus />
        </button>
      </form>
      <p className="collection-status" role="status">
        {status}
      </p>
      <div className="collection-list">
        {!saved.length && <p className="collection-empty">No saved interviewers yet.</p>}
        {saved.map(preset => (
          <div className="collection-row" key={preset.id}>
            <button type="button" className="collection-use" aria-label={'Use ' + preset.name} onClick={() => use(preset)}>
              <Thumbnail ink={preset.ink} />
              <span>
                <strong>{preset.name}</strong>
                <small>{preset.voiceName || 'Default voice'}</small>
              </span>
            </button>
            <button
              type="button"
              className="icon-button"
              title={'Delete ' + preset.name}
              aria-label={'Delete ' + preset.name}
              onClick={() => remove(preset)}
            >
              <Trash2 />
            </button>
          </div>
        ))}
      </div>
    </dialog>,
    document.body,
  );
}
