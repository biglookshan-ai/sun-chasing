/* SunPath v2.0 — 应用逻辑: 状态 / 地图 / 天气 / 罗盘·曲线 / 取景器 / AR / 交互 */
/* ===== 状态 ===== */
const now0=new Date();
const S={lat:51.5074,lng:-0.1278,date:new Date(),minutes:now0.getHours()*60+now0.getMinutes(),height:10,mode:'idle',
  sensor:'ff',focal:50,orient:'land',aimAz:180,aimAlt:12,aimInit:false,lensMode:'idle'};
const $=id=>document.getElementById(id);
function activeDate(){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(S.minutes);return d;}
const mmOf=d=>d.getHours()*60+d.getMinutes();
const sunAzAlt=d=>{const p=getPos(d,S.lat,S.lng);return[azDeg(p.az),altDeg(p.alt),p.alt];};
const moonAzAlt=d=>{const p=getMoonPos(d,S.lat,S.lng);return[azDeg(p.az),altDeg(p.alt),p.alt,p.dist];};

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
    lines.sunrise=L.polyline([],{color:'#FFB020',weight:2,dashArray:'4 5',opacity:.85}).addTo(map);
    lines.sunset=L.polyline([],{color:'#FF8A3D',weight:2,dashArray:'4 5',opacity:.85}).addTo(map);
    lines.moonrise=L.polyline([],{color:'#67E8F9',weight:2,dashArray:'3 5',opacity:.8}).addTo(map);
    lines.moonset=L.polyline([],{color:'#A78BFA',weight:2,dashArray:'3 5',opacity:.8}).addTo(map);
    lines.sun=L.polyline([],{color:'#fff',weight:3,opacity:.9}).addTo(map);
    lines.moon=L.polyline([],{color:'#67E8F9',weight:3,opacity:.85}).addTo(map);
    lines.shadow=L.polyline([],{color:'#5B8FD6',weight:6,opacity:.75,lineCap:'round'}).addTo(map);
    mapOK=true;
  }catch(err){$('mapfail').style.display='grid';}
}
function dispDist(){try{const b=map.getBounds();return map.distance(b.getNorthWest(),b.getSouthEast())*0.16;}catch(e){return 150;}}
function drawOverlays(){
  if(!mapOK)return;
  const t=getTimes(activeDate(),S.lat,S.lng);
  const srAz=azDeg(getPos(t.sunrise,S.lat,S.lng).az),ssAz=azDeg(getPos(t.sunset,S.lat,S.lng).az);
  const[sunAz,alt,altR]=sunAzAlt(activeDate()),[mAz,mAlt]=moonAzAlt(activeDate()),D=dispDist();
  const mt=getMoonTimes(activeDate(),S.lat,S.lng);
  marker.setLatLng([S.lat,S.lng]);
  lines.sunrise.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,srAz,D)]);
  lines.sunset.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,ssAz,D)]);
  lines.moonrise.setLatLngs(mt.rise?[[S.lat,S.lng],dest(S.lat,S.lng,azDeg(getMoonPos(mt.rise,S.lat,S.lng).az),D)]:[]);
  lines.moonset.setLatLngs(mt.set?[[S.lat,S.lng],dest(S.lat,S.lng,azDeg(getMoonPos(mt.set,S.lat,S.lng).az),D)]:[]);
  if(alt>-.5){lines.sun.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,sunAz,D*.9)]);
    const shLen=Math.min(alt>0.5?S.height/Math.tan(altR):5000,4000);
    lines.shadow.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,(sunAz+180)%360,shLen)]);}
  else{lines.sun.setLatLngs([]);lines.shadow.setLatLngs([]);}
  lines.moon.setLatLngs(mAlt>-.5?[[S.lat,S.lng],dest(S.lat,S.lng,mAz,D*.75)]:[]);
}
function setPoint(lat,lng,recenter){S.lat=lat;S.lng=lng;if(mapOK&&recenter)map.setView([lat,lng]);scheduleWeather();renderAll();}

/* ===== 天气 (Open-Meteo) ===== */
let wxData=null,wxCache={},wxTimer=null,lastWxIdx=-2;
function scheduleWeather(){clearTimeout(wxTimer);wxData=null;lastWxIdx=-2;wxTimer=setTimeout(fetchWeather,650);}
async function fetchWeather(){
  const key=S.lat.toFixed(2)+','+S.lng.toFixed(2),bar=$('weatherBar');
  if(wxCache[key]){wxData=wxCache[key];lastWxIdx=-2;renderWeather();return;}
  bar.innerHTML='<div class="wx-load">☁ 天气加载中…</div>';
  try{
    const url='https://api.open-meteo.com/v1/forecast?latitude='+S.lat.toFixed(4)+'&longitude='+S.lng.toFixed(4)+
      '&timezone=auto&past_days=1&forecast_days=7&hourly=temperature_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation_probability,visibility,wind_speed_10m,weather_code';
    const r=await fetch(url);const j=await r.json();if(!j||!j.hourly)throw 0;
    wxData=wxCache[key]=j;lastWxIdx=-2;renderWeather();
  }catch(e){bar.innerHTML='<div class="wx-load" style="animation:none">☁ 天气暂不可用（需线上环境 / 网络）</div>';}
}
function wmo(c){const M={0:['☀','晴'],1:['🌤','大致晴'],2:['⛅','多云'],3:['☁','阴'],45:['🌫','雾'],48:['🌫','雾凇'],51:['🌦','毛毛雨'],53:['🌦','毛毛雨'],55:['🌦','毛毛雨'],56:['🌧','冻雨'],57:['🌧','冻雨'],61:['🌧','小雨'],63:['🌧','中雨'],65:['🌧','大雨'],66:['🌧','冻雨'],67:['🌧','冻雨'],71:['🌨','小雪'],73:['🌨','中雪'],75:['🌨','大雪'],77:['🌨','雪粒'],80:['🌦','阵雨'],81:['🌦','阵雨'],82:['⛈','强阵雨'],85:['🌨','阵雪'],86:['🌨','阵雪'],95:['⛈','雷雨'],96:['⛈','雷雨雹'],99:['⛈','雷雨雹']};return M[c]||['☁','—'];}
function nearestHourIdx(times,when){let best=-1,bd=1e13;for(let i=0;i<times.length;i++){const dd=Math.abs(new Date(times[i]).getTime()-when.getTime());if(dd<bd){bd=dd;best=i;}}return bd>36e5*30?-1:best;}
function shootScore(H,when){
  const i=nearestHourIdx(H.time,when);if(i<0)return null;
  const low=H.cloud_cover_low[i]|0,mid=H.cloud_cover_mid[i]|0,high=H.cloud_cover_high[i]|0,tot=H.cloud_cover[i]|0;
  let cls,txt;
  if(low>70){cls='bad';txt='低云压地平线';}
  else if(low<25&&high>15&&high<85){cls='good';txt='地平线净·高云染色';}
  else if(tot<8){cls='mid';txt='晴空·少染色';}
  else if(low<40){cls='good';txt='大致可拍';}
  else{cls='mid';txt='云况一般';}
  return{cls,txt,low,tot};
}
function renderWeather(){
  if(!wxData)return;const bar=$('weatherBar'),H=wxData.hourly,d=activeDate();
  const i=nearestHourIdx(H.time,d);
  if(i<0){if(lastWxIdx!==-1){bar.innerHTML='<div class="wx-load" style="animation:none">该日期超出天气预报范围（约 ±7 天）</div>';lastWxIdx=-1;}return;}
  if(i===lastWxIdx)return;lastWxIdx=i;
  const[ic,desc]=wmo(H.weather_code[i]);
  const t=getTimes(activeDate(),S.lat,S.lng),sc=shootScore(H,t.sunset);
  const vis=H.visibility[i]!=null?(H.visibility[i]/1000).toFixed(0):'—';
  let html='';
  if(sc)html+=`<div class="wx-score ${sc.cls}"><div class="l">日落可拍性</div><div class="v">${sc.cls==='good'?'✦ 好':sc.cls==='mid'?'◐ 一般':'✕ 较差'} · ${sc.txt}</div></div>`;
  html+=`<div class="wx-item"><div class="l">天气</div><div class="v">${ic} <small>${desc}</small></div></div>`;
  html+=`<div class="wx-item"><div class="l">云量</div><div class="v">${H.cloud_cover[i]|0}<small>% 低${H.cloud_cover_low[i]|0}</small></div></div>`;
  html+=`<div class="wx-item"><div class="l">气温</div><div class="v">${Math.round(H.temperature_2m[i])}<small>°C</small></div></div>`;
  html+=`<div class="wx-item"><div class="l">降水概率</div><div class="v">${H.precipitation_probability[i]|0}<small>%</small></div></div>`;
  html+=`<div class="wx-item"><div class="l">能见度</div><div class="v">${vis}<small>km</small></div></div>`;
  html+=`<div class="wx-item"><div class="l">风速</div><div class="v">${Math.round(H.wind_speed_10m[i])}<small>km/h</small></div></div>`;
  bar.innerHTML=html;
}

/* ===== 光线阶段 + 下一事件 ===== */
function phaseOf(alt){
  if(alt>=6)return{n:'白昼',c:'#7fa8dd'};
  if(alt>=0)return{n:'黄金时刻',c:'#FFB020'};
  if(alt>=-6)return{n:'蓝调时刻',c:'#5B8FD6'};
  if(alt>=-18)return{n:'暮光',c:'#A78BFA'};
  return{n:'夜',c:'#6a76a8'};
}
function nextEvent(t){
  const cur=activeDate().getTime();
  const ev=[['日出',t.sunrise],['正午',t.solarNoon],['日落',t.sunset],['暮蓝调结束',t.dusk],['晨蓝调开始',t.dawn],['黄金晨末',t.ghEnd],['黄金暮始',t.gh]];
  let best=null;for(const[lab,d]of ev){if(d&&!isNaN(d)&&d.getTime()>cur){if(!best||d<best.d)best={lab,d};}}
  return best;
}

/* ===== 渲染 (地图视图) ===== */
function renderAll(){
  const t=getTimes(activeDate(),S.lat,S.lng);
  const[sunAz,alt,altR]=sunAzAlt(activeDate());
  const srAz=azDeg(getPos(t.sunrise,S.lat,S.lng).az),ssAz=azDeg(getPos(t.sunset,S.lat,S.lng).az);
  const[mAz,mAlt]=moonAzAlt(activeDate()),ill=getMoonIllumination(activeDate()),mph=moonPhaseName(ill.phase),mt=getMoonTimes(activeDate(),S.lat,S.lng);
  $('tlabel').textContent=pad(Math.floor(S.minutes/60))+':'+pad(S.minutes%60);
  $('tslider').value=S.minutes;
  $('datePick').value=S.date.getFullYear()+'-'+pad(S.date.getMonth()+1)+'-'+pad(S.date.getDate());
  const ph=phaseOf(alt);$('phaseName').textContent=ph.n;$('phasePill').querySelector('i').style.background=ph.c;
  const ne=nextEvent(t);
  if(ne){const dm=Math.round((ne.d.getTime()-activeDate().getTime())/6e4);$('nextEvt').innerHTML='距 '+ne.lab+' <b>'+Math.floor(dm/60)+'h '+pad(dm%60)+'m</b>';}
  else $('nextEvt').textContent='今日光线阶段已结束';
  let shTxt;if(alt>0.3){const len=S.height/Math.tan(altR);shTxt=(len>999?(len/1000).toFixed(1)+' km':Math.round(len)+' m')+' → '+Math.round((sunAz+180)%360)+'° '+compassPt((sunAz+180)%360);}else shTxt='地平线下 · 无影';
  $('shadowInfo').textContent=shTxt;
  const up=alt>-.833,mUp=mAlt>-.833;
  $('readout').innerHTML=`
    <div class="ro" style="--l:#fff"><div class="k">此刻太阳方位</div><div class="v">${up?Math.round(sunAz)+'°':'—'} <small>${up?compassPt(sunAz):'地平线下'}</small></div></div>
    <div class="ro" style="--l:var(--gold)"><div class="k">太阳高度</div><div class="v">${alt.toFixed(1)}°</div></div>
    <div class="ro" style="--l:var(--moon)"><div class="k">此刻月亮方位</div><div class="v">${mUp?Math.round(mAz)+'°':'—'} <small>${mUp?compassPt(mAz):'地平线下'}</small></div></div>
    <div class="ro" style="--l:var(--moon)"><div class="k">月亮高度</div><div class="v">${mAlt.toFixed(1)}°</div></div>
    <div class="ro" style="--l:var(--violet)"><div class="k">月相 ${mph.icon}</div><div class="v" style="font-size:15px">${mph.name} <small>${Math.round(ill.fraction*100)}%亮</small></div></div>
    <div class="ro" style="--l:var(--moon)"><div class="k">月出 / 月落</div><div class="v" style="font-size:14px">${mt.rise?fmt(mt.rise):(mt.alwaysUp?'整日在上':'—')}<br>${mt.set?fmt(mt.set):(mt.alwaysDown?'整日在下':'—')}</div></div>
    <div class="ro" style="--l:var(--gold)"><div class="k">日出 · 方位</div><div class="v">${fmt(t.sunrise)} <small>${Math.round(srAz)}° ${compassPt(srAz)}</small></div></div>
    <div class="ro" style="--l:var(--rose)"><div class="k">日落 · 方位</div><div class="v">${fmt(t.sunset)} <small>${Math.round(ssAz)}° ${compassPt(ssAz)}</small></div></div>
    <div class="ro" style="--l:var(--blue)"><div class="k">蓝调 晨/暮</div><div class="v" style="font-size:13.5px">${fmt(t.dawn)}–${fmt(t.sunrise)}<br>${fmt(t.sunset)}–${fmt(t.dusk)}</div></div>
    <div class="ro" style="--l:var(--gold-soft)"><div class="k">黄金 晨/暮</div><div class="v" style="font-size:13.5px">${fmt(t.sunrise)}–${fmt(t.ghEnd)}<br>${fmt(t.gh)}–${fmt(t.sunset)}</div></div>`;
  renderJumps(t);
  drawCompass(t,srAz,ssAz,sunAz,alt,mAz,mAlt);
  drawSky(t);
  drawOverlays();
  renderWeather();
  saveHash();
}
function renderJumps(t){
  const J=[['日出',t.sunrise,'#FFB020'],['晨黄金',t.ghEnd,'#F0A93A'],['晨蓝调',t.dawn,'#5B8FD6'],['正午',t.solarNoon,'#7fa8dd'],['暮黄金',t.gh,'#F0A93A'],['暮蓝调',t.dusk,'#5B8FD6'],['日落',t.sunset,'#FF8A3D']];
  $('jumps').innerHTML=J.map((j,i)=>j[1]&&!isNaN(j[1])?`<button class="chip" data-m="${mmOf(j[1])}"><i style="background:${j[2]};color:${j[2]}"></i>${j[0]} ${fmt(j[1])}</button>`:'').join('');
  $('jumps').querySelectorAll('.chip').forEach(c=>c.onclick=()=>{stopModes();S.minutes=+c.dataset.m;renderAll();});
}
function drawCompass(t,srAz,ssAz,sunAz,alt,mAz,mAlt){
  const cx=180,cy=180,R=140,pt=(b,r)=>[cx+r*Math.sin(b*rad),cy-r*Math.cos(b*rad)];
  let s=`<defs><radialGradient id="cf" cx="50%" cy="42%" r="70%"><stop offset="0%" stop-color="#141c3c"/><stop offset="100%" stop-color="#070b16"/></radialGradient>
    <linearGradient id="ca" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FFB020"/><stop offset="50%" stop-color="#fff6e0"/><stop offset="100%" stop-color="#FF8A3D"/></linearGradient></defs>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${R+18}" fill="url(#cf)" stroke="#232c54"/>`;
  [.25,.5,.75].forEach(f=>s+=`<circle cx="${cx}" cy="${cy}" r="${R*(1-f)}" fill="none" stroke="#1e2848" stroke-dasharray="2 4"/>`);
  s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#33407a" stroke-width="1.5"/>`;
  const card={0:'N',90:'E',180:'S',270:'W'};
  for(let d=0;d<360;d+=15){const[x1,y1]=pt(d,R),[x2,y2]=pt(d,d%90===0?R-14:R-7);
    s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${d%90===0?'#5a68a8':'#2b3768'}" stroke-width="${d%90===0?2:1}"/>`;
    if(card[d]){const[lx,ly]=pt(d,R+11);s+=`<text x="${lx}" y="${ly}" fill="${d===0?'#FFB020':'#9aa4cc'}" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="central">${card[d]}</text>`;}}
  // 太阳全天轨迹
  let path='',first=true;
  for(let m=0;m<=1440;m+=6){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const[az,a]=sunAzAlt(d);if(a<-1)continue;
    const[x,y]=pt(az,R*Math.max(0,(90-Math.max(a,0))/90));path+=(first?'M':'L')+x.toFixed(1)+' '+y.toFixed(1)+' ';first=false;}
  if(path)s+=`<path d="${path}" fill="none" stroke="url(#ca)" stroke-width="3" stroke-linecap="round" opacity=".9"/>`;
  // 月亮全天轨迹
  let mpath='',mf=true;
  for(let m=0;m<=1440;m+=6){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const[az,a]=moonAzAlt(d);if(a<-1){mf=true;continue;}
    const[x,y]=pt(az,R*Math.max(0,(90-Math.max(a,0))/90));mpath+=(mf?'M':'L')+x.toFixed(1)+' '+y.toFixed(1)+' ';mf=false;}
  if(mpath)s+=`<path d="${mpath}" fill="none" stroke="#67E8F9" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" opacity=".8"/>`;
  const mk=(az,c)=>{const[x,y]=pt(az,R);return`<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="#070b16" stroke-width="2"/>`;};
  s+=mk(srAz,'#FFB020')+mk(ssAz,'#FF8A3D');
  if(alt>-.833){const sb=(sunAz+180)%360,[sx,sy]=pt(sb,R);
    s+=`<line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="#5B8FD6" stroke-width="3" opacity=".7"/><circle cx="${sx}" cy="${sy}" r="4" fill="#5B8FD6"/>`;
    const r=R*Math.max(0,(90-Math.max(alt,0))/90),[x,y]=pt(sunAz,r);
    s+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#fff" stroke-width="1" opacity=".35"/><circle cx="${x}" cy="${y}" r="8" fill="#fff"/><circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#fff" stroke-width="1.5" opacity=".5"/>`;}
  if(mAlt>-.833){const r=R*Math.max(0,(90-Math.max(mAlt,0))/90),[x,y]=pt(mAz,r);
    s+=`<circle cx="${x}" cy="${y}" r="6.5" fill="#67E8F9"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#67E8F9" stroke-width="1.3" opacity=".5"/>`;}
  s+=`<circle cx="${cx}" cy="${cy}" r="3" fill="#5a68a8"/>`;
  $('compass').innerHTML=s;
}
function drawSky(t){
  const W=560,H=300,pL=40,pR=16,pT=14,pB=26,gw=W-pL-pR,gh=H-pT-pB;
  const noonAlt=altDeg(getPos(t.solarNoon,S.lat,S.lng).alt),aMax=Math.max(20,Math.ceil((noonAlt+5)/10)*10),aMin=-24;
  const x=m=>pL+gw*m/1440,y=a=>pT+gh*(aMax-a)/(aMax-aMin);
  let s='';[[-90,-18,'#0B1a3f'],[-18,-6,'#243a6e'],[-6,0,'#3f63a8'],[0,6,'#e8a33d'],[6,90,'#7fa8dd']].forEach(b=>{const y1=y(Math.min(b[1],aMax)),y2=y(Math.max(b[0],aMin));if(y2>y1)s+=`<rect x="${pL}" y="${y1}" width="${gw}" height="${y2-y1}" fill="${b[2]}" opacity=".38"/>`;});
  s+=`<line x1="${pL}" y1="${y(0)}" x2="${W-pR}" y2="${y(0)}" stroke="#7a86bd" stroke-dasharray="5 4"/><text x="${pL-5}" y="${y(0)}" fill="#9aa4cc" font-size="10" font-family="JetBrains Mono" text-anchor="end" dominant-baseline="central">0°</text>`;
  for(let a=Math.ceil(aMin/10)*10;a<=aMax;a+=10){if(!a)continue;s+=`<text x="${pL-5}" y="${y(a)}" fill="#5C6690" font-size="9" font-family="JetBrains Mono" text-anchor="end" dominant-baseline="central">${a}°</text>`;}
  for(let h=0;h<=24;h+=4){const xx=x(h*60);s+=`<line x1="${xx}" y1="${pT}" x2="${xx}" y2="${H-pB}" stroke="#263258" opacity=".4"/><text x="${xx}" y="${H-pB+15}" fill="#5C6690" font-size="9.5" font-family="JetBrains Mono" text-anchor="middle">${pad(h)}</text>`;}
  // 月亮高度曲线
  let mc='',mf=true;for(let m=0;m<=1440;m+=6){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const a=moonAzAlt(d)[1];mc+=(mf?'M':'L')+x(m).toFixed(1)+' '+y(Math.max(aMin,Math.min(aMax,a))).toFixed(1)+' ';mf=false;}
  s+=`<path d="${mc}" fill="none" stroke="#67E8F9" stroke-width="1.6" stroke-dasharray="3 4" opacity=".75"/>`;
  // 太阳高度曲线
  let c='';for(let m=0;m<=1440;m+=4){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const a=sunAzAlt(d)[1];c+=(m===0?'M':'L')+x(m).toFixed(1)+' '+y(Math.max(aMin,Math.min(aMax,a))).toFixed(1)+' ';}
  s+=`<path d="${c}" fill="none" stroke="#FFB020" stroke-width="2.5"/>`;
  const ev=(d,col,lab)=>{if(!d||isNaN(d))return'';const xx=x(mmOf(d));return`<circle cx="${xx}" cy="${y(0)}" r="4" fill="${col}"/><text x="${xx}" y="${pT+9}" fill="${col}" font-size="10" font-weight="600" text-anchor="middle">${lab}</text>`;};
  s+=ev(t.sunrise,'#FFB020','日出')+ev(t.sunset,'#FF8A3D','日落');
  const xx=x(S.minutes),ya=y(Math.max(aMin,Math.min(aMax,sunAzAlt(activeDate())[1])));
  s+=`<line x1="${xx}" y1="${pT}" x2="${xx}" y2="${H-pB}" stroke="#fff" stroke-width="1.5" opacity=".8"/><circle cx="${xx}" cy="${ya}" r="5" fill="#fff"/>`;
  $('skyarc').innerHTML=s;
}

/* ===== 交互 (地图) ===== */
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

/* ===== Tab / 视图切换 ===== */
function positionTabInd(){const on=$('tabs').querySelector('.tab.on');if(!on)return;const ind=$('tabInd');ind.style.width=on.offsetWidth+'px';ind.style.transform='translateX('+on.offsetLeft+'px)';}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));b.classList.add('on');positionTabInd();
  const v=b.dataset.view;
  $('mapView').classList.toggle('hidden',v!=='map');
  $('lensView').classList.toggle('hidden',v!=='lens');
  $('arView').classList.toggle('hidden',v!=='ar');
  if(v==='map'){renderAll();if(mapOK)setTimeout(()=>map.invalidateSize(),80);}
  else if(v==='lens')onLensShown();
  else onArShown();
});
window.addEventListener('resize',positionTabInd);window.addEventListener('load',positionTabInd);

/* ===== 取景器 / 焦段模拟 ===== */
const SENSORS=[['ff',36,24,'全画幅'],['apsc',23.5,15.6,'APS-C'],['canon',22.3,14.9,'APS-C佳能'],['m43',17.3,13,'M4/3'],['1in',13.2,8.8,'1吋'],['phone',9.8,7.3,'手机']];
const FOCALS=[14,24,35,50,85,135,200,400];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function norm(v){const m=Math.hypot(v[0],v[1],v[2]);return m<1e-9?null:[v[0]/m,v[1]/m,v[2]/m];}
const vec=(azN,altD)=>{const a=azN*rad,e=altD*rad,ca=Math.cos(e);return[Math.sin(a)*ca,Math.cos(a)*ca,Math.sin(e)];};
function fovOf(){const s=SENSORS.find(x=>x[0]===S.sensor);let w=s[1],h=s[2];if(S.orient==='port'){const tmp=w;w=h;h=tmp;}
  const f=S.focal,hfov=2*Math.atan(w/(2*f))/rad,vfov=2*Math.atan(h/(2*f))/rad,dfov=2*Math.atan(Math.hypot(w,h)/(2*f))/rad;
  const crop=43.267/Math.hypot(s[1],s[2]);return{hfov,vfov,dfov,crop,eq:Math.round(f*crop),aspect:w/h};}
function frameProject(azN,altD,f){
  const fwd=vec(S.aimAz,S.aimAlt),r0=norm(cross(fwd,[0,0,1]));if(!r0)return null;const u=cross(r0,fwd);
  const p=vec(azN,altD),zc=dot(p,fwd);if(zc<=0.03)return null;
  return{x:(dot(p,r0)/zc)/Math.tan(f.hfov/2*rad),y:(dot(p,u)/zc)/Math.tan(f.vfov/2*rad)};}
function buildLensControls(){
  $('sensorSeg').innerHTML=SENSORS.map(s=>`<button data-s="${s[0]}" class="${s[0]===S.sensor?'on':''}">${s[3]}</button>`).join('');
  $('sensorSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{S.sensor=b.dataset.s;buildLensControls();renderLens();});
  $('focalPresets').innerHTML=FOCALS.map(f=>`<button data-f="${f}" class="${f===S.focal?'on':''}">${f}</button>`).join('');
  $('focalPresets').querySelectorAll('button').forEach(b=>b.onclick=()=>{S.focal=+b.dataset.f;$('fslider').value=S.focal;$('fval').textContent=S.focal;buildLensControls();renderLens();});
}
function drawViewfinder(){
  const f=fovOf(),W=400,H=Math.round(W/f.aspect),svg=$('viewfinder');
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  const SX=x=>(x+1)/2*W,SY=y=>(1-y)/2*H;
  const proj=(azN,altD)=>{const r=frameProject(azN,altD,f);if(!r)return null;if(Math.abs(r.x)>2.4||Math.abs(r.y)>2.4)return null;return[SX(r.x),SY(r.y)];};
  let s=`<rect x="0" y="0" width="${W}" height="${H}" fill="#04050a"/>`;
  // 三分线
  for(let i=1;i<3;i++){s+=`<line x1="${W*i/3}" y1="0" x2="${W*i/3}" y2="${H}" stroke="#ffffff14"/><line x1="0" y1="${H*i/3}" x2="${W}" y2="${H*i/3}" stroke="#ffffff14"/>`;}
  // 地平线(直线)
  const hl=[proj((S.aimAz-f.hfov/2+360)%360,0),proj((S.aimAz+f.hfov/2)%360,0)];
  if(hl[0]&&hl[1])s+=`<line x1="${hl[0][0].toFixed(1)}" y1="${hl[0][1].toFixed(1)}" x2="${hl[1][0].toFixed(1)}" y2="${hl[1][1].toFixed(1)}" stroke="#7a86bd" stroke-width="1.2" stroke-dasharray="6 5" opacity=".7"/>`;
  // 全天轨迹
  const arc=(azAltFn,col,dash)=>{let d='',first=true;for(let m=0;m<=1440;m+=8){const dt=new Date(S.date);dt.setHours(0,0,0,0);dt.setMinutes(m);const[az,a]=azAltFn(dt);if(a<-2){first=true;continue;}const q=proj(az,a);if(!q){first=true;continue;}d+=(first?'M':'L')+q[0].toFixed(1)+' '+q[1].toFixed(1)+' ';first=false;}return d?`<path d="${d}" fill="none" stroke="${col}" stroke-width="2" ${dash?'stroke-dasharray="4 4"':''} stroke-linecap="round" opacity=".85"/>`:'';};
  s+=arc(moonAzAlt,'#67E8F9',true)+arc(d=>sunAzAlt(d),'#FFB020',false);
  // 整点标签(太阳)
  for(let hh=3;hh<=21;hh+=3){const dt=new Date(S.date);dt.setHours(hh,0,0,0);const[az,a]=sunAzAlt(dt);if(a<-2)continue;const q=proj(az,a);if(!q)continue;s+=`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="2.4" fill="#FFD98A"/><text x="${q[0].toFixed(1)}" y="${(q[1]-7).toFixed(1)}" fill="#FFD98A" font-size="9" font-family="JetBrains Mono" text-anchor="middle">${pad(hh)}</text>`;}
  // 当前太阳 / 月亮
  const[sAz,sAlt]=sunAzAlt(activeDate()),[moAz,moAlt]=moonAzAlt(activeDate());
  const marker=(az,a,col,rr,lab)=>{const q=proj(az,a);if(!q)return'';const inF=q[0]>=0&&q[0]<=W&&q[1]>=0&&q[1]<=H;return`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${rr}" fill="${col}" opacity="${inF?1:.4}"/><circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${rr+6}" fill="none" stroke="${col}" stroke-width="2" opacity="${inF?.6:.25}"/>`+(inF?`<text x="${q[0].toFixed(1)}" y="${(q[1]+rr+13).toFixed(1)}" fill="${col}" font-size="10" font-weight="700" text-anchor="middle">${lab}</text>`:'');};
  if(moAlt>-2)s+=marker(moAz,moAlt,'#67E8F9',7,'月');
  if(sAlt>-2)s+=marker(sAz,sAlt,'#FFB020',10,'日');
  // 边框
  s+=`<rect x="1" y="1" width="${W-2}" height="${H-2}" fill="none" stroke="#ffffff33" stroke-width="2" rx="4"/>`;
  s+=`<text x="8" y="${H-8}" fill="#8b95bf" font-size="10" font-family="JetBrains Mono">${S.focal}mm · ${f.hfov.toFixed(0)}°×${f.vfov.toFixed(0)}°</text>`;
  svg.innerHTML=s;
}
function inFrameTxt(az,alt,f){const r=frameProject(az,alt,f);if(!r)return'在身后';if(Math.abs(r.x)<=1&&Math.abs(r.y)<=1){const col=r.x<-.33?'左':r.x>.33?'右':'中',row=r.y>.33?'上':r.y<-.33?'下':'中';return'在画面 '+row+col;}return'在画面外';}
function renderLens(){
  if(!S.aimInit){const[sa,sl]=sunAzAlt(activeDate()),[ma,ml]=moonAzAlt(activeDate());let az,alt;
    if(sl>-3){az=sa;alt=sl;}else if(ml>-3){az=ma;alt=ml;}
    else{const t=getTimes(activeDate(),S.lat,S.lng);az=azDeg(getPos(t.sunrise,S.lat,S.lng).az);alt=8;}
    S.aimAz=Math.round(az);S.aimAlt=Math.max(-8,Math.min(55,Math.round(alt)));S.aimInit=true;}
  $('aimAz').value=S.aimAz;$('aimAzV').textContent=Math.round(S.aimAz)+'°';
  $('aimAlt').value=S.aimAlt;$('aimAltV').textContent=Math.round(S.aimAlt)+'°';
  $('lensTlabel').textContent=pad(Math.floor(S.minutes/60))+':'+pad(S.minutes%60);
  $('lensTslider').value=S.minutes;$('fval').textContent=S.focal;
  const f=fovOf();drawViewfinder();
  const[sAz,sAlt]=sunAzAlt(activeDate()),[moAz,moAlt]=moonAzAlt(activeDate()),ill=getMoonIllumination(activeDate()),mph=moonPhaseName(ill.phase);
  $('lensInfo').innerHTML=`
    <div class="ro" style="--l:var(--cyan)"><div class="k">视场角 H/V/D</div><div class="v" style="font-size:14px">${f.hfov.toFixed(0)}°/${f.vfov.toFixed(0)}°/${f.dfov.toFixed(0)}°</div></div>
    <div class="ro" style="--l:var(--cyan)"><div class="k">等效焦距</div><div class="v">${f.eq}<small>mm</small></div></div>
    <div class="ro" style="--l:var(--gold)"><div class="k">☀ 太阳</div><div class="v" style="font-size:13.5px">${sAlt>-2?Math.round(sAz)+'° / '+sAlt.toFixed(0)+'°':'地平线下'}<br><small>${sAlt>-2?inFrameTxt(sAz,sAlt,f):'—'}</small></div></div>
    <div class="ro" style="--l:var(--moon)"><div class="k">🌙 月亮 ${mph.icon}</div><div class="v" style="font-size:13.5px">${moAlt>-2?Math.round(moAz)+'° / '+moAlt.toFixed(0)+'°':'地平线下'}<br><small>${moAlt>-2?inFrameTxt(moAz,moAlt,f):'—'}</small></div></div>`;
}
function onLensShown(){buildLensControls();renderLens();}
$('fslider').addEventListener('input',e=>{S.focal=+e.target.value;buildLensControls();renderLens();});
$('orientBtn').onclick=()=>{S.orient=S.orient==='land'?'port':'land';$('orientBtn').textContent=S.orient==='land'?'🔁 横构图':'🔁 竖构图';renderLens();};
$('aimAz').addEventListener('input',e=>{S.aimAz=+e.target.value;renderLens();});
$('aimAlt').addEventListener('input',e=>{S.aimAlt=+e.target.value;renderLens();});
$('aimSun').onclick=()=>{const[a,l]=sunAzAlt(activeDate());if(l<-3){toast('太阳在地平线下');return;}S.aimAz=Math.round(a);S.aimAlt=Math.round(l);renderLens();toast('机位已对准太阳');};
$('aimMoon').onclick=()=>{const[a,l]=moonAzAlt(activeDate());if(l<-3){toast('月亮在地平线下');return;}S.aimAz=Math.round(a);S.aimAlt=Math.round(l);renderLens();toast('机位已对准月亮');};
$('aimReset').onclick=()=>{S.aimAz=0;S.aimAlt=5;renderLens();toast('机位复位：平视正北');};
let lensPlayT=null;
function stopLensPlay(){clearInterval(lensPlayT);lensPlayT=null;$('lensPlay').classList.remove('on');$('lensPlay').textContent='▶';}
$('lensTslider').addEventListener('input',e=>{stopLensPlay();S.minutes=+e.target.value;renderLens();});
$('lensNow').onclick=()=>{stopLensPlay();const n=new Date();S.date=new Date();S.minutes=n.getHours()*60+n.getMinutes();renderLens();toast('已回到当前时刻');};
$('lensPlay').onclick=()=>{if(lensPlayT){stopLensPlay();return;}$('lensPlay').classList.add('on');$('lensPlay').textContent='⏸';lensPlayT=setInterval(()=>{S.minutes=(S.minutes+3)%1440;renderLens();},60);};

/* ===== AR ===== */
let arActive=false,arLock=false,arPlayT=null;
let arYaw=null,arPitch=0,headOff=0,pitchOff=0,absSeen=false;
const AR_VBIAS=0.12;
const arMsg=m=>{const el=$('armsg');el.textContent=m||'';el.style.display=m?'block':'none';};
function cameraDir(a,b,g){
  const A=a*rad,B=b*rad,G=g*rad;
  const cA=Math.cos(A),sA=Math.sin(A),cB=Math.cos(B),sB=Math.sin(B),cG=Math.cos(G),sG=Math.sin(G);
  const fx=-(cA*sG+cG*sA*sB),fy=-(sA*sG-cA*cG*sB),fz=-(cB*cG);
  return{yaw:(Math.atan2(fx,fy)/rad+360)%360,pitch:Math.asin(Math.max(-1,Math.min(1,fz)))/rad};
}
function smoothStep(prev,target,wrap){
  let d=target-prev;if(wrap)d=((d+540)%360)-180;const ad=Math.abs(d);
  const a=ad<0.6?0.02:Math.min(0.4,0.05+ad*0.02);let v=prev+d*a;if(wrap)v=(v+360)%360;return v;}
function onOrient(ev){
  if(ev.alpha==null&&ev.beta==null&&ev.gamma==null)return;
  if(ev.type==='deviceorientationabsolute')absSeen=true;else if(absSeen)return;
  if(arLock)return;
  const cd=cameraDir(ev.alpha||0,ev.beta||0,ev.gamma||0);
  if(arYaw==null){arYaw=cd.yaw;arPitch=cd.pitch;}else{arYaw=smoothStep(arYaw,cd.yaw,true);arPitch=smoothStep(arPitch,cd.pitch,false);}
  setARMapRotation();
}
$('arStartBtn').onclick=async()=>{
  arMsg('请求相机…');
  try{const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});$('arvid').srcObject=st;await $('arvid').play();}
  catch(err){arMsg('无法访问相机（'+err.name+'）。需手机浏览器 + HTTPS 并授权相机。数据、取景器与地图无需相机，可直接使用。');return;}
  try{if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')arMsg('未授权方向传感器；请用「对准太阳」校准方位。');}}catch(e){}
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
  const vc=cv.height*(0.5+AR_VBIAS);
  const proj=(az,alt)=>{let dA=((az-headOff-yaw+540)%360)-180,dV=(alt-pitchOff)-pitch;if(Math.abs(dA)>hFov*.78)return null;return[cv.width/2+(dA/(hFov/2))*(cv.width/2),vc-(dV/(vFov/2))*(cv.height/2)];};
  const y0=vc-(((0-pitchOff)-pitch)/(vFov/2))*(cv.height/2);
  ctx.strokeStyle='rgba(122,134,189,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,y0);ctx.lineTo(cv.width,y0);ctx.stroke();
  ctx.font='700 16px Space Grotesk';ctx.textAlign='center';
  [['N',0,'#FFB020'],['NE',45,'#9aa4cc'],['E',90,'#9aa4cc'],['SE',135,'#9aa4cc'],['S',180,'#9aa4cc'],['SW',225,'#9aa4cc'],['W',270,'#9aa4cc'],['NW',315,'#9aa4cc']].forEach(([lb,az,c])=>{const pr=proj(az,0);if(pr){ctx.fillStyle=c;ctx.fillText(lb,pr[0],y0+24);ctx.fillRect(pr[0]-1,y0-5,2,10);}});
  // 月亮轨迹
  ctx.lineWidth=2.4;ctx.strokeStyle='rgba(103,232,249,.85)';ctx.setLineDash([6,5]);ctx.beginPath();let ms=false;
  for(let m=0;m<=1440;m+=6){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const[az,a]=moonAzAlt(d);if(a<-3){ms=false;continue;}const pr=proj(az,a);if(!pr){ms=false;continue;}if(!ms){ctx.moveTo(pr[0],pr[1]);ms=true;}else ctx.lineTo(pr[0],pr[1]);}
  ctx.stroke();ctx.setLineDash([]);
  // 太阳轨迹
  ctx.lineWidth=3;ctx.strokeStyle='rgba(255,176,32,.9)';ctx.beginPath();let started=false;
  for(let m=0;m<=1440;m+=6){const d=new Date(S.date);d.setHours(0,0,0,0);d.setMinutes(m);const[az,a]=sunAzAlt(d);if(a<-3){started=false;continue;}const pr=proj(az,a);if(!pr){started=false;continue;}if(!started){ctx.moveTo(pr[0],pr[1]);started=true;}else ctx.lineTo(pr[0],pr[1]);}
  ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='11px JetBrains Mono';
  for(let hh=4;hh<=21;hh++){const d=new Date(S.date);d.setHours(hh,0,0,0);const[az,a]=sunAzAlt(d);if(a<-1)continue;const pr=proj(az,a);if(pr){ctx.beginPath();ctx.arc(pr[0],pr[1],2.5,0,7);ctx.fill();if(hh%2===0)ctx.fillText(pad(hh)+':00',pr[0],pr[1]-8);}}
  // 当前月亮
  const[moAz,moAlt]=moonAzAlt(activeDate());
  if(moAlt>-3){const pr=proj(moAz,moAlt);if(pr){ctx.fillStyle='#cffaff';ctx.beginPath();ctx.arc(pr[0],pr[1],11,0,7);ctx.fill();ctx.strokeStyle='rgba(103,232,249,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(pr[0],pr[1],18,0,7);ctx.stroke();}}
  // 当前太阳
  const[sunAz,alt]=sunAzAlt(activeDate());
  if(alt>-3){const pr=proj(sunAz,alt);if(pr){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(pr[0],pr[1],15,0,7);ctx.fill();ctx.strokeStyle='rgba(255,176,32,.9)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(pr[0],pr[1],24,0,7);ctx.stroke();}}
  ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cv.width/2,vc,10,0,7);ctx.moveTo(cv.width/2-16,vc);ctx.lineTo(cv.width/2+16,vc);ctx.moveTo(cv.width/2,vc-16);ctx.lineTo(cv.width/2,vc+16);ctx.stroke();
  $('arhud').innerHTML=`相机朝向 ${Math.round(yaw)}° · 仰角 ${pitch.toFixed(0)}°${arLock?' · 🔒锁定':''}<br>☀ ${Math.round(sunAz)}°/${alt.toFixed(0)}° · 🌙 ${Math.round(moAz)}°/${moAlt.toFixed(0)}°`;
  requestAnimationFrame(drawAR);
}
/* 底部信息面板 */
function drawARInfo(){
  const t=getTimes(activeDate(),S.lat,S.lng);
  const[sunAz,alt]=sunAzAlt(activeDate()),[moAz,moAlt]=moonAzAlt(activeDate()),ill=getMoonIllumination(activeDate()),mph=moonPhaseName(ill.phase);
  const up=alt>-.833,mUp=moAlt>-.833,ph=phaseOf(alt);
  $('arplaninfo').innerHTML=`
    <div class="pl"><span>☀ 太阳方位</span><b>${up?Math.round(sunAz)+'° '+compassPt(sunAz):'地平线下'}</b></div>
    <div class="pl"><span>☀ 太阳高度</span><b>${alt.toFixed(1)}°</b></div>
    <div class="pl"><span>🌙 月亮方位</span><b>${mUp?Math.round(moAz)+'° '+compassPt(moAz):'地平线下'}</b></div>
    <div class="pl"><span>${mph.icon} 月相</span><b>${mph.name} ${Math.round(ill.fraction*100)}%</b></div>
    <div class="pl"><span>光线阶段</span><b style="color:${ph.c}">${ph.n}</b></div>
    <div class="pl"><span>日出 / 日落</span><b>${fmt(t.sunrise)} · ${fmt(t.sunset)}</b></div>`;
}
/* 底部小地图 */
let armap=null,armReady=false,armLines={},armSun=null,armMoon=null,armN=null;
function initARMap(){
  if(armap||typeof L==='undefined')return;
  try{
    armap=L.map('armap',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,tap:false,inertia:false,fadeAnimation:false,zoomAnimation:false}).setView([S.lat,S.lng],16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(armap);
    armLines.sunrise=L.polyline([],{color:'#FFB020',weight:2,dashArray:'3 4',opacity:.85,interactive:false}).addTo(armap);
    armLines.sunset=L.polyline([],{color:'#FF8A3D',weight:2,dashArray:'3 4',opacity:.85,interactive:false}).addTo(armap);
    armLines.shadow=L.polyline([],{color:'#5B8FD6',weight:5,opacity:.7,lineCap:'round',interactive:false}).addTo(armap);
    armLines.moon=L.polyline([],{color:'#67E8F9',weight:2.5,opacity:.85,interactive:false}).addTo(armap);
    armLines.sun=L.polyline([],{color:'#fff',weight:3,opacity:.95,interactive:false}).addTo(armap);
    armN=L.marker([S.lat,S.lng],{icon:L.divIcon({className:'',html:'<div class="armini-n">N</div>',iconSize:[16,16],iconAnchor:[8,8]}),interactive:false}).addTo(armap);
    armMoon=L.marker([S.lat,S.lng],{icon:L.divIcon({className:'',html:'<div class="armoon"></div>',iconSize:[15,15],iconAnchor:[7,7]}),interactive:false}).addTo(armap);
    armSun=L.marker([S.lat,S.lng],{icon:L.divIcon({className:'',html:'<div class="arsun"></div>',iconSize:[18,18],iconAnchor:[9,9]}),interactive:false}).addTo(armap);
    armReady=true;
  }catch(e){}
}
function drawARMap(){
  if(!armReady)return;
  armap.setView([S.lat,S.lng],armap.getZoom(),{animate:false});
  const t=getTimes(activeDate(),S.lat,S.lng);
  const srAz=azDeg(getPos(t.sunrise,S.lat,S.lng).az),ssAz=azDeg(getPos(t.sunset,S.lat,S.lng).az);
  const[sunAz,alt,altR]=sunAzAlt(activeDate()),[moAz,moAlt]=moonAzAlt(activeDate()),D=130;
  armLines.sunrise.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,srAz,D)]);
  armLines.sunset.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,ssAz,D)]);
  armN.setLatLng(dest(S.lat,S.lng,0,D*.92));
  const sunEl=armSun.getElement(),moEl=armMoon.getElement();
  if(alt>-.833){armLines.sun.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,sunAz,D)]);armSun.setLatLng(dest(S.lat,S.lng,sunAz,D));if(sunEl)sunEl.style.display='';
    const shLen=Math.min(alt>0.5?S.height/Math.tan(altR):120,D);armLines.shadow.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,(sunAz+180)%360,Math.max(25,shLen))]);}
  else{armLines.sun.setLatLngs([]);armLines.shadow.setLatLngs([]);if(sunEl)sunEl.style.display='none';}
  if(moAlt>-.833){armLines.moon.setLatLngs([[S.lat,S.lng],dest(S.lat,S.lng,moAz,D)]);armMoon.setLatLng(dest(S.lat,S.lng,moAz,D));if(moEl)moEl.style.display='';}
  else{armLines.moon.setLatLngs([]);if(moEl)moEl.style.display='none';}
}
function setARMapRotation(){const el=$('armap');if(!el)return;const yaw=arYaw==null?0:arYaw;el.style.transform=`translate(-50%,-50%) rotate(${(-yaw).toFixed(1)}deg)`;}
function renderAR(){$('artlabel').textContent=pad(Math.floor(S.minutes/60))+':'+pad(S.minutes%60);$('artslider').value=S.minutes;drawARInfo();drawARMap();}
function stopAR(){clearInterval(arPlayT);arPlayT=null;$('arPlay').classList.remove('on');$('arPlay').textContent='▶';}
$('artslider').addEventListener('input',e=>{stopAR();S.minutes=+e.target.value;renderAR();});
$('arPlay').onclick=()=>{if(arPlayT){stopAR();return;}$('arPlay').classList.add('on');$('arPlay').textContent='⏸';arPlayT=setInterval(()=>{S.minutes=(S.minutes+3)%1440;renderAR();},60);};
$('arNow').onclick=()=>{stopAR();const n=new Date();S.date=new Date();S.minutes=n.getHours()*60+n.getMinutes();renderAR();toast('已回到当前时刻');};
$('arLock').onclick=()=>{arLock=!arLock;$('arLock').classList.toggle('on',arLock);$('arLock').textContent=arLock?'🔒 已锁定':'🔓 锁定方向';toast(arLock?'方向已锁定：拖时间轴看日月沿轨迹移动':'方向已解锁：跟随手机转动');};
$('arCalib').onclick=()=>{if(!arActive){toast('先开启相机再校准');return;}
  const p=getPos(new Date(),S.lat,S.lng),alt=altDeg(p.alt);if(alt<-2){toast('太阳在地平线下，此刻无法用太阳校准');return;}
  headOff=(azDeg(p.az)-(arYaw||0));pitchOff=(alt-arPitch);toast('已按此刻真实太阳位置校准');};
function onArShown(){initARMap();renderAR();setARMapRotation();if(armReady)setTimeout(()=>{armap.invalidateSize();armap.setView([S.lat,S.lng],armap.getZoom(),{animate:false});},120);}

/* ===== 启动 ===== */
loadHash();initMap();buildLensControls();renderAll();positionTabInd();fetchWeather();
