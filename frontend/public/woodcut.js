/* The illustrated direction reuses the existing prototype's data and interview flow. */
const originalHome=home,originalRoom=room,originalCoach=coach,originalBind=bind,originalCleanup=cleanup,originalTranscript=transcript;
let fishState='asking',pendingAnswer=null;
let mouthTimer=null,speechGeneration=0,mouthOpen=false,fishSpeaking=false;
function fishImage(){return fishState==='thinking'?'thinking':fishSpeaking&&mouthOpen?'asking':'mouth-closed';}
function paintMouth(){const img=$('.fish-scene:not(.compact-scene) .fish-layer');if(img)img.src=`assets/fish-${fishImage()}.png`;}
function stopFishSpeech(){speechGeneration++;clearInterval(mouthTimer);mouthTimer=null;fishSpeaking=false;mouthOpen=false;paintMouth();}
function speakFish(){
 if(!window.speechSynthesis){toast('Read-aloud is unavailable in this browser.');return;}
 const wasSpeaking=fishSpeaking;stopFishSpeech();speechSynthesis.cancel();
 if(wasSpeaking){setFishState('listening');return;}
 const generation=speechGeneration,u=new SpeechSynthesisUtterance(question);u.lang='en-US';u.rate=.93;
 u.onstart=()=>{if(generation!==speechGeneration||view!=='room'||theme!=='woodcut')return;setFishState('asking');fishSpeaking=true;mouthOpen=true;paintMouth();mouthTimer=setInterval(()=>{mouthOpen=speechSynthesis.paused?false:!mouthOpen;paintMouth();},170);};
 u.onend=u.onerror=()=>{if(generation!==speechGeneration)return;stopFishSpeech();if(view==='room'&&!pendingAnswer)setFishState('listening');};
 speechSynthesis.speak(u);toast('Browser voice preview · Fish Audio is not connected');
}
['asking','listening','thinking'].forEach(s=>{const img=new Image();img.src=`assets/fish-${s}.png`;});
function fishScene(compact=false){return `<div class="fish-scene ${compact?'compact-scene':''}" role="img" aria-label="A hand-printed fish interviewer floating across a desk in a quiet room"><img class="room-layer" src="assets/room.png" alt=""><div class="fish-position"><img class="fish-layer" src="assets/fish-${compact?'listening':fishState}.png" alt=""></div><img class="desk-layer" src="assets/desk.png" alt="">${compact?'':`<span class="scene-state" role="status"><span></span><b id="fishStateText">${stateText()}</b></span><span class="desk-name">FINN / INTERVIEWER</span>`}</div>`;}
function stateText(){return {asking:'Asking a question',listening:'Listening to you',thinking:'Thinking · sample transition'}[fishState];}
function setFishState(s){if(s!=='asking'&&fishSpeaking){stopFishSpeech();window.speechSynthesis?.cancel();}fishState=s;paintMouth();if($('#fishStateText'))$('#fishStateText').textContent=stateText();const el=$('.fish-scene:not(.compact-scene)');if(el)el.dataset.state=s;}
home=function(){if(theme!=='woodcut')return originalHome();return `${head('A little practice. A real conversation.','Choose where you want to begin.')}<div class="ink-entry"><button class="ink-interview" data-go="setup">${fishScene(true)}<span class="entry-caption"><span><strong>Interview</strong><small>Take a seat. Meet your interviewer.</small></span>${icon('arrow-up-right')}</span></button><button class="ink-speaking" data-go="speaking">${icon('mic-vocal')}<h2>Public speaking</h2><p>Your ideas deserve<br>to be heard.</p><span class="small-label">Coming next</span></button></div><div class="section-heading"><h2>Your practice journal</h2><button class="text-button" data-go="history">View all ${icon('arrow-right')}</button></div>${[...sessions.slice(0,3),sample].map(historyRow).join('')}`;};
coach=function(){if(theme!=='woodcut')return originalCoach();return `<aside class="ink-coach"><h3>Your interviewer</h3>${fishScene(true)}<div class="coach-intro"><h2>Meet Finn.</h2><span class="ink-stamp">A good listener</span></div><p>A thoughtful question.<br>A moment to think.<br>Room to be yourself.</p><div class="interviewer-options" aria-label="Interviewer"><button type="button" class="selected" aria-pressed="true">${icon('fish')}Fish</button><button type="button" disabled title="Woman character artwork is not ready">${icon('user-round')}Woman<small>Coming next</small></button><button type="button" disabled title="Man character artwork is not ready">${icon('user-round')}Man<small>Coming next</small></button></div><p class="field-note">Interviewer tone is selected separately.</p></aside>`;};
room=function(){if(theme!=='woodcut')return originalRoom();const html=originalRoom();return html.replace('<div class="question-stage">',`${fishScene()}<div class="question-stage">`).replace('<img src="assets/coach.jpg" alt="">Alex','<span class="finn-avatar">'+icon('fish')+'</span>Finn');};
transcript=function(list){const html=originalTranscript(list);return theme==='woodcut'?html.replaceAll('<small>Alex</small>','<small>Finn</small>'):html;};
cleanup=function(){stopFishSpeech();if(pendingAnswer){clearTimeout(pendingAnswer);pendingAnswer=null;fishState='listening';}originalCleanup();};
bind=function(){originalBind();if(theme!=='woodcut')return;
 if(view==='summary'){document.querySelectorAll('.feedback-item h3').forEach((h,i)=>{const stamp=document.createElement('span');stamp.className='feedback-stamp';stamp.textContent=['Keep','Try next','Revisit'][i];h.prepend(stamp);});}
 if(view==='setup'){const start=$('#setupForm').onsubmit;$('#setupForm').onsubmit=e=>{fishState='asking';start(e);};}
 if(view!=='room')return;
 setFishState(fishState);
 const onInput=$('#answer').oninput;$('#answer').oninput=e=>{onInput(e);setFishState('listening');};$('#answer').onfocus=()=>{if(!pendingAnswer)setFishState('listening');};
 const sampleClick=$('#sampleAnswer').onclick;$('#sampleAnswer').onclick=()=>{sampleClick();setFishState('listening');};
 const micClick=$('#mic').onclick;$('#mic').onclick=()=>{setFishState('listening');return micClick();};
 $('#listen').onclick=speakFish;
 const submit=$('#answerForm').onsubmit;$('#answerForm').onsubmit=e=>{e.preventDefault();if(pendingAnswer)return;if(!$('#answer').value.trim()){submit(e);return;}originalCleanup();setFishState('thinking');$('#answer').readOnly=true;$('#answerForm').setAttribute('aria-busy','true');['#finish','#sampleAnswer','#mic','#listen','#answerForm button[type=submit]'].forEach(s=>$(s).disabled=true);
  // A short, explicitly labeled transition demonstrates the future model-wait state.
  pendingAnswer=setTimeout(()=>{pendingAnswer=null;fishState='asking';submit(e);},1000);
 };
};
render();
