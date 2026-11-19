'use strict';
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_L = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const app = document.getElementById('app');
const usuario = document.getElementById('usuario');
let abaGestor = 'painel';
let semanaGestor = '';
let mesFunc = 0; // 0 = mês atual, 1 = próximo mês

// Tudo é montado com textContent (nunca innerHTML com dados), então nome/motivo digitados não executam código.
function h(tag, attrs, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    el.append(f.nodeType ? f : document.createTextNode(String(f)));
  }
  return el;
}
const parTxt = p => (p && p.length === 2) ? DIAS_L[p[0]] + ' e ' + DIAS_L[p[1]] : '—';
const dataBR = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function toast(msg, erro) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (erro ? ' erro' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = ''), 4200);
}

async function api(url, corpo) {
  const opt = corpo !== undefined
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
    : {};
  let r;
  try { r = await fetch(url, opt); } catch (e) { throw { msg: 'Sem conexão com o servidor. Se acabou de abrir, aguarde alguns segundos e tente de novo.' }; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && j.erro && j.erro.codigo === 'sem_sessao') telaEntrada();
    throw j.erro || { msg: 'Erro inesperado.' };
  }
  return j;
}
const erroBox = e => h('div', { class: 'msg erro' }, e.msg, e.detalhes ? h('ul', {}, e.detalhes.map(d => h('li', {}, d))) : null);

function abrirModal(...conteudo) {
  const box = document.getElementById('modalBox');
  box.replaceChildren(...conteudo.flat().filter(c => c != null && c !== false));
  document.getElementById('modal').hidden = false;
  const foco = box.querySelector('input,select,button');
  if (foco) foco.focus();
}
function fecharModal() { document.getElementById('modal').hidden = true; }
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') fecharModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });

async function sair() { await api('/api/sair', {}).catch(() => {}); telaEntrada(); }
function barraUsuario(nome, papel) {
  document.body.classList.remove('entrada');
  usuario.replaceChildren(h('span', { class: 'sutil' }, nome + ' • ' + papel + ' '), h('button', { onclick: sair }, 'Sair'));
}

// ---------- entrada: só nome completo + CPF. O sistema descobre sozinho se a pessoa é gestor ou funcionário.
function telaEntrada() {
  usuario.replaceChildren();
  document.body.classList.add('entrada');
  const nome = h('input', { id: 'nome', placeholder: 'Nome completo', 'aria-label': 'Nome completo', autocomplete: 'username' });
  const cpf = h('input', { id: 'cpf', inputmode: 'numeric', maxlength: '14', placeholder: 'CPF', 'aria-label': 'CPF', autocomplete: 'off' });
  cpf.addEventListener('input', () => { // máscara 000.000.000-00 enquanto digita
    const d = cpf.value.replace(/\D/g, '').slice(0, 11);
    cpf.value = d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  });
  const msg = h('div');
  const botao = h('button', { class: 'cheio btn-entrar', type: 'submit' }, 'Entrar');
  const entrar = async ev => {
    if (ev) ev.preventDefault();
    botao.disabled = true;
    try { await api('/api/entrar', { nome: nome.value, cpf: cpf.value }); await iniciar(); }
    catch (e) { msg.replaceChildren(erroBox(e)); }
    finally { botao.disabled = false; }
  };
  app.replaceChildren(h('div', { class: 'entra' },
    h('div', { class: 'espiral', 'aria-hidden': 'true' }),
    h('img', { class: 'entra-logo', src: 'logo.png', alt: 'Quintal do Carmo — Restaurante e Choperia' }),
    h('form', { class: 'entra-card', novalidate: 'novalidate', onsubmit: entrar }, nome, cpf, msg, botao)));
  nome.focus();
}

async function iniciar() {
  const eu = await api('/api/eu');
  if (eu.papel === 'funcionario') return painelFuncionario();
  if (eu.papel === 'gestor') return painelGestor();
  telaEntrada();
}

// ---------- funcionário: só a escala, as folgas e o pedido urgente
function semanaVisual(dias) {
  return h('div', { class: 'semana' }, dias.map(d => h('div', { class: 'dia' + (d.folga ? ' folga' : '') + (d.hoje ? ' hoje' : '') },
    h('b', {}, DIAS[d.dia]), h('small', {}, dataBR(d.data)),
    h('span', { class: 't' }, d.folga ? 'FOLGA' : 'Trabalho'),
    d.feriado ? h('span', { class: 'fer' }, d.feriado) : null)));
}

function statusTxt(x) {
  const m = { pendente: 'em análise pelo gestor', aprovada: 'aprovado', recusada: 'recusado', cancelada: 'cancelado' }[x.status] || x.status;
  return m;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function legendaSemana() {
  return h('div', { class: 'legenda', 'aria-label': 'Legenda' },
    h('span', {}, h('i', { class: 'leg-folga' }), 'Folga'),
    h('span', {}, h('i', { class: 'leg-prev' }), 'Folga prevista'),
    h('span', {}, h('i', { class: 'leg-trab' }), 'Trabalho'),
    h('span', {}, h('i', { class: 'leg-hoje' }), 'Hoje'),
    h('span', {}, h('i', { class: 'leg-fer' }), 'Feriado'));
}

// calendário do mês: semanas de domingo a sábado; dias de outro mês ficam apagados
function calendarioMes(cal, mes) {
  const semanas = [];
  for (let i = 0; i < cal.length; i += 7) {
    const sem = cal.slice(i, i + 7);
    if (sem.some(d => d.data.slice(0, 7) === mes)) semanas.push(sem);
  }
  return h('div', { class: 'cal' },
    DIAS.map(d => h('div', { class: 'cal-cab' }, d)),
    semanas.flat().map(d => {
      const fora = d.data.slice(0, 7) !== mes;
      const cls = 'cal-dia' + (fora ? ' fora' : '') + (!fora && d.folga ? (d.previsao ? ' prev' : ' folga') : '') + (d.hoje ? ' hoje' : '') + (d.passado ? ' passou' : '') + (!fora && d.feriado ? ' tem-fer' : '');
      return h('div', { class: cls, title: d.feriado || '' },
        h('b', {}, String(+d.data.slice(8))),
        !fora && d.folga ? h('span', { class: 't' }, 'folga') : null,
        !fora && d.feriado ? h('span', { class: 'fer' }, d.feriado) : null);
    }));
}

async function painelFuncionario() {
  let p;
  try { p = await api('/api/funcionario/painel'); } catch (e) { return; }
  barraUsuario(p.nome, 'funcionário');
  const m0 = p.hoje.slice(0, 7);
  const dt = new Date(+m0.slice(0, 4), +m0.slice(5, 7), 1); // mês seguinte
  const m1 = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
  const mes = mesFunc ? m1 : m0;
  const nomeMes = MESES[+mes.slice(5, 7) - 1] + ' de ' + mes.slice(0, 4);
  const navMes = h('div', { class: 'nav-mes' },
    h('button', { class: 'pq', disabled: mesFunc === 0, 'aria-label': 'Mês anterior', onclick: () => { mesFunc = 0; painelFuncionario(); } }, '‹'),
    h('h3', {}, nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)),
    h('button', { class: 'pq', disabled: mesFunc === 1, 'aria-label': 'Próximo mês', onclick: () => { mesFunc = 1; painelFuncionario(); } }, '›'));

  const linhaSemana = sem => {
    const emAnalise = sem.meuPedido && sem.meuPedido.status === 'pendente';
    const cancelar = async () => { try { await api('/api/funcionario/cancelar', { id: sem.meuPedido.id }); toast('Pedido cancelado.'); painelFuncionario(); } catch (e) { toast(e.msg, true); } };
    return h('div', { class: 'linha-semana' },
      h('div', {}, h('b', {}, sem.rotulo), h('span', { class: 'sutil' }, ' (' + dataBR(sem.inicio) + ' a ' + dataBR(sem.fim) + ')'),
        h('div', {}, 'Folgas: ', h('b', { class: 'neon-sm' }, parTxt(sem.par))),
        sem.meuPedido ? h('div', { class: 'sutil pequeno' }, 'Pedido urgente (' + parTxt(sem.meuPedido.novo) + '): ' + statusTxt(sem.meuPedido)) : null,
        !sem.podePedir && sem.motivoBloqueio ? h('div', { class: 'sutil pequeno' }, sem.motivoBloqueio) : null),
      h('div', { class: 'acoes' },
        emAnalise ? h('button', { class: 'pq perigo', onclick: cancelar }, 'Cancelar pedido') : null,
        h('button', { class: 'aviso pq', disabled: !sem.podePedir, onclick: () => modalUrgente(p, sem) }, emAnalise ? 'Trocar pedido' : 'Pedir mudança')));
  };

  app.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, p.icone + ' ' + p.nome + ' • ' + p.funcaoNome),
      navMes, calendarioMes(p.calendario, mes), legendaSemana(),
      h('p', { class: 'sutil pequeno' }, 'Depois da próxima semana a escala é uma previsão e ainda pode mudar.')),
    h('div', { class: 'card' },
      h('h2', {}, 'Mudar uma folga'),
      h('p', { class: 'sutil pequeno' }, 'Dá para pedir mudança urgente na semana atual e na próxima. O gestor valida ou recusa.'),
      p.semanas.map(linhaSemana)));
}

// opcoes (opcional): lista {par, ok, motivo} vinda do servidor; dias que a lei não deixa ficam apagados.
function seletorDeDias(sem, hoje, inicial, opcoes, aoRecusar) {
  const sel = new Set(inicial);
  const dias = h('div', { class: 'semana' });
  const aoMudar = [];
  const op = (a, b) => (opcoes || []).find(o => (o.par[0] === Math.min(a, b) && o.par[1] === Math.max(a, b)));
  // por que o dia d não pode entrar na seleção atual (null = pode)
  const proibido = d => {
    if (!opcoes || sel.has(d)) return null;
    if (sel.size >= 2) return null;
    if (sel.size === 1) { const a = [...sel][0]; const o = op(a, d); return o && !o.ok ? o.motivo : null; }
    const algum = opcoes.some(o => o.ok && (o.par[0] === d || o.par[1] === d));
    if (algum) return null;
    const ex = opcoes.find(o => !o.ok && (o.par[0] === d || o.par[1] === d) && o.motivo.startsWith('A lei'));
    return ex ? ex.motivo : 'Este dia não pode ser folga nesta semana.';
  };
  sem.forEach(d => {
    const travado = d.data < hoje; // dia que já passou não pode mudar
    const rotulo = h('span', { class: 't' }, travado ? (d.folga ? 'folga (já passou)' : 'já passou') : 'trabalho');
    const el = h('div', { class: 'dia escolha' + (travado ? ' travado' : ''), tabindex: travado ? '-1' : '0', role: 'button', 'aria-disabled': travado ? 'true' : 'false' },
      h('b', {}, DIAS[d.dia]), h('small', {}, dataBR(d.data)), rotulo);
    el.rotulo = rotulo; el.travado = travado;
    if (travado && d.folga) sel.add(d.dia);
    const alterna = () => {
      if (travado) return;
      const pq = proibido(d.dia);
      if (pq) { if (aoRecusar) aoRecusar(DIAS_L[d.dia] + ': ' + pq); return; }
      if (sel.has(d.dia)) sel.delete(d.dia); else if (sel.size < 2) sel.add(d.dia);
      atualiza();
    };
    el.addEventListener('click', alterna);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alterna(); } });
    dias.append(el);
  });
  const atualiza = () => {
    [...dias.children].forEach((n, i) => {
      n.classList.toggle('sel', sel.has(i));
      const pq = n.travado ? null : proibido(i);
      n.classList.toggle('proibido', !!pq);
      n.title = pq || '';
      if (!n.travado) n.rotulo.textContent = sel.has(i) ? 'FOLGA' : (pq ? 'não pode' : 'trabalho');
    });
    aoMudar.forEach(f => f(sel));
  };
  atualiza();
  return { dias, sel, aoMudar };
}

function modalUrgente(p, sem) {
  const msg = h('div');
  const enviar = h('button', { class: 'cheio', disabled: true }, 'Alertar o gestor');
  const { dias, sel, aoMudar } = seletorDeDias(sem.dias, p.hoje, [], sem.opcoes, txt => msg.replaceChildren(h('div', { class: 'msg erro' }, txt)));
  aoMudar.push(s => { enviar.disabled = s.size !== 2; msg.replaceChildren(); });
  aoMudar.forEach(f => f(sel));
  const cat = h('select', {}, p.categorias.map(c => h('option', { value: c }, c)));
  const motivo = h('textarea', { rows: '2', maxlength: '140', placeholder: 'Só o necessário. Evite detalhes de saúde.' });
  enviar.addEventListener('click', async () => {
    const [a, b] = [...sel].sort((x, y) => x - y);
    try {
      await api('/api/funcionario/urgente', { semana: sem.inicio, a, b, categoria: cat.value, motivo: motivo.value });
      fecharModal(); toast('Gestor alertado. Aguarde a decisão.'); painelFuncionario();
    } catch (e) { msg.replaceChildren(erroBox(e)); }
  });
  abrirModal(h('h2', { class: 'neon-sm' }, 'Pedido urgente'),
    h('p', { class: 'sutil' }, 'Folgas atuais: ' + parTxt(sem.par) + '. Toque nos 2 dias que serão sua nova folga.'
      + (sem.meuPedido && sem.meuPedido.status === 'pendente' ? ' Este pedido substitui o que está em análise.' : '')), dias,
    h('p', { class: 'sutil pequeno' }, 'Dias apagados ("não pode") quebrariam a lei: no máximo 6 dias seguidos de trabalho e a folga de domingo obrigatória. Toque neles para ver o motivo.'),
    h('label', {}, 'Categoria'), cat, h('label', {}, 'Motivo (opcional)'), motivo, msg,
    h('div', { class: 'acoes' }, enviar, h('button', { onclick: fecharModal }, 'Cancelar')));
}

// ---------- gestor
async function painelGestor() {
  let g;
  try { g = await api('/api/gestor/painel' + (semanaGestor ? '?semana=' + semanaGestor : '')); } catch (e) { return; }
  semanaGestor = g.semana;
  const eu = await api('/api/eu').catch(() => ({ nome: 'Gestor' }));
  barraUsuario(eu.nome || 'Gestor', 'gestor');
  const abas = [['painel', 'Pedidos' + (g.pendentes ? ' (' + g.pendentes + ')' : '')], ['escala', 'Escala'], ['equipe', 'Equipe'], ['cobertura', 'Cobertura mínima'], ['regras', 'Regras e sindicato'], ['audit', 'Auditoria'], ['log', 'Registro']];
  const nav = h('div', { class: 'abas' }, abas.map(([k, t]) => h('button', { class: abaGestor === k ? 'ativa' : '', onclick: () => { abaGestor = k; painelGestor(); } }, t)));
  app.replaceChildren(nav, { painel: gPedidos, escala: gEscala, equipe: gEquipe, cobertura: gCobertura, regras: gRegras, audit: gAudit, log: gLog }[abaGestor](g));
}

// lista do remanejamento sugerido: só vale se o gestor aprovar
function blocoPlano(pl, titulo) {
  if (!pl) return null;
  pl.furos = pl.furos || []; pl.sugestoes = pl.sugestoes || [];
  if (!pl.furos.length && !pl.sugestoes.length) return null;
  return h('div', { class: 'msg' + (pl.resolve ? '' : ' erro') },
    pl.furos.length ? h('div', {}, h('b', {}, titulo), h('ul', {}, pl.furos.map(f => h('li', {}, f)))) : null,
    pl.sugestoes.length ? h('div', {}, h('b', {}, 'Para não ficar furo, quem pode trocar (só muda se você aprovar):'),
      h('ul', {}, pl.sugestoes.map(s => h('li', {}, s.nome + ': ' + s.texto)))) : null,
    pl.resolve ? null : h('p', {}, 'Não achei como cobrir sem quebrar a lei. Recuse, ou ajuste antes outras folgas na aba Escala.'));
}
const remanejoDe = pl => (pl && pl.sugestoes ? pl.sugestoes : []).map(s => ({ id: s.id, a: s.para[0], b: s.para[1] }));

function cartaoPedido(g, p) {
  const pl = p.previsao;
  const furo = !!(pl && pl.furos && pl.furos.length);
  const decidir = async (url, corpo, ok) => {
    try { await api(url, corpo); toast(ok); painelGestor(); }
    catch (e) { toast(e.msg + (e.detalhes ? ' ' + e.detalhes.join('; ') : ''), true); painelGestor(); }
  };
  return h('div', { class: 'pedido urg' },
    h('div', {}, h('b', {}, p.nome), ' ', h('span', { class: 'badge' }, g.funcoesInfo[p.funcao].nome), ' ', h('span', { class: 'badge urg' }, 'URGENTE')),
    h('div', { class: 'sutil' }, 'Semana de ' + dataBR(p.semana) + ' • pedido em ' + p.criadoEm),
    h('div', {}, parTxt(p.antigo) + '  →  ', h('b', {}, parTxt(p.novo))),
    p.categoria ? h('div', {}, 'Categoria: ' + p.categoria + (p.motivo ? ' — ' + p.motivo : '')) : null,
    furo ? blocoPlano(pl, 'Aprovar só esta troca deixaria furo:') : h('div', { class: 'sutil pequeno' }, 'Sem furo: só as folgas de ' + p.nome + ' mudam.'),
    h('div', { class: 'acoes' },
      furo
        ? h('button', { class: 'cheio', disabled: !pl.resolve, onclick: () => decidir('/api/gestor/aprovar', { id: p.id, remanejo: remanejoDe(pl) }, 'Validado com o remanejamento que você aprovou.') }, 'Validar com este remanejamento')
        : h('button', { class: 'cheio', onclick: () => decidir('/api/gestor/aprovar', { id: p.id }, 'Validado. Só as folgas de ' + p.nome + ' mudaram.') }, 'Validar'),
      h('button', { class: 'perigo', onclick: () => decidir('/api/gestor/recusar', { id: p.id }, 'Pedido recusado.') }, 'Recusar')));
}

function gPedidos(g) {
  const pend = g.pedidos.filter(p => p.status === 'pendente');
  const resto = g.pedidos.filter(p => p.status !== 'pendente').slice(0, 8);
  return h('div', {},
    pend.length ? h('div', { class: 'alerta', role: 'alert' }, h('h2', { class: 'neg' }, '⚠ ' + pend.length + ' pedido(s) urgente(s) aguardando você'), pend.map(p => cartaoPedido(g, p)))
      : h('div', { class: 'card' }, h('h2', {}, 'Sem pedidos urgentes'), h('p', { class: 'sutil' }, 'Quando alguém pedir mudança urgente, o alerta aparece aqui para você validar ou recusar.')),
    resto.length ? h('div', { class: 'card' }, h('h3', {}, 'Últimas decisões'), h('ul', { class: 'limpa' }, resto.map(p => h('li', {},
      h('b', {}, p.nome), ' • semana de ' + dataBR(p.semana) + ' • ' + parTxt(p.antigo) + ' → ' + parTxt(p.novo) + ' • ',
      h('span', { class: 'badge ' + (p.status === 'aprovada' ? 'ok' : p.status === 'cancelada' ? '' : 'bad') }, { aprovada: 'validado', cancelada: 'cancelado pelo funcionário' }[p.status] || 'recusado'))))) : null);
}

// O gestor pode escolher quaisquer 2 dias de folga para um colaborador (não precisam ser seguidos). A lei é conferida pelo sistema.
function modalFolgas(g, x) {
  const dias = [];
  for (let d = 0; d < 7; d++) dias.push({ dia: d, data: somaDias(g.semana, d), folga: x.par[0] === d || x.par[1] === d });
  const msg = h('div');
  const salvar = h('button', { class: 'cheio', disabled: true }, 'Salvar folgas');
  const { dias: grade, sel, aoMudar } = seletorDeDias(dias, g.hoje, []);
  aoMudar.push(s => { salvar.disabled = s.size !== 2 || (x.par[0] === [...s].sort((p, q) => p - q)[0] && x.par[1] === [...s].sort((p, q) => p - q)[1]); });
  aoMudar.forEach(f => f(sel));
  const jaPassaram = dias.filter(d => d.folga && d.data < g.hoje).length === 2;
  const enviar = async remanejo => {
    const [a, b] = [...sel].sort((p, q) => p - q);
    try { await api('/api/gestor/folgas', { id: x.id, semana: g.semana, a, b, remanejo: remanejo || [] }); fecharModal(); toast('Folgas alteradas.'); painelGestor(); }
    catch (e) {
      if (e.codigo === 'cobertura' && !remanejo) { // abriria furo: mostra quem pode cobrir e pede a aprovação do gestor
        try {
          const pl = await api('/api/gestor/previa', { id: x.id, semana: g.semana, a, b });
          msg.replaceChildren(blocoPlano(pl, 'Esta mudança deixaria furo:'),
            pl.resolve ? h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: () => enviar(remanejoDe(pl)) }, 'Salvar com este remanejamento')) : null);
        } catch (x2) { msg.replaceChildren(erroBox(e)); }
      } else msg.replaceChildren(erroBox(e));
    }
  };
  salvar.addEventListener('click', () => enviar(null));
  abrirModal(h('h2', { class: 'neon-sm' }, 'Alterar folgas de ' + x.nome),
    h('p', { class: 'sutil' }, 'Semana de ' + dataBR(g.semana) + '. Folgas atuais: ' + parTxt(x.par) + '. Toque nos 2 dias da nova folga (não precisam ser seguidos).'), grade,
    jaPassaram ? h('div', { class: 'msg' }, 'As duas folgas desta semana já passaram, então não há o que mudar aqui. Escolha a "Próxima semana" na lista.') : null,
    h('p', { class: 'sutil pequeno' }, 'O sistema recusa qualquer mudança que quebre o descanso semanal ou a folga de domingo exigida em lei.'), msg,
    h('div', { class: 'acoes' }, salvar, h('button', { onclick: fecharModal }, 'Cancelar')));
}

function gEscala(g) {
  const sel = h('select', { onchange: e => { semanaGestor = e.target.value; painelGestor(); } },
    g.semanas.map((s, i) => h('option', { value: s, selected: s === g.semana }, 'Semana de ' + dataBR(s) + ' a ' + dataBR(somaDias(s, 6)) + ' (' + g.rotulos[i] + ')')));
  const cab = h('tr', {}, h('th', {}, 'Colaborador'), DIAS.map((d, i) => h('th', {}, d, h('br'), h('small', { class: 'sutil' }, dataBR(somaDias(g.semana, i))), g.feriados[i] ? h('br') : null, g.feriados[i] ? h('small', { class: 'badge warn' }, 'feriado') : null)), h('th', {}, ''));
  const linhas = [];
  g.ordem.forEach(f => {
    const membros = g.grade.filter(x => x.funcao === f);
    if (!membros.length) return;
    linhas.push(h('tr', {}, h('td', { colspan: '9', class: 'neon-sm' }, g.funcoesInfo[f].icone + ' ' + g.funcoesInfo[f].plural)));
    membros.forEach(x => linhas.push(h('tr', {}, h('td', {}, x.nome),
      DIAS.map((_, d) => { const off = x.par[0] === d || x.par[1] === d; return h('td', { class: (off ? 'f' : '') + (x.alterada ? ' alt' : '') }, off ? 'folga' : '•'); }),
      h('td', {}, g.podeAlterar ? h('button', { class: 'pq', onclick: () => modalFolgas(g, x) }, 'Alterar') : null))));
    const mn = g.minimos[f], cb = g.cobertura[f];
    linhas.push(h('tr', {}, h('td', { class: 'sutil' }, 'Trabalhando / mínimo'), DIAS.map((_, d) => h('td', { class: cb[d] < mn[d] ? 'def' : 'sutil' }, cb[d] + '/' + mn[d])), h('td', {})));
  });
  return h('div', { class: 'card' }, h('h2', {}, 'Escala completa'), sel,
    g.previsao ? h('div', { class: 'msg' }, 'Previsão: esta semana ainda não está fechada. Ela é calculada a partir da escala atual, seguindo a lei, e pode mudar. Para alterar folgas, use a semana atual ou a próxima.') : null,
    !g.podeAlterar && !g.previsao ? h('div', { class: 'msg' }, 'Semana que já passou: só para consulta.') : null,
    g.ajustada ? h('p', { class: 'badge warn' }, 'Esta semana teve ajuste') : null,
    g.deficits.length ? h('div', { class: 'msg erro' }, h('b', { class: 'def' }, 'Furo: ' + g.deficits.length + ' ponto(s) abaixo da cobertura mínima nesta semana. '),
      g.podeAlterar ? h('button', { class: 'pq', onclick: () => sugerirCobertura(g) }, 'Sugerir como cobrir') : null) : null,
    linhas.length ? h('div', { class: 'tabela-rolagem' }, h('table', {}, h('thead', {}, cab), h('tbody', {}, linhas))) : h('p', { class: 'sutil' }, 'Nenhum colaborador cadastrado ainda. Use a aba Equipe.'));
}

async function sugerirCobertura(g) {
  try {
    const pl = await api('/api/gestor/previa', { semana: g.semana, cobrir: true });
    abrirModal(h('h2', { class: 'neon-sm' }, 'Cobrir o furo da semana de ' + dataBR(g.semana)),
      pl.sugestoes.length ? blocoPlano(pl, '') : h('p', {}, 'Não achei quem possa trocar a folga sem quebrar a lei. Ajuste manualmente com o botão Alterar.'),
      h('div', { class: 'acoes' },
        pl.sugestoes.length ? h('button', { class: 'cheio', onclick: async () => { try { await api('/api/gestor/remanejar', { semana: g.semana, remanejo: remanejoDe(pl) }); fecharModal(); toast('Remanejamento aplicado.'); painelGestor(); } catch (e) { toast(e.msg, true); } } }, 'Aprovar estas trocas') : null,
        h('button', { onclick: fecharModal }, 'Cancelar')));
  } catch (e) { toast(e.msg, true); }
}

function gEquipe(g) {
  const nome = h('input', { placeholder: 'Nome completo' });
  const cpf = h('input', { inputmode: 'numeric', maxlength: '14', placeholder: '000.000.000-00', autocomplete: 'off' });
  const fn = h('select', {}, g.ordem.map(f => h('option', { value: f }, g.funcoesInfo[f].nome)));
  const dom = h('select', {}, h('option', { value: '3' }, 'Homem: folga 1 domingo a cada 3 semanas'), h('option', { value: '2' }, 'Mulher: folga 1 domingo a cada 2 semanas'));
  const turno = h('input', { placeholder: 'Turno (ex.: Tarde/Noite)' });
  const msg = h('div');
  const cadastrar = async () => {
    try {
      const r = await api('/api/gestor/funcionarios', { nome: nome.value, cpf: cpf.value, funcao: fn.value, domingoSemanas: Number(dom.value), turno: turno.value });
      await painelGestor(); toast(r.nome + ' cadastrado. Ele entra com o nome completo e o CPF.');
    } catch (e) { msg.replaceChildren(erroBox(e)); }
  };
  const remover = f => abrirModal(h('h2', { class: 'neon-sm' }, 'Remover ' + f.nome + '?'), h('p', {}, 'O colaborador sai da escala e perde o acesso. Ninguém muda de folga sozinho: se faltar gente, a aba Escala mostra o furo e sugere quem pode cobrir, para você aprovar.'),
    h('div', { class: 'acoes' }, h('button', { class: 'perigo', onclick: async () => { fecharModal(); try { await api('/api/gestor/funcionarios/remover', { id: f.id }); toast('Removido.'); painelGestor(); } catch (e) { toast(e.msg, true); } } }, 'Remover'), h('button', { onclick: fecharModal }, 'Cancelar')));
  const revogar = f => abrirModal(h('h2', { class: 'neon-sm' }, 'Encerrar as sessões de ' + f.nome + '?'),
    h('p', {}, 'Ele sai de todos os aparelhos onde estiver logado. Depois pode entrar de novo com nome e CPF. Para tirar o acesso de vez, use Remover.'),
    h('div', { class: 'acoes' }, h('button', { class: 'perigo', onclick: async () => { fecharModal(); try { await api('/api/gestor/funcionarios/acesso', { id: f.id }); toast('Sessões encerradas.'); painelGestor(); } catch (e) { toast(e.msg, true); } } }, 'Encerrar'), h('button', { onclick: fecharModal }, 'Cancelar')));
  const temDemo = g.equipe.some(f => f.demo);
  const removerDemo = () => abrirModal(h('h2', { class: 'neon-sm' }, 'Remover equipe de demonstração?'),
    h('p', {}, 'Remove todos os colaboradores fictícios. Os que você cadastrou ficam.'),
    h('div', { class: 'acoes' },
      h('button', { class: 'perigo', onclick: async () => { fecharModal(); try { const r = await api('/api/gestor/demo/remover', {}); toast(r.removidos + ' removido(s).'); painelGestor(); } catch (e) { toast(e.msg, true); } } }, 'Remover'),
      h('button', { onclick: fecharModal }, 'Cancelar')));
  return h('div', {},
    h('div', { class: 'card' }, h('h2', {}, 'Cadastrar colaborador'),
      h('div', { class: 'grade2' }, h('div', {}, h('label', {}, 'Nome'), nome), h('div', {}, h('label', {}, 'CPF (é o login dele)'), cpf), h('div', {}, h('label', {}, 'Função'), fn), h('div', {}, h('label', {}, 'Regra de domingo'), dom), h('div', {}, h('label', {}, 'Turno'), turno)),
      msg, h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: cadastrar }, 'Cadastrar')),
      h('p', { class: 'sutil pequeno' }, 'O colaborador entra com o nome completo e o CPF. O sistema guarda só um código irreversível do CPF (e os 2 últimos dígitos). As folgas da semana atual e da próxima são encaixadas sem mexer nas dos outros.')),
    h('div', { class: 'card' }, h('h2', {}, 'Equipe (' + g.equipe.length + ')'),
      temDemo ? h('div', { class: 'msg' }, 'Há colaboradores fictícios de demonstração. ', h('button', { class: 'perigo', onclick: removerDemo }, 'Remover demonstração')) : null,
      h('div', { class: 'tabela-rolagem' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Nome', 'Função', 'CPF', 'Domingo', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, g.equipe.map(f => h('tr', {}, h('td', {}, f.nome, f.demo ? h('span', { class: 'badge' }, 'demo') : null), h('td', {}, g.funcoesInfo[f.funcao].nome), h('td', {}, f.cpf), h('td', {}, 'a cada ' + f.domingoSemanas + ' sem.'),
          h('td', {}, h('button', { class: 'pq', onclick: () => revogar(f) }, 'Encerrar sessões'), ' ', h('button', { class: 'perigo pq', onclick: () => remover(f) }, 'Remover'))))))))
  );
}

function gCobertura(g) {
  const linhas = g.ordem.map(f => {
    const ins = DIAS.map((_, d) => h('input', { type: 'number', min: '0', max: '30', value: String(g.minimos[f][d]) }));
    return h('tr', {}, h('td', {}, g.funcoesInfo[f].nome), ins.map(i => h('td', {}, i)),
      h('td', {}, h('button', { onclick: async () => { try { await api('/api/gestor/minimos', { funcao: f, dias: ins.map(i => Number(i.value)) }); toast('Cobertura salva.'); painelGestor(); } catch (e) { toast(e.msg, true); } } }, 'Salvar')));
  });
  return h('div', { class: 'card' }, h('h2', {}, 'Cobertura mínima por dia'),
    h('p', { class: 'sutil' }, 'Quantas pessoas de cada função precisam trabalhar em cada dia. O sistema usa esses números para montar as semanas novas e para barrar qualquer troca que deixe furo.'),
    h('div', { class: 'tabela-rolagem' }, h('table', { class: 'minimos' }, h('thead', {}, h('tr', {}, h('th', {}, 'Função'), DIAS.map(d => h('th', {}, d)), h('th', {}))), h('tbody', {}, linhas))));
}

function gRegras(g) {
  const rot = { lei: ['ok', 'lei'], cct2019: ['warn', 'acordo 2019'], sistema: ['', 'regra do sistema'], confirmar: ['bad', 'confirmar'] };
  return h('div', { class: 'card' }, h('h2', {}, 'Regras aplicadas e fonte'),
    h('div', { class: 'msg' }, 'Não é parecer jurídico. Confira cada item com o SINTHORESSARA ou com o contador antes de usar como oficial.'),
    g.regras.map(r => h('div', { class: 'pedido' }, h('b', {}, r.titulo), ' ', h('span', { class: 'badge ' + rot[r.status][0] }, rot[r.status][1]), h('p', {}, r.descricao), h('div', { class: 'sutil' }, 'Fonte: ' + r.fonte))));
}

function gAudit(g) {
  return h('div', { class: 'card' }, h('h2', {}, 'Auditoria da semana de ' + dataBR(g.semana)), h('div', { class: 'tabela-rolagem' }, h('table', {},
    h('thead', {}, h('tr', {}, ['Colaborador', 'Folgas', 'Máx. dias seguidos', 'Semanas sem folgar domingo', 'Feriados de folga', 'Situação'].map(t => h('th', {}, t)))),
    h('tbody', {}, g.auditoria.map(a => h('tr', {}, h('td', {}, a.nome), h('td', {}, String(a.folgas)), h('td', {}, String(a.maxSeq)), h('td', {}, String(a.semDom)), h('td', {}, String(a.feriados)),
      h('td', {}, h('span', { class: 'badge ' + (a.ok ? 'ok' : 'bad') }, a.ok ? 'em regra' : 'verificar'))))))));
}

function gLog(g) {
  return h('div', { class: 'card' }, h('h2', {}, 'Registro de eventos'), h('ul', { class: 'limpa' }, g.log.map(l => h('li', {}, h('span', { class: 'sutil' }, l.t + ' '), l.texto))));
}

iniciar();
