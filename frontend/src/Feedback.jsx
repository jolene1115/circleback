import React,{useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Minus,RotateCw,ChevronDown,MessageCircle,AudioLines} from 'lucide-react';
import './feedback.css';
import DeliveryFeedback from './DeliveryFeedback';

export default function Feedback({session,onBack,onPractice,onRetry}) {
 const [index,setIndex]=useState(0);
 const turns=session?.turns||[],active=Math.min(index,Math.max(0,turns.length-1));
 const turn=turns[active],feedback=turn?.feedback,metrics=turn?.metrics||feedback?.metrics;
 const star=feedback?.star_check||feedback?.starCheck;
 const rewrite=feedback?.example_rewrite||feedback?.exampleRewrite;
 const tip=feedback?.delivery_tip||feedback?.deliveryTip;
 const strengths=feedback?.strength?[feedback.strength]:feedback?.strengths||[];
 const improvements=feedback?.improvement?[feedback.improvement]:feedback?.improvements||[];
 const next=feedback?.retry_challenge||feedback?.nextTry;
 return <div className="feedback-page">
  <button className="feedback-back" onClick={onBack}><ArrowLeft size={16}/>History</button>
  <header className="feedback-heading"><div><div className="feedback-meta">{session?.preview?'Sample feedback':session?.date}<span>{turns.length} {turns.length===1?'answer':'answers'}</span></div><h1>Your next step.</h1><p>{session?.topic||'Practice review'}</p></div><button className="feedback-practice" onClick={onPractice}><RotateCw size={16}/>Practice again</button></header>
  {!turn?<section className="feedback-empty"><MessageCircle/><h2>No answers yet.</h2><p>Complete an answer to receive feedback.</p></section>:<>
   <nav className="feedback-tabs" aria-label="Answers">{turns.map((t,i)=><button key={i} aria-current={active===i?'true':undefined} onClick={()=>setIndex(i)}>Answer {i+1}{t.feedback&&<span className="feedback-dot"/>}</button>)}</nav>
   <div className="feedback-question"><MessageCircle size={22}/><h2>{turn.q||'Your speech'}</h2></div>
   {!feedback?<p className="feedback-empty">Feedback wasn't saved for this answer.</p>:<div className="feedback-grid">
    <section className="feedback-main" aria-label="Answer feedback">
     {feedback.summary&&<p className="feedback-summary">{feedback.summary}</p>}
     {!!strengths.length&&<section className="feedback-note strength"><h3><Check size={17}/>Keep this</h3>{strengths.map((s,i)=><p key={i}>{s}</p>)}</section>}
     {!!improvements.length&&<section className="feedback-note improvement"><h3><ArrowUpRightIcon/>Next time</h3>{improvements.map((s,i)=><p key={i}>{s}</p>)}</section>}
     {rewrite&&<section className="feedback-rewrite"><h3>A stronger version</h3><blockquote>{rewrite}</blockquote></section>}
     <DeliveryFeedback metrics={metrics} tip={tip}/>
     <details className="feedback-transcript"><summary>Your answer<ChevronDown size={16}/></summary><p>{turn.a||'No transcript saved.'}</p></details>
    </section>
    <aside className="feedback-details" aria-label="Answer details">
     {star&&<section><h3>Story structure</h3><ul className="feedback-star">{[['situation','Situation'],['task','Task'],['action','Action'],['result','Result']].map(([key,label])=><li key={key} className={star[key]===true?'present':'missing'}><span>{label}</span><span>{star[key]===true?<><Check size={15}/>Present</>:star[key]===false?<><Minus size={15}/>Add detail</>:<>Not assessed</>}</span></li>)}</ul></section>}
     {Array.isArray(feedback.pointsCovered)&&feedback.pointsCovered.length>0&&<section><h3>Key points</h3><ul className="feedback-points">{feedback.pointsCovered.map((point,i)=><li key={i}>{point.covered?<Check size={16}/>:<Minus size={16}/>}<div>{point.point}<small>{point.evidence||(point.covered?'Covered':'Not covered')}</small></div></li>)}</ul></section>}
     {feedback.timeCheck&&<section><h3>Time limit</h3><p>{feedback.timeCheck.durationSec}s of {feedback.timeCheck.limitSec}s{feedback.timeCheck.overBySec>0?` (${feedback.timeCheck.overBySec}s over)`:''}</p></section>}
     {next&&<section className="feedback-next"><h3>Try next</h3><p>{next}</p></section>}
     {!session.preview&&turn.q&&<button className="feedback-retry" onClick={()=>onRetry(turn)}><RotateCw size={16}/>Retry this question</button>}
    </aside>
   </div>}
   <footer className="feedback-footer"><span>{active+1} / {turns.length}</span><div><button aria-label="Previous answer" title="Previous answer" disabled={active===0} onClick={()=>setIndex(active-1)}><ArrowLeft size={18}/></button><button aria-label="Next answer" title="Next answer" disabled={active===turns.length-1} onClick={()=>setIndex(active+1)}><ArrowRight size={18}/></button></div></footer>
  </>}
 </div>;
}
function ArrowUpRightIcon(){return <ArrowRight size={17} style={{transform:'rotate(-35deg)'}}/>;}
