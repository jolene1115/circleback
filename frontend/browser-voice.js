const browserVoice = (() => {
 const key='cadence-browser-voice';
 let preference='',generation=0;
 try{preference=localStorage.getItem(key)||'';}catch{}
 const voices=()=> (window.speechSynthesis?.getVoices()||[]).filter(v=>v.localService&&/^en([-_]|$)/i.test(v.lang));
 const id=v=>v.voiceURI+'|'+v.lang;
 function current(){const list=voices();return list.find(v=>id(v)===preference)||list.find(v=>v.name==='Organ')||list.find(v=>v.default)||list[0];}
 function select(value){preference=value;try{localStorage.setItem(key,value);}catch{}window.dispatchEvent(new Event('browser-voice-change'));}
 function stop(){generation++;window.speechSynthesis?.cancel();}
 async function speak(callbacks){
  stop();const run=generation,synth=window.speechSynthesis;
  if(!synth||!window.SpeechSynthesisUtterance){callbacks.onerror?.({error:'unavailable'});return;}
  if(!voices().length)await new Promise(resolve=>{const ready=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',ready);resolve();};const timer=setTimeout(ready,1500);synth.addEventListener('voiceschanged',ready);});
  if(run!==generation)return;
  const voice=current();
  if(!voice){callbacks.onerror?.({error:'voice-unavailable'});return;}
  const u=new SpeechSynthesisUtterance(callbacks.text);callbacks.native=u;
  u.voice=voice;u.lang=voice.lang;u.rate=.92;u.pitch=1;
  for(const event of ['start','boundary','end','error'])u['on'+event]=e=>{if(run===generation)callbacks['on'+event]?.(e);};
  synth.speak(u);
 }
 function populate(selectElement){
  const selected=current();selectElement.replaceChildren();
  for(const voice of voices()){const option=new Option(voice.name+' ('+voice.lang+')',id(voice));selectElement.add(option);}
  if(selected)selectElement.value=id(selected);
  else selectElement.add(new Option('No local English voices available',''));
  selectElement.disabled=!selected;
 }
 window.addEventListener('storage',e=>{if(e.key===key){preference=e.newValue||'';window.dispatchEvent(new Event('browser-voice-change'));}});
 window.addEventListener('pagehide',stop);
 return {voices,id,current,select,stop,speak,populate};
})();
