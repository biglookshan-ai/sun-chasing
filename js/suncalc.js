/* SunPath — 天文核心 (SunCalc 算法 + 几何/格式化辅助) */
/* ===== SunCalc 核心 ===== */
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

const CN={N:'北',E:'东',S:'南',W:'西',NE:'东北',SE:'东南',SW:'西南',NW:'西北',NNE:'北偏东',ENE:'东偏北',ESE:'东偏南',SSE:'南偏东',SSW:'南偏西',WSW:'西偏南',WNW:'西偏北',NNW:'北偏西'};
const DIRS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compassPt=d=>CN[DIRS[Math.round(((d%360)+360)%360/22.5)%16]];
const azDeg=a=>((a*180/PI+180)%360+360)%360,altDeg=a=>a*180/PI;
const pad=n=>String(n).padStart(2,'0'),fmt=d=>(!d||isNaN(d))?'—':pad(d.getHours())+':'+pad(d.getMinutes());
function dest(lat,lng,brg,dM){const R=6371000,br=brg*rad,f1=lat*rad,l1=lng*rad,dl=dM/R;
  const f2=Math.asin(Math.sin(f1)*Math.cos(dl)+Math.cos(f1)*Math.sin(dl)*Math.cos(br));
  const l2=l1+Math.atan2(Math.sin(br)*Math.sin(dl)*Math.cos(f1),Math.cos(dl)-Math.sin(f1)*Math.sin(f2));return[f2/rad,l2/rad];}
