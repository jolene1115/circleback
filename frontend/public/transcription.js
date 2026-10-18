/* Send WAV chunks to the same-origin team API, which transcribes with the configured AI service. */
function pcmWav(pcm,sampleRate){
 const buffer=new ArrayBuffer(44+pcm.length*2),v=new DataView(buffer);
 const text=(offset,value)=>{for(let i=0;i<value.length;i++)v.setUint8(offset+i,value.charCodeAt(i));};
 text(0,'RIFF');v.setUint32(4,36+pcm.length*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,pcm.length*2,true);
 pcm.forEach((s,i)=>v.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*(s<0?32768:32767),true));return new Blob([buffer],{type:'audio/wav'});
}
let liveTranscript=null;
async function startTranscript(){
 if(liveTranscript||!stream||recording?.state!=='recording')return;
 const input=$('#answer'),recorder=recording;
 const context=new AudioContext({sampleRate:16000});
 const source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(4096,1,1);
 const silent=context.createGain();silent.gain.value=0;
 const state={context,source,processor,silent,parts:[],count:0,quietSamples:0,chain:Promise.resolve(),valid:true,input,requests:new Set(),failed:false};
 liveTranscript=state;
 state.flush=()=>{
  if(!state.count)return;
  const pcm=new Float32Array(state.count);let offset=0;
  for(const part of state.parts){pcm.set(part,offset);offset+=part.length;}
  state.parts=[];state.count=0;state.quietSamples=0;
  state.chain=state.chain.then(async()=>{
   if(!state.valid)return;
   const controller=new AbortController();state.requests.add(controller);
   const timeout=setTimeout(()=>controller.abort(),30000);
   try{
    const body=new FormData();body.append('audio',pcmWav(pcm,context.sampleRate),'answer.wav');body.append('durationSec',String(pcm.length/context.sampleRate));
    const response=await fetch('/api/transcribe',{method:'POST',body,signal:controller.signal});
    if(!response.ok)throw new Error('Transcription unavailable');
    const result=await response.json();
    if(state.valid&&input.isConnected&&result.transcript){input.value=(input.value.trim()+' '+result.transcript).trim().slice(0,5000);answer=input.value;const caption=$('#liveAnswer');if(caption){caption.textContent=answer;caption.scrollTop=caption.scrollHeight;}$('#answerError').textContent='';}
   }catch(e){if(state.valid){state.failed=true;$('#micStatus').textContent='Transcription unavailable';$('#answerError').textContent='Transcription failed. Stop and record again; part of your answer may be missing.';toast('Transcription unavailable. Check the server connection and AI service quota.');state.valid=false;}}
   finally{clearTimeout(timeout);state.requests.delete(controller);}
  });
 };
 processor.onaudioprocess=e=>{
  if(!state.valid||recorder.state!=='recording')return;
  const data=new Float32Array(e.inputBuffer.getChannelData(0));state.parts.push(data);state.count+=data.length;
  input.dataset.durationSec=String(Number(input.dataset.durationSec||0)+data.length/context.sampleRate);
  // Send at a natural pause once there is enough context; cap continuous speech at 8s.
  const rms=Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length);
  state.quietSamples=rms<0.008?state.quietSamples+data.length:0;
  if(state.count>=context.sampleRate*8||(state.count>=context.sampleRate*4&&state.quietSamples>=context.sampleRate*.5))state.flush();
 };
 source.connect(processor);processor.connect(silent);silent.connect(context.destination);
 recorder.addEventListener('stop',()=>{if(liveTranscript===state)stopTranscript(false);},{once:true});
 await context.resume();
}
async function stopTranscript(discard){
 const state=liveTranscript;if(!state)return;
 if(discard){state.valid=false;state.requests.forEach(controller=>controller.abort());}
 if(!state.stopping){state.stopping=true;state.processor.disconnect();state.source.disconnect();state.silent.disconnect();state.processor.onaudioprocess=null;state.context.close().catch(()=>{});if(!discard)state.flush();}
 await state.chain;
 if(liveTranscript===state)liveTranscript=null;
}
const transcriptBind=bind,transcriptCleanup=cleanup;
cleanup=function(){stopTranscript(true);transcriptCleanup();};
bind=function(){
 transcriptBind();if(theme!=='moon'||view!=='room')return;
 const note=$('#answerForm>.field-note');if(note)note.textContent='Audio is transcribed through the team server.';
 $('#answer').hidden=true;$('#answer').setAttribute('aria-hidden','true');$('#answer').tabIndex=-1;
 const caption=document.createElement('div');caption.id='liveAnswer';caption.setAttribute('role','status');caption.setAttribute('aria-live','polite');caption.setAttribute('aria-label','Your transcribed answer');caption.textContent=$('#answer').value;$('#answer').before(caption);
 const label=$('label[for=answer]');if(label)label.hidden=true;$('#sampleAnswer').hidden=true;
 const mic=$('#mic').onclick;
 $('#mic').onclick=async()=>{if(recording?.state!=='recording')await stopTranscript(false);await mic();if(recording?.state==='recording'){try{await startTranscript();}catch{toast('Live transcription could not start. Stop and retry recording.');}}};
 const submit=$('#answerForm').onsubmit;
 let submitting=false;
 $('#answerForm').onsubmit=async e=>{
  e.preventDefault();if(submitting)return;submitting=true;
  const form=$('#answerForm'),button=$('#answerForm button[type=submit]');button.disabled=true;form.dataset.transcribing='true';
  if(recording?.state==='recording')recording.stop();
  if(liveTranscript)$('#micStatus').textContent='Finishing transcript...';
  await stopTranscript(false);
  if(button.isConnected){button.disabled=false;submitting=false;form.dataset.transcribing='false';if(!$('#answer').value.trim()){$('#micStatus').textContent='Ready to record';$('#answerError').textContent='No speech transcribed yet. Record your answer before sending.';return;}submit(e);}
 };
};
render();
