/* Pure ES5 teaching model. Internal units: minutes and cables (1 nmi = 10 cables). */
(function(root){
'use strict';
var EPS=1e-8;
function number(v,label,min,max){
 var s=String(v).replace(/,/g,'.').replace(/^\s+|\s+$/g,'');
 if((typeof v!=='number'&&!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))||!isFinite(Number(s)))throw Error(label+': введите число');
 var n=Number(s);if(n<min||n>max)throw Error(label+': значение вне диапазона '+min+'…'+max);return n;
}
function duration(s){
 if(s.mode==='distance'){var l=number(s.length,'Длина, мили',0.001,10000),v=number(s.speed,'Скорость, уз',0.01,100);return l/v*60;}
 var m=String(s.duration||'').match(/^(\d{1,3}):([0-5]\d)$/);
 if(!m||Number(m[1])*60+Number(m[2])<=0)throw Error('Длительность: чч:мм, больше нуля');return Number(m[1])*60+Number(m[2]);
}
function clockBase(t){var m=String(t).match(/^([01]\d|2[0-3]):([0-5]\d)$/);if(!m)throw Error('T0: судовое время от 00:00 до 23:59');return Number(m[1])*60+Number(m[2]);}
function pad(n){return n<10?'0'+n:String(n);}
function elapsed(min){var n=Math.floor(min+EPS);return pad(Math.floor(n/60))+':'+pad(n%60);}
function clock(t,min){var all=clockBase(t)+Math.floor(min+EPS),days=Math.floor(all/1440),n=all%1440;return elapsed(n)+(days?' (+'+days+' сут)':'');}
// Only this drift branch is confirmed. (1.8) is radial Mlim<=Dop/R; perpendicular relations are (1.9).
function drift(hours,kc){var h=number(hours,'Интервал, ч',0,168),k=number(kc,'Kс',0,100);return {miles:0.7*k*h,cables:7* k*h,extrapolated:h>2};}
function errorAt(mo,minutes,kc,mode){var d=drift(minutes/60,kc).cables;return mode==='rss'?Math.sqrt(mo*mo+d*d):mo+d;}
function inverse(mo,limit,kc,mode){
 if(mo>=limit)return 0;if(kc===0)return Infinity;
 var amount=mode==='rss'?Math.sqrt(limit*limit-mo*mo):limit-mo,lo=0,hi=60,mid,i;
 // Invert the same monotone drift function, not a second copy of its formula.
 while(hi<10080&&drift(hi/60,kc).cables<amount)hi=Math.min(10080,hi*2);
 if(drift(hi/60,kc).cables<amount)return Infinity;
 for(i=0;i<46;i++){mid=(lo+hi)/2;if(drift(mid/60,kc).cables<amount)lo=mid;else hi=mid;}
 return hi;
}
// Central normal probability P1(Z)=2*Phi(Z)-1. Positive-term integral series;
// at Z>=8 the omitted normal tail is below 1.3e-15 (double precision).
function laplace(value){
 var z=number(value,'Z',0,1e9);if(z===0)return 0;if(z>=8)return 1;
 var term=z,sum=z,k;for(k=3;k<513;k+=2){term*=z*z/k;sum+=term;if(term<sum*1e-16)break;}
 return Math.min(1,2*Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)*sum);
}
function inverseLaplace(value){
 var p=number(value,'Вероятность Лапласа',0,1);if(p>=1)throw Error('Вероятность Лапласа должна быть меньше 1');if(p===0)return 0;
 var lo=0,hi=8,mid,i;for(i=0;i<60;i++){mid=(lo+hi)/2;if(laplace(mid)<p)lo=mid;else hi=mid;}return (lo+hi)/2;
}
function cables(value,unit){if(unit!=='cables'&&unit!=='miles')throw Error('Единицы расстояния: кб или мили');return number(value,'Расстояние Dоп / D⊥',0.0001,10000)*(unit==='miles'?10:1);}
function target(value){return number(value,'Pз, %',50.0001,99.9999)/100;}
function dangerLimit(distance,unit,probability){var d=cables(distance,unit),pz=target(probability),z=inverseLaplace(2*pz-1);return {z:z,limit:1.4*d/z};}
// Rayleigh approximation for circular radial RMS (e=1), not an invented MT-2000 lookup.
function rayleighR(probability){var p=target(probability);return Math.sqrt(-Math.log(1-p));}
function radialLimit(distance,unit,coefficient){var d=cables(distance,unit),r=number(coefficient,'R',0.000001,1e9);return d/r;}
function circularLimit(distance,unit,probability){var r=rayleighR(probability);return {r:r,limit:radialLimit(distance,unit,r)};}

function passage(kind,m,d1,d2){
 m=number(m,'M на траверзе, кб',0,1e9);d1=number(d1,'D⊥1, кб',0.0001,1e9);if(kind!=='single'&&kind!=='pair')throw Error('Тип опасности не задан');if(kind==='pair')d2=number(d2,'D⊥2, кб',0.0001,1e9);
 var p1=m===0?1:laplace(1.4*d1/m),p2=kind==='pair'?(m===0?1:laplace(1.4*d2/m)):null;return {p:kind==='pair'?(p1+p2)/2:(1+p1)/2,p1:p1,p2:p2};
}
function graphError(p,value){
 var t=number(value,'Момент траверза, мин',0,p.total),i,a;
 // At a simultaneous observation, evaluate the incoming (left) graph value.
 if(t===0)return {m:p.rows[0].mo,extrapolated:false};
 for(i=0;i<p.arcs.length;i++){a=p.arcs[i];if(t>a.start&&t<=a.end+EPS)return {m:errorAt(a.mo,t-a.start,p.kc,p.mode),extrapolated:t-a.start>120};}
 throw Error('Момент траверза вне графика');
}
function addSafety(p){
 var product=1,count=0;p.safety=[];
 p.segments.forEach(function(s,i){if(s.hazard==='none')return;var at=s.start+s.traverse,g=graphError(p,at),prob=passage(s.hazard,g.m,s.distance,s.distance2),r={segmentIndex:i,name:s.name,hazard:s.hazard,time:at,m:g.m,limit:s.limit,distance:s.distance,distance2:s.distance2,target:s.target,p:prob.p,p1:prob.p1,p2:prob.p2,z:s.z,r:s.r,radius:s.radius,aboveLimit:g.m>s.limit+EPS,extrapolated:g.extrapolated};p.safety.push(r);product*=r.p;count++;
  if(r.aboveLimit||r.p+EPS<r.target||r.extrapolated)p.warnings.push({from:s.start,to:s.end,kind:'probability',text:s.name+': на траверзе T0+'+elapsed(at)+' M = '+r.m.toFixed(2)+' кб'+(r.aboveLimit?' > Mдоп':'')+'; P = '+(100*r.p).toFixed(2)+' % (Pз = '+(100*r.target).toFixed(2)+' %).'+(s.limitMode==='danger'&&s.hazard==='pair'?' Допуск по D⊥1 относится только к одиночной опасности; проверяйте P между двумя.':'')+(r.extrapolated?' M использует неподтверждённую экстраполяцию после 2 ч.':'')});
 });p.routeProbability=count?product:null;p.safetyComplete=count===p.segments.length;return p;
}
function normalize(input){
 var kc=number(input.kc,'Kс, мили/ч',0,100),m0=number(input.m0,'M0, кб',0,10000),min=number(input.minInterval,'Минимальный интервал, мин',1,1440),margin=number(input.margin,'Запас, мин',0,1440),total=0,segments=[];
 clockBase(input.t0);if(min%1||margin%1)throw Error('Запас и минимальный интервал задаются целыми минутами');
 var mode=input.mode||'linear';if(mode!=='linear'&&mode!=='rss')throw Error('Неизвестный режим сложения');
 if(!input.segments||input.segments.length<1||input.segments.length>48)throw Error('Нужно от 1 до 48 участков');
 input.segments.forEach(function(s,i){var len=duration(s);if(total+len>10080)throw Error('Маршрут ограничен 7 сутками');var n={name:String(s.name||('Участок '+(i+1))),start:total,end:total+len,limit:(s.limitMode==='danger'||s.limitMode==='circle')?0:number(s.limit,'Mдоп, кб',0.01,10000),mainMo:number(s.mainMo,'Mо основного, кб',0,10000),reserveMo:number(s.reserveMo,'Mо резервного, кб',0,10000),mainMethod:String(s.mainMethod||'Не задан'),reserveMethod:String(s.reserveMethod||'Не задан'),landmarks:String(s.landmarks||'Не заданы')};var lm=s.limitMode||'manual',haz=s.hazard||(lm==='danger'?'single':'none'),derived,tm;
 if(lm!=='manual'&&lm!=='danger'&&lm!=='circle')throw Error('Неизвестный способ задания Mдоп');if(haz!=='none'&&haz!=='single'&&haz!=='pair')throw Error('Неизвестный тип опасности');if(lm==='danger'&&haz==='none')throw Error('Для допуска через D⊥ задайте опасность');
 n.limitMode=lm;n.hazard=haz;n.conditions=s.conditions||'custom';
 if(n.conditions!=='open'&&n.conditions!=='confined'&&n.conditions!=='custom')throw Error('Неизвестный пресет условий');
 if(haz!=='none'||lm==='circle'){
  n.target=target(s.targetProbability===undefined?95:s.targetProbability);
  if(n.conditions==='open'&&n.target<0.95-EPS)throw Error('Открытое море / побережье: Pз не ниже 95 %');
  if(n.conditions==='confined'&&n.target<0.99-EPS)throw Error('Стеснённые условия: Pз не ниже 99 %');
 }
 if(lm==='circle'){n.radius=cables(s.radius,s.distanceUnit||'cables');derived=circularLimit(s.radius,s.distanceUnit||'cables',s.targetProbability===undefined?95:s.targetProbability);n.limit=derived.limit;n.r=derived.r;}
 if(haz!=='none'){
  n.distance=cables(s.distance,s.distanceUnit||'cables');n.distance2=haz==='pair'?cables(s.distance2,s.distanceUnit||'cables'):null;n.target=target(s.targetProbability===undefined?95:s.targetProbability);
  if(s.traverse===undefined||String(s.traverse).replace(/\s/g,'')==='')n.traverse=len;else{tm=String(s.traverse).match(/^(\d{1,3}):([0-5]\d)$/);if(!tm)throw Error('Траверз: чч:мм от начала участка или пусто для конца');n.traverse=Number(tm[1])*60+Number(tm[2]);if(n.traverse>len+EPS)throw Error('Траверз вне участка');}
  if(lm==='danger'){derived=dangerLimit(s.distance,s.distanceUnit||'cables',s.targetProbability===undefined?95:s.targetProbability);n.limit=derived.limit;n.z=derived.z;}
 }
 segments.push(n);total+=len;});
 return {t0:input.t0,kc:kc,m0:m0,minInterval:min,margin:margin,mode:mode,segments:segments,total:total,overrides:input.overrides||{}};
}
function plan(input){
 var cfg=normalize(input),segs=cfg.segments,rows=[],arcs=[],warnings=[],crossings=[];
 function warn(from,to,kind,text){if(to>from+EPS)warnings.push({from:from,to:to,kind:kind,text:text});}
 function indexAt(t){var i;for(i=0;i<segs.length;i++)if(t<segs[i].end-EPS)return i;return segs.length-1;}
 function row(t,idx,reason){
  var s=segs[idx],over=cfg.overrides[rows.length]||{},r={time:t,segmentIndex:idx,reason:reason,limit:segs[indexAt(t)].limit,mainMo:s.mainMo,reserveMo:s.reserveMo,mainMethod:s.mainMethod,reserveMethod:s.reserveMethod,landmarks:s.landmarks};
  ['mainMo','reserveMo'].forEach(function(k){if(over[k]!==undefined)r[k]=number(over[k],k+' строки '+rows.length,0,10000);});
  ['mainMethod','reserveMethod','landmarks'].forEach(function(k){if(over[k]!==undefined)r[k]=String(over[k]);});
  if(rows.length===0)r.mainMo=cfg.m0;
  r.mo=r.mainMo;r.valid=r.mainMo<s.limit;rows.push(r);return r;
 }
 function arc(r,end){if(end<=r.time+EPS)return;var a={start:r.time,end:end,mo:r.mainMo,reserveMo:r.reserveMo,endError:errorAt(r.mo,end-r.time,cfg.kc,cfg.mode)};arcs.push(a);if(end-r.time>120)warn(r.time+120,end,'formula','Интервал счисления >2 ч: формула не задана; временная линейная экстраполяция.');}
 function next(r){
  var i,s,start,cross,err;
  for(i=indexAt(r.time);i<segs.length;i++){
   s=segs[i];start=Math.max(r.time,s.start);err=errorAt(r.mo,start-r.time,cfg.kc,cfg.mode);
   if(err>=s.limit-EPS)return {time:start,index:i,boundary:start>r.time+EPS};
   cross=r.time+inverse(r.mo,s.limit,cfg.kc,cfg.mode);
   if(cross<s.end-EPS)return {time:cross,index:i,boundary:false};
   if(Math.abs(cross-s.end)<=EPS&&i+1<segs.length&&segs[i+1].limit<=s.limit)return {time:s.end,index:i+1,boundary:true};
  }
  return null;
 }
 segs.forEach(function(s){if(s.mainMo>=s.limit)warn(s.start,s.end,'main','Типовой основной способ: Mо ≥ Mдоп. Нужны изменение условий или другой способ.');});
 var r=row(0,0,'initial'),ev,q,target,end,guard=0;
 while(r.time<cfg.total-EPS){
  if(++guard>10081)throw Error('Превышен предел плановых строк');
  ev=next(r);
  if(!ev){arc(r,cfg.total);break;}
  target=segs[ev.index];
  q=Math.floor(ev.time-cfg.margin+(ev.boundary?-EPS:EPS));
  if(q-r.time<cfg.minInterval){
   warn(Math.max(r.time,target.start),target.end,'main',r.mo>=target.limit?'Mо ≥ Mдоп: точности основного способа недостаточно.':'Требуемый интервал между обсервациями меньше минимального (с учётом запаса и округления).');
   end=target.end;arc(r,end);if(end>=cfg.total-EPS)break;r=row(end,ev.index+1,'recovery');continue;
  }
  crossings.push({time:ev.time,at:q,start:r.time,mo:r.mo,error:errorAt(r.mo,ev.time-r.time,cfg.kc,cfg.mode),boundary:ev.boundary});
  arc(r,q);r=row(q,ev.boundary?ev.index:indexAt(q),ev.boundary?'boundary':'threshold');
  if(r.mo>=target.limit){
   r.valid=false;warn(Math.max(q,target.start),target.end,'main','Mо ≥ Mдоп: основной способ не обеспечивает допустимую РСКП.');arc(r,target.end);if(target.end>=cfg.total-EPS)break;r=row(target.end,ev.index+1,'recovery');
  }
 }
 arcs.forEach(function(a){segs.forEach(function(s){var start=Math.max(a.start,s.start),end=Math.min(a.end,s.end),cross=a.start+inverse(a.reserveMo,s.limit,cfg.kc,cfg.mode),mainCross=a.start+inverse(a.mo,s.limit,cfg.kc,cfg.mode);if(end>start+EPS&&cross<end-EPS)warn(Math.max(start,cross),end,'reserve','Резервный способ: ожидаемая РСКП достигает или превышает Mдоп.');if(end>start+EPS&&mainCross<end-EPS)warn(Math.max(start,mainCross),end,'main','На этом интервале ожидаемая погрешность основного способа достигает или превышает Mдоп.');});});
 // Merge overlapping intervals, but keep distinct reasons in the warning text.
 warnings.sort(function(a,b){return a.kind<b.kind?-1:a.kind>b.kind?1:a.from-b.from;});
 var merged=[];warnings.forEach(function(w){var last=merged[merged.length-1];if(last&&last.kind===w.kind&&w.from<=last.to+EPS){last.to=Math.max(last.to,w.to);if(last.text.indexOf(w.text)<0)last.text+=' '+w.text;}else merged.push(w);});warnings=merged;
 return addSafety({rows:rows,arcs:arcs,warnings:warnings,crossings:crossings,segments:segs,total:cfg.total,t0:cfg.t0,kc:cfg.kc,mode:cfg.mode,minInterval:cfg.minInterval,margin:cfg.margin,ocExtrapolated:cfg.total>120});
}
function example(){
 function s(name,d,lim,mo,res,land){return {name:name,mode:'time',duration:d,length:'2',speed:'6',limit:lim,mainMo:mo,reserveMo:res,mainMethod:'Три пеленга (условно)',reserveMethod:'РЛС: пеленг и дистанция',landmarks:land,conditions:'open',radius:2,limitMode:'manual',hazard:name.indexOf('4')===0?'pair':'single',distance:name.indexOf('4')===0?'0.5':'1.0',distance2:'0.7',distanceUnit:'miles',targetProbability:95,traverse:''};}
 return {title:'Учебный пример: условный выход из Кольского залива',t0:'14:30',kc:1.1,m0:2.5,minInterval:5,margin:0,mode:'linear',segments:[s('1 · Начальный участок','01:00',6,2.5,2.8,'Ориентир А, Маяк Б (условные)'),s('2 · Расширение допустимой РСКП','01:10',7,3,3.4,'Ориентир В, Ориентир Г (условные)'),s('3 · Сужение','00:15',5,1.5,2,'Маяк Д (условный)'),s('4 · Недостаточная точность','00:35',5,5.6,6,'Ориентир Е (условный)')],overrides:{}};
}
var api={number:number,duration:duration,clock:clock,elapsed:elapsed,drift:drift,errorAt:errorAt,plan:plan,example:example,laplace:laplace,inverseLaplace:inverseLaplace,dangerLimit:dangerLimit,rayleighR:rayleighR,radialLimit:radialLimit,circularLimit:circularLimit,passage:passage,graphError:graphError};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ObsCore=api;
})(this);
