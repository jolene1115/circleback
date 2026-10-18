import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Check, Eraser, Pencil, RotateCcw, Undo2, X} from 'lucide-react';

import {strokeMoonLine, traceRestingFigure} from '../engine/drawing.js';
import {getInk, getInterviewerName, inkColors, paintInk, saveInterviewer} from '../engine/ink.js';

const MAX_STROKES = 150,
  MAX_POINTS = 2000,
  MAX_UNDO = 40;

/** Modal for drawing on the interviewer and naming it. */
export default function InkEditor({onClose}) {
  const dialog = useRef(null),
    canvas = useRef(null);
  const draft = useRef(structuredClone(getInk())),
    undo = useRef([]),
    active = useRef(null),
    pointer = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(inkColors[0][1]);
  const [name, setName] = useState(getInterviewerName());
  const [status, setStatus] = useState('');
  const [canUndo, setCanUndo] = useState(false);

  function draw() {
    const el = canvas.current;
    if (!el) return;
    const c = el.getContext('2d'),
      r = el.getBoundingClientRect(),
      dpr = window.devicePixelRatio || 1;
    el.width = Math.max(1, Math.round(r.width * dpr));
    el.height = Math.max(1, Math.round(r.height * dpr));
    c.setTransform(el.width / 1000, 0, 0, el.height / 500, 0, 0);
    c.clearRect(0, 0, 1000, 500);
    traceRestingFigure(c);
    strokeMoonLine(c, '#e9eef2');
    paintInk(c, draft.current);
    setCanUndo(undo.current.length > 0);
  }

  useEffect(() => {
    const el = dialog.current,
      opener = document.activeElement;
    const closed = () => {
      onClose();
      opener?.focus();
    };
    el.addEventListener('close', closed, {once: true});
    el.showModal();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas.current);
    draw();
    return () => {
      observer.disconnect();
      el.removeEventListener('close', closed);
    };
  }, []);

  function checkpoint() {
    undo.current.push(structuredClone(draft.current));
    if (undo.current.length > MAX_UNDO) undo.current.shift();
  }

  function point(e) {
    const r = canvas.current.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, ((e.clientX - r.left) * 1000) / r.width)),
      Math.max(0, Math.min(500, ((e.clientY - r.top) * 500) / r.height)),
    ];
  }

  function erase(p) {
    draft.current = draft.current.filter(s => !s.points.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 20));
  }

  function onPointerDown(e) {
    if (pointer.current !== null || e.button !== 0) return;
    e.preventDefault();
    pointer.current = e.pointerId;
    canvas.current.setPointerCapture(e.pointerId);
    checkpoint();
    if (tool === 'pen') {
      if (draft.current.length >= MAX_STROKES) {
        setStatus('Drawing limit reached. Erase a stroke to continue.');
        pointer.current = null;
        return;
      }
      active.current = [point(e)];
      draft.current.push({color, points: active.current});
    } else erase(point(e));
    draw();
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointer.current) return;
    const p = point(e);
    if (tool === 'pen' && active.current && active.current.length < MAX_POINTS) {
      const last = active.current.at(-1);
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 1.5) active.current.push(p);
    } else if (tool === 'erase') erase(p);
    draw();
  }

  function onPointerUp() {
    pointer.current = null;
    active.current = null;
  }

  function save() {
    try {
      saveInterviewer(draft.current, name.trim());
      dialog.current.close();
    } catch {
      setStatus('Could not save. Please try again.');
    }
  }

  return createPortal(
    <dialog id="inkEditor" ref={dialog}>
      <form method="dialog" className="ink-header">
        <input
          id="interviewerName"
          maxLength={40}
          value={name}
          placeholder="Name your interviewer"
          aria-label="Interviewer name"
          autoComplete="off"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
        />
        <button className="icon-button" aria-label="Close editor" title="Close">
          <X />
        </button>
      </form>
      <div className="ink-tools" role="group" aria-label="Drawing tools">
        <button data-ink-tool="pen" aria-pressed={String(tool === 'pen')} title="Draw" aria-label="Draw" onClick={() => setTool('pen')}>
          <Pencil />
        </button>
        <button
          data-ink-tool="erase"
          aria-pressed={String(tool === 'erase')}
          title="Erase added strokes"
          aria-label="Erase added strokes"
          onClick={() => setTool('erase')}
        >
          <Eraser />
        </button>
        <button
          id="inkUndo"
          title="Undo"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => {
            if (undo.current.length) draft.current = undo.current.pop();
            draw();
          }}
        >
          <Undo2 />
        </button>
        <button
          id="inkReset"
          title="Reset drawing"
          aria-label="Reset drawing"
          onClick={() => {
            checkpoint();
            draft.current = [];
            draw();
          }}
        >
          <RotateCcw />
        </button>
      </div>
      <div className="ink-palette" role="group" aria-label="Ink color">
        {inkColors.map(([label, value]) => (
          <button
            key={value}
            type="button"
            data-ink-color={value}
            style={{'--ink-color': value}}
            title={label}
            aria-label={label}
            aria-pressed={String(value === color)}
            onClick={() => {
              setColor(value);
              setTool('pen');
            }}
          />
        ))}
      </div>
      <canvas
        id="inkCanvas"
        ref={canvas}
        aria-label="Draw on the interviewer"
        width="1000"
        height="500"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="ink-footer">
        <span id="inkStatus" role="status">
          {status}
        </span>
        <button id="inkSave" className="main-button" onClick={save}>
          Save <Check />
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
