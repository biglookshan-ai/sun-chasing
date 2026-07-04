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

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));b.classList.add('on');const v=b.dataset.view;$('mapView').classList.toggle('hidden',v!=='map');$('arView').classList.toggle('hidden',v!=='ar');if(v==='map'&&mapOK)setTimeout(()=>map.invalidateSize(),80);});

/* ===== AR ===== */
let arActive=false,heading=0,camAlt=0,hSmooth=null;
const arMsg=m=>{const el=$('armsg');el.textContent=m||'';el.style.display=m?'block':'none';};
const scrAngle=()=>{try{return(screen.orientation&&screen.orientation.angle)||window.orientation||0;}catch(e){return 0;}};
function onOrient(ev){
  let h=ev.webkitCompassHeading!=null?ev.webkitCompassHeading:(ev.alpha!=null?(360-ev.alpha):null);
  if(h!=null){h=(h+scrAngle())%360;if(hSmooth==null)hSmooth=h;else{let d=((h-hSmooth+540)%360)-180;hSmooth=(hSmooth+d*0.25+360)%360;}heading=hSmooth;}
  if(ev.beta!=null)camAlt=ev.beta-90;
}
$('arStartBtn').onclick=async()=>{
  arMsg('请求相机…');
  try{const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});$('arvid').srcObject=st;await $('arvid').play();}
  catch(err){arMsg('无法访问相机（'+err.name+'）。需手机浏览器 + HTTPS 并授权相机。');return;}
  try{if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')arMsg('未授权方向传感器，方位可能不准。');}}catch(e){}
  window.addEventListener('deviceorientation',onOrient,true);
  $('arstart').style.display='none';$('arhud').style.display='block';arActive=true;drawAR();
};
function drawAR(){
  if(!arActive)return;
  const cv=$('arcanvas'),v=$('arvid');cv.width=v.videoWidth||cv.clientWidth||360;cv.height=v.videoHeight||cv.clientHeight||640;
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
  const hFov=62,vFov=hFov*cv.height/cv.width;
  const proj=(az,alt)=>{let dA=((az-heading+540)%360)-180,dV=alt-camAlt;if(Math.abs(dA)>hFov*.72)return null;return[cv.width/2+(dA/(hFov/2))*(cv.width/2),cv.height/2-(dV/(vFov/2))*(cv.height/2)];};
  // horizon + cardinals
  ctx.strokeStyle='rgba(122,134,189,.5)';ctx.lineWidth=1.5;ctx.beginPath();
  {const a=proj(heading-30,0),b=proj(heading+30,0);const y0=cv.height/2-((0-camAlt)/(vFov/2))*(cv.height/2);ctx.moveTo(0,y0);ctx.lineTo(cv.width,y0);ctx.stroke();
   ctx.fillStyle='rgba(154,164,204,.9)';ctx.font='600 15px Space Grotesk';ctx.textAlign='center';
   [['N',0],['E',90],['S',180],['W',270]].forEach(([lb,az])=>{const pr=proj(az,0);if(pr)ctx.fillText(lb,pr[0],y0+22);});}
  // sun path with time ticks
  ctx.lineWidth=3;ctx.strokeStyle='rgba(240,178,74,.9)';ctx.beginPath();let started=false;
  for(let m=0;m<=1440;m+=6){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const q=getPos(d,S.lat,S.lng);if(altDeg(q.alt)<-2)continue;const pr=proj(azDeg(q.az),altDeg(q.alt));if(!pr){started=false;continue;}if(!started){ctx.moveTo(pr[0],pr[1]);started=true;}else ctx.lineTo(pr[0],pr[1]);}
  ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='11px JetBrains Mono';ctx.textAlign='center';
  for(let h=4;h<=20;h+=2){const d=new Date(S.date);d.setHours(h,0,0,0);const q=getPos(d,S.lat,S.lng);if(altDeg(q.alt)<0)continue;const pr=proj(azDeg(q.az),altDeg(q.alt));if(pr){ctx.beginPath();ctx.arc(pr[0],pr[1],3,0,7);ctx.fill();ctx.fillText(pad(h)+':00',pr[0],pr[1]-8);}}
  // current sun
  const p=getPos(activeDate(),S.lat,S.lng);if(altDeg(p.alt)>-2){const pr=proj(azDeg(p.az),altDeg(p.alt));if(pr){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(pr[0],pr[1],15,0,7);ctx.fill();ctx.strokeStyle='rgba(240,178,74,.85)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(pr[0],pr[1],24,0,7);ctx.stroke();}}
  $('arhud').innerHTML=`罗盘 ${Math.round(heading)}° · 仰角 ${camAlt.toFixed(0)}°<br>太阳 ${Math.round(azDeg(p.az))}° / ${altDeg(p.alt).toFixed(0)}°`;
  requestAnimationFrame(drawAR);
}

/* ===== 启动 ===== */
loadHash();initMap();renderAll();
