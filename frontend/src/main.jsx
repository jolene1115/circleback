import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';

async function boot(){
 const bootstrap=document.createElement('div');bootstrap.hidden=true;
 bootstrap.innerHTML='<div class="preview"><div role="group"></div></div><div id="app"></div>';
 document.body.append(bootstrap);
 for(const file of ['assets/lucide.min.js','app.js','woodcut.js','browser-voice.js','moon.js','transcription.js','immersive-controls.js','interviewer-ink.js','workspace.js','team-api.js','react-bridge.js']){
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/'+file;script.onload=resolve;script.onerror=reject;document.head.append(script);});
 }
 window.cadence.stopFigure();bootstrap.remove();
 createRoot(document.getElementById('root')).render(<App/>);
}
boot().catch(()=>{document.getElementById('root').textContent='Could not load Cadence. Please refresh.';});
