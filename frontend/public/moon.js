/* One sampled continuous curve morphs between an original figure and a waveform. */
const moonBase={home,coach,room,bind,cleanup,render};
let moonState='listening',moonAnimation=0,moonWait=null,moonSpeech=0,moonProgress=0,moonCanvas=null,moonLast=0;
let moonAuto=true,moonAutoTimer=null,moonStartGuard=null,moonReadKey=null,moonUtterance=null,moonStateAt=0,moonHoldUntil=0;
let moonAutoRecord=true,moonRecordTimer=null,moonImmersive=false;
let moonCaptionGuard=null;
function moonCaptionThrough(index){if(Number.isFinite(index))moonWordPulse=1;let current=null;document.querySelectorAll('.moon-word').forEach(word=>{const spoken=Number(word.dataset.start)<=index;word.classList.toggle('is-spoken',spoken);if(spoken)current=word;});if(Number.isFinite(index))moonFollowWord(current);}
// Keep the word being spoken centered in the question box when the question is longer than the box.
function moonFollowWord(word){const box=word?.parentElement;if(!box||box.scrollHeight<=box.clientHeight+1)return;const b=box.getBoundingClientRect(),w=word.getBoundingClientRect();box.scrollTo({top:Math.max(0,box.scrollTop+(w.top-b.top)-(box.clientHeight-w.height)/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
let moonMicSource=null,moonMicRequest=null,moonMicEpoch=0;
const moonAcquireBase=acquireRecordingStream;
function moonCloseMic(){moonMicEpoch++;moonMicSource?.getTracks().forEach(track=>track.stop());moonMicSource=null;moonMicRequest=null;}
acquireRecordingStream=async function(){
 if(theme!=='moon')return moonAcquireBase();
 const epoch=moonMicEpoch;
 if(!moonMicSource?.getAudioTracks().some(track=>track.readyState==='live')){
  if(!moonMicRequest)moonMicRequest=moonAcquireBase();
  const pending=moonMicRequest;
  let source;try{source=await pending;}finally{if(moonMicRequest===pending)moonMicRequest=null;}
  if(epoch!==moonMicEpoch||view!=='room'||theme!=='moon'){source.getTracks().forEach(track=>track.stop());throw new DOMException('Interview ended','AbortError');}
  moonMicSource=source;
  // Keep permission alive between rounds without sending live samples to a recorder.
  moonMicSource.getTracks().forEach(track=>{track.enabled=false;});
 }
 const copy=moonMicSource.clone();copy.getTracks().forEach(track=>{track.enabled=true;});return copy;
};
window.addEventListener('pagehide',moonCloseMic);
let moonNextBlink=performance.now()+2600,moonBlinkAt=-10000,moonAttentionAt=-10000;
let moonThought=0,moonGaze=0,moonGazeTarget=0,moonLean=0,moonReturnAt=-10000;
let moonVoiceSince=0,moonQuietSince=0,moonLastAck=-10000,moonPhraseReady=false;
let moonEyeThought=0,moonHeadGaze=0,moonNodStrength=.7,moonNodDuration=1000,moonAckGap=4500;
let moonExpression='auto',moonPreviewExpression='neutral',moonPreviewExpressionAt=0,moonCurious=0,moonUnsure=0,moonWarmSmile=0;
let moonGazeY=0,moonGazeYTarget=0,moonHeadGazeY=0,moonPointerAt=-10000,moonDoubleBlinkAt=-10000;
let moonGesture='none',moonGestureAt=-10000,moonNextGesture=performance.now()+6000,moonGestureSide=1,moonLastGesture='none',moonLastStretch=-30000;
function moonGesturePose(t){
 const quiet=['listening','responding'].includes(moonState)&&!reducedMotion.matches;
 if(!quiet){moonGesture='none';moonNextGesture=t+5000;return {tilt:0,look:0,brow:0,smile:0,stretch:0};}
 if(t>=moonNextGesture&&t-moonAttentionAt>1800){
  const choices=['tilt','look','brow','smile',...(t-moonLastStretch>22000?['stretch']:[])].filter(value=>value!==moonLastGesture);
  moonGesture=choices[Math.floor(Math.random()*choices.length)];moonLastGesture=moonGesture;moonGestureAt=t;moonGestureSide=Math.random()<.5?-1:1;
  if(moonGesture==='stretch')moonLastStretch=t;
  moonNextGesture=t+7500+Math.random()*5000;
 }
 const phase=Math.max(0,Math.min(1,(t-moonGestureAt)/2500));
 const amount=Math.sin(phase*Math.PI)**2;
 return {tilt:moonGesture==='tilt'?amount*moonGestureSide:0,look:moonGesture==='look'&&t-moonPointerAt>2000?amount*moonGestureSide:0,brow:moonGesture==='brow'?amount*moonGestureSide:0,smile:moonGesture==='smile'?amount:0,stretch:moonGesture==='stretch'?amount:0};
}
function moonNod(t){moonAttentionAt=t;moonNodStrength=.5+Math.random()*.5;moonNodDuration=850+Math.random()*450;moonAckGap=4500+Math.random()*2500;}
function moonReactToVoice(t,level){
 if(level>.09){if(!moonVoiceSince)moonVoiceSince=t;moonQuietSince=0;if(t-moonVoiceSince>650)moonPhraseReady=true;}
 else {moonVoiceSince=0;if(!moonQuietSince)moonQuietSince=t;
  if(moonPhraseReady&&t-moonQuietSince>350&&t-moonLastAck>moonAckGap){moonNod(t);moonLastAck=t;moonPhraseReady=false;}
 }
}
let moonAudio=null,moonAnalyser=null,moonSamples=null,moonLevel=0,moonWarm=0,moonLight=0,moonWordPulse=0,moonPresence=1;
const curtain=document.createElement('canvas');curtain.width=140;curtain.height=70;
const curtainCtx=curtain.getContext('2d'),curtainPixels=curtainCtx.createImageData(140,70);let curtainTime=-100;
function moonReleaseAudio(){moonAnalyser=null;moonSamples=null;if(moonAudio){moonAudio.close().catch(()=>{});moonAudio=null;}moonLevel=0;}
function moonBackground(c,t,dt){
 if(view==='setup')return;
 const quiet=view==='room',light=quiet?0:moonLight;
 if(moonAnalyser&&recording?.state==='recording'){moonAnalyser.getFloatTimeDomainData(moonSamples);let sum=0;for(const v of moonSamples)sum+=v*v;moonLevel+=(Math.min(1,Math.sqrt(sum/moonSamples.length)*9)-moonLevel)*.18;}else moonLevel*=.9;
 const responding=moonState==='responding',target=responding?(view==='home'?.65:Math.min(.9,.32+moonLevel)):0;moonWarm+=(target-moonWarm)*(1-Math.exp(-dt*2));
 moonWordPulse*=Math.exp(-dt*3);moonLight+=((moonState==='speaking'?.5+moonWordPulse*.5:0)-moonLight)*(1-Math.exp(-dt*2));
 if(t-curtainTime>.06){curtainTime=t;const pixels=curtainPixels.data;
 for(let y=0;y<70;y++)for(let x=0;x<140;x++){const u=x/139,v=y/69;
  const edge=Math.pow(Math.abs(u-.5)*2,1.8);
  const sweep=.5+.5*Math.sin(quiet?u*3.2+v*4.1-t*.14:u*4.2+v*3.1-t*.32);
  const fold=.5+.5*Math.sin(quiet?v*4-u*2+t*.11:v*5-u*3+t*.24);
  const blue=quiet?edge*(.24+.5*sweep)+.08*fold:edge*(.2+.5*sweep)+.17*fold+light*.22*sweep;
  const warm=moonWarm*(quiet?Math.pow(1-u,1.6)*(.3+.65*fold):(.3+.7*Math.sin(u*2+v*3-t*.35)**2)*(.3+.65*fold));
  const grain=(Math.sin(x*127.1+y*311.7)*43758.5453)%1;const i=(y*140+x)*4;
  pixels[i]=14+blue*13+warm*150+light*18*fold+grain*1.5;pixels[i+1]=18+blue*45+warm*82+light*22*fold+grain*1.5;pixels[i+2]=25+blue*91+warm*25+grain*1.5;pixels[i+3]=255;
 }curtainCtx.putImageData(curtainPixels,0,0);}
 c.imageSmoothingEnabled=true;c.drawImage(curtain,0,0,1000,500);
}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const figurePath=document.createElementNS('http://www.w3.org/2000/svg','path');
figurePath.setAttribute('d','M 225 425 C 270 389 325 382 368 373 C 392 368 400 353 391 335 C 357 323 337 296 333 262 C 329 228 327 201 343 171 C 362 131 405 104 453 110 C 509 116 539 146 537 190 C 537 211 529 220 514 221 C 492 224 475 209 451 209 C 427 208 410 224 390 224 C 376 224 368 215 375 206 C 382 195 402 200 405 212 C 408 226 393 233 380 224 C 402 240 426 224 449 222 C 468 222 480 224 488 213 C 499 196 521 200 519 214 C 517 228 497 229 488 218 C 477 233 481 248 486 262 C 492 278 474 282 461 276 C 453 272 462 262 467 270 C 474 284 470 297 455 301 C 442 305 427 300 420 306 C 430 320 456 321 473 311 C 493 301 510 281 518 261 C 521 290 509 321 488 337 C 477 345 477 362 491 370 C 533 386 589 386 638 425');
const curveLength=figurePath.getTotalLength(),figure=Array.from({length:520},(_,i)=>{const p=figurePath.getPointAtLength(i*curveLength/519);return{x:p.x+65,y:p.y-12};});
function moonStage(compact=false){return `<div class="moon-stage ${compact?'moon-small':''}"><canvas class="moon-canvas" width="1000" height="500" aria-label="Original continuous-line interviewer, morphing into a waveform when speaking"></canvas><div class="moon-caption"><span class="moon-dot"></span><span id="moonStatus" role="status">${moonStateLabel()}</span></div></div>`;}
function moonStateLabel(){return {listening:'Here with you',responding:view==='home'?'Your turn · motion preview':'Listening to your voice',speaking:'Speaking',thinking:'Thinking · sample transition'}[moonState];}
function moonSet(s){if(s!==moonState){moonStateAt=performance.now();if(s==='listening'&&moonState==='speaking')moonReturnAt=moonStateAt+700;if(s==='responding'){moonAttentionAt=moonStateAt;moonLastAck=moonStateAt;}moonVoiceSince=moonQuietSince=0;moonPhraseReady=false;}moonState=s;if($('#moonStatus'))$('#moonStatus').textContent=moonStateLabel();document.querySelectorAll('[data-moon-state]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.moonState===s));}
function moonStopVoice(){browserVoice.stop();clearTimeout(moonCaptionGuard);moonCaptionThrough(Infinity);clearTimeout(moonRecordTimer);moonRecordTimer=null;clearTimeout(moonAutoTimer);clearTimeout(moonStartGuard);moonAutoTimer=moonStartGuard=null;moonSpeech++;moonUtterance=null;moonHoldUntil=0;moonSet('listening');}
function moonSpeak(){
 if(recording?.state==='recording'){microphone();moonReleaseAudio();}
 if(moonState==='speaking'||moonUtterance){moonStopVoice();return;}moonStopVoice();const id=moonSpeech,u={text:question};moonUtterance=u;moonSet('thinking');
 u.onstart=()=>{if(id===moonSpeech&&theme==='moon'&&view==='room'){clearTimeout(moonStartGuard);moonSet('speaking');moonCaptionThrough(0);moonCaptionGuard=setTimeout(()=>moonCaptionThrough(Infinity),1800);}};
 u.onboundary=e=>{if(id!==moonSpeech||theme!=='moon'||view!=='room'||e.name!=='word')return;clearTimeout(moonCaptionGuard);moonCaptionThrough(e.charIndex);};
 u.onend=()=>{if(id!==moonSpeech)return;clearTimeout(moonCaptionGuard);moonCaptionThrough(Infinity);clearTimeout(moonStartGuard);moonUtterance=null;moonHoldUntil=performance.now()+200;moonSet('listening');if(moonAutoRecord)moonRecordTimer=setTimeout(()=>{moonRecordTimer=null;if(id===moonSpeech&&theme==='moon'&&view==='room'&&!document.hidden&&!moonWait&&recording?.state!=='recording')$('#mic')?.click();},450);};
 u.onerror=e=>{if(id!==moonSpeech)return;clearTimeout(moonCaptionGuard);moonCaptionThrough(Infinity);clearTimeout(moonStartGuard);moonUtterance=null;moonHoldUntil=0;moonSet('listening');if(!['canceled','interrupted'].includes(e.error))toast('Browser audio could not play. Open the menu and replay the question to retry.');};
 moonStartGuard=setTimeout(()=>{if(id===moonSpeech&&moonState!=='speaking'){moonStopVoice();toast('Audio did not start. Replay the question to retry.');}},8000);
 browserVoice.speak(u);
}
function strokeMoonLine(c,color,opacity=1){
 c.save();const matrix=c.getTransform(),scale=Math.hypot(matrix.a,matrix.b);
 c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.shadowColor=color;
 c.shadowBlur=3*scale;c.globalAlpha=.16*opacity;c.lineWidth=2.8;c.stroke();
 c.shadowBlur=0;c.globalAlpha=opacity;c.lineWidth=2.2;c.stroke();c.restore();
}
function moonDraw(t){
 if(!moonCanvas?.isConnected)return;
 const dt=Math.min((t-moonLast)/1000||.016,.05);moonLast=t;
 const goal=(moonState==='speaking'&&t-moonStateAt>130&&moonThought<.16)||t<moonHoldUntil?1:0;moonProgress+=(goal-moonProgress)*(1-Math.exp(-dt*(reducedMotion.matches?18:goal?3.8:2.7)));
 moonEyeThought+=((moonState==='thinking'?1:0)-moonEyeThought)*(1-Math.exp(-dt*9));
 moonThought+=((moonState==='thinking'&&t-moonStateAt>240?1:0)-moonThought)*(1-Math.exp(-dt*(reducedMotion.matches?22:3.5)));
 moonGaze+=(moonGazeTarget-moonGaze)*(1-Math.exp(-dt*9));
 moonHeadGaze+=(moonGaze-moonHeadGaze)*(1-Math.exp(-dt*2));
 moonGazeY+=(moonGazeYTarget-moonGazeY)*(1-Math.exp(-dt*9));moonHeadGazeY+=(moonGazeY-moonHeadGazeY)*(1-Math.exp(-dt*2));
 const gesture=moonGesturePose(t);
 const randomExpression=(view==='home'&&moonExpression==='auto')||(view==='room'&&['listening','responding'].includes(moonState));
 if(randomExpression&&!reducedMotion.matches&&t>=moonPreviewExpressionAt&&t-moonGestureAt>2800){
  const choices=['neutral','curious','unsure','warm'].filter(value=>value!==moonPreviewExpression);
  moonPreviewExpression=choices[Math.floor(Math.random()*choices.length)];moonPreviewExpressionAt=t+4000+Math.random()*2000;
  moonNextGesture=Math.max(moonNextGesture,t+1800);
 }
 const expression=randomExpression?(reducedMotion.matches?'neutral':moonPreviewExpression):view==='home'&&moonExpression!=='auto'?moonExpression:'neutral';
 moonCurious+=((expression==='curious'?1:0)-moonCurious)*(1-Math.exp(-dt*5));
 moonUnsure+=((expression==='unsure'?1:0)-moonUnsure)*(1-Math.exp(-dt*5));
 moonWarmSmile+=((expression==='warm'?1:0)-moonWarmSmile)*(1-Math.exp(-dt*5));
 moonLean+=((moonState==='responding'?1:0)-moonLean)*(1-Math.exp(-dt*2.8));
 if(moonState==='responding')moonReactToVoice(t,view==='home'?((t-moonStateAt)%6500<3800?.2:0):moonLevel);
 const c=moonCanvas.getContext('2d'),w=1000,rect=moonCanvas.getBoundingClientRect(),h=1000*rect.height/rect.width||500;
 const dpr=window.devicePixelRatio||1,pixelWidth=Math.max(1,Math.round(rect.width*dpr)),pixelHeight=Math.max(1,Math.round(rect.height*dpr));
 if(moonCanvas.width!==pixelWidth||moonCanvas.height!==pixelHeight){moonCanvas.width=pixelWidth;moonCanvas.height=pixelHeight;}
 // Keep the drawing coordinates stable while matching the display's physical pixels.
 c.setTransform(pixelWidth/w,0,0,pixelHeight/h,0,0);c.clearRect(0,0,w,h);c.save();c.scale(1,h/500);moonBackground(c,reducedMotion.matches?0:t/1000,dt);c.restore();c.save();const immersive=moonImmersive&&view==='room',short=rect.height<=650,scale=view==='setup'?Math.min(1.2,h/400):Math.min(immersive?1.4:1,h*(immersive?(short?.49:.62):1)/500);c.translate((w-w*scale)/2,immersive?h*(short?.31:.37)-250*scale:(h-500*scale)/2);c.scale(scale,scale);
 if(t>moonNextBlink){moonBlinkAt=t;moonDoubleBlinkAt=Math.random()<.18?t+310:-10000;moonNextBlink=t+2800+Math.random()*3300;}
 const blinkPulse=at=>Math.sin(Math.max(0,Math.min(1,(t-at)/190))*Math.PI);
 const blink=reducedMotion.matches?0:Math.max(blinkPulse(moonBlinkAt),blinkPulse(moonDoubleBlinkAt));
 const attention=reducedMotion.matches?0:Math.sin(Math.min(1,Math.max(0,(t-moonAttentionAt)/moonNodDuration))*Math.PI)*moonNodStrength;
 const returning=reducedMotion.matches?0:Math.sin(Math.min(1,Math.max(0,(t-moonReturnAt)/1200))*Math.PI);
 const time=reducedMotion.matches?0:t/1000,blend=moonProgress*moonProgress*(3-2*moonProgress),thought=moonThought*moonThought*(3-2*moonThought),nod=reducedMotion.matches?0:(moonHeadGaze*.035+attention*.04)*(1-thought);
 const transformPoint=(p,i,total=figure.length,ink=false)=>{const u=i/Math.max(1,total-1),eye=Math.max(Math.exp(-Math.pow((p.x-455)/20,2)-Math.pow((p.y-202)/14,2)),Math.exp(-Math.pow((p.x-570)/20,2)-Math.pow((p.y-202)/14,2)));const head=Math.max(0,Math.min(1,(365-p.y)/90));
 const mouth=Math.exp(-Math.pow((p.x-510)/35,2)-Math.pow((p.y-297)/17,2));
 const rightEye=Math.exp(-Math.pow((p.x-570)/22,2)-Math.pow((p.y-202)/22,2));
 const leftEye=Math.exp(-Math.pow((p.x-455)/22,2)-Math.pow((p.y-202)/22,2));
 const px=p.x-500+(-8*moonEyeThought+(reducedMotion.matches?0:moonGaze*5+gesture.look*5)+attention*3*(1-thought))*eye-(p.x-510)*mouth*.16*thought;
 // Flatten the resting smile locally; expression changes stay on the same curve.
 const py=p.y-350-(p.y-202)*blink*.93*eye-6*moonEyeThought*eye-(p.y-290)*mouth*((ink?0:.72)-.45*moonWarmSmile-.18*gesture.smile)-rightEye*(8*moonCurious+4*moonEyeThought)+rightEye*5*moonUnsure+(reducedMotion.matches?0:moonGazeY*3-Math.abs(gesture.look)*3)*eye-6*Math.abs(gesture.brow)*(gesture.brow>0?rightEye:leftEye);
 // Rotate around the neck; shoulders stay anchored while the face looks upward.
 const tilt=nod+(-.16*thought+.045*moonCurious-.06*moonUnsure+.035*gesture.tilt)*head;
 const lean=reducedMotion.matches?0:moonLean*head;
 const x=500+(px*Math.cos(tilt)-py*Math.sin(tilt))*(1+.045*lean),y=350+px*Math.sin(tilt)+py*Math.cos(tilt)-8*thought*head+(reducedMotion.matches?0:Math.sin(time*.9)*.8+attention*7*head*(1-thought)+lean*7-returning*5*head);
 const envelope=Math.pow(Math.sin(Math.PI*u),1.6),pulse=reducedMotion.matches?.55:(.5+.25*Math.sin(time*2.1)+.18*Math.sin(time*4.3));const wy=250+envelope*(Math.sin(u*Math.PI*12-time*5)*55+Math.sin(u*Math.PI*21+time*2.3)*16)*pulse;
 const gaze=reducedMotion.matches?0:moonHeadGaze*8*head*(1-thought);
 const fx=(x+gaze)*(1-blend)+(120+u*760)*blend;
 const shoulder=Math.max(0,Math.min(1,(p.y-335)/75));
 const fy=(y+(reducedMotion.matches?0:moonHeadGazeY*3*head)-gesture.stretch*(head*4+shoulder*5))*(1-blend)+wy*blend;
 return {x:fx,y:fy};};
 c.beginPath();figure.forEach((p,i)=>{const {x:fx,y:fy}=transformPoint(p,i);i?c.lineTo(fx,fy):c.moveTo(fx,fy);
 if(i===figure.length-1&&view==='home'&&typeof drawWorkspaceGreeting==='function')drawWorkspaceGreeting(c,t,{x:fx,y:fy});
 });moonPresence+=((document.body.classList.contains('moon-exploring')?.07:1)-moonPresence)*(1-Math.exp(-dt*3));
 strokeMoonLine(c,'#e9eef2',moonPresence);
 if((view==='room'||view==='setup')&&typeof paintInk==='function')paintInk(c,interviewerInk,blend,time,(p,i,total)=>transformPoint(p,i,total,true));
 c.restore();moonAnimation=requestAnimationFrame(moonDraw);
}
function moonMount(){cancelAnimationFrame(moonAnimation);moonCanvas=$('.moon-canvas');moonLast=0;moonGazeTarget=moonGazeYTarget=0;if(moonCanvas)moonAnimation=requestAnimationFrame(moonDraw);}
document.addEventListener('pointermove',e=>{
 if(theme!=='moon'||!moonCanvas?.isConnected||e.pointerType==='touch')return;
 const r=moonCanvas.getBoundingClientRect();
 if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){moonGazeTarget=moonGazeYTarget=0;return;}
 moonPointerAt=performance.now();moonGazeTarget=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));moonGazeYTarget=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));
});
document.documentElement.addEventListener('pointerleave',()=>{moonGazeTarget=moonGazeYTarget=0;});
window.addEventListener('blur',()=>{moonGazeTarget=moonGazeYTarget=0;});
home=function(){if(theme!=='moon')return moonBase.home();return `${head('A space to find your words.','A question, a pause, and your next thought.')}<div class="moon-home-layout"><section>${moonStage()}<div class="moon-preview-controls"><span>Motion preview</span><div role="group" aria-label="Interviewer motion"><button data-moon-state="listening" aria-pressed="true">${icon('ear')}Listening</button><button data-moon-state="speaking" aria-pressed="false">${icon('audio-lines')}Speaking</button><button data-moon-state="thinking" aria-pressed="false">${icon('ellipsis')}Thinking</button></div></div></section><section class="moon-choices"><button data-go="setup" class="moon-choice">${icon('messages-square')}<h2>Interview</h2><p>One question at a time.<br>A conversation that follows you.</p><span>Start practicing ${icon('arrow-up-right')}</span></button><button data-go="speaking" class="moon-choice muted-choice">${icon('mic-vocal')}<h2>Public speaking</h2><p>Make room for your ideas.</p><span>Coming next</span></button></section></div><div class="section-heading"><h2>Recent conversations</h2><button class="text-button" data-go="history">View history</button></div>${[...sessions.slice(0,2),sample].map(historyRow).join('')}`;};
coach=function(){if(theme!=='moon')return moonBase.coach();return `<aside class="moon-coach">${moonStage(true)}<h2>A little room to think.</h2><p>Take your time.<br>Your next answer can start anywhere.</p><div class="coach-facts"><div>${icon('messages-square')}One question at a time</div><div>${icon('notebook-pen')}Reflection at the end</div></div></aside>`;};
room=function(){if(theme!=='moon')return moonBase.room();return originalRoom().replace('<div class="question-stage">',`${moonStage()}<div class="question-stage">`).replace('<img src="assets/coach.jpg" alt="">Alex','<span class="moon-speaker-icon">'+icon('audio-lines')+'</span>Alex');};
cleanup=function(){moonReleaseAudio();moonStopVoice();clearTimeout(moonWait);moonWait=null;cancelAnimationFrame(moonAnimation);moonBase.cleanup();};
render=function(){cancelAnimationFrame(moonAnimation);const immersive=theme==='moon'&&view==='room'&&moonImmersive;if(theme!=='moon'||view!=='room'){moonCloseMic();moonImmersive=false;}moonBase.render();document.body.classList.toggle('moon-immersive',immersive);};
bind=function(){moonBase.bind();if(theme!=='moon')return;moonMount();if(view==='home'){const b=document.createElement('button');b.dataset.moonState='responding';b.setAttribute('aria-pressed','false');b.innerHTML=icon('mic')+'Your turn';$('.moon-preview-controls [role=group]').append(b);lucide.createIcons();}document.querySelectorAll('[data-moon-state]').forEach(b=>b.onclick=()=>moonSet(b.dataset.moonState));
 if(view==='home'){
  const label=document.createElement('label');label.className='moon-expression';label.textContent='Expression preview';
  const select=document.createElement('select');select.setAttribute('aria-label','Expression preview');
  [['auto','Auto'],['neutral','Attentive'],['curious','Curious'],['unsure','Unsure'],['warm','Encouraging']].forEach(([value,text])=>{const option=new Option(text,value);select.add(option);});
  select.value=moonExpression;select.onchange=()=>{moonExpression=select.value;moonPreviewExpressionAt=0;moonSet('listening');if(moonExpression==='warm')moonNod(performance.now()+300);};label.append(select);$('.moon-preview-controls').after(label);
 }
 if(view==='setup'){moonExpression='neutral';moonCurious=moonUnsure=moonWarmSmile=0;const start=$('#setupForm').onsubmit;$('#setupForm').onsubmit=e=>{moonReadKey=null;moonSet('listening');moonImmersive=true;start(e);};}
 if(view!=='room')return;
 const controls=document.createElement('div');controls.className='moon-session-controls';
 controls.innerHTML=`<label><input id="moonAutoRecord" type="checkbox" ${moonAutoRecord?'checked':''}> Auto-record after question</label><button type="button" class="secondary-button" id="moonLeave">Exit interview</button>`;
 $('.page-head').append(controls);$('#moonAutoRecord').onchange=e=>{moonAutoRecord=e.target.checked;if(!moonAutoRecord){clearTimeout(moonRecordTimer);moonRecordTimer=null;}};
 $('#moonLeave').onclick=()=>go('home');
 $('#mic').title='Start or stop recording';
 const recordingNote=document.createElement('p');recordingNote.className='field-note';recordingNote.textContent='Recording stays on this device. Transcription is not connected yet; enter your answer as text to continue.';$('#audioPlayback').after(recordingNote);
 if(moonImmersive){
  const caption=$('.question-stage h2');caption.setAttribute('aria-label',question);caption.innerHTML=Array.from(question.matchAll(/\S+/g),match=>`<span aria-hidden="true" class="moon-word${moonAuto?'':' is-spoken'}" data-start="${match.index}">${esc(match[0])} </span>`).join('');
  $('#answer').placeholder='Type your reply...';$('#answer').setAttribute('aria-label','Your reply. Voice transcription is not connected.');
  const send=$('#answerForm button[type=submit]');send.innerHTML=icon('arrow-up');send.title='Send answer';send.setAttribute('aria-label','Send answer');
  $('#moonLeave').innerHTML=icon('x');$('#moonLeave').title='Exit interview';$('#moonLeave').setAttribute('aria-label','Exit interview');
  $('#finish').innerHTML=icon('check');$('#finish').title='Finish session';$('#finish').setAttribute('aria-label','Finish session');
  $('#moonAutoRecord').parentElement.title='Auto-record after question';
 }
 const mute=document.createElement('button');mute.type='button';mute.id='moonMute';mute.className='icon-button';mute.title=moonAuto?'Mute automatic questions':'Enable automatic questions';mute.setAttribute('aria-label',mute.title);mute.setAttribute('aria-pressed',String(!moonAuto));mute.innerHTML=icon(moonAuto?'volume-2':'volume-x');$('#listen').before(mute);mute.onclick=()=>{moonAuto=!moonAuto;moonStopVoice();mute.title=moonAuto?'Mute automatic questions':'Enable automatic questions';mute.setAttribute('aria-label',mute.title);mute.setAttribute('aria-pressed',String(!moonAuto));mute.innerHTML=icon(moonAuto?'volume-2':'volume-x');lucide.createIcons();if(moonAuto)moonSpeak();};$('#listen').title='Replay or stop question';$('#listen').setAttribute('aria-label','Replay or stop question');$('#listen').innerHTML=icon('rotate-ccw');lucide.createIcons();
 if(moonImmersive){controls.prepend(mute,$('#listen'));$('.speaker').hidden=true;}
 const readKey=turns.length+':'+question;if(readKey!==moonReadKey){moonReadKey=readKey;if(moonAuto&&!document.hidden)moonAutoTimer=setTimeout(()=>{moonAutoTimer=null;if(theme==='moon'&&view==='room'&&!moonWait)moonSpeak();},300);}
 const input=$('#answer').oninput;$('#answer').oninput=e=>{input(e);moonStopVoice();};$('#answer').onfocus=()=>{if(!moonWait)moonStopVoice();};const sampleClick=$('#sampleAnswer').onclick;$('#sampleAnswer').onclick=()=>{moonStopVoice();sampleClick();};const mic=$('#mic').onclick;$('#mic').onclick=async()=>{moonStopVoice();moonReleaseAudio();await mic();if(recording?.state==='recording'&&stream&&theme==='moon'&&view==='room'){moonSet('responding');try{moonAudio=new AudioContext();await moonAudio.resume();moonAnalyser=moonAudio.createAnalyser();moonAnalyser.fftSize=1024;moonSamples=new Float32Array(moonAnalyser.fftSize);moonAudio.createMediaStreamSource(stream).connect(moonAnalyser);}catch{moonReleaseAudio();toast('Recording continues; audio-reactive lighting is unavailable.');}}};$('#listen').onclick=moonSpeak;
 const submit=$('#answerForm').onsubmit;$('#answerForm').onsubmit=e=>{e.preventDefault();if(moonWait)return;if(!$('#answer').value.trim()){submit(e);return;}moonStopVoice();originalCleanup();moonSet('thinking');$('#answer').readOnly=true;$('#answerForm').setAttribute('aria-busy','true');['#finish','#sampleAnswer','#mic','#listen','#moonMute','#answerForm button[type=submit]'].forEach(s=>$(s).disabled=true);moonWait=setTimeout(()=>{moonWait=null;moonSet('listening');submit(e);},1800);};
};
const moonButton=document.createElement('button');moonButton.dataset.theme='moon';moonButton.textContent='05 Moonlight';$('.preview [role=group]').prepend(moonButton);moonButton.onclick=()=>{if(view==='setup')saveConfig();if(view==='room')answer=$('#answer').value;cleanup();theme='moon';const url=new URL(location.href);url.searchParams.set('theme','moon');window.history.replaceState(null,'',url);render();};
// Stop preview sound when changing designs or leaving the page, including from the home view.
document.querySelectorAll('.preview button:not([data-theme=moon])').forEach(b=>{const action=b.onclick;b.onclick=()=>{cleanup();action();};});
document.addEventListener('visibilitychange',()=>{if(document.hidden){moonStopVoice();cancelAnimationFrame(moonAnimation);}else if(theme==='moon')moonMount();});
render();
