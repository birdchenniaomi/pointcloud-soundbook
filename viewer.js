import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const $=s=>document.querySelector(s);
const viewer=$('#viewer'),loading=$('#loading'),loadingText=$('#loadingText'),loadingProgress=$('#loadingProgress'),errorBox=$('#errorBox');
const pointSize=$('#pointSize'),pointSizeValue=$('#pointSizeValue'),brightness=$('#brightness'),brightnessValue=$('#brightnessValue');
const globalWave=$('#globalWave'),globalWaveValue=$('#globalWaveValue'),localWave=$('#localWave'),localWaveValue=$('#localWaveValue');
const motionSpeed=$('#motionSpeed'),motionSpeedValue=$('#motionSpeedValue'),audioInfluence=$('#audioInfluence'),audioInfluenceValue=$('#audioInfluenceValue');
const fireflyAmount=$('#fireflyAmount'),fireflyAmountValue=$('#fireflyAmountValue'),fireflyRange=$('#fireflyRange'),fireflyRangeValue=$('#fireflyRangeValue');
const resetBtn=$('#resetBtn'),waveBtn=$('#waveBtn'),rotateBtn=$('#rotateBtn'),fullscreenBtn=$('#fullscreenBtn'),settingsBtn=$('#settingsBtn'),settings=$('#settings');
const audio=$('#soundtrack'),audioBtn=$('#audioBtn'),audioIcon=$('#audioIcon'),audioLabel=$('#audioLabel');
const sceneMenuBtn=$('#sceneMenuBtn'),sceneDrawer=$('#sceneDrawer'),sceneCloseBtn=$('#sceneCloseBtn'),sceneList=$('#sceneList');
const prevSceneBtn=$('#prevSceneBtn'),nextSceneBtn=$('#nextSceneBtn');

let debugPanel=null,debugBody=null,debugVisible=false;
let lastGeometryCenter=new THREE.Vector3(),lastBoundingCenter=new THREE.Vector3();
let pickFocusMode=false, savedView=null;
const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
let focusMarker=null;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x070808); scene.fog=new THREE.FogExp2(0x070808,.011);
const camera=new THREE.PerspectiveCamera(45,1,.01,5000);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; viewer.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.065; controls.screenSpacePanning=true; controls.autoRotate=true; controls.autoRotateSpeed=.28;

let catalog=[],currentIndex=0,currentPoints=null,currentConfig=null,cloudRadius=1,homePosition=new THREE.Vector3(0,0,4),homeTarget=new THREE.Vector3(),resumeTimer=0,loadToken=0;
const clock=new THREE.Clock();
const uniforms={uPointSize:{value:.005},uBrightness:{value:1},uGlowStrength:{value:.35},uGlowRadius:{value:.45},uTime:{value:0},uMotion:{value:1},uScale:{value:1},uRadius:{value:1},uBass:{value:0},uMid:{value:0},uHigh:{value:0},uEnvelope:{value:0},uGlobalWave:{value:1.8},uLocalWave:{value:2.2},uMotionSpeed:{value:.55},uAudioInfluence:{value:1.35},uFireflyAmount:{value:.45},uFireflyRange:{value:1.2}};
let motionTarget=1;

const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexColors:true,vertexShader:`
uniform float uPointSize,uGlowRadius,uTime,uMotion,uScale,uRadius,uBass,uMid,uHigh,uEnvelope,uGlobalWave,uLocalWave,uMotionSpeed,uAudioInfluence,uFireflyAmount,uFireflyRange;
varying vec3 vColor; varying float vFirefly;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453123);} float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);} float fbm(vec3 p){float v=0.,a=.55;v+=a*noise3(p);p=p*2.03+vec3(17.1,9.2,5.7);a*=.5;v+=a*noise3(p);p=p*2.01+vec3(3.4,19.8,11.3);a*=.5;v+=a*noise3(p);return v;}
void main(){vColor=color;vec3 p=position;float seed=hash(position*31.73);float selectThreshold=1.0-clamp(uFireflyAmount,0.0,3.0)*0.004;vFirefly=step(selectThreshold,seed);float t=uTime*uMotionSpeed;vec3 q=p*uScale;float largeA=fbm(q*.20+vec3(t*.055,t*.018,-t*.030))-.5;float largeB=fbm(q*.23+vec3(-t*.028,t*.042,t*.016)+vec3(12.7,3.4,8.8))-.5;float localA=fbm(q*.72+vec3(t*.090,-t*.040,t*.050)+vec3(2.1,17.3,5.6))-.5;float localB=fbm(q*1.18+vec3(-t*.075,t*.065,-t*.035)+vec3(20.4,7.1,13.2))-.5;float audioSlow=(uBass*.60+uMid*.28+uHigh*.12)*uAudioInfluence;float globalAmp=uRadius*(.0018*uGlobalWave)*(1.0+audioSlow*.75);float localAmp=uRadius*(.00075*uLocalWave)*(1.0+audioSlow*1.15);vec3 flow=normalize(vec3(largeB*.8,largeA*.35,largeA*.55)+vec3(.001));vec3 globalOffset=flow*largeA*globalAmp;vec3 localDir=normalize(vec3(localB,localA*.9,localA-localB)+vec3(.001));vec3 localOffset=localDir*mix(localA,localB,.5)*localAmp;float radial=length(q.xz);float pulse=sin(radial*1.25-t*(.28+uBass*.35));pulse=smoothstep(.42,1.0,pulse*.5+.5)*uEnvelope;vec3 pulseOffset=normalize(vec3(q.x,.22,q.z)+vec3(.001))*pulse*uRadius*.0017*uAudioInfluence;vec3 fireflyOffset=vec3(0.);if(vFirefly>.5){float phase=hash(position*17.19+vec3(2.4,8.1,5.7))*6.2831853;float speed=.22+hash(position*9.41+vec3(4.1,1.8,7.3))*.38;float orbit=uRadius*.0015*uFireflyRange;float nx=fbm(q*.38+vec3(t*.12+phase,phase*.2,-t*.08))-.5;float ny=fbm(q*.41+vec3(-t*.09,phase*.3,t*.11+phase))-.5;float nz=fbm(q*.36+vec3(t*.07,-t*.10+phase,phase*.4))-.5;fireflyOffset=vec3(sin(t*speed+phase)+nx*.9,cos(t*(speed*.73)+phase*1.37)+ny*.8,sin(t*(speed*.57)+phase*2.11)+nz*.9)*orbit;}p+=(globalOffset+localOffset+pulseOffset+fireflyOffset)*uMotion;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uPointSize*(320.0/max(1.0,-mv.z))*(1.0+vFirefly*1.8)*(1.0+uGlowRadius*.85);}
`,fragmentShader:`uniform float uBrightness,uHigh,uGlowStrength,uGlowRadius;varying vec3 vColor;varying float vFirefly;void main(){vec2 uv=gl_PointCoord-.5;float r=length(uv);if(r>.5)discard;float core=smoothstep(.30,.03,r);float halo=smoothstep(.5,.12,r)*(1.0-core);vec3 c=min(vColor*(uBrightness+uHigh*.18),vec3(1.));c=mix(c,min(c*1.45+vec3(.12,.10,.05),vec3(1.)),vFirefly);vec3 glow=min(c*(1.0+uGlowStrength*1.8),vec3(1.));vec3 outColor=mix(c,glow,halo*clamp(uGlowStrength,0.0,2.0));float alpha=core+halo*uGlowStrength*.48;alpha*=1.0+vFirefly*.35;gl_FragColor=vec4(outColor,alpha);}`});


function rollCamera(degrees){
  const axis=new THREE.Vector3().subVectors(controls.target,camera.position).normalize();
  camera.up.applyAxisAngle(axis,THREE.MathUtils.degToRad(degrees)).normalize();
  camera.lookAt(controls.target);controls.update();
}
function levelCamera(){
  const forward=new THREE.Vector3().subVectors(controls.target,camera.position).normalize();
  const worldUp=new THREE.Vector3(0,1,0);
  let right=new THREE.Vector3().crossVectors(forward,worldUp);
  if(right.lengthSq()<1e-8) right.set(1,0,0); else right.normalize();
  camera.up.crossVectors(right,forward).normalize();
  camera.lookAt(controls.target);controls.update();
}
function createRangeRow(label,min,max,step,value,onInput){
  const row=document.createElement('label');row.style.cssText='display:grid;grid-template-columns:84px 1fr 44px;align-items:center;gap:7px;margin-top:7px';
  const name=document.createElement('span');name.textContent=label;
  const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=value;
  const out=document.createElement('output');out.textContent=Number(value).toFixed(2);out.style.textAlign='right';
  input.oninput=()=>{out.textContent=Number(input.value).toFixed(2);onInput(Number(input.value));};
  row.append(name,input,out);return row;
}
function ensureDebugPanel(){
  if(debugPanel)return;
  debugPanel=document.createElement('section');
  debugPanel.id='debugPanel';
  debugPanel.style.cssText='position:fixed;left:12px;bottom:12px;z-index:40;min-width:290px;max-width:min(92vw,430px);padding:10px 11px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(5,7,7,.82);backdrop-filter:blur(12px);color:rgba(255,255,255,.78);font:10px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap';
  debugPanel.hidden=true;
  const head=document.createElement('div');
  head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px;color:#fff';
  const title=document.createElement('span'); title.textContent='VIEW CALIBRATION';
  const hide=document.createElement('button'); hide.textContent='HIDE';
  hide.style.cssText='border:1px solid rgba(255,255,255,.22);border-radius:999px;background:transparent;color:inherit;padding:3px 7px;font:inherit;cursor:pointer';
  hide.onclick=()=>{debugVisible=false;debugPanel.hidden=true};
  head.append(title,hide);

  const actions=document.createElement('div');
  actions.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:8px';
  const makeButton=(label)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='border:1px solid rgba(255,255,255,.22);border-radius:7px;background:rgba(255,255,255,.035);color:#fff;padding:6px 7px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer';return b};
  const pick=makeButton('PICK FOCUS');
  const save=makeButton('SAVE VIEW');
  const copy=makeButton('COPY CONFIG');
  const download=makeButton('DOWNLOAD JSON');
  const rollLeft=makeButton('ROLL −');
  const level=makeButton('LEVEL');
  const rollRight=makeButton('ROLL +');

  pick.onclick=()=>{
    pickFocusMode=!pickFocusMode;
    pick.textContent=pickFocusMode?'CLICK A POINT…':'PICK FOCUS';
    pick.style.background=pickFocusMode?'rgba(255,255,255,.18)':'rgba(255,255,255,.035)';
    renderer.domElement.style.cursor=pickFocusMode?'crosshair':'';
  };
  save.onclick=()=>{
    savedView=captureView();
    homeTarget.copy(savedView.focus);
    homePosition.copy(savedView.cameraPosition);
    camera.up.copy(savedView.cameraUp).normalize();
    save.textContent='VIEW SAVED';setTimeout(()=>save.textContent='SAVE VIEW',1000);
    updateFocusMarker(homeTarget);
  };
  copy.onclick=async()=>{
    const text=viewConfigText();
    try{await navigator.clipboard.writeText(text);copy.textContent='COPIED';setTimeout(()=>copy.textContent='COPY CONFIG',1000)}catch{prompt('貼到 config.json：',text)}
  };
  download.onclick=()=>{
    const merged={...(currentConfig||{}),...viewConfigObject()};
    const blob=new Blob([JSON.stringify(merged,null,2)+'\n'],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${currentConfig?.id||'scene'}-config.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  rollLeft.onclick=()=>rollCamera(-1);
  rollRight.onclick=()=>rollCamera(1);
  level.onclick=()=>levelCamera();
  actions.append(pick,save,copy,download,rollLeft,level,rollRight);
  actions.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';
  const glowControls=document.createElement('div');
  glowControls.style.cssText='padding:7px 0 8px;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:8px';
  glowControls.append(
    createRangeRow('GLOW',0,2,.01,uniforms.uGlowStrength.value,v=>uniforms.uGlowStrength.value=v),
    createRangeRow('RADIUS',0,1.5,.01,uniforms.uGlowRadius.value,v=>uniforms.uGlowRadius.value=v)
  );
  debugBody=document.createElement('div');
  debugPanel.append(head,actions,glowControls,debugBody);document.body.appendChild(debugPanel);

  const show=document.createElement('button');
  show.id='debugShowBtn';show.textContent='XYZ';show.title='顯示視角校正';
  show.style.cssText='position:fixed;left:12px;bottom:12px;z-index:39;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(5,7,7,.72);color:#fff;padding:6px 9px;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer';
  show.onclick=()=>{debugVisible=true;debugPanel.hidden=false};document.body.appendChild(show);
}
function captureView(){return {focus:controls.target.clone(),cameraPosition:camera.position.clone(),cameraUp:camera.up.clone().normalize()}}
function viewConfigObject(){const v=captureView(),a=x=>+x.toFixed(6);return {focus:[a(v.focus.x),a(v.focus.y),a(v.focus.z)],cameraPosition:[a(v.cameraPosition.x),a(v.cameraPosition.y),a(v.cameraPosition.z)],cameraUp:[a(v.cameraUp.x),a(v.cameraUp.y),a(v.cameraUp.z)],glowStrength:a(uniforms.uGlowStrength.value),glowRadius:a(uniforms.uGlowRadius.value)}}
function viewConfigText(){const v=viewConfigObject();return `"focus": ${JSON.stringify(v.focus)},\n"cameraPosition": ${JSON.stringify(v.cameraPosition)},\n"cameraUp": ${JSON.stringify(v.cameraUp)}`}
function updateFocusMarker(position){
  if(!focusMarker){
    const geo=new THREE.SphereGeometry(1,12,8);
    const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,depthTest:false});
    focusMarker=new THREE.Mesh(geo,mat);focusMarker.renderOrder=999;scene.add(focusMarker);
  }
  focusMarker.position.copy(position);focusMarker.scale.setScalar(Math.max(cloudRadius*.008,.002));focusMarker.visible=true;
}
function pickFocusFromPointer(event){
  if(!pickFocusMode||!currentPoints)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  raycaster.params.Points.threshold=Math.max(cloudRadius*.012,.002);
  const hit=raycaster.intersectObject(currentPoints,false)[0];
  if(!hit)return;
  controls.target.copy(hit.point);controls.update();updateFocusMarker(hit.point);
  pickFocusMode=false;renderer.domElement.style.cursor='';
  const btn=[...debugPanel.querySelectorAll('button')].find(b=>b.textContent.includes('CLICK A POINT'));
  if(btn){btn.textContent='PICK FOCUS';btn.style.background='rgba(255,255,255,.035)'}
}
renderer.domElement.addEventListener('pointerdown',pickFocusFromPointer);
function updateDebugPanel(){
  if(!debugBody||!debugVisible)return;
  const f=v=>`${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)}`;
  const cloud=currentPoints?.position||new THREE.Vector3();
  const distance=camera.position.distanceTo(controls.target);
  debugBody.textContent=[
    `scene          ${currentConfig?.id||'-'}`,
    `camera         ${f(camera.position)}`,
    `focus/target   ${f(controls.target)}`,
    `camera up      ${f(camera.up)}`,
    `cloud object   ${f(cloud)}`,
    `mean center    ${f(lastGeometryCenter)}`,
    `bbox center    ${f(lastBoundingCenter)}`,
    `distance       ${distance.toFixed(4)}`,
    `radius         ${cloudRadius.toFixed(4)}`,
    `pick mode      ${pickFocusMode?'ON':'OFF'}`
  ].join('\n');
}
ensureDebugPanel();

function syncToggle(button,on){button.setAttribute('aria-pressed',String(on));button.classList.toggle('is-active',on)}
function setRange(input,output,uniform,value,digits=2){input.value=String(value);uniform.value=+value;output.value=(+value).toFixed(digits)}
function vec3FromConfig(value,fallback){
  return Array.isArray(value)&&value.length>=3
    ? new THREE.Vector3(Number(value[0])||0,Number(value[1])||0,Number(value[2])||0)
    : fallback.clone();
}
function fit(points, config={}){
  const g=points.geometry;
  const position=g.getAttribute('position');
  if(!position||position.count===0)return;

  // 保留 V8 的外框置中方式：先將幾何中心移到世界原點。
  g.computeBoundingBox();
  const bboxCenter=new THREE.Vector3(),size=new THREE.Vector3();
  g.boundingBox.getCenter(bboxCenter);g.boundingBox.getSize(size);
  lastBoundingCenter.copy(bboxCenter);

  const mean=new THREE.Vector3();
  for(let i=0;i<position.count;i++)mean.add(new THREE.Vector3(position.getX(i),position.getY(i),position.getZ(i)));
  mean.multiplyScalar(1/position.count);lastGeometryCenter.copy(mean);

  g.translate(-bboxCenter.x,-bboxCenter.y,-bboxCenter.z);
  g.computeBoundingBox();g.computeBoundingSphere();
  points.position.set(0,0,0);points.rotation.set(0,0,0);points.scale.set(1,1,1);

  cloudRadius=Math.max(g.boundingSphere?.radius||Math.max(size.x,size.y,size.z)*.5,0.0001);
  uniforms.uScale.value=3.2/cloudRadius;uniforms.uRadius.value=cloudRadius;

  const defaultTarget=new THREE.Vector3(0,0,0);
  const focus=vec3FromConfig(config.focus||config.viewTarget,defaultTarget);
  homeTarget.copy(focus);

  const halfFov=THREE.MathUtils.degToRad(camera.fov*.5);
  const distance=(cloudRadius/Math.sin(halfFov))*1.12;
  const defaultCamera=focus.clone().add(new THREE.Vector3(distance*.16,distance*.06,distance));
  homePosition.copy(vec3FromConfig(config.cameraPosition,defaultCamera));
  camera.up.copy(vec3FromConfig(config.cameraUp,new THREE.Vector3(0,1,0))).normalize();

  camera.near=Math.max(cloudRadius/5000,0.001);camera.far=Math.max(cloudRadius*50,1000);camera.updateProjectionMatrix();
  controls.minDistance=Math.max(cloudRadius*.08,0.001);controls.maxDistance=Math.max(cloudRadius*25,10);
  controls.target.copy(homeTarget);camera.position.copy(homePosition);camera.lookAt(homeTarget);controls.update();
  savedView=captureView();updateFocusMarker(homeTarget);
}
function reset(anim=true){if(!anim){camera.position.copy(homePosition);controls.target.copy(homeTarget);camera.lookAt(homeTarget);controls.update();return}const a=camera.position.clone(),b=controls.target.clone(),st=performance.now();(function step(now){const t=Math.min((now-st)/650,1),e=1-Math.pow(1-t,3);camera.position.lerpVectors(a,homePosition,e);controls.target.lerpVectors(b,homeTarget,e);if(t<1)requestAnimationFrame(step)})(st)}
function showLoading(text='載入作品…'){loading.classList.remove('hide');loadingText.textContent=text;loadingProgress.value=0;errorBox.hidden=true}
function fail(m){loading.classList.add('hide');errorBox.hidden=false;errorBox.textContent=m}
function applyConfig(c){currentConfig=c;document.title=`Point Cloud Sound Book — ${c.title}`;$('#sceneTitle').textContent=c.title||c.id;$('#sceneGps').textContent=c.gps||'';$('#sceneDate').textContent=c.date||'';$('#sceneLabel').textContent=c.sceneLabel||c.id;$('#sceneSubtitle').textContent=c.subtitle||'';setRange(pointSize,pointSizeValue,uniforms.uPointSize,c.pointSize??.005,3);setRange(brightness,brightnessValue,uniforms.uBrightness,c.brightness??1,2);uniforms.uGlowStrength.value=Number(c.glowStrength??.35);uniforms.uGlowRadius.value=Number(c.glowRadius??.45);setRange(globalWave,globalWaveValue,uniforms.uGlobalWave,c.globalWave??1.8,2);setRange(localWave,localWaveValue,uniforms.uLocalWave,c.localWave??2.2,2);setRange(motionSpeed,motionSpeedValue,uniforms.uMotionSpeed,c.motionSpeed??.55,2);setRange(audioInfluence,audioInfluenceValue,uniforms.uAudioInfluence,c.audioInfluence??1.35,2);setRange(fireflyAmount,fireflyAmountValue,uniforms.uFireflyAmount,c.fireflyAmount??.45,2);setRange(fireflyRange,fireflyRangeValue,uniforms.uFireflyRange,c.fireflyRange??1.2,2);controls.autoRotate=c.autoRotate!==false;motionTarget=c.motionEnabled===false?0:1;syncToggle(rotateBtn,controls.autoRotate);syncToggle(waveBtn,motionTarget>0);audio.pause();audio.innerHTML='';if(c.sound){const src=document.createElement('source');src.src=c.sound;src.type=c.soundType||'';audio.appendChild(src);audio.load()}setAudioUI()}
function removeCloud(){if(currentPoints){scene.remove(currentPoints);currentPoints.geometry.dispose();currentPoints=null}}
async function loadScene(index,push=true){if(!catalog.length)return;currentIndex=(index+catalog.length)%catalog.length;const token=++loadToken;showLoading('載入作品資料…');try{const configUrl=catalog[currentIndex].config;const res=await fetch(configUrl,{cache:'no-store'});if(!res.ok)throw new Error(`config ${res.status}`);const c=await res.json();if(token!==loadToken)return;applyConfig(c);renderSceneList();showLoading('載入點雲…');new PLYLoader().load(c.model,g=>{if(token!==loadToken){g.dispose();return}if(!g.getAttribute('position'))return fail('PLY 沒有頂點資料。');if(!g.getAttribute('color')){const a=new Float32Array(g.getAttribute('position').count*3).fill(1);g.setAttribute('color',new THREE.BufferAttribute(a,3))}removeCloud();currentPoints=new THREE.Points(g,material);currentPoints.frustumCulled=false;scene.add(currentPoints);fit(currentPoints,c);loadingText.textContent=`完成：${g.getAttribute('position').count.toLocaleString()} 點`;setTimeout(()=>loading.classList.add('hide'),250);if(push){const u=new URL(location.href);u.searchParams.set('scene',c.id);history.replaceState(null,'',u)}} ,e=>{if(token!==loadToken)return;if(e.lengthComputable){const p=Math.round(e.loaded/e.total*100);loadingProgress.value=p;loadingText.textContent=`載入點雲… ${p}%`}else loadingText.textContent=`載入點雲… ${(e.loaded/1048576).toFixed(1)} MB`},()=>{if(token===loadToken)fail(`無法載入 ${c.model}`)})}catch(e){console.error(e);fail('作品設定載入失敗。')}}
function renderSceneList(){sceneList.innerHTML='';catalog.forEach((item,i)=>{const b=document.createElement('button');b.className=i===currentIndex?'is-current':'';b.innerHTML=`<span class="num">${String(i+1).padStart(2,'0')}</span><span><strong>${item.title||item.id}</strong><small>${item.date||''}</small></span>`;b.onclick=()=>{sceneDrawer.hidden=true;sceneMenuBtn.setAttribute('aria-expanded','false');loadScene(i)};sceneList.appendChild(b)});prevSceneBtn.disabled=catalog.length<2;nextSceneBtn.disabled=catalog.length<2}
async function initCatalog(){try{const r=await fetch('./scenes/index.json',{cache:'no-store'});if(!r.ok)throw new Error(r.status);const data=await r.json();catalog=await Promise.all(data.scenes.map(async s=>{try{const rr=await fetch(s.config,{cache:'no-store'});const c=await rr.json();return {...s,title:c.title,date:c.date,id:c.id||s.id}}catch{return s}}));const requested=new URL(location.href).searchParams.get('scene');let idx=catalog.findIndex(s=>s.id===requested);if(idx<0)idx=Math.max(0,catalog.findIndex(s=>s.id===data.defaultScene));renderSceneList();loadScene(idx,false)}catch(e){console.error(e);fail('無法載入 scenes/index.json')}}

function bindRange(input,output,uniform,digits=2){input.oninput=()=>{uniform.value=+input.value;output.value=(+input.value).toFixed(digits)}}
bindRange(pointSize,pointSizeValue,uniforms.uPointSize,3);bindRange(brightness,brightnessValue,uniforms.uBrightness,2);bindRange(globalWave,globalWaveValue,uniforms.uGlobalWave,2);bindRange(localWave,localWaveValue,uniforms.uLocalWave,2);bindRange(motionSpeed,motionSpeedValue,uniforms.uMotionSpeed,2);bindRange(audioInfluence,audioInfluenceValue,uniforms.uAudioInfluence,2);bindRange(fireflyAmount,fireflyAmountValue,uniforms.uFireflyAmount,2);bindRange(fireflyRange,fireflyRangeValue,uniforms.uFireflyRange,2);
function restoreFocusForAutoRotate(){
  // 將 OrbitControls 的旋轉中心恢復為此場景保存的 focus。
  // 同時平移攝影機相同的差值，保持目前距離與觀看角度，不會突然跳動。
  const delta=homeTarget.clone().sub(controls.target);
  camera.position.add(delta);
  controls.target.copy(homeTarget);
  camera.lookAt(homeTarget);
  controls.update();
}
function setAutoRotate(on){
  if(on)restoreFocusForAutoRotate();
  controls.autoRotate=on;
  syncToggle(rotateBtn,on);
}
settingsBtn.onclick=()=>{settings.hidden=!settings.hidden;settingsBtn.setAttribute('aria-expanded',String(!settings.hidden))};sceneMenuBtn.onclick=()=>{sceneDrawer.hidden=!sceneDrawer.hidden;sceneMenuBtn.setAttribute('aria-expanded',String(!sceneDrawer.hidden))};sceneCloseBtn.onclick=()=>{sceneDrawer.hidden=true;sceneMenuBtn.setAttribute('aria-expanded','false')};prevSceneBtn.onclick=()=>loadScene(currentIndex-1);nextSceneBtn.onclick=()=>loadScene(currentIndex+1);resetBtn.onclick=()=>reset(true);waveBtn.onclick=()=>{const on=waveBtn.getAttribute('aria-pressed')!=='true';syncToggle(waveBtn,on);motionTarget=on?1:0};rotateBtn.onclick=()=>setAutoRotate(!controls.autoRotate);fullscreenBtn.onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch(e){console.warn(e)}};
let ctx=null,analyser=null,data=null,source=null;async function initAudio(){if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();source=ctx.createMediaElementSource(audio);analyser=ctx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.92;data=new Uint8Array(analyser.frequencyBinCount);source.connect(analyser);analyser.connect(ctx.destination)}if(ctx.state==='suspended')await ctx.resume()}function setAudioUI(){const p=!audio.paused;audioBtn.classList.toggle('is-playing',p);audioBtn.setAttribute('aria-pressed',String(p));audioIcon.textContent=p?'Ⅱ':'▶';audioLabel.textContent=p?'pause':'listen'}audioBtn.onclick=async()=>{try{await initAudio();audio.paused?await audio.play():audio.pause();setAudioUI()}catch(e){console.error(e);alert('音檔無法播放。')}};audio.onplay=setAudioUI;audio.onpause=setAudioUI;
function bands(){const smooth=(c,t,a,r)=>THREE.MathUtils.lerp(c,t,t>c?a:r);if(!analyser||audio.paused){uniforms.uBass.value=smooth(uniforms.uBass.value,0,.02,.012);uniforms.uMid.value=smooth(uniforms.uMid.value,0,.018,.010);uniforms.uHigh.value=smooth(uniforms.uHigh.value,0,.014,.008);uniforms.uEnvelope.value=smooth(uniforms.uEnvelope.value,0,.018,.006);return}analyser.getByteFrequencyData(data);const avg=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=data[i];return s/(b-a)/255};const bass=avg(1,12),mid=avg(12,55),high=avg(55,150),env=Math.max(0,(bass*.65+mid*.28+high*.07)-.08);uniforms.uBass.value=smooth(uniforms.uBass.value,bass,.045,.010);uniforms.uMid.value=smooth(uniforms.uMid.value,mid,.032,.008);uniforms.uHigh.value=smooth(uniforms.uHigh.value,high,.022,.006);uniforms.uEnvelope.value=smooth(uniforms.uEnvelope.value,env,.028,.004)}
controls.addEventListener('start',()=>{clearTimeout(resumeTimer);setAutoRotate(false)});controls.addEventListener('end',()=>{clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{if(currentConfig?.autoRotate!==false)setAutoRotate(true)},5000)});function resize(){camera.aspect=viewer.clientWidth/viewer.clientHeight;camera.updateProjectionMatrix();renderer.setSize(viewer.clientWidth,viewer.clientHeight,false)}addEventListener('resize',resize);resize();renderer.setAnimationLoop(()=>{uniforms.uTime.value=clock.getElapsedTime();bands();uniforms.uMotion.value=THREE.MathUtils.lerp(uniforms.uMotion.value,motionTarget,.025);controls.update();updateDebugPanel();renderer.render(scene,camera)});initCatalog();
