const teamBaseBind=bind,teamBaseSummary=summary;
let teamOpening='';
nextQuestion=()=>teamOpening;
function interviewContext(){return {topic:currentTopic(),context:config.context,focus:[...config.focus,...(config.extra?[config.extra]:[])],tone:config.tone,history:turns.map(t=>({question:t.q,answer:t.a}))};}
async function teamRequest(path,payload){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed. Please try again.');return data;}
 catch(error){if(error.name==='AbortError')throw Error('The server took too long. Please try again.');throw error;}
 finally{clearTimeout(timer);}
}
// Show the AI's feedback in place of the answer box; `next` runs when the user continues.
function showFeedback(feedback,last,next){
 const form=$('#answerForm');if(!form)return next();
 // Same look as the end-of-session review (src/Review.jsx, review.css), condensed for one answer.
 const m=feedback.metrics,star=feedback.star_check;
 const block=(cls,iconName,label,text)=>'<div class="mini-block"><h3 class="'+cls+'">'+icon(iconName)+label+'</h3><p>'+esc(text)+'</p></div>';
 const stat=(label,value,unit)=>'<div><small>'+label+'</small><strong>'+value+(unit?'<span>'+unit+'</span>':'')+'</strong></div>';
 const stats=m?'<div class="mini-stats">'+stat('Duration',Math.round(m.durationSec)+'s')+stat('Average pace',m.wordsPerMinute,'wpm')+stat('Possible fillers',m.fillerCount)+'</div>':'';
 const structure=star?'<aside class="mini-side"><h4>Story structure</h4><ul>'+['situation','task','action','result'].map(k=>'<li><span>'+k[0].toUpperCase()+k.slice(1)+'</span>'+(star[k]?'<span class="mini-present">'+icon('check')+'Present</span>':'<span class="mini-missing">'+icon('minus')+'Add detail</span>')+'</li>').join('')+'</ul></aside>':'';
 const panel=document.createElement('section');panel.className='answer-feedback';panel.setAttribute('aria-live','polite');panel.setAttribute('aria-label','Feedback on your answer');
 panel.innerHTML='<div class="mini-body"><div class="mini-main">'+block('mini-keep','check','Keep this',feedback.strength)+block('mini-next','move-up-right','Next time',feedback.improvement)+stats+'</div>'+structure+'</div><div class="mini-foot"><button type="button" class="mini-continue">'+(last?'See summary':'Next question')+icon('arrow-right')+'</button></div>';
 form.style.display='none';form.after(panel);lucide.createIcons();
 const dialogue=panel.closest('.moon-dialogue');dialogue?.classList.add('has-feedback');
 const button=panel.querySelector('button');button.focus();
 button.onclick=()=>{panel.remove();dialogue?.classList.remove('has-feedback');form.style.display='';next();};
}
summary=function(){
 const markup=teamBaseSummary(),s=selectedSession;
 if(!s?.turns.some(t=>t.feedback))return markup;
 const root=document.createElement('div');root.innerHTML=markup;
 const section=root.querySelector('.summary-layout>section');
 if(section){section.replaceChildren();s.turns.forEach((t,i)=>{const block=document.createElement('section');block.className='feedback-item';block.innerHTML='<h3>Question '+(i+1)+'</h3><p>'+esc(t.q)+'</p><div class="summary-quote">'+esc(t.a)+'</div>'+(t.feedback?'<h3>Strength</h3><p>'+esc(t.feedback.strength)+'</p><h3>Next step</h3><p>'+esc(t.feedback.improvement)+'</p><p>'+esc(t.feedback.retry_challenge)+'</p>':'');section.append(block);});}
 root.querySelectorAll('.sample-label').forEach(el=>el.remove());
 root.querySelectorAll('p').forEach(el=>{if(/sample|preview|not.*evaluat/i.test(el.textContent))el.remove();});
 return root.innerHTML;
};
bind=function(){
 teamBaseBind();
 if(view==='setup'){
  const form=$('#setupForm'),start=form.onsubmit,button=form.querySelector('button[type=submit]');
  const service=form.querySelector('.setup-footer .small-label');service.textContent='Checking connection...';button.disabled=true;
  fetch('/api/health').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!form.isConnected)return;button.disabled=!data.keyConfigured;service.textContent=data.keyConfigured?'Ready to practice':'API key needed on server';}).catch(()=>{if(form.isConnected)service.textContent='Server unavailable. Refresh to retry.';});
  const consent=document.createElement('label');consent.className='team-consent';consent.innerHTML='<input type="checkbox" required> <span>Send my audio and answers to the AI service.</span>';button.parentElement.before(consent);
  const error=document.createElement('p');error.className='error';error.setAttribute('role','alert');form.append(error);
  form.onsubmit=async e=>{e.preventDefault();if(button.disabled||!form.reportValidity())return;saveConfig();answerSeconds=0;button.disabled=true;error.textContent='';const label=button.innerHTML;button.textContent='Preparing...';
   try{const result=await teamRequest('interview/question',{...interviewContext(),history:[]});if(!form.isConnected)return;if(typeof result.question!=='string'||!result.question.trim())throw Error('The server returned an empty question.');teamOpening=result.question;start(e);}
   catch(err){if(form.isConnected)error.textContent=err.message;}
   finally{if(form.isConnected){button.disabled=false;button.innerHTML=label;}}
  };
 }
 if(view==='room'){
  const form=$('#answerForm');let submitting=false;
  form.onsubmit=async e=>{
   e.preventDefault();if(submitting)return;submitting=true;form.dataset.transcribing='true';
   const failed=liveTranscript;
   try{
    if(recording?.state==='recording')recording.stop();await stopTranscript(false);
    if(!form.isConnected)return;
    if(failed?.failed)throw Error('Transcription was incomplete. Please record your answer again.');
    const spoken=$('#answer').value.trim();if(!spoken)throw Error('No speech transcribed yet. Please record your answer.');
    moonStopVoice();moonSet('thinking');
    const feedback=await teamRequest('interview/feedback',{question,transcript:spoken,interview:interviewContext(),durationSec:answerSeconds||undefined});
    if(!form.isConnected)return;
    if(['strength','improvement','retry_challenge'].some(k=>typeof feedback[k]!=='string'||!feedback[k].trim()))throw Error('The server returned incomplete feedback. Please try again.');
    cleanup();turns.push({q:question,a:spoken,feedback});answer='';answerSeconds=0;
    const last=turns.length>=Number(config.rounds);moonSet('listening');
    showFeedback(feedback,last,()=>{if(last){finish();return;}question=feedback.retry_challenge;render();});
   }catch(err){if(form.isConnected){$('#answerError').textContent=err.message;moonSet('listening');}}
   finally{if(form.isConnected){submitting=false;form.dataset.transcribing='false';}}
  };
 }
};
render();
