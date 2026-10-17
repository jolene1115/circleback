/* Keep the proven canvas/audio engine isolated from React's page ownership. */
const engineRoomRender=render;
render=()=>window.dispatchEvent(new Event('cadence:navigate'));
theme='moon';view='home';config.context='';
window.cadence={
 snapshot:()=>({view,config:structuredClone(config),sessions,selectedSession,name:interviewerName}),
 go,
 configure:value=>{config={...config,...value};},
 start:opening=>{reviewRecordings.forEach(r=>URL.revokeObjectURL(r.url));reviewRecordings=[];turns=[];reviewTurns=turns;answer='';question=opening;moonReadKey=null;moonImmersive=true;moonSet('listening');go('room');},
 mountRoom:()=>engineRoomRender(),
 mountFigure:()=>{moonSet('listening');workspaceHelloAt=performance.now();moonMount();},
 stopFigure:()=>cancelAnimationFrame(moonAnimation),
 setState:moonSet,
 voices:browserVoice,
 edit:openInkEditor,
 collection:openInterviewerCollection,
 selectSession:s=>{selectedSession=s;go('summary');},
 retry:s=>{config.custom=s.topic;config.context=s.context||'';config.focus=s.focus.filter(f=>focusOptions.includes(f));config.extra=s.focus.filter(f=>!focusOptions.includes(f)).join(', ');go('setup');},
 topicOptions,focusOptions,
 dispose:()=>{cleanup();moonCloseMic();immersiveObserver?.disconnect();},
 request:teamRequest
};
const syncName=refreshInterviewerName;
refreshInterviewerName=()=>{syncName();window.dispatchEvent(new Event('cadence:character'));};
