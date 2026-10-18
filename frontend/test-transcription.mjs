import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

async function recorder({holdFirst=false}={}) {
 let processor,release;
 const requests=[];
 const input={value:'',dataset:{},isConnected:true},status={textContent:''};
 class Context {
  sampleRate=16000;destination={};
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createScriptProcessor(){return processor={connect(){},disconnect(){}};}
  createGain(){return {gain:{},connect(){},disconnect(){}};}
  async resume(){}
  async close(){}
 }
 const context=vm.createContext({AudioContext:Context,recording:{state:'recording',addEventListener(){}},stream:{},
  $:selector=>selector==='#answer'?input:status,bind(){},cleanup(){},render(){},toast(){},answer:'',
  Float32Array,ArrayBuffer,DataView,Blob,FormData,AbortController,setTimeout,clearTimeout,
  fetch:async(url,{body})=>{
   requests.push({url,duration:Number(body.get('durationSec'))});
   const n=requests.length;
   if(holdFirst&&n===1)await new Promise(resolve=>{release=resolve;});
   return {ok:true,json:async()=>({transcript:`Part ${n}.`})};
  }});
 vm.runInContext(fs.readFileSync(new URL('./public/transcription.js',import.meta.url),'utf8'),context);
 await vm.runInContext('startTranscript()',context);
 return {input,requests,release:()=>release(),
  feed(value,seconds){processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(16000*seconds).fill(value)}});},
  settle:()=>vm.runInContext('liveTranscript.chain',context),
  stop:()=>vm.runInContext('stopTranscript(false)',context)};
}
test('sends at a natural pause after four seconds',async()=>{
 const r=await recorder();r.feed(.1,3.5);r.feed(0,.5);await r.settle();
 assert.deepEqual(r.requests,[{url:'/api/transcribe',duration:4}]);
 assert.equal(r.input.value,'Part 1.');await r.stop();
});
test('continuous speech keeps eight seconds of context',async()=>{
 const r=await recorder();r.feed(.1,4);await r.settle();assert.equal(r.requests.length,0);
 r.feed(.1,4);await r.settle();assert.equal(r.requests[0].duration,8);await r.stop();
});
test('short pauses do not split an early phrase; stopping flushes the remainder once',async()=>{
 const r=await recorder();r.feed(.1,1);r.feed(0,.5);await r.settle();assert.equal(r.requests.length,0);
 await r.stop();await r.stop();assert.deepEqual(r.requests.map(x=>x.duration),[1.5]);
});
test('slow requests remain ordered and final audio is not lost',async()=>{
 const r=await recorder({holdFirst:true});r.feed(.1,3.5);r.feed(0,.5);
 await new Promise(resolve=>setImmediate(resolve));
 r.feed(.1,3.5);r.feed(0,.5);r.feed(.1,1);
 const stopped=r.stop();assert.equal(r.requests.length,1);
 r.release();await stopped;
 assert.deepEqual(r.requests.map(x=>x.duration),[4,4,1]);
 assert.equal(Number(r.input.dataset.durationSec),9);
 assert.equal(r.input.value,'Part 1. Part 2. Part 3.');
});
