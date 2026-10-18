/* The workspace surrounds the interview; the immersive room keeps its own layout. */
const workspaceBase={home,nav,setup,coach,history,summary,bind};
let workspaceHelloAt=0;
let workspaceHover=0,workspaceHoverTarget=0,workspaceConfirmAt=-10000;
window.addEventListener('cadence:welcome',event=>{
 workspaceHoverTarget=event.detail==='hover'?1:0;
 if(event.detail==='confirm')workspaceConfirmAt=performance.now();
});
function workspaceWelcomePose(t,dt){
 const active=document.body.classList.contains('moon-landing')&&!reducedMotion.matches;
 workspaceHover+=((active?workspaceHoverTarget:0)-workspaceHover)*(1-Math.exp(-dt*5));
 if(!active)return {tilt:0,lift:0,nod:0};
 const elapsed=(t-workspaceHelloAt)/1000;
 return {tilt:workspaceHover*.035,lift:Math.sin(Math.PI*Math.max(0,Math.min(1,elapsed/1.4)))*2,
  nod:Math.sin(Math.PI*Math.max(0,Math.min(1,(t-workspaceConfirmAt)/420)))*4};
}
const greetingLine=document.createElementNS('http://www.w3.org/2000/svg','path');
greetingLine.setAttribute('d','M 703 413 C 724 427 738 443 751 441 C 772 438 782 403 785 376 C 787 360 779 348 772 337 C 765 327 753 316 758 310 C 765 300 777 318 785 326 C 788 329 789 327 788 323 C 783 307 772 281 777 274 C 780 268 786 269 789 276 C 793 286 796 303 799 313 C 800 317 802 316 801 312 C 800 297 791 267 796 260 C 799 254 805 257 807 263 C 811 276 810 295 812 309 C 813 313 815 313 815 309 C 817 295 814 278 819 274 C 824 269 829 274 829 280 C 830 291 825 307 825 317 C 825 321 827 322 829 318 C 833 310 833 300 837 298 C 843 295 846 302 844 309 C 840 323 833 335 830 347 C 827 365 820 374 814 386 C 809 404 805 435 791 454');
const greetingLength=greetingLine.getTotalLength();
const greetingPoints=Array.from({length:640},(_,i)=>greetingLine.getPointAtLength(greetingLength*i/639));
function drawWorkspaceGreeting(c,t,anchor){
 if(!document.body.classList.contains('moon-landing'))return;
 const elapsed=(t-workspaceHelloAt)/1000;
 const phase=Math.max(0,Math.min(1,(elapsed-1.1)/2.8));
 const rest=reducedMotion.matches?0:Math.max(0,Math.min(1,(elapsed-3.9)/1.8));
 const relaxed=rest*rest*(3-2*rest);
 const wave=reducedMotion.matches?0:Math.sin(phase*Math.PI*4)*Math.sin(phase*Math.PI)*.065;
 const pivot={x:800,y:375};
 for(const point of greetingPoints){
  const hand=Math.max(0,Math.min(1,(425-point.y)/70));
  const weight=hand*hand*(3-2*hand),angle=(wave+.13*relaxed)*weight;
  const fingertip=Math.max(0,Math.min(1,(330-point.y)/70));
  const dx=(point.x-pivot.x)*(1-.07*relaxed*fingertip),dy=point.y-pivot.y+4*relaxed*fingertip;
  c.lineTo(anchor.x+pivot.x+dx*Math.cos(angle)-dy*Math.sin(angle)-703,anchor.y+pivot.y+dx*Math.sin(angle)+dy*Math.cos(angle)-413+9*relaxed*weight);
 }
}
function choiceHand(){
 return '<svg class="choice-hand" viewBox="0 0 400 300" fill="none" aria-hidden="true"><path d="M 64 320 C 100 279 113 248 145 226 C 164 213 184 206 199 191 C 211 180 220 163 230 164 C 245 166 233 189 216 204 C 206 213 194 219 185 218 C 173 217 183 208 199 212 C 222 219 248 217 267 206 C 288 194 306 174 321 159 C 331 149 342 142 347 149 C 354 159 330 181 316 193 C 301 207 286 217 273 221 C 290 211 316 191 330 181 C 344 171 353 171 354 180 C 355 190 325 214 311 223 C 300 230 286 236 278 236 C 290 229 313 214 326 210 C 340 205 345 213 335 223 C 322 236 303 246 286 251 C 276 254 268 254 265 252 C 277 245 294 240 306 241 C 318 244 302 257 288 262 C 262 272 235 265 213 278 C 194 290 185 308 173 327" /></svg>';
}
nav=function(){if(theme!=='moon')return workspaceBase.nav();return `<aside class="sidebar"><a href="#" class="brand" data-go="home">${icon('audio-lines')}<span>cadence</span></a><nav aria-label="Main navigation"><button class="nav-item ${view==='home'||view==='setup'?'active':''}" data-go="home">Practice</button><button class="nav-item ${view==='history'||view==='summary'?'active':''}" data-go="history">History</button></nav><span class="workspace-edition">A little more you.</span></aside>`;};
home=function(){if(theme!=='moon')return workspaceBase.home();return `<section class="workspace-intro"><div class="workspace-title"><span class="eyebrow">Your practice space</span><h1>Cadence</h1><p>Find the words.<br>Keep your voice.</p></div>${moonStage()}<span class="workspace-presence">${icon('audio-lines')}Here with you</span></section><section class="workspace-modes" aria-label="Practice modes"><button data-go="setup" class="workspace-mode"><span class="mode-number">01 / CONVERSATION</span><div><h2>Interview</h2>${icon('arrow-up-right')}</div><p>A new opportunity. A little rehearsal.</p></button><button data-go="speaking" class="workspace-mode"><span class="mode-number">02 / EXPRESSION <span>Coming soon</span></span><div><h2>Public speaking</h2>${icon('mic-vocal')}</div><p>A stage for your next idea.</p></button></section><section class="workspace-recent"><div class="section-heading"><h2>Recent conversations</h2><button class="text-button" data-go="history">All sessions ${icon('arrow-right')}</button></div>${sessions.length?sessions.slice(0,2).map(historyRow).join(''):'<div class="workspace-empty">A fresh start.<span>Your completed conversations will appear here.</span></div>'}</section><div class="moon-preview-controls" hidden><div role="group"></div></div>`;};
coach=function(){if(theme!=='moon')return workspaceBase.coach();return `<aside class="moon-coach">${moonStage(true)}<div class="workspace-voice"></div></aside>`;};
setup=function(){if(theme!=='moon')return workspaceBase.setup();return `
 <div class="setup-heading"><button class="icon-button" data-go="home" title="Back to practice" aria-label="Back to practice">${icon('arrow-left')}</button><h1>Interview</h1></div>
 <div class="setup-layout"><form id="setupForm">
 <fieldset class="setup-topic"><legend>Topic</legend><div class="topic-grid">${topicOptions.map(([t,d,i])=>`<button type="button" class="topic ${config.topic===t&&!config.custom?'selected':''}" data-topic="${t}" aria-pressed="${config.topic===t&&!config.custom}">${icon(i)}<span>${t}</span>${icon('check')}</button>`).join('')}</div>
 <input id="custom" aria-label="Custom topic" maxlength="160" placeholder="Or add your own..." value="${esc(config.custom)}"></fieldset>
 <fieldset class="setup-focus"><legend>Focus</legend><div class="focus-options">${focusOptions.map(f=>`<label class="focus-option"><input type="checkbox" name="focus" value="${f}" ${config.focus.includes(f)?'checked':''}>${f}</label>`).join('')}</div></fieldset>
 <details class="setup-details"><summary>${icon('sliders-horizontal')}Personalize ${icon('chevron-down')}</summary><div class="setup-details-body">
 <label class="field-label" for="extra">Other focus</label><input id="extra" maxlength="200" placeholder="What else matters?" value="${esc(config.extra)}">
 <label class="field-label" for="context">Background</label><textarea id="context" maxlength="3000" placeholder="Your experience or the role you're pursuing">${esc(config.context)}</textarea>
 <div class="inline-fields"><div><label class="field-label" for="rounds">Questions</label><select id="rounds">${['4','6','8'].map(v=>`<option value="${v}" ${config.rounds===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label class="field-label" for="tone">Style</label><select id="tone">${['Supportive','Direct'].map(v=>`<option ${config.tone===v?'selected':''}>${v}</option>`).join('')}</select></div></div></div></details>
 <div class="setup-footer"><span class="small-label">Practice preview</span><button class="main-button" type="submit">Begin ${icon('arrow-right')}</button></div>
 </form>${coach()}</div>`;};
history=function(){if(theme!=='moon')return workspaceBase.history();return `${head('Your conversations.',`${sessions.length} saved ${sessions.length===1?'session':'sessions'} · Stored in this browser`)}<div class="workspace-history">${sessions.length?sessions.map(historyRow).join(''):`<div class="workspace-history-empty">${icon('audio-lines')}<h2>Room for your first conversation.</h2><button class="text-button" data-go="setup">Start an interview ${icon('arrow-right')}</button></div>`}</div><details class="workspace-example"><summary>View an example session</summary>${historyRow(sample)}</details>`;};
summary=function(){if(theme!=='moon')return workspaceBase.summary();const s=selectedSession||sample;return `<button class="back" data-go="history">${icon('arrow-left')}History</button>${head(esc(s.topic),`${esc(s.date)} · ${s.turns.length} answers${s.id==='example'?' · Example session':''}`,`<button class="main-button" id="practiceAgain">${icon('rotate-cw')}Practice again</button>`)}<div class="summary-layout"><section><div class="section-heading"><h2>The conversation</h2><span class="small-label">${s.turns.length} exchanges</span></div>${s.turns.map((t,i)=>`<article class="workspace-exchange"><span class="exchange-number">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(t.q)}</h3><p>${esc(t.a)}</p></div></article>`).join('')}</section><aside class="context-panel"><h3>Practice focus</h3><div class="tag-list">${s.focus.map(f=>`<span>${esc(f)}</span>`).join('')}</div><h3>For your next take</h3><p>Choose one answer. Make your own action and its outcome clear.</p><span class="small-label">General practice tip, not an assessment.</span><div class="conversation"><h3>Your context</h3><p>${esc(s.context||'No background added.')}</p></div></aside></div>`;};
function refreshWorkspaceVoice(){
 const select=document.querySelector('#browserVoice');if(!select)return;
 browserVoice.populate(select);
 const name=document.querySelector('.workspace-voice h2');if(name)name.textContent=browserVoice.current()?.name||'No voice available';
 document.querySelector('#previewVoice').disabled=select.disabled;
}
window.speechSynthesis?.addEventListener('voiceschanged',refreshWorkspaceVoice);
window.addEventListener('browser-voice-change',refreshWorkspaceVoice);
bind=function(){
 browserVoice.stop();workspaceBase.bind();if(theme!=='moon'||view==='room')return;
 document.body.classList.add('moon-workspace');document.querySelector('.moon-expression')?.remove();
 if(view==='home'){
  moonSet('listening');document.body.classList.add('moon-landing');workspaceHelloAt=performance.now();moonNod(workspaceHelloAt+550);
  const modes=document.querySelector('.workspace-modes'),recent=document.querySelector('.workspace-recent'),intro=document.querySelector('.workspace-intro');
  modes.hidden=true;recent.hidden=true;
  document.querySelector('.workspace-title .eyebrow')?.remove();
  const copy=document.querySelector('.workspace-title p');copy.className='landing-description';copy.innerHTML='<strong>Your personal speaking coach.</strong><span>A little practice for your next big conversation.</span>';
  document.querySelector('.workspace-presence')?.remove();
  const explore=document.createElement('button');explore.className='main-button explore-button';explore.innerHTML='Explore '+icon('arrow-right');
  document.querySelector('.workspace-title').append(explore);
  explore.onclick=()=>{
   document.body.classList.remove('moon-landing');document.body.classList.add('moon-exploring');modes.hidden=false;
   document.querySelector('.workspace-title').hidden=true;
   modes.querySelectorAll('button').forEach(button=>{button.querySelector('.mode-number')?.remove();button.querySelector('p')?.remove();button.insertAdjacentHTML('beforeend',choiceHand());});
   const soon=document.createElement('small');soon.className='choice-soon';soon.textContent='Coming soon';modes.querySelectorAll('button')[1].append(soon);
   modes.querySelector('button').focus();
  };lucide.createIcons();
 }
 if(view==='setup'){
  moonSet('listening');
  const edit=document.createElement('button');edit.className='icon-button edit-interviewer';edit.type='button';edit.title='Draw on interviewer';edit.setAttribute('aria-label',edit.title);edit.innerHTML=icon('pencil');edit.onclick=openInkEditor;document.querySelector('.moon-coach').prepend(edit);
  const collection=document.createElement('button');collection.className='icon-button collection-interviewer';collection.type='button';collection.title='Saved interviewers';collection.setAttribute('aria-label',collection.title);collection.innerHTML=icon('bookmark');collection.onclick=()=>{browserVoice.stop();previewState(false);openInterviewerCollection();};document.querySelector('.moon-coach').prepend(collection);
  const field=document.createElement('div');field.className='browser-voice-field';
  field.innerHTML='<div class="browser-voice-picker"><select id="browserVoice" aria-label="Interviewer voice"></select><button type="button" id="previewVoice" class="icon-button" title="Preview voice" aria-label="Preview voice">'+icon('volume-2')+'</button></div><p id="voicePreviewStatus" class="field-note" role="status"></p>';
  document.body.classList.add('moon-setup');const nameLabel=document.createElement('div');nameLabel.className='interviewer-name';document.querySelector('.workspace-voice').append(nameLabel,field);refreshInterviewerName();refreshWorkspaceVoice();
  const preview=document.querySelector('#previewVoice'),status=document.querySelector('#voicePreviewStatus');let playing=false;
  function previewState(active){playing=active;preview.innerHTML=icon(active?'square':'volume-2');preview.title=active?'Stop preview':'Preview voice';preview.setAttribute('aria-label',preview.title);moonSet(active?'speaking':'listening');lucide.createIcons();}
  document.querySelector('#browserVoice').onchange=e=>{browserVoice.stop();previewState(false);browserVoice.select(e.target.value);status.textContent='';};
  preview.onclick=()=>{
   if(playing){browserVoice.stop();previewState(false);return;}
   status.textContent='';previewState(true);
   browserVoice.speak({text:'Tell me about a project you are proud of. Take your time.',onend:()=>previewState(false),onerror:()=>{previewState(false);status.textContent='Could not play. Try another voice.';}});
  };lucide.createIcons();
 }
};
render();
