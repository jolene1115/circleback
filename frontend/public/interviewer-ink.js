let interviewerInk=[];
let interviewerName='';
try{interviewerName=(localStorage.getItem('cadence-interviewer-name')||'').slice(0,40);}catch{}
function refreshInterviewerName(){const label=document.querySelector('.interviewer-name');if(label){label.textContent=interviewerName;label.hidden=!interviewerName;}}
const inkColors=[['Silver','#e9eef2'],['Ice','#8cddff'],['Mint','#9befcb'],['Gold','#ffda8e'],['Coral','#ffa4a4'],['Lilac','#cbb5ff']];
try{const saved=JSON.parse(localStorage.getItem('cadence-interviewer-ink')||'[]');const migrated=Array.isArray(saved)?saved.map(s=>Array.isArray(s)?{color:inkColors[0][1],points:s}:s):[];if(migrated.length<=150&&migrated.every(s=>s&&inkColors.some(c=>c[1]===s.color)&&Array.isArray(s.points)&&s.points.length<=2000&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))))interviewerInk=migrated;}catch{}
function paintInk(c,strokes,blend=0,time=0,transform=null){
 const opacity=Math.max(0,1-blend/.7)**2;
 if(opacity===0)return;
 c.save();c.strokeStyle='#e9eef2';c.lineWidth=2.2;c.lineCap='round';c.lineJoin='round';c.globalAlpha=1;
 for(const stroke of strokes){
  const points=stroke.points;c.beginPath();
  points.forEach(([x,y],i)=>{const u=Math.max(0,Math.min(1,(x-120)/760)),envelope=Math.sin(Math.PI*u)**1.6,pulse=reducedMotion.matches?.55:.5+.25*Math.sin(time*2.1)+.18*Math.sin(time*4.3);const wave=250+envelope*(Math.sin(u*Math.PI*12-time*5)*55+Math.sin(u*Math.PI*21+time*2.3)*16)*pulse;const p=transform?transform({x,y},i,points.length):{x,y:y*(1-blend)+wave*blend};i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);if(points.length===1)c.lineTo(p.x+.1,p.y);});
  const color=[0,1,2].map((v)=>{const original=parseInt(stroke.color.slice(1+v*2,3+v*2),16);return Math.round(original+([233,238,242][v]-original)*Math.min(1,blend/.5));});
  strokeMoonLine(c,'rgb('+color.join(',')+')',opacity);
 }c.restore();
}
function openInkEditor(){
 if(document.querySelector('#inkEditor'))return;
 const dialog=document.createElement('dialog');dialog.id='inkEditor';
 dialog.innerHTML='<form method="dialog" class="ink-header"><h2>Your interviewer</h2><button class="icon-button" aria-label="Close editor" title="Close">'+icon('x')+'</button></form><div class="ink-tools" role="group" aria-label="Drawing tools"><button data-ink-tool="pen" aria-pressed="true" title="Draw" aria-label="Draw">'+icon('pencil')+'</button><button data-ink-tool="erase" aria-pressed="false" title="Erase added strokes" aria-label="Erase added strokes">'+icon('eraser')+'</button><button id="inkUndo" title="Undo" aria-label="Undo">'+icon('undo-2')+'</button><button id="inkReset" title="Reset drawing" aria-label="Reset drawing">'+icon('rotate-ccw')+'</button></div><canvas id="inkCanvas" aria-label="Draw on the interviewer" width="1000" height="500"></canvas><div class="ink-footer"><span id="inkStatus" role="status"></span><button id="inkSave" class="main-button">Save '+icon('check')+'</button></div>';
 const palette=document.createElement('div');palette.className='ink-palette';palette.setAttribute('role','group');palette.setAttribute('aria-label','Ink color');
 for(const [name,value] of inkColors){const button=document.createElement('button');button.type='button';button.dataset.inkColor=value;button.style.setProperty('--ink-color',value);button.title=name;button.setAttribute('aria-label',name);button.setAttribute('aria-pressed',String(value===inkColors[0][1]));palette.append(button);}
 dialog.querySelector('.ink-tools').after(palette);
 const name=document.createElement('input');name.id='interviewerName';name.maxLength=40;name.value=interviewerName;name.placeholder='Name your interviewer';name.setAttribute('aria-label','Interviewer name');name.autocomplete='off';
 dialog.querySelector('h2').replaceWith(name);
 name.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();dialog.querySelector('#inkSave').click();}};
 document.body.append(dialog);lucide.createIcons();
 const canvas=dialog.querySelector('canvas'),c=canvas.getContext('2d'),undo=[],status=dialog.querySelector('#inkStatus');
 let draft=structuredClone(interviewerInk),tool='pen',color=inkColors[0][1],active=null,pointer=null;
 function draw(){const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));c.setTransform(canvas.width/1000,0,0,canvas.height/500,0,0);c.clearRect(0,0,1000,500);c.beginPath();figure.forEach((p,i)=>{const mouth=Math.exp(-Math.pow((p.x-510)/35,2)-Math.pow((p.y-297)/17,2));const y=p.y-(p.y-290)*mouth*.72;i?c.lineTo(p.x,y):c.moveTo(p.x,y);});strokeMoonLine(c,'#e9eef2');paintInk(c,draft);dialog.querySelector('#inkUndo').disabled=!undo.length;}
 function checkpoint(){undo.push(structuredClone(draft));if(undo.length>40)undo.shift();}
 function point(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1000,(e.clientX-r.left)*1000/r.width)),Math.max(0,Math.min(500,(e.clientY-r.top)*500/r.height))];}
 function erase(p){draft=draft.filter(s=>!s.points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<20));}
 canvas.onpointerdown=e=>{if(pointer!==null||e.button!==0)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);checkpoint();if(tool==='pen'){if(draft.length>=150){status.textContent='Drawing limit reached. Erase a stroke to continue.';pointer=null;return;}active=[point(e)];draft.push({color,points:active});}else erase(point(e));draw();};
 canvas.onpointermove=e=>{if(e.pointerId!==pointer)return;const p=point(e);if(tool==='pen'&&active&&active.length<2000){const last=active.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])>1.5)active.push(p);}else if(tool==='erase')erase(p);draw();};
 canvas.onpointerup=canvas.onpointercancel=()=>{pointer=null;active=null;};
 dialog.querySelectorAll('[data-ink-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.inkTool;dialog.querySelectorAll('[data-ink-tool]').forEach(x=>x.setAttribute('aria-pressed',x===b));});
 palette.querySelectorAll('button').forEach(b=>b.onclick=()=>{color=b.dataset.inkColor;palette.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));dialog.querySelector('[data-ink-tool="pen"]').click();});
 dialog.querySelector('#inkUndo').onclick=()=>{if(undo.length)draft=undo.pop();draw();};
 dialog.querySelector('#inkReset').onclick=()=>{checkpoint();draft=[];draw();};
 dialog.querySelector('#inkSave').onclick=()=>{try{const nextName=name.value.trim();localStorage.setItem('cadence-interviewer-ink',JSON.stringify(draft));localStorage.setItem('cadence-interviewer-name',nextName);interviewerInk=structuredClone(draft);interviewerName=nextName;refreshInterviewerName();dialog.close();}catch{status.textContent='Could not save. Please try again.';}};
 const opener=document.activeElement;
 const observer=new ResizeObserver(draw);
 dialog.addEventListener('close',()=>{observer.disconnect();dialog.remove();opener?.focus();},{once:true});dialog.showModal();observer.observe(canvas);draw();
}

function openInterviewerCollection(){
 if(document.querySelector('#interviewerCollection'))return;
 const key='cadence-interviewer-collection';
 let saved=[];
 try{const data=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(data))saved=data.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.voice==='string'&&Array.isArray(p.ink)&&p.ink.length<=150&&p.ink.every(s=>s&&inkColors.some(c=>c[1]===s.color)&&Array.isArray(s.points)&&s.points.length<=2000&&s.points.every(q=>Array.isArray(q)&&q.length===2&&q.every(Number.isFinite))));}catch{}
 const opener=document.activeElement,dialog=document.createElement('dialog');dialog.id='interviewerCollection';
 dialog.innerHTML='<form method="dialog" class="ink-header"><h2>Your interviewers</h2><button class="icon-button" aria-label="Close collection" title="Close">'+icon('x')+'</button></form><form class="collection-save"><input maxlength="40" required aria-label="Collection name" placeholder="Name this interviewer"><button class="icon-button" title="Save current interviewer" aria-label="Save current interviewer">'+icon('bookmark-plus')+'</button></form><p class="collection-status" role="status"></p><div class="collection-list"></div>';
 const input=dialog.querySelector('input'),status=dialog.querySelector('[role=status]'),list=dialog.querySelector('.collection-list');input.value=interviewerName;
 function persist(next){try{localStorage.setItem(key,JSON.stringify(next));saved=next;return true;}catch{status.textContent='Storage is full. Remove a saved interviewer and try again.';return false;}}
 function drawList(){
  list.replaceChildren();
  if(!saved.length){const empty=document.createElement('p');empty.className='collection-empty';empty.textContent='No saved interviewers yet.';list.append(empty);}
  for(const preset of saved){
   const row=document.createElement('div');row.className='collection-row';
   const use=document.createElement('button');use.type='button';use.className='collection-use';use.setAttribute('aria-label','Use '+preset.name);
   const canvas=document.createElement('canvas');canvas.width=240;canvas.height=120;canvas.setAttribute('aria-hidden','true');
   const copy=document.createElement('span'),name=document.createElement('strong'),voice=document.createElement('small');name.textContent=preset.name;voice.textContent=preset.voiceName||'Default voice';copy.append(name,voice);use.append(canvas,copy);row.append(use);
   const remove=document.createElement('button');remove.type='button';remove.className='icon-button';remove.title='Delete '+preset.name;remove.setAttribute('aria-label',remove.title);remove.innerHTML=icon('trash-2');row.append(remove);list.append(row);
   const c=canvas.getContext('2d');c.scale(.24,.24);c.beginPath();figure.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));strokeMoonLine(c,'#e9eef2');paintInk(c,preset.ink);
   use.onclick=()=>{
    try{localStorage.setItem('cadence-interviewer-ink',JSON.stringify(preset.ink));localStorage.setItem('cadence-interviewer-name',preset.name);}catch{status.textContent='Could not apply this interviewer. Please try again.';return;}
    interviewerInk=structuredClone(preset.ink);interviewerName=preset.name;browserVoice.stop();browserVoice.select(preset.voice);refreshInterviewerName();moonSet('listening');dialog.close();
    const note=document.querySelector('#voicePreviewStatus');if(note&&preset.voice&&!browserVoice.voices().some(v=>browserVoice.id(v)===preset.voice))note.textContent='Saved voice unavailable. Using the default voice.';
   };
   remove.onclick=()=>{if(confirm('Delete "'+preset.name+'" from your collection?')&&persist(saved.filter(p=>p.id!==preset.id))){status.textContent='Deleted.';drawList();}};
  }
  lucide.createIcons();
 }
 dialog.querySelector('.collection-save').onsubmit=e=>{
  e.preventDefault();const name=input.value.trim();if(!name){input.setCustomValidity('Enter a name.');input.reportValidity();return;}
  const voice=browserVoice.current(),preset={id:crypto.randomUUID(),name,ink:structuredClone(interviewerInk),voice:voice?browserVoice.id(voice):'',voiceName:voice?.name||''};
  if(persist([...saved,preset])){status.textContent='Saved.';drawList();}
 };
 input.oninput=()=>input.setCustomValidity('');
 dialog.addEventListener('close',()=>{dialog.remove();opener?.focus();},{once:true});document.body.append(dialog);drawList();dialog.showModal();
}
