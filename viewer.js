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

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x070808);
scene.fog=new THREE.FogExp2(0x070808,.011);
const camera=new THREE.PerspectiveCamera(45,1,.01,5000);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
viewer.appendChild(renderer.domElement);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.065; controls.screenSpacePanning=true;
controls.autoRotate=true; controls.autoRotateSpeed=.28;

let cloudRadius=1,homePosition=new THREE.Vector3(0,0,4),homeTarget=new THREE.Vector3(),resumeTimer=0;
const clock=new THREE.Clock();

const uniforms={
  uPointSize:{value:+pointSize.value},uBrightness:{value:+brightness.value},uTime:{value:0},
  uMotion:{value:1},uScale:{value:1},uRadius:{value:1},uBass:{value:0},uMid:{value:0},uHigh:{value:0},uEnvelope:{value:0},
  uGlobalWave:{value:+globalWave.value},uLocalWave:{value:+localWave.value},uMotionSpeed:{value:+motionSpeed.value},uAudioInfluence:{value:+audioInfluence.value},
  uFireflyAmount:{value:+fireflyAmount.value},uFireflyRange:{value:+fireflyRange.value}
};
let motionTarget=1;

const material=new THREE.ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,vertexColors:true,
  vertexShader:`
uniform float uPointSize,uTime,uMotion,uScale,uRadius,uBass,uMid,uHigh,uEnvelope,uGlobalWave,uLocalWave,uMotionSpeed,uAudioInfluence,uFireflyAmount,uFireflyRange;
varying vec3 vColor;
varying float vFirefly;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453123);}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float v=0.0,a=.55;
  v+=a*noise3(p); p=p*2.03+vec3(17.1,9.2,5.7); a*=.5;
  v+=a*noise3(p); p=p*2.01+vec3(3.4,19.8,11.3); a*=.5;
  v+=a*noise3(p);
  return v;
}
void main(){
  vColor=color;
  vec3 p=position;
  float seed=hash(position*31.73);
  float selectThreshold=1.0-clamp(uFireflyAmount,0.0,2.0)*0.004;
  vFirefly=step(selectThreshold,seed);
  float t=uTime*uMotionSpeed;
  vec3 q=p*uScale;

  float largeA=fbm(q*.20+vec3(t*.055,t*.018,-t*.030))-.5;
  float largeB=fbm(q*.23+vec3(-t*.028,t*.042,t*.016)+vec3(12.7,3.4,8.8))-.5;
  float localA=fbm(q*.72+vec3(t*.090,-t*.040,t*.050)+vec3(2.1,17.3,5.6))-.5;
  float localB=fbm(q*1.18+vec3(-t*.075,t*.065,-t*.035)+vec3(20.4,7.1,13.2))-.5;

  float audioSlow=(uBass*.60+uMid*.28+uHigh*.12)*uAudioInfluence;
  float globalAmp=uRadius*(.0018*uGlobalWave)*(1.0+audioSlow*.75);
  float localAmp=uRadius*(.00075*uLocalWave)*(1.0+audioSlow*1.15);

  vec3 flow=normalize(vec3(largeB*.8,largeA*.35,largeA*.55)+vec3(.001));
  vec3 globalOffset=flow*largeA*globalAmp;

  vec3 localDir=normalize(vec3(localB,localA*.9,localA-localB)+vec3(.001));
  float grain=mix(localA,localB,.5);
  vec3 localOffset=localDir*grain*localAmp;

  float radial=length(q.xz);
  float pulse=sin(radial*1.25-t*(.28+uBass*.35));
  pulse=smoothstep(.42,1.0,pulse*.5+.5)*uEnvelope;
  vec3 pulseOffset=normalize(vec3(q.x,.22,q.z)+vec3(.001))*pulse*uRadius*.0017*uAudioInfluence;

  vec3 fireflyOffset=vec3(0.0);
  if(vFirefly>0.5){
    float phase=hash(position*17.19+vec3(2.4,8.1,5.7))*6.2831853;
    float speed=.22+hash(position*9.41+vec3(4.1,1.8,7.3))*.38;
    float orbit=uRadius*.0015*uFireflyRange;
    float nx=fbm(q*.38+vec3(t*.12+phase,phase*.2,-t*.08))-.5;
    float ny=fbm(q*.41+vec3(-t*.09,phase*.3,t*.11+phase))-.5;
    float nz=fbm(q*.36+vec3(t*.07,-t*.10+phase,phase*.4))-.5;
    fireflyOffset=vec3(
      sin(t*speed+phase)+nx*.9,
      cos(t*(speed*.73)+phase*1.37)+ny*.8,
      sin(t*(speed*.57)+phase*2.11)+nz*.9
    )*orbit;
  }
  p+=(globalOffset+localOffset+pulseOffset+fireflyOffset)*uMotion;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=uPointSize*(320.0/max(1.0,-mv.z))*(1.0+vFirefly*1.8);
}`,
  fragmentShader:`uniform float uBrightness,uHigh;varying vec3 vColor;varying float vFirefly;void main(){vec2 uv=gl_PointCoord-.5;float d=dot(uv,uv);if(d>.25)discard;float edge=smoothstep(.25,.07,d);vec3 c=min(vColor*(uBrightness+uHigh*.18),vec3(1.));c=mix(c,min(c*1.45+vec3(.12,.10,.05),vec3(1.)),vFirefly);float alpha=edge*(1.0+vFirefly*.35);gl_FragColor=vec4(c,alpha);}`
});

function fit(points){
  const g=points.geometry; g.computeBoundingBox();
  const c=new THREE.Vector3(),s=new THREE.Vector3(); g.boundingBox.getCenter(c); g.boundingBox.getSize(s); g.translate(-c.x,-c.y,-c.z);
  cloudRadius=Math.max(s.x,s.y,s.z)*.5||1;
  uniforms.uScale.value=3.2/cloudRadius; uniforms.uRadius.value=cloudRadius;
  const d=cloudRadius/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)); homePosition.set(d*.28,d*.1,d*1.15);
  camera.near=Math.max(cloudRadius/10000,.001); camera.far=Math.max(cloudRadius*100,1000); camera.updateProjectionMatrix();
  controls.minDistance=cloudRadius*.05; controls.maxDistance=cloudRadius*20; reset(false);
}
function reset(anim=true){
  if(!anim){camera.position.copy(homePosition);controls.target.copy(homeTarget);controls.update();return;}
  const a=camera.position.clone(),b=controls.target.clone(),st=performance.now();
  (function step(now){const t=Math.min((now-st)/650,1),e=1-Math.pow(1-t,3);camera.position.lerpVectors(a,homePosition,e);controls.target.lerpVectors(b,homeTarget,e);if(t<1)requestAnimationFrame(step)})(st);
}
function fail(m){loading.classList.add('hide');errorBox.hidden=false;errorBox.textContent=m;}
new PLYLoader().load('./assets/flower.ply',g=>{
  if(!g.getAttribute('position'))return fail('PLY 沒有頂點資料。');
  if(!g.getAttribute('color')){const a=new Float32Array(g.getAttribute('position').count*3).fill(1);g.setAttribute('color',new THREE.BufferAttribute(a,3));}
  const p=new THREE.Points(g,material);p.frustumCulled=false;scene.add(p);fit(p);
  loadingText.textContent=`完成：${g.getAttribute('position').count.toLocaleString()} 點`;setTimeout(()=>loading.classList.add('hide'),300);
},e=>{if(e.lengthComputable){const p=Math.round(e.loaded/e.total*100);loadingProgress.value=p;loadingText.textContent=`載入點雲… ${p}%`}else loadingText.textContent=`載入點雲… ${(e.loaded/1048576).toFixed(1)} MB`},()=>fail('無法載入 assets/flower.ply'));

function bindRange(input,output,uniform,digits=2){input.oninput=()=>{uniform.value=+input.value;output.value=(+input.value).toFixed(digits)};input.oninput();}
bindRange(pointSize,pointSizeValue,uniforms.uPointSize,3);
bindRange(brightness,brightnessValue,uniforms.uBrightness,2);
bindRange(globalWave,globalWaveValue,uniforms.uGlobalWave,2);
bindRange(localWave,localWaveValue,uniforms.uLocalWave,2);
bindRange(motionSpeed,motionSpeedValue,uniforms.uMotionSpeed,2);
bindRange(audioInfluence,audioInfluenceValue,uniforms.uAudioInfluence,2);
bindRange(fireflyAmount,fireflyAmountValue,uniforms.uFireflyAmount,2);
bindRange(fireflyRange,fireflyRangeValue,uniforms.uFireflyRange,2);

settingsBtn.onclick=()=>{settings.hidden=!settings.hidden;settingsBtn.setAttribute('aria-expanded',String(!settings.hidden));};
resetBtn.onclick=()=>reset(true);
function syncToggle(button,on){button.setAttribute('aria-pressed',String(on));button.classList.toggle('is-active',on);}
syncToggle(waveBtn,true);
syncToggle(rotateBtn,true);
waveBtn.onclick=()=>{const on=waveBtn.getAttribute('aria-pressed')!=='true';syncToggle(waveBtn,on);motionTarget=on?1:0;};
rotateBtn.onclick=()=>{controls.autoRotate=!controls.autoRotate;syncToggle(rotateBtn,controls.autoRotate);};
fullscreenBtn.onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch(e){console.warn(e)}};

let ctx=null,analyser=null,data=null,source=null;
async function initAudio(){if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();source=ctx.createMediaElementSource(audio);analyser=ctx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.92;data=new Uint8Array(analyser.frequencyBinCount);source.connect(analyser);analyser.connect(ctx.destination)}if(ctx.state==='suspended')await ctx.resume();}
function setAudioUI(){const p=!audio.paused;audioBtn.classList.toggle('is-playing',p);audioBtn.setAttribute('aria-pressed',String(p));audioIcon.textContent=p?'Ⅱ':'▶';audioLabel.textContent=p?'pause':'listen';}
audioBtn.onclick=async()=>{try{await initAudio();audio.paused?await audio.play():audio.pause();setAudioUI()}catch(e){console.error(e);alert('音檔無法播放。')}};
audio.onplay=setAudioUI;audio.onpause=setAudioUI;

function bands(){
  const smooth=(current,target,attack,release)=>THREE.MathUtils.lerp(current,target,target>current?attack:release);
  if(!analyser||audio.paused){
    uniforms.uBass.value=smooth(uniforms.uBass.value,0,.02,.012);
    uniforms.uMid.value=smooth(uniforms.uMid.value,0,.018,.010);
    uniforms.uHigh.value=smooth(uniforms.uHigh.value,0,.014,.008);
    uniforms.uEnvelope.value=smooth(uniforms.uEnvelope.value,0,.018,.006);
    return;
  }
  analyser.getByteFrequencyData(data);
  const avg=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=data[i];return s/(b-a)/255;};
  const bass=avg(1,12),mid=avg(12,55),high=avg(55,150),env=Math.max(0,(bass*.65+mid*.28+high*.07)-.08);
  uniforms.uBass.value=smooth(uniforms.uBass.value,bass,.045,.010);
  uniforms.uMid.value=smooth(uniforms.uMid.value,mid,.032,.008);
  uniforms.uHigh.value=smooth(uniforms.uHigh.value,high,.022,.006);
  uniforms.uEnvelope.value=smooth(uniforms.uEnvelope.value,env,.028,.004);
}

controls.addEventListener('start',()=>{clearTimeout(resumeTimer);controls.autoRotate=false;syncToggle(rotateBtn,false)});
controls.addEventListener('end',()=>{clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{controls.autoRotate=true;syncToggle(rotateBtn,true)},5000)});
function resize(){camera.aspect=viewer.clientWidth/viewer.clientHeight;camera.updateProjectionMatrix();renderer.setSize(viewer.clientWidth,viewer.clientHeight,false)}
addEventListener('resize',resize);resize();
renderer.setAnimationLoop(()=>{
  uniforms.uTime.value=clock.getElapsedTime();
  bands();
  uniforms.uMotion.value=THREE.MathUtils.lerp(uniforms.uMotion.value,motionTarget,.025);
  controls.update();renderer.render(scene,camera);
});
