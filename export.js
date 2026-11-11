(function(root){
'use strict';
// PDF contains raster JPEG pages: Cyrillic and formulas need no installed PDF fonts.
function pdf(images){
 var objects=['<< /Type /Catalog /Pages 2 0 R >>',''],kids=[],i;
 images.forEach(function(im,i){var page=3+i*3,img=page+1,stream=page+2,w=842,h=595,scale=Math.min((w-32)/im.width,(h-32)/im.height),pw=im.width*scale,ph=im.height*scale,cmd='q '+pw.toFixed(3)+' 0 0 '+ph.toFixed(3)+' 16 '+(h-16-ph).toFixed(3)+' cm /Im0 Do Q';kids.push(page+' 0 R');objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 '+img+' 0 R >> >> /Contents '+stream+' 0 R >>');objects.push('<< /Type /XObject /Subtype /Image /Width '+im.width+' /Height '+im.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+im.data.length+' >>\nstream\n'+im.data+'\nendstream');objects.push('<< /Length '+cmd.length+' >>\nstream\n'+cmd+'\nendstream');});
 objects[1]='<< /Type /Pages /Count '+images.length+' /Kids ['+kids.join(' ')+'] >>';var out='%PDF-1.3\n%\xE2\xE3\xCF\xD3\n',offsets=[0];for(i=0;i<objects.length;i++){offsets.push(out.length);out+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}var xref=out.length;out+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n';for(i=1;i<offsets.length;i++)out+=('0000000000'+offsets[i]).slice(-10)+' 00000 n \n';out+='trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return out;
}
function textLines(ctx,text,width){
 var remaining=String(text),lines=[],i,lastSpace;
 if(!remaining)return [''];
 while(remaining){
  i=0;lastSpace=-1;
  while(i<remaining.length&&ctx.measureText(remaining.slice(0,i+1)).width<=width){if(remaining.charAt(i)===' ')lastSpace=i;i++;}
  if(i===remaining.length){lines.push(remaining);break;}
  if(i===0)i=1;
  if(lastSpace>0){lines.push(remaining.slice(0,lastSpace));remaining=remaining.slice(lastSpace+1);}
  else {lines.push(remaining.slice(0,i));remaining=remaining.slice(i);}
 }
 return lines;
}
function wrap(ctx,text,x,y,width,lineHeight,maxLines){
 var lines=textLines(ctx,text,width),count=Math.min(lines.length,maxLines||lines.length);
 for(var i=0;i<count;i++)ctx.fillText(lines[i]+(maxLines&&i===count-1&&lines.length>count?'…':''),x,y+i*lineHeight);
 return count;
}
function pages(p,title){
 var list=[],C=root.ObsCore,Chart=root.ObsChart,widths=[55,85,145,85,290,290,290,115,115],heads=['№','От T0','Судовое','Mдоп','Осн. способ','Рез. способ','Ориентиры','Mо осн.','Mо рез.'];
 var measure=document.createElement('canvas').getContext('2d'),groups=[],group=[],used=0;
 measure.font='17px "Times New Roman",serif';
 p.rows.forEach(function(r,i){
  var vals=[String(i),C.elapsed(r.time),C.clock(p.t0,r.time),String(r.limit),r.mainMethod,r.reserveMethod,r.landmarks,String(r.mainMo),String(r.reserveMo)];
  var lines=vals.map(function(v,j){return textLines(measure,v,widths[j]-10);}),count=1;lines.forEach(function(v){count=Math.max(count,v.length);});var height=Math.max(38,count*18+10);
  if(height>390)throw Error('Поле обсервации '+i+' слишком длинное для листа; сократите его перед экспортом. Данные не усечены.');
  if(used+height>390&&group.length){groups.push(group);group=[];used=0;}
  group.push({row:r,lines:lines,height:height});used+=height;
 });if(group.length)groups.push(group);
 var warningGroups=[],wg=[],wu=0;
 measure.font='20px "Times New Roman",serif';p.warnings.forEach(function(w){var lines=textLines(measure,w.text,1500),h=lines.length*24+46;if(wu+h>740&&wg.length){warningGroups.push(wg);wg=[];wu=0;}wg.push({warning:w,lines:lines,height:h});wu+=h;});if(wg.length)warningGroups.push(wg);
 var safetyGroups=[],sg=[],su=0,sw=[390,230,260,190,190,280],sh=['Участок / опасность','T0 / судовое','D⊥1 / D⊥2, кб','M, кб','Mдоп, кб','P / Pз'];
 function pct(v){return (v*100).toFixed(2)+' %';}
 measure.font='20px "Times New Roman",serif';
 (p.safety||[]).forEach(function(r){var vals=[r.name+' · '+(r.hazard==='pair'?'между двумя':'одиночная'),C.elapsed(r.time)+' / '+C.clock(p.t0,r.time),r.distance.toFixed(2)+(r.distance2!==null?' / '+r.distance2.toFixed(2):''),r.m.toFixed(2)+(r.extrapolated?' *':''),r.limit.toFixed(2)+(r.z?' (Z='+r.z.toFixed(3)+')':'')+(r.r?' (R='+r.r.toFixed(3)+', Рэлей)':''),pct(r.p)+' / '+pct(r.target)],lines=vals.map(function(v,j){return textLines(measure,v,sw[j]-16);}),n=1;lines.forEach(function(v){n=Math.max(n,v.length);});var height=Math.max(65,n*25+20);if(height>600)throw Error('Название участка слишком длинное для экспорта вероятности; сократите его.');if(su+height>600&&sg.length){safetyGroups.push(sg);sg=[];su=0;}sg.push({lines:lines,height:height,bad:r.aboveLimit||r.p<r.target});su+=height;});
 if(sg.length)safetyGroups.push(sg);if(!safetyGroups.length)safetyGroups.push([]);
 var total=groups.length+safetyGroups.length+warningGroups.length;
 function base(page){
  var canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1130;var g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,1600,1130);g.fillStyle='#063b66';g.fillRect(0,0,1600,75);g.fillStyle='#fff';g.font='30px "Times New Roman",serif';g.fillText('График обсерваций · учебный, не для навигации',35,47);g.fillStyle='#405c70';g.font='20px "Times New Roman",serif';wrap(g,title||'Учебный план',35,105,1500,24,1);g.fillText('T0 '+p.t0+' · Kс '+p.kc+' мили/ч · '+(p.mode==='linear'?'по книге, линейно':'RSS, независимые ошибки')+' · запас '+p.margin+' мин · минимум '+p.minInterval+' мин',35,137);g.fillText('Лист '+page+' / '+total+' · Все времена судовые, погрешности в кб',35,1103);return {canvas:canvas,g:g};
 }
 function encoded(canvas){return {width:canvas.width,height:canvas.height,png:canvas.toDataURL('image/png').split(',')[1],jpeg:atob(canvas.toDataURL('image/jpeg',0.88).split(',')[1])};}
 groups.forEach(function(rows,pg){
  var b=base(pg+1),g=b.g;g.save();g.translate(25,155);Chart.draw(g,p,1545,440);g.restore();
  g.font='18px "Times New Roman",serif';g.fillStyle='#405c70';g.fillText('━━ Mдоп   ━━ Основной   ┄┄ Резервный   ┄┄ OC   ○ Mоi   Cᵢ — предельные точки',40,606);
  var xx=30,yy=625;heads.forEach(function(h,i){g.fillStyle='#e4eff8';g.fillRect(xx,yy,widths[i],35);g.strokeStyle='#93b4ca';g.strokeRect(xx,yy,widths[i],35);g.fillStyle='#102c42';g.fillText(h,xx+6,yy+24);xx+=widths[i];});
  var y=660;rows.forEach(function(item,k){var x=30;item.lines.forEach(function(lines,j){g.fillStyle=item.row.valid?(k%2?'#eff7fc':'#fff'):'#ffe5e7';g.fillRect(x,y,widths[j],item.height);g.strokeStyle='#93b4ca';g.strokeRect(x,y,widths[j],item.height);g.fillStyle='#102c42';g.font='17px "Times New Roman",serif';lines.forEach(function(line,ln){g.fillText(line,x+5,y+18+ln*18);});x+=widths[j];});y+=item.height;});
  g.font='17px "Times New Roman",serif';g.fillStyle='#8b1825';g.fillText('Предупреждений основного плана: '+p.warnings.filter(function(w){return w.kind==='main';}).length+'; резерв/формула — в приложении к таблице.',35,1066);list.push(encoded(b.canvas));
 });
 safetyGroups.forEach(function(items,sp){
  var b=base(groups.length+sp+1),g=b.g;g.fillStyle='#083f70';g.font='28px "Times New Roman",serif';g.fillText('Вероятность прохода на заданных траверзах',35,190);g.font='21px "Times New Roman",serif';
  wrap(g,p.routeProbability===null?'P не рассчитана: нет геометрии опасностей.':'Произведение P: '+pct(p.routeProbability)+'; учтено '+p.safety.length+' из '+p.segments.length+' участков. '+(p.safetyComplete?'Геометрия задана для всех участков.':'НЕПОЛНЫЙ расчёт.'),35,225,1500,26);
  wrap(g,'Только учебная модель. M — с графика перед обсервацией; * — экстраполяция после 2 ч. Произведение предполагает применимость модели независимых событий.',35,278,1500,25);
  var x=30,y=350;sh.forEach(function(h,i){g.fillStyle='#e4eff8';g.fillRect(x,y,sw[i],50);g.fillStyle='#102c42';g.fillText(h,x+8,y+31);x+=sw[i];});y+=50;
  g.font='20px "Times New Roman",serif';items.forEach(function(item){var x=30;item.lines.forEach(function(lines,j){g.fillStyle=item.bad?'#ffe5e7':'#eff7fc';g.fillRect(x,y,sw[j],item.height);g.strokeStyle='#93b4ca';g.strokeRect(x,y,sw[j],item.height);g.fillStyle='#102c42';lines.forEach(function(line,k){g.fillText(line,x+8,y+25+k*25);});x+=sw[j];});y+=item.height;});
  g.fillStyle='#8b1825';g.font='20px "Times New Roman",serif';wrap(g,'Mдоп по D⊥1 и Pз — только для одиночной опасности. Между двумя проверяйте итоговую P; участки без геометрии не оценены. Реальная безопасность не подтверждается.',35,1020,1500,26);list.push(encoded(b.canvas));
 });
 warningGroups.forEach(function(items,wp){
  var b=base(groups.length+safetyGroups.length+wp+1),g=b.g;g.fillStyle='#083f70';g.font='28px "Times New Roman",serif';g.fillText('Предупреждения и ограничения',35,191);var y=230;
  items.forEach(function(item){var w=item.warning;g.fillStyle=w.kind==='main'?'#8b1825':'#644500';g.font='21px "Times New Roman",serif';g.fillText((w.kind==='main'?'ОСНОВНОЙ':w.kind==='reserve'?'РЕЗЕРВНЫЙ':w.kind==='probability'?'ВЕРОЯТНОСТЬ':'ФОРМУЛА')+' · от T0+'+C.elapsed(w.from)+' до T0+'+C.elapsed(w.to),35,y);g.fillStyle='#102c42';g.font='20px "Times New Roman",serif';item.lines.forEach(function(line,i){g.fillText(line,35,y+27+i*24);});y+=item.height;});
  g.font='20px "Times New Roman",serif';g.fillStyle='#8b1825';wrap(g,'Меры: изменить путь, увеличить расстояние до опасности; тщательно вести счисление; включить эхолот и контролировать глубины; снизить ход.',35,1000,1500,27);list.push(encoded(b.canvas));
 });
 return list;
}
function save(base64,mime,name,container){
 if(root.AndroidExport&&root.AndroidExport.saveBase64){root.AndroidExport.saveBase64(base64,mime,name);return;}
 // NW.js 0.14 supports local save dialog; no server or network is involved.
 if(typeof require==='function'&&root.process&&root.process.versions&&root.process.versions.nw){var input=document.createElement('input');input.type='file';input.setAttribute('nwsaveas',name);input.style.display='none';document.body.appendChild(input);input.onchange=function(){if(input.value)require('fs').writeFileSync(input.value,new (require('buffer').Buffer)(base64,'base64'));document.body.removeChild(input);};input.click();return;}
 var a=document.createElement('a');a.href='data:'+mime+';base64,'+base64;a.download=name;a.textContent='Сохранить '+name;container.appendChild(a);a.click();
}
var api={pdf:pdf,pages:pages,save:save};if(typeof module==='object'&&module.exports)module.exports=api;else root.ObsExport=api;
})(this);
