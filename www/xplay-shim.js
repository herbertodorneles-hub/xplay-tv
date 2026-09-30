/* XPLAY shim v2 — incluir no <head> de todo jogo (antes de qualquer script do jogo).
   - PS (botão 16) ou Share+Options: abre o menu do XPLAY
   - Segurar PS ~0,8s, ou segurar Voltar/Esc ~0,7s: sai direto para a biblioteca
   - Menu aberto: congela requestAnimationFrame, suspende áudio e silencia o controle (0 CPU/GPU no jogo)
   - Share/PS nunca chegam ao jogo; Options some enquanto Share estiver apertado (evita pausa dupla) */
(function(){
if(window.__xplayShim)return;window.__xplayShim=1;
var embedded=parent!==window,held=false,raf=window.requestAnimationFrame.bind(window),caf=window.cancelAnimationFrame.bind(window),
    orig=navigator.getGamepads&&navigator.getGamepads.bind(navigator),ctxs=[],queue=[],qid=0;
function send(t){try{parent.postMessage({xplay:t},'*')}catch(e){}}

/* ---- congelar/retomar o loop do jogo ---- */
window.requestAnimationFrame=function(cb){
  if(!held)return raf(cb);
  var id=--qid;queue.push({id:id,cb:cb});return id};
window.cancelAnimationFrame=function(id){
  if(id<0){for(var i=0;i<queue.length;i++)if(queue[i].id===id){queue.splice(i,1);break}}else caf(id)};
function setHold(v){
  if(held===v)return;held=v;
  ctxs.forEach(function(c){try{v?c.suspend():c.resume()}catch(e){}});
  if(!v){var q=queue;queue=[];q.forEach(function(x){raf(x.cb)})}}

/* ---- rastrear AudioContext para poder suspender ---- */
['AudioContext','webkitAudioContext'].forEach(function(n){var A=window[n];if(!A)return;
  var W=function(){var c=new (Function.prototype.bind.apply(A,[null].concat([].slice.call(arguments))));ctxs.push(c);if(held)try{c.suspend()}catch(e){}return c};
  W.prototype=A.prototype;window[n]=W});

/* ---- controle: esconder Share/PS do jogo e silenciar com menu aberto ---- */
var ZERO={pressed:false,touched:false,value:0};
function wrap(g){
  if(!g)return g;var b=g.buttons,sh=b[8]&&b[8].pressed,nb=[];
  for(var i=0;i<b.length;i++)nb.push(i===8||i===16||(i===9&&sh)?ZERO:b[i]);
  return{id:g.id,index:g.index,connected:g.connected,mapping:g.mapping,timestamp:g.timestamp,axes:g.axes,buttons:nb,vibrationActuator:g.vibrationActuator,hapticActuators:g.hapticActuators}}
if(orig)navigator.getGamepads=function(){
  if(held)return[null,null,null,null];
  var a=orig(),r=[];for(var i=0;i<a.length;i++)r.push(wrap(a[i]));return r};

addEventListener('message',function(e){if(e.data&&e.data.xplay){
  if(e.data.xplay==='hold')setHold(!!e.data.v);
  else if(e.data.xplay==='stop')stop()}});

/* ---- encerramento limpo (o XPLAY manda 'stop' antes de destruir o iframe) ---- */
function stop(){
  held=true;queue=[];
  ctxs.forEach(function(c){try{c.close()}catch(e){}});
  try{var cs=document.getElementsByTagName('canvas');for(var i=0;i<cs.length;i++){
    var g=cs[i].getContext('webgl')||cs[i].getContext('webgl2');
    var x=g&&g.getExtension('WEBGL_lose_context');if(x)x.loseContext()}}catch(e){}
  try{window.dispatchEvent(new Event('xplay-stop'))}catch(e){}}

/* ---- indicador "segure para sair" ---- */
var bar;
function showExit(p){
  if(!bar){bar=document.createElement('div');bar.style.cssText='position:fixed;left:50%;bottom:6%;transform:translateX(-50%);z-index:2147483647;background:#000c;color:#fff;font:700 16px sans-serif;padding:10px 18px;border-radius:24px;pointer-events:none;display:none;white-space:nowrap';
    bar.innerHTML='Saindo… <span style="display:inline-block;width:120px;height:8px;border-radius:4px;background:#fff3;vertical-align:middle;overflow:hidden"><i style="display:block;height:100%;width:0;background:#22e6ff"></i></span>';
    (document.body||document.documentElement).appendChild(bar)}
  bar.style.display=p>0?'block':'none';if(p>0)bar.querySelector('i').style.width=Math.min(100,p*100)+'%'}

/* ---- Voltar/Esc longo (controles de TV traduzem ○ em Back) ---- */
var kt=0,kdone=0;
function isBack(e){var k=(e.key||'').toLowerCase(),c=(e.code||'').toLowerCase();
  return k==='escape'||k==='browserback'||k==='goback'||c==='browserback'||e.keyCode===4||e.keyCode===196}
addEventListener('keydown',function(e){
  if(e.key==='F1'){e.preventDefault();send('menu');return}
  if(isBack(e)&&!e.repeat&&!kt){kdone=0;kt=performance.now()}},true);
addEventListener('keyup',function(e){if(isBack(e)){kt=0;showExit(0)}},true);
addEventListener('blur',function(){kt=0;showExit(0)});

/* ---- laço do shim (usa rAF nativo, roda mesmo com jogo congelado) ---- */
var sent=0,ps=0;
function tick(){
  var g=orig&&orig(),p=g&&Array.prototype.find.call(g,Boolean),now=performance.now(),hp=0;
  if(p){var b=function(i){return p.buttons[i]&&p.buttons[i].pressed},psb=b(16),combo=b(8)&&b(9);
    if(!held){
      if((psb||combo)&&!sent){sent=1;send('menu')}
      if(!psb&&!combo)sent=0}
    if(psb){if(!ps)ps=now;hp=(now-ps)/800;if(hp>=1&&!kdone){kdone=1;send('exit')}}else ps=0}
  var kp=kt?(now-kt-250)/450:0;if(kt&&kp>=1&&!kdone){kdone=1;send('exit')}
  showExit(Math.max(hp>.25?hp:0,kp>0?kp:0));
  raf(tick)}
if(embedded){raf(tick);addEventListener('load',function(){try{window.focus()}catch(e){}})}
})();
