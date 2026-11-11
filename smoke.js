(function(root){
'use strict';
// Native smoke hook: active only inside NW.js when OBSPLAN_SMOKE names an output directory. Inert otherwise.
if(typeof require!=='function'||!root.process||!root.process.env||!root.process.env.OBSPLAN_SMOKE)return;
var fs=require('fs'),dir=root.process.env.OBSPLAN_SMOKE,checks=[],failed=0;
function ok(name,cond,extra){checks.push({name:name,pass:!!cond,extra:extra||''});if(!cond)failed++;}
function done(err){var res={pass:!err&&failed===0,error:err?String(err.stack||err):'',checks:checks,userAgent:navigator.userAgent};fs.writeFileSync(dir+'/result.json',JSON.stringify(res,null,1));setTimeout(function(){try{require('nw.gui').App.quit();}catch(e){root.process.exit(0);}},4500);}
setTimeout(function(){try{
 ok('tabs 3',document.querySelectorAll('nav button').length===3);
 root.ObsApp.navigate('theory');ok('theory visible',!document.getElementById('theory').hidden);
 ok('katex formulas',document.querySelectorAll('#theory .katex').length>=4,document.querySelectorAll('#theory .katex').length);
 root.ObsApp.example();ok('calc visible',!document.getElementById('calc').hidden);
 ok('results shown',!document.getElementById('results').hidden);
 var rows=document.querySelectorAll('#obs-table tbody tr').length;ok('table rows 7',rows===7,rows);
 var w=document.getElementById('warnings').textContent;ok('warning 02:25..03:00',/2ч25м/.test(w)||/02:25/.test(w),w.slice(0,80));
 var cv=document.getElementById('chart');ok('canvas drawn',cv.toDataURL('image/png').length>5000);
 var p=root.ObsCore.plan(root.ObsCore.example()),pages=root.ObsExport.pages(p,'smoke');ok('export pages',pages.length>=1,pages.length);
 pages.forEach(function(pg,i){fs.writeFileSync(dir+'/export-'+(i+1)+'.png',new (require('buffer').Buffer)(pg.png,'base64'));});
 var images=pages.map(function(pg){return {data:pg.jpeg,width:pg.width,height:pg.height};});
 fs.writeFileSync(dir+'/export.pdf',new (require('buffer').Buffer)(btoa(root.ObsExport.pdf(images)),'base64'));
 var d=root.ObsCore.dangerLimit(2,'miles',95);ok('source Z and limit',Math.abs(d.z-1.644853626951)<1e-6&&Math.abs(d.limit/10-1.702279129)<1e-6);
 ok('Laplace inverse roundtrip',Math.abs(root.ObsCore.laplace(root.ObsCore.inverseLaplace(.9))-.9)<1e-10);
 ok('probability table rows',document.querySelectorAll('#safety-table tbody tr').length===4);
 ok('route probability product',p.routeProbability>0&&p.routeProbability<1&&p.safetyComplete);
 ok('radial formula 1.8 correction',document.getElementById('radial-limit').textContent.indexOf('Dоп/R')>=0);
 var radial=root.ObsCore.circularLimit(2,'miles',95);ok('Rayleigh R and radial limit',Math.abs(radial.r-1.730818382602285)<1e-10&&Math.abs(radial.limit/10-2/1.730818382602285)<1e-10);
 ok('source MT circular coefficient separate',Math.abs(root.ObsCore.radialLimit(2,'miles',1.71)/10-2/1.71)<1e-10);
 ok('P99 central .98 source table2.32',Math.abs(root.ObsCore.inverseLaplace(.98)-2.32)<.01);
 var select=document.getElementById('seg-0-limitMode');select.value='circle';select.onchange();document.getElementById('seg-0-radius').value='2';document.getElementById('seg-0-distanceUnit').value='miles';root.ObsApp.calculate();ok('native radial controls',Math.abs(root.ObsApp.result.segments[0].r-1.730818382602285)<1e-10&&document.getElementById('seg-0-limit-result').textContent.indexOf('1,71')>=0);

 ok('files written',fs.existsSync(dir+'/export.pdf'));root.ObsApp.example();fs.writeFileSync(dir+'/ready.txt','1');
 setTimeout(function(){done();},300);
}catch(e){done(e);}},1500);
})(this);
