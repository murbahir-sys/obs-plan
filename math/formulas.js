/* Presentation only. The solver's strings/values are never parsed back into calculations. */
(function(root){
'use strict';
var functions=['atan2','arcsin','arccos','arctg','cosec','slerp','atanh','sin','cos','ctg','tg','ln'];
var greek={'φ':'varphi','λ':'lambda','σ':'sigma','γ':'gamma','ψ':'psi','α':'alpha','ε':'varepsilon','π':'pi','Δ':'Delta','Σ':'Sigma'};
var symbols={'−':'-','·':'\\cdot ','×':'\\times ','±':'\\pm ','∓':'\\mp ','≈':'\\approx ','≤':'\\le ','≥':'\\ge ','⇒':'\\Rightarrow ','⇔':'\\Leftrightarrow ','→':'\\to ','∞':'\\infty ','⊕':'\\oplus ','⊖':'\\ominus ','…':'\\ldots '};
var supers={'²':'2','³':'3','½':'\\frac{1}{2}','³ᐟ²':'\\frac{3}{2}'},subs={'₀':'0','₁':'1','₂':'2','₃':'3','ᵢ':'i','ᵥ':'V','₋':'-','ₙ':'n'};
function escaped(s){return s.replace(/([{}%&#_$])/g,'\\$1').replace(/\\(?![{}%&#_$])/g,'\\textbackslash ');}
function tokens(s){
 var out=[],i=0,m,c,j,fn,previous,end;
 while(i<s.length){
  c=s.charAt(i);if(/\s|\u00a0/.test(c)){i++;continue;}
  // These exact inherited prose shorthands mean alternatives, not division.
  m=s.slice(i).match(/^(0°\/180°|ctg A\/B|cos\/tg|cos\/sin|N\/E|S\/W)/);if(m){out.push({kind:'atom',t:'\\text{'+m[0]+'}'});i+=m[0].length;continue;}
  m=s.slice(i).match(/^\d+°\s*\d+(?:[.,]\d+)?[′'](?:\s*\d+(?:[.,]\d+)?″)?/);
  if(m){out.push({kind:'atom',t:m[0].replace(/,/g,'{,}').replace(/°/g,'{}^{\\circ}').replace(/[′']/g,'{}^{\\prime}').replace(/″/g,'{}^{\\prime\\prime}')});i+=m[0].length;continue;}
  m=s.slice(i).match(/^\d+(?:[.,]\d+)?/);if(m){out.push({kind:'atom',t:m[0].replace(',', '{,}'),number:m[0]});i+=m[0].length;continue;}
  m=s.slice(i).match(/^cos\s+или\s+sin/);if(m){out.push({kind:'fn',t:'\\operatorname{cos\\;или\\;sin}'});i+=m[0].length;continue;}
  fn=null;for(j=0;j<functions.length;j++)if(s.slice(i,i+functions[j].length)===functions[j]){fn=functions[j];break;}
  if(fn){out.push({kind:'fn',t:/^(sin|cos|ln|arcsin|arccos)$/.test(fn)?'\\'+fn:'\\operatorname{'+fn+'}'});i+=fn.length;continue;}
  if(c==='√'){out.push({kind:'sqrt',t:c});i++;continue;}
  if(greek[c]||/[a-zA-Z]/.test(c)){
   end=i+1;var t=greek[c]?'\\'+greek[c]:c;
   if(c==='Δ'&&/[λφDS]/.test(s.charAt(end))){c=s.charAt(end++);t='\\Delta '+(greek[c]?'\\'+greek[c]:c);}
   // Subscripts in the inherited display notation: φA, Kн, SДБК, Xlocal, e.g.
   m=s.slice(end).match(/^(local|WGS|условн|ДБК|ср|[нклэ]|[ABVi])(?=$|[^a-zA-Zа-яА-ЯёЁ]|sin|cos|ctg|tg)/);
   if(m){t+='_{'+(/^[ABVi]$/.test(m[0])?m[0]:'\\mathrm{'+m[0]+'}')+'}';end+=m[0].length;}
   out.push({kind:'atom',t:t});i=end;continue;
  }
  if(/[а-яА-ЯёЁ]/.test(c)){m=s.slice(i).match(/^[а-яА-ЯёЁ]+/);out.push({kind:'text',t:m[0]});i+=m[0].length;continue;}
  if(s.slice(i,i+3)==='³ᐟ²'){out.push({kind:'sup',t:supers['³ᐟ²']});i+=3;continue;}
  if(supers[c]){out.push({kind:'sup',t:supers[c]});i++;continue;}
  if(subs[c]){m='';while(subs[s.charAt(i)])m+=subs[s.charAt(i++)];out.push({kind:'sub',t:m});continue;}
  if(c==='°'||c==='′'||c==='″'||c==="'"){out.push({kind:'post',t:c==='°'?'{}^{\\circ}':c==='″'?'{}^{\\prime\\prime}':'{}^{\\prime}'});i++;continue;}
  out.push({kind:'op',t:symbols[c]||c,raw:c});i++;
 }
 return out;
}
function tex(source,signs){
 var ts=tokens(source),at=0;
 function bare(n){return n.inner===undefined?n.t:n.inner;}
 function atom(){
  var x=ts[at++],n,inner,close,p,exponent='';if(!x)return {t:''};
  if(x.kind==='fn'){
   while(ts[at]&&ts[at].kind==='sup')exponent+='^{'+ts[at++].t+'}';
   n=atom();
   // The inherited inline explanation writes tg A/2 for the half-angle tangent.
   if(/\\operatorname\{(?:tg|ctg)\}/.test(x.t)&&n.inner===undefined&&ts[at]&&ts[at].raw==='/'&&ts[at+1]&&ts[at+1].number==='2'){at+=2;n={t:'\\frac{'+n.t+'}{2}'};}
   return {t:x.t+exponent+' '+n.t};
  }
  if(x.kind==='sqrt'){n=atom();return {t:'\\sqrt{'+bare(n)+'}'};}
  if(x.raw==='-'||x.raw==='−'||x.raw==='+'){
   n=atom();return {t:(x.raw==='+'?'+':'-')+n.t,number:n.number?(x.raw==='+'?'':'-')+n.number:undefined};
  }
  if(x.raw==='('||x.raw==='['){
   close=x.raw==='('?')':']';inner=sequence(close);if(ts[at]&&ts[at].raw===close)at++;
   n={t:'\\left'+x.raw+inner+'\\right'+close,inner:inner};
   if(/^-?\d+(?:\{,\}|[.])\d+$/.test(inner))n.number=inner.replace('{,}',',');
  }else if(x.kind==='text')n={t:'\\text{'+escaped(x.t)+'}'};
  else n={t:x.t,number:x.number};
  while(ts[at]){
   p=ts[at];if(p.kind==='sup'){n.t='{'+n.t+'}^{'+p.t+'}';at++;delete n.inner;}
   else if(p.kind==='sub'){n.t=/_\{.*\}$/.test(n.t)?n.t.slice(0,-1)+p.t+'}':'{'+n.t+'}_{'+p.t+'}';at++;delete n.inner;}
   else if(p.kind==='post'){n.t+=p.t;at++;delete n.number;delete n.inner;}
   else break;
  }
  return n;
 }
 function mark(n){if(signs&&n.number&&/[.,]/.test(n.number))return '\\overset{'+(n.number.charAt(0)==='-'?'\\ominus':'\\oplus')+'}{'+n.t+'}';return n.t;}
 function product(){
  var n=atom(),p,r,op;
  while(at<ts.length){
   p=ts[at];op=p.raw;
   if(op==='/'||op==='·'||op==='×'||op==='*'){
    at++;r=atom();n={t:op==='/'?'\\frac{'+(n.inner!==undefined?bare(n):mark(n))+'}{'+(r.inner!==undefined?bare(r):mark(r))+'}':mark(n)+(op==='×'?'\\times ':'\\cdot ')+mark(r)};
   }else if(p.kind==='atom'||p.kind==='fn'||p.kind==='sqrt'||op==='('||op==='['){r=atom();n={t:n.t+' '+r.t};}
   else break;
  }
  return n.t;
 }
 function sequence(close){
  var result='',p;
  while(at<ts.length&&(!close||ts[at].raw!==close)){
   p=ts[at];if(p.kind==='op'&&p.raw!=='('&&p.raw!=='['&&p.raw!=='-'&&p.raw!=='−'&&p.raw!=='+'){
    result+=p.t+' ';at++;
   }else if(p.kind==='text'){result+='\\text{'+escaped(p.t)+'}\\ ';at++;}
   else result+=product()+' ';
  }
  return result.trim();
 }
 return sequence();
}
var api={tex:tex,tokens:tokens,layoutTex:layoutTex,errors:[],count:0};
if(typeof module==='object'&&module.exports)module.exports=api;
if(!root.document)return;
root.TextbookMath=api;
function layoutTex(text,display){
 var source=tex(text,display),depth=0,parts=[],last=0;
 if(display&&text.length>65){for(var i=0;i<text.length;i++){var c=text.charAt(i);if(c==='('||c==='[')depth++;if(c===')'||c===']')depth--;if(c==='='&&depth===0){parts.push(text.slice(last,i));last=i+1;}}if(parts.length>1){parts.push(text.slice(last));source='\\begin{aligned}'+tex(parts.shift(),display)+' &='+parts.map(function(p){return tex(p,display);}).join('\\\\ &=' )+'\\end{aligned}';}}
 return (display?'\\displaystyle ':'')+source;
}
api.layoutTex=layoutTex;
function mathHTML(text,signs){return root.katex.renderToString(layoutTex(text,signs),{output:'html',displayMode:false,throwOnError:true,strict:'ignore',trust:false,minRuleThickness:.055});}
function renderNode(node,display){
 var text=node.nodeValue;if(!text||!text.trim())return;
 // Prose stays ordinary text; only contiguous notation is passed to KaTeX.
 var ts=tokens(text),math='',pieces=[],hasMath=false;
 function flush(){if(math){pieces.push({math:math});math='';}}
 // Boundaries are derived from the exact original substrings, not reconstructed tokens.
 var regex=/[а-яА-ЯёЁ]+/g,last=0,m,word,start,prev;
 while((m=regex.exec(text))){word=m[0];start=m.index;prev=start?text.charAt(start-1):'';
  if(word==='или'&&/cos\s+$/.test(text.slice(0,start))&&/^\s+sin/.test(text.slice(start+word.length)))continue;
  if(/^(н|к|л|э|ср|ДБК|условн)$/.test(word)&&/[A-Za-zφλσ]/.test(prev))continue;
  math+=text.slice(last,start);flush();pieces.push({text:word});last=start+word.length;
 }
 math+=text.slice(last);flush();
 var fragment=document.createDocumentFragment();
 for(var i=0;i<pieces.length;i++){
  var p=pieces[i],s=p.math;
  if(p.text!==undefined){fragment.appendChild(document.createTextNode(p.text));continue;}
  if(!/[A-Za-zφλσγψαεπΔΣ√=<>≈≤≥⇒⇔²³/]/.test(s)){fragment.appendChild(document.createTextNode(s));continue;}
  // Keep equation numbers and the explanatory dash outside the expression.
  var chunks=s.split(/(\s{2,}|\u00a0{2,}|;\s*)/);
  for(var j=0;j<chunks.length;j++){
   var chunk=chunks[j];if(!chunk)continue;
   if(/^\s+$|^;\s*$/.test(chunk)){var sep=document.createElement(display?'br':'span');if(!display)sep.textContent=chunk;fragment.appendChild(sep);continue;}
   var span=document.createElement('span');span.className=display?'math-line':'math-inline';span.setAttribute('role','math');span.setAttribute('aria-label',chunk.trim());
   var leading=chunk.match(/^\s+/),trailing=chunk.match(/\s+$/);if(leading)fragment.appendChild(document.createTextNode(leading[0]));
   try{span.innerHTML=mathHTML(chunk,display);api.count++;}catch(error){api.errors.push({source:chunk,message:String(error)});span.className+=' math-error';span.textContent='Ошибка набора формулы';}
   fragment.appendChild(span);if(trailing)fragment.appendChild(document.createTextNode(trailing[0]));hasMath=true;
  }
 }
 if(hasMath)node.parentNode.replaceChild(fragment,node);
}
function inside(node,selector){var p=node.parentNode;while(p&&p!==document){if(p.nodeType===1&&p.matches(selector))return p;p=p.parentNode;}return null;}
function render(){
 var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false),list=[],node;
 while((node=walker.nextNode())){
  if(inside(node,'script,style,textarea,input,select,option,svg,.katex,.math-inline,.math-line,.math-error,button,header,footer'))continue;
  var block=inside(node,'.formula,.fml,.f'),context=inside(node,'.doc,.cols3,#solution,#teacher-solver,.correct-value,.hint');
  if(block||context&&/[=≈≤≥√φλσγψαεπΔΣ]|\b(?:sin|cos|ctg|cosec|tg)\b/.test(node.nodeValue))list.push({node:node,display:!!block});
 }
 for(var i=0;i<list.length;i++)renderNode(list[i].node,list[i].display);
}
function measure(){var lines=document.querySelectorAll('.math-line');for(var i=0;i<lines.length;i++){var e=lines[i];if(e.clientWidth&&e.scrollWidth>e.clientWidth+2){e.setAttribute('tabindex','0');e.setAttribute('title','Длинная формула: прокрутите влево или вправо');var block=inside(e,'.formula,.fml,.f');if(block)block.classList.add('math-wide');}}}
api.render=render;root.addEventListener('resize',measure);root.addEventListener('click',function(){setTimeout(measure,0);});if(document.fonts&&document.fonts.ready)document.fonts.ready.then(measure);
var observer=new MutationObserver(function(){observer.disconnect();render();measure();observe();});
function observe(){observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
render();observe();
}(typeof window==='object'?window:this));
