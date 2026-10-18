import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,SlidersHorizontal,Plus,X} from 'lucide-react';
import './setup-page.css';
import ResumeInput from './components/ResumeInput.jsx';
import {configure, getState, go, startInterview} from './store.js';

const groups={Job:['Relevant experience','Problem solving','Collaboration','Motivation'],Internship:['Project experience','Learning','Teamwork','Motivation'],School:['Academic interests','Personal story','Goals','Community'],Custom:['Experience','Communication','Problem solving','Motivation']};
function recommendations(kind,target){
 if(/design|portfolio|ux|ui|设计/i.test(target))return ['Portfolio','Design decisions','Collaboration','Problem solving'];
 if(/software|engineer|developer|programming|工程/i.test(target))return ['Technical projects','Problem solving','Trade-offs','Teamwork'];
 return groups[kind];
}
export default function SetupPage({Character}){
 const [config,setConfig]=useState(()=>{const c=getState().config;return {...c,kind:c.kind||'Internship',custom:c.custom||'',focus:c.focus||[],context:c.context||''};});
 const [uploading,setUploading]=useState(false);
 const [health,setHealth]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[extra,setExtra]=useState('');
 const alive=useRef(true),abort=useRef(null),manual=useRef(false);
 useEffect(()=>{alive.current=true;const controller=new AbortController();fetch('/api/health',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(alive.current)setHealth(data);}).catch(e=>{if(e.name!=='AbortError'&&alive.current)setError('Server unavailable. Refresh to retry.');});return()=>{alive.current=false;controller.abort();abort.current?.abort();};},[]);
 function update(values){setConfig(old=>{const next={...old,...values};configure(next);return next;});}
 function changeTarget(target){const suggested=recommendations(config.kind,target);update({custom:target,...(!manual.current?{focus:suggested.slice(0,3)}:{})});}
 function changeKind(kind){manual.current=false;update({kind,topic:kind==='Custom'?'Interview':kind+' interview',focus:recommendations(kind,config.custom).slice(0,3)});}
 const suggested=recommendations(config.kind,config.custom),choices=[...new Set([...suggested,...config.focus])];
 function addFocus(e){e.preventDefault();const value=extra.trim();if(value&&config.focus.length<10){manual.current=true;update({focus:[...new Set([...config.focus,value])]});setExtra('');}}
 async function start(e){e.preventDefault();if(busy||uploading||!health?.keyConfigured||(config.type==='resume'&&!config.resumeText?.trim()))return;setBusy(true);setError('');abort.current=new AbortController();const topic=config.custom.trim()||config.kind+' interview';configure({...config,custom:topic,extra:''});try{const response=await fetch('/api/interview/question',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.current.signal,body:JSON.stringify({type:config.type||'behavioral',resumeText:config.type==='resume'?config.resumeText:undefined,topic,context:config.context,focus:config.focus,tone:config.tone,history:[]})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not prepare your interview.');if(!data.question?.trim())throw Error('No question was returned. Please retry.');if(alive.current)startInterview(data.question);}catch(err){if(alive.current&&err.name!=='AbortError')setError(err.message);}finally{if(alive.current)setBusy(false);}}
 return <div className="interview-setup"><header className="setup-new-heading"><button type="button" className="icon-button" aria-label="Back to practice" onClick={()=>go('home')}><ArrowLeft/></button><h1>Your next conversation.</h1></header>
 <form onSubmit={start} className="setup-new-form">
  <section className="setup-track"><div className="track-switch" role="group" aria-label="Interview track">{[['behavioral','Behavioral'],['resume','Resume deep-dive']].map(([type,label])=><button type="button" key={type} aria-pressed={(config.type||'behavioral')===type} disabled={busy} onClick={()=>{if(type===(config.type||'behavioral'))return;setUploading(false);update({type,resumeText:''});}}>{label}</button>)}</div></section>

  <section className="setup-target"><label htmlFor="interview-target">What are you preparing for?</label><div className="setup-kind" role="group" aria-label="Interview type">{Object.keys(groups).map(kind=><button type="button" key={kind} aria-pressed={config.kind===kind} onClick={()=>changeKind(kind)}>{kind}</button>)}</div><input id="interview-target" autoComplete="off" maxLength={160} value={config.custom} placeholder={config.kind==='School'?'Program or school you are applying to':config.kind==='Custom'?'Your interview topic':'e.g. Game design internship at Riot'} onChange={e=>changeTarget(e.target.value)}/></section>
  {config.type==='resume'&&<ResumeInput value={config.resumeText||''} onChange={resumeText=>update({resumeText})} onBusy={setUploading} disabled={busy}/>}
  <section className="setup-background"><label htmlFor="interview-background">Your background <span>Optional</span></label><textarea id="interview-background" maxLength={3000} rows={3} value={config.context} onChange={e=>update({context:e.target.value})} placeholder="A little about your experience, or paste the job description..."/></section>
  <section className="setup-practice-focus"><h2>What would you like to practice?</h2><div className="setup-focus-list">{choices.map(f=><label key={f}><input type="checkbox" checked={config.focus.includes(f)} onChange={e=>{manual.current=true;update({focus:e.target.checked?[...config.focus,f].slice(0,10):config.focus.filter(v=>v!==f)});}}/><span>{f}</span></label>)}</div><div className="setup-add-focus"><input aria-label="Add practice focus" maxLength={80} value={extra} onChange={e=>setExtra(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addFocus(e);}} placeholder="Add a focus"/><button type="button" aria-label="Add focus" title="Add focus" disabled={!extra.trim()||config.focus.length>=10} onClick={addFocus}><Plus size={17}/></button></div></section>
  <section className="setup-character"><h2>Your interviewer</h2><Character/></section>
  <details className="setup-advanced"><summary><SlidersHorizontal size={16}/>Session settings<ChevronDown size={16}/></summary><div><label>Questions<select value={config.rounds} onChange={e=>update({rounds:e.target.value})}>{[1,3,5,10].map(n=><option key={n} value={String(n)}>{n}</option>)}</select></label><label>Interview style<select value={config.tone} onChange={e=>update({tone:e.target.value})}><option>Supportive</option><option>Direct</option></select></label></div></details>
  <label className="setup-permission"><input type="checkbox" required/><span>Audio, answers, and any resume text are sent to Gemini for transcription and feedback.</span></label>
  <label className="setup-feedback-choice">Feedback<select aria-label="Feedback timing" value={config.feedbackMode||'summary'} onChange={e=>update({feedbackMode:e.target.value})}><option value="summary">After the interview</option><option value="each">After each answer</option></select></label>
  {health&&!health.keyConfigured&&<p role="alert" className="error">Set up an API key on the server to start.</p>}{error&&<p role="alert" className="error">{error}</p>}
  <footer className="setup-start"><span>{config.rounds} {config.rounds==='1'?'question':'questions'}</span><button className="main-button" type="submit" disabled={busy||uploading||!health?.keyConfigured||(config.type==='resume'&&!config.resumeText?.trim())}>{busy?'Preparing...':'Start interview'}<ArrowRight size={18}/></button></footer>
 </form></div>;
}
