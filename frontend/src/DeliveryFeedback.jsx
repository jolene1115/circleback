import React from 'react';
import {AudioLines} from 'lucide-react';

export default function DeliveryFeedback({metrics,tip}) {
 const timed=Number.isFinite(metrics?.durationSec)&&metrics.durationSec>0;
 const pace=timed&&Number.isFinite(metrics.wordsPerMinute)?metrics.wordsPerMinute:null;
 const fillers=Number.isFinite(metrics?.fillerCount)?metrics.fillerCount:null;
 const short=timed&&metrics.durationSec<20;
 const paceTip=pace===null?'Recording duration was not saved for this answer. Record a new answer to measure pace.':short?'This answer is too short for a reliable pace comparison. Try a complete example before adjusting your speed.':pace>170?'Try shorter sentences and a brief pause after each key point. Aim for clarity rather than racing to finish.':pace<110?'Try rehearsing the main point first, then give your example. This average includes silence, so pauses may lower it.':'Your average pace is within a useful practice range. Leave a brief pause after the result so it can land.';
 const words=Object.entries(metrics?.fillerWords||{}).filter(([,count])=>count>0);
 return <section className="delivery-feedback" aria-label="Speaking delivery">
  <h3><AudioLines size={18}/>Speaking delivery</h3>
  <dl className="delivery-numbers">
   <div><dt>Duration</dt><dd>{timed?`${Math.round(metrics.durationSec)}s`:'Not recorded'}</dd></div>
   <div><dt>Average pace</dt><dd>{pace!==null?<>{pace} <small>wpm</small></>:'Not recorded'}</dd></div>
   <div><dt>Possible fillers</dt><dd>{fillers??'Not recorded'}</dd></div>
  </dl>
  <div className="delivery-advice"><div><h4>Pace & rhythm</h4><p>{paceTip}</p>{timed&&<small>English practice guide: roughly 110–170 wpm, not a score. Includes recorded silence.</small>}</div>
   <div><h4>Filler words</h4><p>{fillers===null?'Filler counts were not saved for this answer.':fillers>0?'Try replacing a filler with a short, quiet pause before your next point.':'No listed filler words were found in the transcript.'}</p>{words.length>0&&<p className="delivery-fillers">{words.map(([word,count])=>`${word} × ${count}`).join(' · ')}</p>}<small>Transcript estimate; ordinary words can be flagged, and transcription may omit fillers.</small></div>
   {tip&&<div><h4>Verbal organization</h4><p>{tip}</p></div>}
  </div>
  <p className="delivery-unavailable">Pronunciation, intonation, volume and pause timing have not been analyzed.</p>
 </section>;
}
