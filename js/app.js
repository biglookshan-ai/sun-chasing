/* SunPath — 应用逻辑: 状态 / 地图 / 渲染 / 交互 / AR */
/* ===== 状态 ===== */
const now0=new Date();
const S={lat:51.5074,lng:-0.1278,date:new Date(),minutes:now0.getHours()*60+now0.getMinutes(),height:10,mode:'idle'};
const $=id=>document.getElementById(id);
function activeDate(){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(S.minutes);return d;}
const mmOf=d=>d.getHours()*60+d.getMinutes();

/* URL hash: lat,lng,YYYY-MM-DD */
function loadHash(){const h=decodeURIComponent(location.hash.slice(1));if(!h)return;const p=h.split(',');
  const la=parseFloat(p[0]),ln=parseFloat(p[1]);if(!isNaN(la)&&!isNaN(ln)){S.lat=la;S.lng=ln;}
  if(p[2]){const[y,m,d]=p[2].split('-').map(Number);if(y)S.date=new Date(y,m-1,d);}}
function saveHash(){const ds=S.date.getFullYear()+'-'+pad(S.date.getMonth()+1)+'-'+pad(S.date.getDate());
  history.replaceState(null,'','#'+S.lat.toFixed(5)+','+S.lng.toFixed(5)+','+ds);}

/* ===== 地图 ===== */
let map,marker,lines={},mapOK=false;
function initMap(){
  if(typeof L==='undefined'){$('mapfail').style.display='grid';return;}
  try{
    map=L.map('map',{zoomControl:true,attributionControl:true}).setView([S.lat,S.lng],15);
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'});
    let loaded=false;tiles.on('load',()=>loaded=true);tiles.addTo(map);
    setTimeout(()=>{if(!loaded)$('mapfail').style.display='grid';},4500);
    const icon=L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[16,16],iconAnchor:[8,8]});
    marker=L.marker([S.lat,S.lng],{draggable:true,icon}).addTo(map);
    marker.on('dragend',ev=>setPoint(ev.target.getLatLng().lat,ev.target.getLatLng().lng,false));
    map.on('click',ev=>setPoint(ev.latlng.lat,ev.latlng.lng,false));
    map.on('zoomend moveend',()=>{if(mapOK)drawOverlays();});
    lines.sunrise=L.polyline([],{color:'#F0B24A',weight:2,dashArray:'4 5',opacity:.85}).addTo(map);
    lines.sunset=L.polyline([],{color:'#D98C7A',weight:2,dashArray:'4 5',opacity:.85}).addTo(map);
    lines.sun=L.polyline([],{color:'#fff',weight:3,opacity:.9}).addTo(map);
    lines.shadow=L.polyline([],{color:'#5B8FD6',weight:6,opacity:.75,lineCap:'round'}).addTo(map);
    mapOK=true;
  }catch(err){$('mapfail').style.display='grid';}
}
function dispDist(){try{const b=map.getBounds();return map.distance(b.getNorthWest(),b.getSouthEast())*0.16;}catch(e){return 150;}}
function drawOverlays(){
  if(!mapOK)return;
  const t=getTimes(activeDate(),S.lat,S.lng);
  const srAz=azDeg(getPos(t.sunrise,S.lat,S.lng).az),ssAz=azDeg(getPos(t.sunset,S.lat,S.lng).az);
  const p=getPos(activeDate(),S.lat,S.lng),sunAz=azDeg(p.az),alt=altDeg(p.alt),D=dispDist();
  marker.setLatLng([S.lat,S.lng]);
  lines.sunrise.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,srAz,D)]);
  lines.sunset.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,ssAz,D)]);
  if(alt>-.5){lines.sun.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,sunAz,D*.9)]);
    const shLen=Math.min(alt>0.5?S.height/Math.tan(p.alt):5000,4000);
    lines.shadow.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,(sunAz+180)%360,shLen)]);}
  else{lines.sun.setLatLngs([]);lines.shadow.setLatLngs([]);}
}
function setPoint(lat,lng,recenter){S.lat=lat;S.lng=lng;if(mapOK&&recenter)map.setView([lat,lng]);renderAll();}

/* ===== 光线阶段 + 下一事件 ===== */
function phaseOf(alt){
  if(alt>=6)return{n:'白昼',c:'#7fa8dd'};
  if(alt>=0)return{n:'黄金时刻',c:'#F0B24A'};
  if(alt>=-6)return{n:'蓝调时刻',c:'#5B8FD6'};
  if(alt>=-18)return{n:'暮光',c:'#4a63a8'};
  return{n:'夜',c:'#6a76a8'};
}
function nextEvent(t){
  const cur=activeDate().getTime();
  const ev=[['日出',t.sunrise],['正午',t.solarNoon],['日落',t.sunset],['暮蓝调结束',t.dusk],['晨蓝调开始',t.dawn],['黄金晨末',t.ghEnd],['黄金暮始',t.gh]];
  let best=null;for(const[lab,d]of ev){if(d&&!isNaN(d)&&d.getTime()>cur){if(!best||d<best.d)best={lab,d};}}
  return best;
}

/* ===== 渲染 ===== */
function renderAll(){
  const t=getTimes(activeDate(),S.lat,S.lng);
  const p=getPos(activeDate(),S.lat,S.lng),sunAz=azDeg(p.az),alt=altDeg(p.alt);
  const srAz=azDeg(getPos(t.sunrise,S.lat,S.lng).az),ssAz=azDeg(getPos(t.sunset,S.lat,S.lng).az);
  $('tlabel').textContent=pad(Math.floor(S.minutes/60))+':'+pad(S.minutes%60);
  $('tslider').value=S.minutes;
  $('datePick').value=S.date.getFullYear()+'-'+pad(S.date.getMonth()+1)+'-'+pad(S.date.getDate());
  // phase
  const ph=phaseOf(alt);$('phaseName').textContent=ph.n;$('phasePill').querySelector('i').style.background=ph.c;
  const ne=nextEvent(t);
  if(ne){const dm=Math.round((ne.d.getTime()-activeDate().getTime())/6e4);$('nextEvt').innerHTML='距 '+ne.lab+' <b>'+Math.floor(dm/60)+'h '+pad(dm%60)+'m</b>';}
  else $('nextEvt').textContent='今日光线阶段已结束';
  // shadow
  let shTxt;if(alt>0.3){const len=S.height/Math.tan(p.alt);shTxt=(len>999?(len/1000).toFixed(1)+' km':Math.round(len)+' m')+' → '+Math.round((sunAz+180)%360)+'° '+compassPt((sunAz+180)%360);}else shTxt='地平线下 · 无影';
  $('shadowInfo').textContent=shTxt;
  const up=alt>-.833;
  $('readout').innerHTML=`
    <div class="ro" style="--l:#fff"><div class="k">此刻太阳方位</div><div class="v">${up?Math.round(sunAz)+'°':'—'} <small>${up?compassPt(sunAz):'地平线下'}</small></div></div>
    <div class="ro" style="--l:var(--gold)"><div class="k">太阳高度</div><div class="v">${alt.toFixed(1)}°</div></div>
    <div class="ro" style="--l:var(--gold)"><div class="k">日出 · 方位</div><div class="v">${fmt(t.sunrise)} <small>${Math.round(srAz)}° ${compassPt(srAz)}</small></div></div>
    <div class="ro" style="--l:var(--rose)"><div class="k">日落 · 方位</div><div class="v">${fmt(t.sunset)} <small>${Math.round(ssAz)}° ${compassPt(ssAz)}</small></div></div>
    <div class="ro" style="--l:var(--blue)"><div class="k">蓝调 晨/暮</div><div class="v" style="font-size:13.5px">${fmt(t.dawn)}–${fmt(t.sunrise)}<br>${fmt(t.sunset)}–${fmt(t.dusk)}</div></div>
    <div class="ro" style="--l:var(--gold-soft)"><div class="k">黄金 晨/暮</div><div class="v" style="font-size:13.5px">${fmt(t.sunrise)}–${fmt(t.ghEnd)}<br>${fmt(t.gh)}–${fmt(t.sunset)}</div></div>`;
  renderJumps(t);
  drawCompass(t,srAz,ssAz,sunAz,alt);
  drawSky(t);
  drawOverlays();
  saveHash();
}
function renderJumps(t){
  const J=[['日出',t.sunrise,'#F0B24A'],['晨黄金',t.ghEnd,'#E8A33D'],['晨蓝调',t.dawn,'#5B8FD6'],['正午',t.solarNoon,'#7fa8dd'],['暮黄金',t.gh,'#E8A33D'],['暮蓝调',t.dusk,'#5B8FD6'],['日落',t.sunset,'#D98C7A']];
  $('jumps').innerHTML=J.map((j,i)=>j[1]&&!isNaN(j[1])?`<button class="chip" data-m="${mmOf(j[1])}"><i style="background:${j[2]}"></i>${j[0]} ${fmt(j[1])}</button>`:'').join('');
  $('jumps').querySelectorAll('.chip').forEach(c=>c.onclick=()=>{stopModes();S.minutes=+c.dataset.m;renderAll();});
}
function drawCompass(t,srAz,ssAz,sunAz,alt){
  const cx=180,cy=180,R=140,pt=(b,r)=>[cx+r*Math.sin(b*rad),cy-r*Math.cos(b*rad)];
  let s=`<defs><radialGradient id="f" cx="50%" cy="42%" r="70%"><stop offset="0%" stop-color="#1a2450"/><stop offset="100%" stop-color="#0c1230"/></radialGradient>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F0B24A"/><stop offset="50%" stop-color="#fff6e0"/><stop offset="100%" stop-color="#D98C7A"/></linearGradient></defs>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${R+18}" fill="url(#f)" stroke="#293567"/>`;
  [.25,.5,.75].forEach(f=>s+=`<circle cx="${cx}" cy="${cy}" r="${R*(1-f)}" fill="none" stroke="#243057" stroke-dasharray="2 4"/>`);
  s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#3a478a" stroke-width="1.5"/>`;
  const card={0:'N',90:'E',180:'S',270:'W'};
  for(let d=0;d<360;d+=15){const[x1,y1]=pt(d,R),[x2,y2]=pt(d,d%90===0?R-14:R-7);
    s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${d%90===0?'#5a68a8':'#33407a'}" stroke-width="${d%90===0?2:1}"/>`;
    if(card[d]){const[lx,ly]=pt(d,R+11);s+=`<text x="${lx}" y="${ly}" fill="${d===0?'#F0B24A':'#9aa4cc'}" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="central">${card[d]}</text>`;}}
  let path='',first=true;
  for(let m=0;m<=1440;m+=6){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const q=getPos(d,S.lat,S.lng),a=altDeg(q.alt);if(a<-1)continue;
    const[x,y]=pt(azDeg(q.az),R*Math.max(0,(90-Math.max(a,0))/90));path+=(first?'M':'L')+x.toFixed(1)+' '+y.toFixed(1)+' ';first=false;}
  if(path)s+=`<path d="${path}" fill="none" stroke="url(#a)" stroke-width="3" stroke-linecap="round" opacity=".9"/>`;
  const mk=(az,c)=>{const[x,y]=pt(az,R);return`<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="#0c1230" stroke-width="2"/>`;};
  s+=mk(srAz,'#F0B24A')+mk(ssAz,'#D98C7A');
  if(alt>-.833){const sb=(sunAz+180)%360,[sx,sy]=pt(sb,R);
    s+=`<line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="#5B8FD6" stroke-width="3" opacity=".7"/><circle cx="${sx}" cy="${sy}" r="4" fill="#5B8FD6"/>`;
    const r=R*Math.max(0,(90-Math.max(alt,0))/90),[x,y]=pt(sunAz,r);
    s+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#fff" stroke-width="1" opacity=".35"/><circle cx="${x}" cy="${y}" r="8" fill="#fff"/><circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#fff" stroke-width="1.5" opacity=".5"/>`;}
  s+=`<circle cx="${cx}" cy="${cy}" r="3" fill="#5a68a8"/>`;
  $('compass').innerHTML=s;
}
function drawSky(t){
  const W=560,H=300,pL=40,pR=16,pT=14,pB=26,gw=W-pL-pR,gh=H-pT-pB;
  const noonAlt=altDeg(getPos(t.solarNoon,S.lat,S.lng).alt),aMax=Math.max(20,Math.ceil((noonAlt+5)/10)*10),aMin=-24;
  const x=m=>pL+gw*m/1440,y=a=>pT+gh*(aMax-a)/(aMax-aMin);
  let s='';[[-90,-18,'#0B1a3f'],[-18,-6,'#243a6e'],[-6,0,'#3f63a8'],[0,6,'#e8a33d'],[6,90,'#7fa8dd']].forEach(b=>{const y1=y(Math.min(b[1],aMax)),y2=y(Math.max(b[0],aMin));if(y2>y1)s+=`<rect x="${pL}" y="${y1}" width="${gw}" height="${y2-y1}" fill="${b[2]}" opacity=".42"/>`;});
  s+=`<line x1="${pL}" y1="${y(0)}" x2="${W-pR}" y2="${y(0)}" stroke="#7a86bd" stroke-dasharray="5 4"/><text x="${pL-5}" y="${y(0)}" fill="#9aa4cc" font-size="10" font-family="JetBrains Mono" text-anchor="end" dominant-baseline="central">0°</text>`;
  for(let a=Math.ceil(aMin/10)*10;a<=aMax;a+=10){if(!a)continue;s+=`<text x="${pL-5}" y="${y(a)}" fill="#5C6690" font-size="9" font-family="JetBrains Mono" text-anchor="end" dominant-baseline="central">${a}°</text>`;}
  for(let h=0;h<=24;h+=4){const xx=x(h*60);s+=`<line x1="${xx}" y1="${pT}" x2="${xx}" y2="${H-pB}" stroke="#263258" opacity=".4"/><text x="${xx}" y="${H-pB+15}" fill="#5C6690" font-size="9.5" font-family="JetBrains Mono" text-anchor="middle">${pad(h)}</text>`;}
  let c='';for(let m=0;m<=1440;m+=4){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const a=altDeg(getPos(d,S.lat,S.lng).alt);c+=(m===0?'M':'L')+x(m).toFixed(1)+' '+y(Math.max(aMin,Math.min(aMax,a))).toFixed(1)+' ';}
  s+=`<path d="${c}" fill="none" stroke="#F0B24A" stroke-width="2.5"/>`;
  const ev=(d,col,lab)=>{if(!d||isNaN(d))return'';const xx=x(mmOf(d));return`<circle cx="${xx}" cy="${y(0)}" r="4" fill="${col}"/><text x="${xx}" y="${pT+9}" fill="${col}" font-size="10" font-weight="600" text-anchor="middle">${lab}</text>`;};
  s+=ev(t.sunrise,'#F0B24A','日出')+ev(t.sunset,'#D98C7A','日落');
  const xx=x(S.minutes),ya=y(Math.max(aMin,Math.min(aMax,altDeg(getPos(activeDate(),S.lat,S.lng).alt))));
  s+=`<line x1="${xx}" y1="${pT}" x2="${xx}" y2="${H-pB}" stroke="#fff" stroke-width="1.5" opacity=".8"/><circle cx="${xx}" cy="${ya}" r="5" fill="#fff"/>`;
  $('skyarc').innerHTML=s;
}

/* ===== 交互 ===== */
let playT,liveT;
function stopModes(){S.mode='idle';clearInterval(playT);clearInterval(liveT);$('playBtn').classList.remove('on');$('playBtn').textContent='▶ 播放';$('liveBtn').classList.remove('on');}
$('tslider').addEventListener('input',e=>{stopModes();S.minutes=+e.target.value;renderAll();});
$('prevDay').onclick=()=>{S.date=new Date(S.date.getTime()-dayMs);renderAll();};
$('nextDay').onclick=()=>{S.date=new Date(S.date.getTime()+dayMs);renderAll();};
$('datePick').onchange=e=>{const[y,m,d]=e.target.value.split('-').map(Number);S.date=new Date(y,m-1,d);renderAll();};
$('hslider').addEventListener('input',e=>{S.height=+e.target.value;$('hval').textContent=S.height+' m';renderAll();});
$('playBtn').onclick=()=>{if(S.mode==='play'){stopModes();return;}stopModes();S.mode='play';$('playBtn').classList.add('on');$('playBtn').textContent='⏸ 暂停';playT=setInterval(()=>{S.minutes=(S.minutes+3)%1440;renderAll();},60);};
$('liveBtn').onclick=()=>{if(S.mode==='live'){stopModes();return;}stopModes();S.mode='live';$('liveBtn').classList.add('on');const tick=()=>{const n=new Date();S.date=new Date();S.minutes=n.getHours()*60+n.getMinutes();renderAll();};tick();liveT=setInterval(tick,1000);};
$('geoBtn').onclick=()=>{if(!navigator.geolocation){toast('此浏览器不支持定位');return;}toast('定位中…');navigator.geolocation.getCurrentPosition(p=>{setPoint(p.coords.latitude,p.coords.longitude,true);toast('已定位');},e=>toast(e.code===1?'定位权限被拒绝':'定位失败，请重试'),{enableHighAccuracy:true,timeout:8000});};
$('coordBtn').onclick=()=>{const inp=prompt('输入 纬度,经度：',S.lat.toFixed(4)+','+S.lng.toFixed(4));if(!inp)return;const[la,ln]=inp.split(',').map(x=>parseFloat(x.trim()));if(!isNaN(la)&&!isNaN(ln))setPoint(la,ln,true);else toast('格式无效');};
async function doSearch(){const q=$('q').value.trim();if(!q)return;$('searchBtn').textContent='…';
  try{const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q),{headers:{'Accept':'application/json'}});const j=await r.json();if(j&&j[0]){setPoint(+j[0].lat,+j[0].lon,true);toast('已定位到 '+(j[0].display_name||'').split(',')[0]);}else toast('未找到该地点');}
  catch(e){toast('搜索不可用（需线上环境）');}finally{$('searchBtn').textContent='搜索';}}
$('searchBtn').onclick=doSearch;$('q').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
$('shareBtn').onclick=async()=>{saveHash();const url=location.href;try{if(navigator.share){await navigator.share({title:'SunPath 机位',url});}else{await navigator.clipboard.writeText(url);toast('链接已复制');}}catch(e){toast('链接：'+url);}};
function toast(m){const el=$('toast');el.textContent=m;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2200);}

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));b.classList.add('on');const v=b.dataset.view;$('mapView').classList.toggle('hidden',v!=='map');$('arView').classList.toggle('hidden',v!=='ar');if(v==='map'){renderAll();if(mapOK)setTimeout(()=>map.invalidateSize(),80);}else onArShown();});

/* ===== AR ===== */
let arActive=false,arLock=false,arPlayT=null;
let arYaw=null,arPitch=0,headOff=0,pitchOff=0,absSeen=false;
const AR_VBIAS=0.12; // AR 叠加整体下移比例：把水平线/准星压低，上方给太阳留更多天空
const arMsg=m=>{const el=$('armsg');el.textContent=m||'';el.style.display=m?'block':'none';};

/* 由 alpha/beta/gamma 求相机(后置)光轴的方位角(yaw)与俯仰角(pitch)。
   用完整旋转矩阵推导，跨手机姿态都成立。 */
function cameraDir(a,b,g){
  const A=a*rad,B=b*rad,G=g*rad;
  const cA=Math.cos(A),sA=Math.sin(A),cB=Math.cos(B),sB=Math.sin(B),cG=Math.cos(G),sG=Math.sin(G);
  const fx=-(cA*sG+cG*sA*sB),fy=-(sA*sG-cA*cG*sB),fz=-(cB*cG); // 相机前向在世界系(x东 y北 z上)
  const yaw=(Math.atan2(fx,fy)/rad+360)%360;
  const pitch=Math.asin(Math.max(-1,Math.min(1,fz)))/rad;
  return{yaw,pitch};
}
/* 自适应指数平滑：静止时用极小系数并对亚度级噪声加死区（几乎不抖），
   快速转动时系数自动放大（依然跟手）。wrap=true 时按角度环绕处理。 */
function smoothStep(prev,target,wrap){
  let d=target-prev;if(wrap)d=((d+540)%360)-180;
  const ad=Math.abs(d);
  const a=ad<0.6?0.02:Math.min(0.4,0.05+ad*0.02); // 死区 + 自适应系数
  let v=prev+d*a;if(wrap)v=(v+360)%360;
  return v;
}
function onOrient(ev){
  if(ev.alpha==null&&ev.beta==null&&ev.gamma==null)return;
  if(ev.type==='deviceorientationabsolute')absSeen=true;
  else if(absSeen)return; // 已有绝对方位来源，忽略相对事件，避免两路数据打架加剧抖动
  if(arLock)return;
  const cd=cameraDir(ev.alpha||0,ev.beta||0,ev.gamma||0);
  if(arYaw==null){arYaw=cd.yaw;arPitch=cd.pitch;}
  else{arYaw=smoothStep(arYaw,cd.yaw,true);arPitch=smoothStep(arPitch,cd.pitch,false);}
  setARMapRotation();
}
$('arStartBtn').onclick=async()=>{
  arMsg('请求相机…');
  try{const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});$('arvid').srcObject=st;await $('arvid').play();}
  catch(err){arMsg('无法访问相机（'+err.name+'）。需手机浏览器 + HTTPS 并授权相机。方位图与时间轴无需相机，可直接使用。');return;}
  try{if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')arMsg('未授权方向传感器；请用「校准」对准太阳修正方位。');}}catch(e){}
  window.addEventListener('deviceorientationabsolute',onOrient,true);
  window.addEventListener('deviceorientation',onOrient,true);
  $('arStartBtn').style.display='none';$('arhud').style.display='block';arMsg('');arActive=true;drawAR();
};
function drawAR(){
  if(!arActive)return;
  const cv=$('arcanvas'),v=$('arvid'),w=v.videoWidth||cv.clientWidth||360,h=v.videoHeight||cv.clientHeight||640;
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
  const yaw=arYaw==null?0:arYaw,pitch=arPitch,hFov=64,vFov=hFov*cv.height/cv.width;
  const vc=cv.height*(0.5+AR_VBIAS); // 视觉中心整体下移：水平线更低，上方留白给天空/太阳轨迹
  const proj=(az,alt)=>{let dA=((az-headOff-yaw+540)%360)-180,dV=(alt-pitchOff)-pitch;if(Math.abs(dA)>hFov*.78)return null;return[cv.width/2+(dA/(hFov/2))*(cv.width/2),vc-(dV/(vFov/2))*(cv.height/2)];};
  // 地平线 + 方位
  const y0=vc-(((0-pitchOff)-pitch)/(vFov/2))*(cv.height/2);
  ctx.strokeStyle='rgba(122,134,189,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,y0);ctx.lineTo(cv.width,y0);ctx.stroke();
  ctx.font='700 16px Space Grotesk';ctx.textAlign='center';
  [['N',0,'#F0B24A'],['NE',45,'#9aa4cc'],['E',90,'#9aa4cc'],['SE',135,'#9aa4cc'],['S',180,'#9aa4cc'],['SW',225,'#9aa4cc'],['W',270,'#9aa4cc'],['NW',315,'#9aa4cc']].forEach(([lb,az,c])=>{const pr=proj(az,0);if(pr){ctx.fillStyle=c;ctx.fillText(lb,pr[0],y0+24);ctx.fillRect(pr[0]-1,y0-5,2,10);}});
  // 太阳全天轨迹
  ctx.lineWidth=3;ctx.strokeStyle='rgba(240,178,74,.9)';ctx.beginPath();let started=false;
  for(let m=0;m<=1440;m+=6){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const q=getPos(d,S.lat,S.lng);if(altDeg(q.alt)<-3)continue;const pr=proj(azDeg(q.az),altDeg(q.alt));if(!pr){started=false;continue;}if(!started){ctx.moveTo(pr[0],pr[1]);started=true;}else ctx.lineTo(pr[0],pr[1]);}
  ctx.stroke();
  // 整点刻度
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='11px JetBrains Mono';
  for(let hh=4;hh<=21;hh++){const d=new Date(S.date);d.setHours(hh,0,0,0);const q=getPos(d,S.lat,S.lng);if(altDeg(q.alt)<-1)continue;const pr=proj(azDeg(q.az),altDeg(q.alt));if(pr){ctx.beginPath();ctx.arc(pr[0],pr[1],2.5,0,7);ctx.fill();if(hh%2===0)ctx.fillText(pad(hh)+':00',pr[0],pr[1]-8);}}
  // 当前太阳（随时间轴移动）
  const p=getPos(activeDate(),S.lat,S.lng),sunAz=azDeg(p.az),alt=altDeg(p.alt);
  if(alt>-3){const pr=proj(sunAz,alt);if(pr){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(pr[0],pr[1],15,0,7);ctx.fill();ctx.strokeStyle='rgba(240,178,74,.9)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(pr[0],pr[1],24,0,7);ctx.stroke();}}
  // 中心校准准星
  ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cv.width/2,vc,10,0,7);ctx.moveTo(cv.width/2-16,vc);ctx.lineTo(cv.width/2+16,vc);ctx.moveTo(cv.width/2,vc-16);ctx.lineTo(cv.width/2,vc+16);ctx.stroke();
  $('arhud').innerHTML=`相机朝向 ${Math.round(yaw)}° · 仰角 ${pitch.toFixed(0)}°${arLock?' · 🔒锁定':''}<br>太阳 ${Math.round(sunAz)}° / ${alt.toFixed(0)}°`;
  requestAnimationFrame(drawAR);
}
/* 底部信息面板（纯计算，不依赖传感器，始终准确） */
function drawARInfo(){
  const t=getTimes(activeDate(),S.lat,S.lng);
  const p=getPos(activeDate(),S.lat,S.lng),sunAz=azDeg(p.az),alt=altDeg(p.alt);
  const up=alt>-.833,ph=phaseOf(alt);
  $('arplaninfo').innerHTML=`
    <div class="pl"><span>太阳方位</span><b>${up?Math.round(sunAz)+'° '+compassPt(sunAz):'地平线下'}</b></div>
    <div class="pl"><span>太阳高度</span><b>${alt.toFixed(1)}°</b></div>
    <div class="pl"><span>影子方向</span><b>${up&&alt>.3?Math.round((sunAz+180)%360)+'° '+compassPt((sunAz+180)%360):'—'}</b></div>
    <div class="pl"><span>光线阶段</span><b style="color:${ph.c}">${ph.n}</b></div>
    <div class="pl"><span>日出/日落</span><b>${fmt(t.sunrise)} · ${fmt(t.sunset)}</b></div>`;
}
/* 底部小地图：随手机朝向旋转（正上方＝手机正对的方向），叠加太阳/日出日落/影子方向。
   容器旋转 -yaw，地图 div 做成超尺寸并居中，任意角度都盖满四角。 */
let armap=null,armReady=false,armLines={},armSun=null,armN=null;
function initARMap(){
  if(armap||typeof L==='undefined')return;
  try{
    armap=L.map('armap',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,tap:false,inertia:false,fadeAnimation:false,zoomAnimation:false}).setView([S.lat,S.lng],16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(armap);
    armLines.sunrise=L.polyline([],{color:'#F0B24A',weight:2,dashArray:'3 4',opacity:.85,interactive:false}).addTo(armap);
    armLines.sunset=L.polyline([],{color:'#D98C7A',weight:2,dashArray:'3 4',opacity:.85,interactive:false}).addTo(armap);
    armLines.shadow=L.polyline([],{color:'#5B8FD6',weight:5,opacity:.7,lineCap:'round',interactive:false}).addTo(armap);
    armLines.sun=L.polyline([],{color:'#fff',weight:3,opacity:.95,interactive:false}).addTo(armap);
    armN=L.marker([S.lat,S.lng],{icon:L.divIcon({className:'',html:'<div class="armini-n">N</div>',iconSize:[16,16],iconAnchor:[8,8]}),interactive:false}).addTo(armap);
    armSun=L.marker([S.lat,S.lng],{icon:L.divIcon({className:'',html:'<div class="arsun"></div>',iconSize:[18,18],iconAnchor:[9,9]}),interactive:false}).addTo(armap);
    armReady=true;
  }catch(e){}
}
function drawARMap(){
  if(!armReady)return;
  armap.setView([S.lat,S.lng],armap.getZoom(),{animate:false});
  const t=getTimes(activeDate(),S.lat,S.lng);
  const srAz=azDeg(getPos(t.sunrise,S.lat,S.lng).az),ssAz=azDeg(getPos(t.sunset,S.lat,S.lng).az);
  const p=getPos(activeDate(),S.lat,S.lng),sunAz=azDeg(p.az),alt=altDeg(p.alt),D=130;
  armLines.sunrise.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,srAz,D)]);
  armLines.sunset.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,ssAz,D)]);
  armN.setLatLng(dest(S.lat,S.lng,0,D*.92));
  const sunEl=armSun.getElement();
  if(alt>-.833){
    armLines.sun.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,sunAz,D)]);
    armSun.setLatLng(dest(S.lat,S.lng,sunAz,D));if(sunEl)sunEl.style.display='';
    const shLen=Math.min(alt>0.5?S.height/Math.tan(p.alt):120,D);
    armLines.shadow.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,(sunAz+180)%360,Math.max(25,shLen))]);
  }else{
    armLines.sun.setLatLngs([]);armLines.shadow.setLatLngs([]);if(sunEl)sunEl.style.display='none';
  }
}
/* 把手机朝向 yaw 反向旋到容器上，实现「正上方＝正对方向」 */
function setARMapRotation(){
  const el=$('armap');if(!el)return;
  const yaw=arYaw==null?0:arYaw;
  el.style.transform=`translate(-50%,-50%) rotate(${(-yaw).toFixed(1)}deg)`;
}
function renderAR(){
  $('artlabel').textContent=pad(Math.floor(S.minutes/60))+':'+pad(S.minutes%60);
  $('artslider').value=S.minutes;
  drawARInfo();drawARMap();
}
function stopAR(){clearInterval(arPlayT);arPlayT=null;$('arPlay').classList.remove('on');$('arPlay').textContent='▶';}
$('artslider').addEventListener('input',e=>{stopAR();S.minutes=+e.target.value;renderAR();});
$('arPlay').onclick=()=>{if(arPlayT){stopAR();return;}$('arPlay').classList.add('on');$('arPlay').textContent='⏸';arPlayT=setInterval(()=>{S.minutes=(S.minutes+3)%1440;renderAR();},60);};
$('arNow').onclick=()=>{stopAR();const n=new Date();S.date=new Date();S.minutes=n.getHours()*60+n.getMinutes();renderAR();toast('已回到当前时刻');};
$('arLock').onclick=()=>{arLock=!arLock;$('arLock').classList.toggle('on',arLock);$('arLock').textContent=arLock?'🔒 已锁定':'🔓 锁定方向';toast(arLock?'方向已锁定：现在拖时间轴看太阳沿轨迹移动':'方向已解锁：跟随手机转动');};
$('arCalib').onclick=()=>{if(!arActive){toast('先开启相机再校准');return;}
  const p=getPos(new Date(),S.lat,S.lng),alt=altDeg(p.alt); // 始终用真实此刻的太阳，与时间轴无关
  if(alt<-2){toast('太阳在地平线下，此刻无法用太阳校准');return;}
  headOff=(azDeg(p.az)-(arYaw||0));pitchOff=(alt-arPitch);toast('已按此刻真实太阳位置校准');};
function onArShown(){initARMap();renderAR();setARMapRotation();if(armReady)setTimeout(()=>{armap.invalidateSize();armap.setView([S.lat,S.lng],armap.getZoom(),{animate:false});},120);}

/* ===== 启动 ===== */
loadHash();initMap();renderAll();
