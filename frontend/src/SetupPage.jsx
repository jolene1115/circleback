import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import './setup-page.css';
import {configure, getState, go, startInterview} from './store.js';

export default function SetupPage({Character}){
 const [config,setConfig]=useState(()=>{const c=getState().config;return {...c,custom:c.custom||'',focus:[],extra:'',tone:'Supportive',context:c.context||''};});
 const [health,setHealth]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState(''),[resumeUploaded,setResumeUploaded]=useState(false);
 const alive=useRef(true),abort=useRef(null),upload=useRef(null);
 useEffect(()=>{alive.current=true;const controller=new AbortController();fetch('/api/health',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(alive.current)setHealth(data);}).catch(e=>{if(e.name!=='AbortError'&&alive.current)setError('Server unavailable. Refresh to retry.');});return()=>{alive.current=false;controller.abort();abort.current?.abort();upload.current?.abort();};},[]);
 function update(values){setConfig(old=>{const next={...old,...values};configure(next);return next;});}
 function changeTrack(type){upload.current?.abort();upload.current=null;setUploading(false);setUploadError('');setResumeUploaded(false);update({type,resumeText:''});}
 async function uploadResume(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  upload.current?.abort();const controller=new AbortController();upload.current=controller;
  setUploadError('');setResumeUploaded(false);update({resumeText:''});
  if(file.size>5*1024*1024){setUploadError('Resume PDF must be 5 MB or smaller.');setUploading(false);return;}
  setUploading(true);
  try{
   const body=new FormData();body.append('file',file);
   const response=await fetch('/api/interview/resume',{method:'POST',body,signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Could not extract resume text. Please paste it instead.');
   if(alive.current&&upload.current===controller){update({resumeText:data.resumeText});setResumeUploaded(true);}
  }catch(err){if(alive.current&&upload.current===controller&&err.name!=='AbortError')setUploadError(err.message);}
  finally{if(alive.current&&upload.current===controller)setUploading(false);}
 }
 async function start(e){e.preventDefault();if(busy||uploading||!health?.keyConfigured)return;if(config.type==='resume'&&!config.resumeText?.trim()){setError('Upload a resume or paste resume text first.');return;}setBusy(true);setError('');abort.current=new AbortController();const topic=config.custom.trim()||'General interview';configure({...config,custom:topic,extra:''});try{const response=await fetch('/api/interview/question',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.current.signal,body:JSON.stringify({type:config.type||'behavioral',resumeText:config.type==='resume'?config.resumeText:undefined,topic,context:config.context,focus:config.focus,tone:config.tone,history:[]})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not prepare your interview.');if(!data.question?.trim())throw Error('No question was returned. Please retry.');if(alive.current)startInterview(data.question);}catch(err){if(alive.current&&err.name!=='AbortError')setError(err.message);}finally{if(alive.current)setBusy(false);}}
 return <div className="interview-setup"><header className="setup-new-heading"><button type="button" className="icon-button" aria-label="Back to practice" onClick={()=>go('home')}><ArrowLeft/></button><h1>Your next conversation.</h1></header>
 <form onSubmit={start} className="setup-new-form">
  <section className="setup-target"><h2>Interview track</h2><div className="setup-kind" role="group" aria-label="Interview track">{[['behavioral','Behavioral'],['resume','Resume deep-dive']].map(([type,label])=><button type="button" key={type} disabled={busy} aria-pressed={(config.type||'behavioral')===type} onClick={()=>changeTrack(type)}>{label}</button>)}</div></section>
  <section className="setup-character"><h2>Your interviewer</h2><Character/></section>
  {config.type==='resume'&&<section className="setup-background">
   <label htmlFor="resume-pdf">Upload your resume PDF</label><div className="resume-upload-row"><input id="resume-pdf" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={uploadResume}/></div>
   <div className="resume-help-row"><p className="resume-help resume-upload-help" role="status">{uploading?'Extracting resume…':'Or paste your resume below.'}</p>{resumeUploaded&&<button className="resume-clear" type="button" disabled={busy} onClick={()=>changeTrack('resume')}>Clear resume</button>}</div>
   {uploadError&&<p className="error" role="alert">{uploadError}</p>}
   <div className={'resume-text-box'+(resumeUploaded?' has-resume':'')}> <textarea aria-label="Resume text" id="resume-text" rows={8} maxLength={20000} required disabled={uploading||busy} value={config.resumeText||''} onChange={e=>update({resumeText:e.target.value})}/></div>
   <p className="resume-help resume-privacy-note">Review the text and remove anything you don’t want shared with Gemini. Your PDF isn’t saved, and resume text is cleared when you return home.</p>
  </section>}
  <section className="setup-target"><label htmlFor="interview-target">What are you preparing for?</label><input id="interview-target" autoComplete="off" maxLength={160} value={config.custom} placeholder="e.g. Game design internship at Riot" onChange={e=>update({custom:e.target.value})}/></section>
  <section className="setup-background"><label htmlFor="interview-background">Background/Job Description <span>Optional</span></label><textarea id="interview-background" maxLength={3000} rows={3} value={config.context} onChange={e=>update({context:e.target.value})} placeholder="A little about your experience, or paste the job description..."/></section>

  <section className="setup-advanced setup-session-settings"><div><div><h3 id="question-count-label">Number of questions</h3><div className="setup-kind question-count-options" role="group" aria-labelledby="question-count-label">{[1,3,5,10].map(n=><button type="button" key={n} aria-pressed={Number(config.rounds)===n} onClick={()=>update({rounds:String(n)})}>{n}</button>)}</div></div><div><h3 id="feedback-timing-label">Feedback</h3><div className="setup-kind feedback-timing-options" role="group" aria-labelledby="feedback-timing-label">{[['summary','After the interview'],['each','After each answer']].map(([value,label])=><button type="button" key={value} aria-pressed={(config.feedbackMode||'summary')===value} onClick={()=>update({feedbackMode:value})}>{label}</button>)}</div></div></div></section>
  <label className="setup-permission"><input type="checkbox" required/><span>Audio, answers, and any resume text are sent to Gemini for transcription and feedback.</span></label>
  {health&&!health.keyConfigured&&<p role="alert" className="error">Set up an API key on the server to start.</p>}{error&&<p role="alert" className="error">{error}</p>}
  <footer className="setup-start"><span>{config.rounds} {config.rounds==='1'?'question':'questions'}</span><button className="main-button" type="submit" disabled={busy||uploading||!health?.keyConfigured||(config.type==='resume'&&!config.resumeText?.trim())}>{busy?'Preparing...':'Start interview'}<ArrowRight size={18}/></button></footer>
 </form></div>;
}
