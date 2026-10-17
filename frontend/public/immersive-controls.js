let immersiveObserver=null;
let reviewRecordings=[],reviewTurns=null;
const observedRecorders=new WeakSet();
const immersiveBind=bind;
bind=function(){
 immersiveObserver?.disconnect();immersiveBind();
 if(theme==='moon'&&view==='setup'){
  const start=$('#setupForm').onsubmit;
  $('#setupForm').onsubmit=e=>{reviewRecordings.forEach(r=>URL.revokeObjectURL(r.url));reviewRecordings=[];start(e);reviewTurns=turns;};
 }
 if(theme==='moon'&&view==='summary'&&reviewRecordings.length&&selectedSession?.turns.length&&selectedSession.turns.every((turn,i)=>turn===reviewTurns?.[i])){
  const section=document.createElement('section');section.className='moon-review-audio';
  const title=document.createElement('h3');title.textContent='Listen back';section.append(title);
  const note=document.createElement('p');note.className='field-note';note.textContent='Recordings are available until you reload or start a new session.';section.append(note);
  reviewRecordings.forEach(record=>{const label=document.createElement('p');label.textContent=record.question;const audio=document.createElement('audio');audio.controls=true;audio.src=record.url;section.append(label,audio);});
  $('.summary-layout>section').append(section);
 }
 if(theme!=='moon'||view!=='room'||!moonImmersive)return;
 const dialogue=document.createElement('div');dialogue.className='moon-dialogue';
 const questionStage=$('.question-stage');questionStage.before(dialogue);dialogue.append(questionStage,$('#answerForm'));
 const toolbar=$('.moon-session-controls'),menu=document.createElement('details');
 menu.className='moon-menu';
 menu.innerHTML=`<summary title="Interview options" aria-label="Interview options">${icon('ellipsis')}</summary><div class="moon-menu-items"></div>`;
 const items=menu.querySelector('.moon-menu-items');
 const mute=$('#moonMute'),replay=$('#listen'),finishButton=$('#finish');
 function labelButton(button,text){button.innerHTML=text;button.title=text;button.setAttribute('aria-label',text);}
 labelButton(replay,'Replay question');labelButton(finishButton,'Finish session');
 const autoLabel=$('#moonAutoRecord').parentElement;
 items.append(mute,replay,autoLabel,finishButton);toolbar.prepend(menu);
 const primary=$('#answerForm button[type=submit]');
 const status=$('#micStatus');status.setAttribute('role','status');
 function update(){
  const busy=!!moonWait||$('#answerForm').dataset.transcribing==='true';
  const isRecording=recording?.state==='recording';
  if(isRecording&&!observedRecorders.has(recording)){
   const recorder=recording,chunks=[],spokenQuestion=question,sessionRecordings=reviewRecordings;
   observedRecorders.add(recorder);
   recorder.addEventListener('dataavailable',event=>{if(event.data.size)chunks.push(event.data);});
   recorder.addEventListener('stop',()=>{if(chunks.length&&sessionRecordings===reviewRecordings)reviewRecordings.push({question:spokenQuestion,url:URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}))});},{once:true});
  }
  const speaking=moonState==='speaking'||!!moonUtterance;
  const label=busy?'Processing answer':isRecording?'Stop recording':speaking?'Interviewer speaking':startingMic?'Starting microphone':$('#answer').value.trim()?'Send answer':'Start recording';
  const symbol=busy?'loader-circle':isRecording?'square':speaking?'volume-2':$('#answer').value.trim()?'arrow-up':'mic';
  if(primary.dataset.symbol!==symbol){primary.dataset.symbol=symbol;primary.innerHTML=icon(symbol);lucide.createIcons();}
  primary.title=label;primary.setAttribute('aria-label',label);
  primary.disabled=busy||speaking||startingMic;
  primary.classList.toggle('is-recording',isRecording);
  const caption=$('#liveAnswer'),spoken=$('#answer').value.trim();
  const placeholder=busy?'Processing...':speaking?'':startingMic?'Starting microphone...':isRecording?"I'm listening. Go ahead...":'Ready when you are.';
  const text=spoken||placeholder;
  if(caption.textContent!==text)caption.textContent=text;
  caption.classList.toggle('is-placeholder',!spoken);
  labelButton(mute,moonAuto?'Mute questions':'Enable question audio');
 }
 primary.onclick=e=>{
  if(recording?.state!=='recording'&&!$('#answer').value.trim()){
   e.preventDefault();$('#mic').click();
  }
 };
 immersiveObserver=new MutationObserver(update);
 immersiveObserver.observe(status,{childList:true,characterData:true,subtree:true});
 immersiveObserver.observe($('#moonStatus'),{childList:true});
 immersiveObserver.observe($('#liveAnswer'),{childList:true});
 immersiveObserver.observe($('#answerForm'),{attributes:true,attributeFilter:['data-transcribing']});
 const oldMute=mute.onclick;mute.onclick=()=>{oldMute();update();};
 items.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false;});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});
 update();lucide.createIcons();
};
render();
