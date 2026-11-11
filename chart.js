(function(root){
'use strict';
function draw(ctx,p,width,height){
 var c=typeof ObsCore!=='undefined'?ObsCore:require('./core.js'),L=62,R=26,T=35,B=65,W=width-L-R,H=height-T-B,max=1,i,s,a,r,t;
 p.segments.forEach(function(s){max=Math.max(max,s.limit);});p.rows.forEach(function(r){max=Math.max(max,Math.min(r.mo,max*1.6),Math.min(r.reserveMo,max*1.6));});max=Math.ceil(max*1.26);
 function x(t){return L+t/p.total*W;}
 function y(e){return T+H-e/max*H;}
 function line(points,color,dash,w){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=w||2;ctx.setLineDash(dash||[]);points.forEach(function(pt,j){if(j===0)ctx.moveTo(pt[0],pt[1]);else ctx.lineTo(pt[0],pt[1]);});ctx.stroke();ctx.setLineDash([]);}
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.font='16px "Times New Roman",serif';ctx.fillStyle='#102c42';ctx.fillText('M, кб',8,22);
 p.warnings.forEach(function(w){if(w.kind!=='main')return;ctx.fillStyle='rgba(210,35,55,0.10)';ctx.fillRect(x(w.from),T,Math.max(1,x(w.to)-x(w.from)),H);});
 var yt=Math.max(1,Math.ceil(max/7));for(i=0;i<=max;i+=yt){line([[L,y(i)],[width-R,y(i)]],'#d2e3ed',[],1);ctx.fillStyle='#405c70';ctx.textAlign='right';ctx.fillText(String(i),L-10,y(i)+5);}
 ctx.textAlign='center';var tick=p.total<=240?60:Math.ceil(p.total/360)*60;if(p.total<60)tick=15;
 for(t=0;t<=p.total;t+=tick){line([[x(t),T],[x(t),T+H]],'#d2e3ed',[],1);ctx.fillStyle='#405c70';ctx.fillText(t===0?'T0':('T0+'+Math.floor(t/60)+'ч'+(t%60?String(t%60)+'м':'')),x(t),T+H+25);}
 line([[L,T-10],[L,T+H],[width-R+10,T+H]],'#102c42',[],2);ctx.textAlign='right';ctx.fillStyle='#102c42';ctx.fillText('Время от T0 · '+p.t0,width-R,height-6);
 ctx.save();ctx.beginPath();ctx.rect(L,T,W,H);ctx.clip();
 var points=[];p.segments.forEach(function(s){points.push([x(s.start),y(s.limit)]);points.push([x(s.end),y(s.limit)]);});line(points,'#075c94',[],3);
 var ocEnd=p.kc?Math.min(p.total,max/c.drift(1,p.kc).cables*60):p.total;line([[x(0),y(0)],[x(ocEnd),y(c.drift(ocEnd/60,p.kc).cables)]],'#70808d',[8,6],2);
 function curve(a,mo,col,dash){var pts=[],steps=p.mode==='rss'?24:1;for(var j=0;j<=steps;j++){var tm=a.start+(a.end-a.start)*j/steps;pts.push([x(tm),y(c.errorAt(mo,tm-a.start,p.kc,p.mode))]);}line(pts,col,dash,2.6);}
 p.arcs.forEach(function(a){curve(a,a.reserveMo,'#8a4300',[6,5]);curve(a,a.mo,'#006d60',[]);});
 p.rows.forEach(function(r,i){line([[x(r.time),T+H],[x(r.time),y(r.mo)]],'#91a9b7',[3,5],1);if(i>0){a=p.arcs[i-1];if(a&&Math.abs(a.end-r.time)<1e-6)line([[x(r.time),y(a.endError)],[x(r.time),y(r.mo)]],'#006d60',[],1);}
  ctx.beginPath();ctx.fillStyle='#fff';ctx.strokeStyle=r.valid?'#006d60':'#a32330';ctx.lineWidth=2;ctx.arc(x(r.time),y(r.mo),4.7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.fillStyle='#8a4300';ctx.arc(x(r.time),y(r.reserveMo),2.5,0,Math.PI*2);ctx.fill();
 });
 p.crossings.forEach(function(ci,i){var val=ci.error;if(ci.time>ci.at)line([[x(ci.at),y(c.errorAt(ci.mo,ci.at-ci.start,p.kc,p.mode))],[x(ci.time),y(val)]],'#006d60',[2,3],1);ctx.fillStyle='#006d60';ctx.fillRect(x(ci.time)-2,y(val)-2,4,4);});
 ctx.restore();ctx.textAlign='left';ctx.fillStyle='#526778';ctx.font='14px "Times New Roman",serif';ctx.fillText('OC',x(ocEnd*.5)+5,y(c.drift(ocEnd*.5/60,p.kc).cables)-8);
 var stride=Math.max(1,Math.ceil(p.rows.length/22));p.rows.forEach(function(r,i){if(i%stride!==0)return;ctx.fillStyle=r.valid?'#006d60':'#a32330';ctx.textAlign=r.time>p.total*.92?'right':'left';ctx.fillText(i===0?'M0':'Mо'+i,x(r.time)+6,y(Math.min(r.mo,max*.93))+((i%2)?18:-10));});
 p.crossings.forEach(function(ci,i){if(i%stride!==0)return;ctx.fillStyle='#075c94';ctx.fillText('C'+(i+1),x(ci.time)+4,Math.max(T+14,y(ci.error)-7-(i%2)*12));});ctx.textAlign='left';
 ctx.fillStyle='#405c70';ctx.fillText('T0 = '+p.t0+' · '+(p.mode==='linear'?'линейное сложение':'квадратическое сложение')+' · РСКП в кб',L,height-27);
}
var api={draw:draw};if(typeof module==='object'&&module.exports)module.exports=api;else root.ObsChart=api;
})(this);
