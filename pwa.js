(function(){
'use strict';
var status=document.getElementById('pwa-status');
function text(s){if(status)status.textContent=s;}
if(typeof navigator==='undefined'||typeof location==='undefined'||(location.protocol!=='https:'&&location.protocol!=='http:')||!('serviceWorker' in navigator))return;
text('Подготовка офлайн-копии… Не закрывайте страницу до готовности.');
navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(function(reg){
 function update(){if(reg.waiting)text('Доступно обновление. Закройте все окна приложения и откройте снова с интернетом.');}
 reg.addEventListener('updatefound',function(){var worker=reg.installing;if(worker)worker.addEventListener('statechange',function(){if(worker.state==='redundant')text('Офлайн-копия не обновлена. Проверьте сеть и откройте страницу снова.');else update();});});
 navigator.serviceWorker.ready.then(function(){text('Офлайн готово · 0.3.1. В Safari: «Поделиться» → «На экран Домой».');update();});update();
}).catch(function(){text('Офлайн-копия недоступна. Проверьте сеть, HTTPS и разрешение хранения данных Safari.');});
})();
