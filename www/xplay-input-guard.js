/* XPLAY Input Guard v1
   Blinda a interface contra o "cursor fantasma" das Smart TVs.

   Com o Modo Controle ativo, todo click/pointerdown/mousedown/touchstart que NÃO seja de um ponteiro
   humano comprovado é cancelado na fase de captura (window), antes de qualquer listener da página e antes
   do clique nativo chegar ao elemento que está sob a coordenada X/Y. O gesto é então convertido em UMA
   única confirmação no item de foco lógico (.f:focus / .card-selected / .focused).

   Como diferencia mouse de PC x cursor de TV (sem nunca olhar para clientX/clientY):
     1. Plataforma: se for TV (UA, ?tv=1 ou localStorage 'xplay.tv'), nenhum ponteiro vale (tvAllowPointer=false).
     2. Fora de TV, mouse só vale se houve MOVIMENTO REAL do mouse depois da última entrada de controle/teclado
        ("posse" do mouse). Clique sem movimento prévio = fantasma. Mexer o mouse de verdade devolve a posse.
     3. Toque fora de TV só vale se o controle está parado há 'touchGraceMs' (tablet/celular com controle).
   Cliques programáticos (el.click() do próprio XPLAY) têm isTrusted=false e passam sempre.

   API:  const G = XPlayInputGuard.init({...});
         G.refresh()               reavalia isControlMode() e liga/desliga os listeners (chame ao conectar/desconectar controle)
         G.noteControllerInput()   avise a cada botão/tecla/analógico do controle
         G.click(el)               clique programático seguro (não é interceptado)
         G.isTV                    boolean */
(function (root) {
  'use strict';

  var TV_UA = /SMART-?TV|SmartTV|Tizen|Web0S|WebOS|NetCast|VIDAA|HbbTV|Android ?TV|Google ?TV|GoogleTV|BRAVIA|CrKey|AppleTV|Roku|Viera|AQUOS|Hisense|TCL|AFT[A-Z]|MiBOX|Philips/i;
  var EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'auxclick', 'contextmenu'];
  var ACTIONABLE = { pointerdown: 1, touchstart: 1, mousedown: 1, click: 1 }; // eventos que podem disparar a confirmação

  // Detecta suporte a {passive:false}; navegadores antigos de TV aceitam só boolean.
  var optsOK = false;
  try { var o = Object.defineProperty({}, 'passive', { get: function () { optsOK = true; } }); root.addEventListener('t', null, o); } catch (e) {}
  var CAP = optsOK ? { capture: true, passive: false } : true;
  var CAP_PASSIVE = optsOK ? { capture: true, passive: true } : true;

  function now() { return root.performance ? performance.now() : Date.now(); }

  function detectTV(pref) {
    if (pref === true || pref === false) return pref;
    try {
      var q = /[?&]tv=(\d)/.exec(location.search);
      if (q) { try { localStorage.setItem('xplay.tv', q[1]); } catch (e) {} return q[1] === '1'; }
      var s = localStorage.getItem('xplay.tv');
      if (s === '1' || s === '0') return s === '1';
    } catch (e) {}
    return TV_UA.test(navigator.userAgent || '');
  }

  function init(cfg) {
    cfg = cfg || {};
    var o = {
      isControlMode: cfg.isControlMode || function () { return document.body && document.body.classList.contains('pad'); },
      focusSelector: cfg.focusSelector || '.f:focus, .card-selected, .focused',
      scope: cfg.scope || function () { return document.body; },   // retorne null para "nada clicável agora"
      confirm: cfg.confirm || null,        // (el|null) => void ; padrão: clica em el com G.click
      onNoTarget: cfg.onNoTarget || null,  // chamado quando não há item focado
      onBlocked: cfg.onBlocked || null,    // (event, reason) => void — útil para debug
      tvAllowPointer: !!cfg.tvAllowPointer,
      tvAlwaysOn: cfg.tvAlwaysOn !== false, // em TV o guard fica ativo mesmo sem controle conectado
      claimPx: cfg.claimPx || 14,           // movimento acumulado para "tomar posse" do mouse
      settleMs: cfg.settleMs || 900,        // ignora mousemove logo após entrada de controle (scrollIntoView gera mousemove falso)
      touchGraceMs: cfg.touchGraceMs || 1500,
      lockMs: cfg.lockMs || 450,            // um gesto físico = uma ação (pointerdown+mousedown+touchstart+click)
      requireTrusted: cfg.requireTrusted !== false
    };
    var isTV = detectTV(cfg.tv);
    var attached = false, internal = false;
    var lastCtrl = 0, mouseOwner = false, lastX = -1, lastY = -1, acc = 0, lockUntil = 0;

    function active() { return (isTV && o.tvAlwaysOn) || !!o.isControlMode(); }

    function pType(e) {
      if (e.pointerType) return e.pointerType;
      var t = e.type;
      if (t.indexOf('touch') === 0) return 'touch';
      var sc = e.sourceCapabilities;                       // mousedown/click "compat" vindos de toque
      return sc && sc.firesTouchEvents ? 'touch' : 'mouse';
    }

    // true = ponteiro humano comprovado (deixa passar). false = fantasma.
    function isRealPointer(e) {
      if (isTV && !o.tvAllowPointer) return false;
      var t = pType(e);
      if (t === 'mouse') return mouseOwner;
      return !isTV && (now() - lastCtrl) > o.touchGraceMs; // touch/pen
    }

    function onMove(e) {
      if (o.requireTrusted && !e.isTrusted) return;
      var x = e.clientX, y = e.clientY, n = now();
      var d = lastX < 0 ? 0 : Math.abs(x - lastX) + Math.abs(y - lastY);
      lastX = x; lastY = y;
      if (n - lastCtrl < o.settleMs) { acc = 0; return; }
      acc += d;
      if (acc >= o.claimPx) mouseOwner = true;
    }

    function target() {
      var sc = o.scope();
      if (!sc) return null;
      var sel = o.focusSelector, a = document.activeElement;
      if (a && a !== document.body && a.matches && a.matches(sel) && sc.contains(a)) return a;
      return sc.querySelector(sel);
    }

    function redirect() {
      var el = target();
      if (o.confirm) { o.confirm(el); return; }
      if (el) api.click(el); else if (o.onNoTarget) o.onNoTarget();
    }

    function onInput(e) {
      if (internal || (o.requireTrusted && !e.isTrusted)) return;   // cliques do próprio XPLAY
      if (isRealPointer(e)) return;                                 // mouse/toque real: comportamento normal

      // Cursor fantasma: mata o evento AGORA, antes de qualquer listener e do clique nativo em X/Y.
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (o.onBlocked) o.onBlocked(e, pType(e));

      if (!ACTIONABLE[e.type]) return;
      var n = now();
      if (n < lockUntil) return;            // mesmo gesto já convertido
      lockUntil = n + o.lockMs;
      redirect();                           // síncrono: preserva a ativação do usuário (tela cheia etc.)
    }

    function attach() {
      if (attached) return; attached = true;
      for (var i = 0; i < EVENTS.length; i++) root.addEventListener(EVENTS[i], onInput, CAP);
      root.addEventListener('mousemove', onMove, CAP_PASSIVE);
    }
    function detach() {
      if (!attached) return; attached = false;
      for (var i = 0; i < EVENTS.length; i++) root.removeEventListener(EVENTS[i], onInput, CAP);
      root.removeEventListener('mousemove', onMove, CAP_PASSIVE);
      mouseOwner = false; acc = 0;
    }

    var api = {
      isTV: isTV,
      refresh: function () { active() ? attach() : detach(); },
      noteControllerInput: function () { lastCtrl = now(); mouseOwner = false; acc = 0; },
      click: function (el) { internal = true; try { el.click(); } finally { internal = false; } },
      get owner() { return mouseOwner ? 'mouse' : 'controller'; }
    };
    api.refresh();
    return api;
  }

  root.XPlayInputGuard = { init: init };
})(typeof window !== 'undefined' ? window : this);
