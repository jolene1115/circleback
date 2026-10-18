import React,{useEffect,useRef} from 'react';
import './ambient-music.css';
import {getState} from './store.js';
import {getFigureState,onFigureState} from './engine/figure.js';
export default function AmbientMusic(){
 const audio=useRef(null);
 useEffect(()=>{
  const element=audio.current;
  let engine=null,frame,last=performance.now(),disposed=false,state=getFigureState();
  const visual={energy:0,bass:0,air:0,phase:0};window.cadenceAmbience=visual;
  const unsubscribe=onFigureState(value=>{state=value;});
  async function start(){
   if(disposed||document.hidden)return;
   try{
    if(!engine){
     const context=new AudioContext(),source=context.createMediaElementSource(element),analyser=context.createAnalyser(),gain=context.createGain();
     analyser.fftSize=512;analyser.smoothingTimeConstant=.85;gain.gain.value=0;
     source.connect(analyser);analyser.connect(gain);gain.connect(context.destination);
     engine={context,analyser,gain,bins:new Uint8Array(analyser.frequencyBinCount)};
    }
    // Keep both unlock calls in the user's gesture.
    await Promise.all([engine.context.resume(),element.play()]);
    if(disposed)element.pause();
   }catch{/* Retry on the next user gesture when autoplay is blocked. */}
  }
  const gesture=()=>{if(element.paused||engine?.context.state!=='running')void start();};
  const visibility=()=>{if(document.hidden)element.pause();else void start();};
  function tick(now){
   const dt=Math.min((now-last)/1000,.1);last=now;
   const e=engine,playing=!document.hidden&&!element.paused&&e?.context.state==='running';
   const duck=getState().view==='room'?(state==='responding'?0:state==='speaking'?.2:.55):1;
   if(e){
    e.gain.gain.setTargetAtTime(playing?.16*duck:0,e.context.currentTime,duck===0?.04:.7);
    e.analyser.getByteFrequencyData(e.bins);
    const average=(start,end)=>{let sum=0;for(let i=start;i<end;i++)sum+=e.bins[i];return sum/((end-start)*255);};
    const strength=playing?duck:0,smooth=1-Math.exp(-dt*.9);
    visual.bass+=(average(1,12)*strength-visual.bass)*smooth;
    visual.air+=(average(24,100)*strength-visual.air)*smooth;
    visual.energy+=((visual.bass*.65+visual.air*.35)-visual.energy)*smooth;
    if(playing)visual.phase+=dt*(.08+visual.energy*.11);
   }
   frame=requestAnimationFrame(tick);
  }
  window.addEventListener('pointerdown',gesture);window.addEventListener('keydown',gesture);
  document.addEventListener('visibilitychange',visibility);
  frame=requestAnimationFrame(tick);void start();
  return()=>{
   disposed=true;cancelAnimationFrame(frame);unsubscribe();
   window.removeEventListener('pointerdown',gesture);window.removeEventListener('keydown',gesture);
   document.removeEventListener('visibilitychange',visibility);
   element.pause();engine?.context.close();delete window.cadenceAmbience;
  };
 },[]);
 return <><audio ref={audio} data-ambient-music src="/audio/reverie-scott-buckley.mp3" preload="auto" loop hidden/>
 <small className="music-credit"><a href="https://www.scottbuckley.com.au/library/reverie/" target="_blank" rel="noreferrer">Reverie · Scott Buckley</a><span> · </span><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></small></>;
}
