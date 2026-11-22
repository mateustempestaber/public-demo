// Demonstração: o servidor Go roda aqui no navegador (WebAssembly) e guarda os dados no próprio navegador.
// Nada é enviado para a internet. Para recomeçar do zero, abra o endereço com ?reiniciar=1 no final.
(function () {
  try {
    if (/[?&]reiniciar=1/.test(location.search)) {
      localStorage.removeItem('quintal-demo-estado-v6');
      history.replaceState(null, '', location.pathname + location.hash);
    }
  } catch (e) { /* sem localStorage: segue sem guardar */ }
  const realFetch = window.fetch.bind(window);
  let cookie = '';
  let pronto;
  const aguarda = new Promise(r => (pronto = r));
  window.quintalPronto = () => pronto();

  const go = new Go();
  (async () => {
    let inst;
    try { inst = await WebAssembly.instantiateStreaming(realFetch('app.wasm'), go.importObject); }
    catch (e) {
      const buf = await (await realFetch('app.wasm')).arrayBuffer();
      inst = await WebAssembly.instantiate(buf, go.importObject);
    }
    go.run(inst.instance);
  })();

  window.fetch = async function (url, opt) {
    const u = String(url);
    if (!u.startsWith('/api/')) return realFetch(url, opt);
    await aguarda;
    opt = opt || {};
    const r = JSON.parse(window.quintalAPI(opt.method || 'GET', u, opt.body || '', cookie));
    if (r.cookie !== null) cookie = r.cookie;
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json' } });
  };
})();
