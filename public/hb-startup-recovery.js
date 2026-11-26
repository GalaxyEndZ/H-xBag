/* Safe startup diagnostics, intentionally independent of React and database APIs. */
(function () {
  'use strict';
  var lastError = '';
  var shown = false;
  function rootElement() { return document.getElementById('root'); }
  function isStartupBlank() {
    var root = rootElement();
    if (!root || root.querySelector('[data-hb-runtime-error]')) return false;
    var starting = root.querySelector('[data-hb-starting]');
    return !!starting || root.children.length === 0 ||
      (!(root.textContent || '').trim() && root.querySelectorAll('main,section,header,form,button,input').length === 0);
  }
  function renderError() {
    if (shown || !isStartupBlank()) return;
    var root = rootElement();
    if (!root) return;
    shown = true;
    root.replaceChildren();
    var main = document.createElement('main');
    main.setAttribute('role', 'alert');
    main.setAttribute('data-hb-startup-failure', 'true');
    main.style.cssText = 'box-sizing:border-box;min-height:100dvh;display:grid;place-items:center;padding:24px;color:#f0eaf2;background:#100e15;font-family:system-ui,sans-serif';
    var box = document.createElement('section');
    box.style.cssText = 'box-sizing:border-box;width:min(100%,530px);padding:28px;border-radius:18px;border:1px solid #423b4c;background:#201c29';
    var title = document.createElement('h1');
    title.style.cssText = 'font-size:22px;margin:0 0 12px';
    title.textContent = 'Não foi possível iniciar o HäxBag';
    var description = document.createElement('p');
    description.style.cssText = 'line-height:1.6;color:#cec5d1';
    description.textContent = 'A aplicação não terminou de carregar. Seus dados não foram apagados. Atualize a página e, se persistir, verifique o primeiro erro no Console (F12).';
    var reload = document.createElement('button');
    reload.type = 'button'; reload.textContent = 'Recarregar página';
    reload.style.cssText = 'padding:12px 18px;border:0;border-radius:11px;font-weight:750;background:#d9bd8b;color:#201b20;cursor:pointer';
    reload.addEventListener('click', function () { window.location.reload(); });
    box.append(title, description, reload);
    if (lastError) {
      var details = document.createElement('details');
      details.style.cssText = 'margin-top:18px;font-size:13px;color:#bfb6c7';
      var summary = document.createElement('summary'); summary.textContent = 'Detalhes para diagnóstico';
      var code = document.createElement('pre');
      code.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
      code.textContent = lastError.slice(0, 500);
      details.append(summary, code); box.append(details);
    }
    main.appendChild(box); root.appendChild(main);
  }
  function record(message) {
    if (!message) return;
    lastError = String(message);
    console.error('[HäxBag] Falha durante a inicialização:', lastError);
    setTimeout(renderError, 3000);
  }
  window.addEventListener('error', function (event) {
    if (event.target && event.target !== window && event.target.tagName) {
      var tag = event.target.tagName;
      if (tag === 'SCRIPT' || (tag === 'LINK' && event.target.rel === 'stylesheet')) record('Não foi possível carregar um arquivo da aplicação (' + tag + ').');
    } else if (event.message) record(event.message);
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    record(event.reason && event.reason.message ? event.reason.message : 'Erro ao carregar um módulo da aplicação.');
  });
  // If React never mounts, replace the blank/splash state with a useful recovery screen.
  setTimeout(renderError, 10000);
})();
