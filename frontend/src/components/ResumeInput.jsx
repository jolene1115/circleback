import React, {useEffect, useRef, useState} from 'react';
import {Check, ChevronDown, FileText, LoaderCircle, Upload, X} from 'lucide-react';

export default function ResumeInput({value, onChange, onBusy, disabled}) {
  const input = useRef(null), pending = useRef(null);
  const [filename, setFilename] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => { pending.current?.abort(); }, []);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    pending.current?.abort();
    setError('');
    if (file.size > 5 * 1024 * 1024) { setError('Choose a PDF smaller than 5 MB.'); return; }
    if (!/\.pdf$/i.test(file.name)) { setError('Choose a PDF, or paste your resume below.'); return; }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); onBusy(true);
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch('/api/interview/resume', {method: 'POST', body, signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not read this PDF. Paste your resume instead.');
      if (!data.resumeText?.trim()) throw Error('No readable text found. Paste your resume instead.');
      if (pending.current !== controller) return;
      onChange(data.resumeText); setFilename(file.name); setExpanded(false);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!controller.signal.aborted && pending.current === controller) {
        setBusy(false); onBusy(false); pending.current = null;
      }
    }
  }

  return <section className="setup-background resume-section">
    <div className="resume-heading"><label htmlFor="resume-text">Your resume</label><span>PDF or text</span></div>
    <input ref={input} type="file" accept=".pdf,application/pdf" hidden onChange={upload} disabled={busy || disabled} aria-label="Upload resume PDF" />
    <div className="resume-upload">
      <button type="button" className="resume-upload-button" disabled={busy || disabled} onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle className="resume-spinner" size={18} /> : filename ? <FileText size={18} /> : <Upload size={18} />}
        <span>{busy ? 'Reading PDF...' : filename || 'Upload PDF'}</span>
      </button>
      {value && !busy ? <button type="button" className="icon-button" aria-label="Clear resume" title="Clear resume" disabled={disabled} onClick={() => {onChange(''); setFilename(''); setError(''); setExpanded(true);}}><X size={17} /></button> : <span className="resume-limit">5 MB max</span>}
    </div>
    {value.trim() && <button type="button" className="resume-review" aria-expanded={expanded} aria-controls="resume-text" disabled={busy || disabled} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide text' : 'View / edit text'}<ChevronDown size={16}/></button>}
    <textarea id="resume-text" hidden={!expanded} rows={6} maxLength={20000} required={expanded} value={value} disabled={busy || disabled} onChange={e => onChange(e.target.value)} placeholder="Or paste your experience, projects and skills..." aria-describedby="resume-note" />
    <div className="resume-status" role="status">{error ? <span className="error">{error}</span> : value.trim() ? <><Check size={14} />Ready to review</> : null}</div>
    <p id="resume-note" className="resume-note">Only this text is sent for questions and feedback. The PDF is not saved. Resume text clears when you return home.</p>
  </section>;
}
