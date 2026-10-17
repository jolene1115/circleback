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
  const consent=document.createElement('label');consent.className='team-consent';consent.innerHTML='<input type="checkbox" required> <span>Use Gemini to process my audio and answers.</span>';button.parentElement.before(consent);
  const error=document.createElement('p');error.className='error';error.setAttribute('role','alert');form.append(error);
  form.onsubmit=async e=>{e.preventDefault();if(button.disabled||!form.reportValidity())return;saveConfig();button.disabled=true;error.textContent='';const label=button.innerHTML;button.textContent='Preparing...';
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
    const feedback=await teamRequest('interview/feedback',{question,transcript:spoken,interview:interviewContext()});
    if(!form.isConnected)return;
    if(['strength','improvement','retry_challenge'].some(k=>typeof feedback[k]!=='string'||!feedback[k].trim()))throw Error('The server returned incomplete feedback. Please try again.');
    cleanup();turns.push({q:question,a:spoken,feedback});answer='';
    if(turns.length>=Number(config.rounds)){finish();return;}
    question=feedback.retry_challenge;moonSet('listening');render();
   }catch(err){if(form.isConnected){$('#answerError').textContent=err.message;moonSet('listening');}}
   finally{if(form.isConnected){submitting=false;form.dataset.transcribing='false';}}
  };
 }
};
render();
