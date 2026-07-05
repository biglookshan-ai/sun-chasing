/* SunPath — 天文核心 (SunCalc 算法: 太阳 + 月亮 + 几何/格式化辅助)
   移植自 mourner/suncalc (BSD-2)。方位角统一：内部自南顺时针弧度，azDeg() 转为自北顺时针度。*/
/* ===== 常量与基础 ===== */
const PI=Math.PI,rad=PI/180,dayMs=864e5,J1970=2440588,J2000=2451545,e0=rad*23.4397;
const toJulian=d=>d.valueOf()/dayMs-.5+J1970,fromJulian=j=>new Date((j+.5-J1970)*dayMs),toDays=d=>toJulian(d)-J2000;
const RA=(l,b)=>Math.atan2(Math.sin(l)*Math.cos(e0)-Math.tan(b)*Math.sin(e0),Math.cos(l));
const DEC=(l,b)=>Math.asin(Math.sin(b)*Math.cos(e0)+Math.cos(b)*Math.sin(e0)*Math.sin(l));
const AZ=(H,phi,d)=>Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(d)*Math.cos(phi));
const ALT=(H,phi,d)=>Math.asin(Math.sin(phi)*Math.sin(d)+Math.cos(phi)*Math.cos(d)*Math.cos(H));
const sidereal=(d,lw)=>rad*(280.16+360.9856235*d)-lw,sma=d=>rad*(357.5291+.98560028*d);
const ecLon=M=>M+rad*(1.9148*Math.sin(M)+.02*Math.sin(2*M)+.0003*Math.sin(3*M))+rad*102.9372+PI;
function sunCoords(d){const M=sma(d),L=ecLon(M);return{dec:DEC(L,0),ra:RA(L,0)};}
function getPos(date,lat,lng){const lw=rad*-lng,phi=rad*lat,d=toDays(date),c=sunCoords(d),H=sidereal(d,lw)-c.ra;return{az:AZ(H,phi,c.dec),alt:ALT(H,phi,c.dec)};}
const J0=.0009,jcyc=(d,lw)=>Math.round(d-J0-lw/(2*PI)),atr=(Ht,lw,n)=>J0+(Ht+lw)/(2*PI)+n;
const stj=(ds,M,L)=>J2000+ds+.0053*Math.sin(M)-.0069*Math.sin(2*L);
const hAng=(h,phi,d)=>Math.acos((Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d)));
function setJ(h,lw,phi,dec,n,M,L){return stj(atr(hAng(h,phi,dec),lw,n),M,L);}
function getTimes(date,lat,lng){const lw=rad*-lng,phi=rad*lat,d=toDays(date),n=jcyc(d,lw),ds=atr(0,lw,n),M=sma(ds),L=ecLon(M),dec=DEC(L,0),Jn=stj(ds,M,L);
  const D=[[-.833,'sunrise','sunset'],[-6,'dawn','dusk'],[-18,'nightEnd','night'],[6,'ghEnd','gh']],r={solarNoon:fromJulian(Jn)};
  for(const t of D){const Js=setJ(t[0]*rad,lw,phi,dec,n,M,L);r[t[1]]=fromJulian(Jn-(Js-Jn));r[t[2]]=fromJulian(Js);}return r;}

/* ===== 月亮 ===== */
function astroRefraction(h){if(h<0)h=0;return .0002967/Math.tan(h+.00312536/(h+.08901179));}
function moonCoords(d){const L=rad*(218.316+13.176396*d),M=rad*(134.963+13.064993*d),F=rad*(93.272+13.22935*d);
  const l=L+rad*6.289*Math.sin(M),b=rad*5.128*Math.sin(F),dt=385001-20905*Math.cos(M);
  return{ra:RA(l,b),dec:DEC(l,b),dist:dt};}
/* 返回与 getPos 相同约定：az 自南顺时针弧度(用 azDeg 转)、alt 弧度(已加折射) */
function getMoonPos(date,lat,lng){const lw=rad*-lng,phi=rad*lat,d=toDays(date),c=moonCoords(d),H=sidereal(d,lw)-c.ra;
  let h=ALT(H,phi,c.dec);const pa=Math.atan2(Math.sin(H),Math.tan(phi)*Math.cos(c.dec)-Math.sin(c.dec)*Math.cos(H));
  h=h+astroRefraction(h);return{az:AZ(H,phi,c.dec),alt:h,dist:c.dist,pa};}
function getMoonIllumination(date){const d=toDays(date||new Date()),s=sunCoords(d),m=moonCoords(d),sdist=149598000;
  const phi=Math.acos(Math.sin(s.dec)*Math.sin(m.dec)+Math.cos(s.dec)*Math.cos(m.dec)*Math.cos(s.ra-m.ra));
  const inc=Math.atan2(sdist*Math.sin(phi),m.dist-sdist*Math.cos(phi));
  const angle=Math.atan2(Math.cos(s.dec)*Math.sin(s.ra-m.ra),Math.sin(s.dec)*Math.cos(m.dec)-Math.cos(s.dec)*Math.sin(m.dec)*Math.cos(s.ra-m.ra));
  return{fraction:(1+Math.cos(inc))/2,phase:.5+.5*inc*(angle<0?-1:1)/PI,angle};}
const _hLater=(date,h)=>new Date(date.valueOf()+h*dayMs/24);
function getMoonTimes(date,lat,lng){const t=new Date(date);t.setHours(0,0,0,0);const hc=.133*rad;
  let h0=getMoonPos(t,lat,lng).alt-hc,rise,set,ye,x1,x2;
  for(let i=1;i<=24;i+=2){const h1=getMoonPos(_hLater(t,i),lat,lng).alt-hc,h2=getMoonPos(_hLater(t,i+1),lat,lng).alt-hc;
    const a=(h0+h2)/2-h1,b=(h2-h0)/2,xe=-b/(2*a);ye=(a*xe+b)*xe+h1;const dsc=b*b-4*a*h1;let roots=0;
    if(dsc>=0){const dx=Math.sqrt(dsc)/(Math.abs(a)*2);x1=xe-dx;x2=xe+dx;if(Math.abs(x1)<=1)roots++;if(Math.abs(x2)<=1)roots++;if(x1<-1)x1=x2;}
    if(roots===1){if(h0<0)rise=i+x1;else set=i+x1;}else if(roots===2){rise=i+(ye<0?x2:x1);set=i+(ye<0?x1:x2);}
    if(rise&&set)break;h0=h2;}
  const r={};if(rise)r.rise=_hLater(t,rise);if(set)r.set=_hLater(t,set);if(!rise&&!set)r[ye>0?'alwaysUp':'alwaysDown']=true;return r;}
function moonPhaseName(p){const N=[[.033,'新月','🌑'],[.216,'娥眉月','🌒'],[.283,'上弦月','🌓'],[.466,'盈凸月','🌔'],[.533,'满月','🌕'],[.716,'亏凸月','🌖'],[.783,'下弦月','🌗'],[.966,'残月','🌘']];
  for(const[t,n,i]of N)if(p<t)return{name:n,icon:i,waxing:p<.5};return{name:'新月',icon:'🌑',waxing:false};}

/* ===== 几何 / 格式化辅助 ===== */
const CN={N:'北',E:'东',S:'南',W:'西',NE:'东北',SE:'东南',SW:'西南',NW:'西北',NNE:'北偏东',ENE:'东偏北',ESE:'东偏南',SSE:'南偏东',SSW:'南偏西',WSW:'西偏南',WNW:'西偏北',NNW:'北偏西'};
const DIRS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compassPt=d=>CN[DIRS[Math.round(((d%360)+360)%360/22.5)%16]];
const azDeg=a=>((a*180/PI+180)%360+360)%360,altDeg=a=>a*180/PI;
const pad=n=>String(n).padStart(2,'0'),fmt=d=>(!d||isNaN(d))?'—':pad(d.getHours())+':'+pad(d.getMinutes());
function dest(lat,lng,brg,dM){const R=6371000,br=brg*rad,f1=lat*rad,l1=lng*rad,dl=dM/R;
  const f2=Math.asin(Math.sin(f1)*Math.cos(dl)+Math.cos(f1)*Math.sin(dl)*Math.cos(br));
  const l2=l1+Math.atan2(Math.sin(br)*Math.sin(dl)*Math.cos(f1),Math.cos(dl)-Math.sin(f1)*Math.sin(f2));return[f2/rad,l2/rad];}
