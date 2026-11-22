'use strict';
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_L = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// sigla que aparece no quadradinho e nome por extenso de cada tipo de dia
const SIG = { T: '', F: 'F', FJ: 'FJ', FI: 'FI', EX: 'EX', TR: 'TR' };
const NOME_TIPO = { T: 'Trabalho', F: 'Folga', FJ: 'Falta justificada', FI: 'Falta injustificada', EX: 'Dia extra', TR: 'Trabalhou no feriado' };
const app = document.getElementById('app');
const usuario = document.getElementById('usuario');
let abaGestor = 'escala';
let mesGestor = '';
let mesFunc = 0; // 0 = mês atual, 1 = próximo mês
let verHorarios = false;
let MARCA = null;

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
const dataBRc = iso => dataBR(iso) + '/' + iso.slice(0, 4);
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const nomeDoMes = ym => { const t = MESES[+ym.slice(5, 7) - 1] + ' de ' + ym.slice(0, 4); return t.charAt(0).toUpperCase() + t.slice(1); };
const cpfFmt = d => d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

function toast(msg, erro) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (erro ? ' erro' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = ''), 4800);
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
  const foco = box.querySelector('button:not(:disabled),input,select');
  if (foco) foco.focus();
}
function fecharModal() { document.getElementById('modal').hidden = true; }
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') fecharModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });
const confirmar = (titulo, texto, rotulo, acao, perigo) => abrirModal(h('h2', { class: 'neon-sm' }, titulo), h('p', {}, texto),
  h('div', { class: 'acoes' }, h('button', { class: perigo ? 'perigo' : 'cheio', onclick: async () => { fecharModal(); await acao(); } }, rotulo), h('button', { onclick: fecharModal }, 'Cancelar')));

// baixa um arquivo gerado aqui mesmo (planilha CSV ou backup JSON)
function baixarArquivo(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = h('a', { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// CSV com ; e BOM: abre certo no Excel em português
const csv = linhas => '﻿' + linhas.map(l => l.map(v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');

// ---------- identidade da empresa (nome, logo, cor)
async function carregarMarca() {
  MARCA = await api('/api/marca').catch(() => ({ nome: 'Quintal do Carmo', subtitulo: 'Restaurante e Choperia', demo: [] }));
  const raiz = document.documentElement.style;
  if (MARCA.cor) {
    const n = parseInt(MARCA.cor.slice(1), 16), lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    raiz.setProperty('--lima', MARCA.cor); raiz.setProperty('--acc', MARCA.cor);
    raiz.setProperty('--lima-esc', lum > 0.55 ? '#07120e' : '#ffffff');
  } else ['--lima', '--acc', '--lima-esc'].forEach(v => raiz.removeProperty(v));
  const logo = document.querySelector('.logo-topo');
  if (logo) { logo.src = logoSrc(); logo.alt = MARCA.nome; }
  document.title = MARCA.nome;
}
const logoSrc = () => (MARCA && MARCA.logo) || 'logo.png';

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
  const mascara = () => {
    const d = cpf.value.replace(/\D/g, '').slice(0, 11);
    cpf.value = d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  };
  cpf.addEventListener('input', mascara);
  const msg = h('div');
  const botao = h('button', { class: 'cheio btn-entrar', type: 'submit' }, 'Entrar');
  const entrar = async ev => {
    if (ev) ev.preventDefault();
    botao.disabled = true;
    try { await api('/api/entrar', { nome: nome.value, cpf: cpf.value }); await iniciar(); }
    catch (e) { msg.replaceChildren(erroBox(e)); }
    finally { botao.disabled = false; }
  };
  const demo = (MARCA && MARCA.demo) || [];
  const rapido = demo.length ? h('div', { class: 'entra-demo' },
    h('p', { class: 'sutil pequeno' }, 'Entrar rápido (demonstração)'),
    h('div', { class: 'demo-botoes' }, demo.map(d => h('button', { type: 'button', class: 'demo-btn', onclick: () => { nome.value = d.nome; cpf.value = cpfFmt(d.cpf); entrar(); } },
      h('b', {}, d.nome.split(' ')[0]), h('small', {}, d.info))))) : null;
  app.replaceChildren(h('div', { class: 'entra' },
    h('img', { class: 'entra-logo', src: logoSrc(), alt: MARCA ? MARCA.nome : '' }),
    h('form', { class: 'entra-card', novalidate: 'novalidate', onsubmit: entrar }, nome, cpf, msg, botao),
    rapido));
  nome.focus();
}

async function iniciar() {
  if (!MARCA) await carregarMarca();
  const eu = await api('/api/eu');
  if (eu.papel === 'funcionario') return painelFuncionario();
  if (eu.papel === 'gestor') return painelGestor();
  telaEntrada();
}

// ---------- funcionário: o calendário do mês e as folgas
function legendaFunc() {
  return h('div', { class: 'legenda', 'aria-label': 'Legenda' },
    h('span', {}, h('i', { class: 'leg-folga' }), 'Folga'),
    h('span', {}, h('i', { class: 'leg-prev' }), 'Folga prevista'),
    h('span', {}, h('i', { class: 'leg-trab' }), 'Trabalho'),
    h('span', {}, h('i', { class: 'leg-fj' }), 'Falta justificada'),
    h('span', {}, h('i', { class: 'leg-fi' }), 'Falta'),
    h('span', {}, h('i', { class: 'leg-ex' }), 'Dia extra'),
    h('span', {}, h('i', { class: 'leg-hoje' }), 'Hoje'),
    h('span', {}, h('i', { class: 'leg-fer' }), 'Feriado'));
}

const ROT_CAL = { FJ: 'falta just.', FI: 'falta', EX: 'extra', TR: 'feriado trab.' };
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
      const cls = 'cal-dia' + (fora ? ' fora' : '') + (!fora && d.folga && !d.tipo ? (d.previsao ? ' prev' : ' folga') : '') + (!fora && d.tipo ? ' tp-' + d.tipo : '') +
        (d.hoje ? ' hoje' : '') + (d.passado ? ' passou' : '') + (!fora && d.feriado ? ' tem-fer' : '');
      return h('div', { class: cls, title: [d.feriado, d.horario].filter(Boolean).join(' • ') },
        h('b', {}, String(+d.data.slice(8))),
        !fora && d.tipo ? h('span', { class: 't' }, ROT_CAL[d.tipo]) : (!fora && d.folga ? h('span', { class: 't' }, 'folga') : null),
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
  const navMes = h('div', { class: 'nav-mes' },
    h('button', { class: 'pq', disabled: mesFunc === 0, 'aria-label': 'Mês anterior', onclick: () => { mesFunc = 0; painelFuncionario(); } }, '‹'),
    h('h3', {}, nomeDoMes(mes)),
    h('button', { class: 'pq', disabled: mesFunc === 1, 'aria-label': 'Próximo mês', onclick: () => { mesFunc = 1; painelFuncionario(); } }, '›'));
  app.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, p.icone + ' ' + p.nome + ' • ' + p.funcaoNome),
      navMes, calendarioMes(p.calendario, mes), legendaFunc(),
      h('p', { class: 'sutil pequeno' }, 'Depois da próxima semana a escala é uma previsão e ainda pode mudar.')),
    h('div', { class: 'card' },
      h('h2', {}, 'Suas folgas'),
      p.semanas.map(sem => h('div', { class: 'linha-semana' },
        h('div', {}, h('b', {}, sem.rotulo), h('span', { class: 'sutil' }, ' (' + dataBR(sem.inicio) + ' a ' + dataBR(sem.fim) + ')')),
        h('b', { class: 'neon-sm' }, parTxt(sem.par)))),
      p.horario ? h('div', { class: 'linha-semana' }, h('b', {}, 'Seu horário'), h('b', { class: 'neon-sm' }, p.horario)) : null,
      h('p', { class: 'sutil pequeno' }, 'Precisa mudar uma folga? Fale com o gestor.')));
}

// ---------- gestor
async function painelGestor() {
  let g;
  try { g = await api('/api/gestor/painel'); } catch (e) { return; }
  const eu = await api('/api/eu').catch(() => ({ nome: 'Gestor' }));
  barraUsuario(eu.nome || 'Gestor', 'gestor');
  const abas = [['escala', 'Escala do mês'], ['equipe', 'Equipe'], ['cobertura', 'Cobertura mínima'], ['regras', 'Feriados e regras'],
    ['audit', 'Auditoria'], ['empresa', 'Empresa'], ['backup', 'Backup e histórico']];
  const nav = h('div', { class: 'abas' }, abas.map(([k, t]) => h('button', { class: abaGestor === k ? 'ativa' : '', onclick: () => { abaGestor = k; painelGestor(); } }, t)));
  if (abaGestor === 'escala') { app.replaceChildren(nav, h('div', { class: 'card' }, h('p', { class: 'sutil' }, 'Carregando a escala...'))); return gEscalaMes(nav); }
  app.replaceChildren(nav, { equipe: gEquipe, cobertura: gCobertura, regras: gRegras, audit: gAudit, empresa: gEmpresa, backup: gBackup }[abaGestor](g));
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
    pl.resolve ? null : h('p', {}, 'Não achei como cobrir sem quebrar a lei. Escolha outro dia ou ajuste antes outras folgas.'));
}
const remanejoDe = pl => (pl && pl.sugestoes ? pl.sugestoes : []).map(s => ({ id: s.id, a: s.para[0], b: s.para[1] }));

// ---------- escala do mês (tabela com todos e todos os dias; imprime em uma folha)
async function gEscalaMes(nav) {
  let m;
  try { m = await api('/api/gestor/mes' + (mesGestor ? '?mes=' + mesGestor : '')); } catch (e) { toast(e.msg, true); return; }
  mesGestor = m.mes;
  const titulo = nomeDoMes(m.mes);
  const i = m.meses.indexOf(m.mes);
  const navMes = h('div', { class: 'nav-mes nao-imprime' },
    h('button', { class: 'pq', disabled: i <= 0, 'aria-label': 'Mês anterior', onclick: () => { mesGestor = m.meses[i - 1]; painelGestor(); } }, '‹'),
    h('h3', {}, titulo),
    h('button', { class: 'pq', disabled: i >= m.meses.length - 1, 'aria-label': 'Próximo mês', onclick: () => { mesGestor = m.meses[i + 1]; painelGestor(); } }, '›'));
  const cab = h('tr', {}, h('th', { class: 'col-nome' }, 'Colaborador'),
    m.dias.map(d => h('th', { class: 'col-dia' + (d.dia === 0 ? ' dom' : '') + (d.hoje ? ' hoje' : '') + (d.feriado ? ' fer' : ''), title: d.feriado || '' },
      h('b', {}, String(+d.data.slice(8))), h('small', {}, DIAS[d.dia].slice(0, 1)), d.feriado ? h('i', {}, 'fer') : null)),
    h('th', {}, 'Folgas'));
  const corpo = [];
  m.ordem.forEach(f => {
    const ls = m.linhas.filter(l => l.funcao === f);
    if (!ls.length) return;
    corpo.push(h('tr', { class: 'grupo' }, h('td', { colspan: String(m.dias.length + 2) }, m.funcoesInfo[f].icone + ' ' + m.funcoesInfo[f].plural)));
    ls.forEach(l => corpo.push(h('tr', {}, h('td', { class: 'col-nome', title: l.horario ? 'Horário padrão ' + l.horario : '' }, l.nome),
      m.dias.map((d, k) => {
        const c = l.dias[k] || { t: '' }, prev = d.data >= m.previsao;
        const dica = [NOME_TIPO[c.t], c.motivo, c.h, c.obs, DIAS_L[d.dia] + ' ' + dataBR(d.data)].filter(Boolean).join(' • ');
        const td = h('td', { class: 'cel t-' + c.t + (prev ? ' prev' : '') + (d.hoje ? ' hoje' : '') + (d.dia === 0 ? ' dom' : '') + (c.manual ? ' manual' : ''),
          tabindex: '0', role: 'button', title: dica, 'aria-label': l.nome + ', ' + dica + '. Toque para alterar.', onclick: () => modalDia(l, k, m) },
        SIG[c.t] ? h('span', { class: 'sig' }, SIG[c.t]) : null,
        verHorarios && c.h ? h('small', { class: 'hr' }, c.h.slice(0, 5)) : null,
        verHorarios && c.h ? h('small', { class: 'hr' }, c.h.slice(-5)) : null,
        c.obs ? h('i', { class: 'ponto-obs', 'aria-hidden': 'true' }) : null);
        td.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); modalDia(l, k, m); } });
        return td;
      }),
      h('td', { class: 'tot' }, String(l.total)))));
    corpo.push(h('tr', { class: 'cob' }, h('td', { class: 'col-nome' }, 'Trabalhando / mínimo'),
      m.dias.map((d, k) => { const t = m.trabalhando[f][k], mi = m.minimos[f][k]; return h('td', { class: t < mi ? 'def' : '', title: t < mi ? 'Falta gente neste dia' : '' }, t + '/' + mi); }), h('td')));
  });
  const ckHor = h('input', { type: 'checkbox', checked: verHorarios, onchange: e => { verHorarios = e.target.checked; painelGestor(); } });
  const card = h('div', { class: 'card escala-mes' + (verHorarios ? ' com-horas' : '') },
    h('div', { class: 'so-imprime cab-impressao' }, h('img', { src: logoSrc(), alt: '' }),
      h('div', {}, h('b', {}, 'Escala de folgas • ' + titulo), h('small', {}, (MARCA ? MARCA.nome + ' • ' : '') + 'F = folga, FJ = falta justificada, FI = falta, EX = dia extra, TR = trabalhou no feriado. Gerada em ' + dataBRc(m.hoje) + '.'))),
    h('div', { class: 'topo-escala nao-imprime' }, h('h2', {}, 'Escala do mês'),
      h('div', { class: 'acoes' },
        h('button', { class: 'cheio', onclick: () => window.print() }, 'Imprimir ou salvar PDF'),
        h('button', { onclick: () => baixarEscala(m, titulo) }, 'Baixar planilha'),
        h('button', { onclick: modalSalvarVersao }, 'Salvar versão'))),
    navMes,
    m.furos ? h('div', { class: 'msg erro nao-imprime' }, h('b', {}, 'Falta gente em ' + m.furos + (m.furos === 1 ? ' dia' : ' dias') + ' deste mês. '), 'Veja os números em vermelho na linha "Trabalhando / mínimo" e toque num dia para ajustar.') : null,
    h('div', { class: 'barra-escala nao-imprime' },
      h('div', { class: 'legenda' },
        h('span', {}, h('i', { class: 'leg-folga' }), 'F folga'), h('span', {}, h('i', { class: 'leg-fj' }), 'FJ falta justificada'),
        h('span', {}, h('i', { class: 'leg-fi' }), 'FI falta'), h('span', {}, h('i', { class: 'leg-ex' }), 'EX dia extra'),
        h('span', {}, h('i', { class: 'leg-tr' }), 'TR trabalhou no feriado'), h('span', {}, h('i', { class: 'leg-obs' }), 'tem observação'),
        h('span', {}, h('i', { class: 'leg-prev' }), 'previsão'), h('span', {}, h('i', { class: 'leg-hoje' }), 'hoje')),
      h('label', { class: 'check' }, ckHor, 'Mostrar horários')),
    h('p', { class: 'sutil pequeno nao-imprime' }, 'Toque em qualquer dia para marcar folga, falta, dia extra, horário ou observação. O sistema não deixa quebrar a lei nem deixar furo.'),
    h('div', { class: 'tabela-rolagem' }, h('table', { class: 'tmes' }, h('thead', {}, cab), h('tbody', {}, corpo))),
    h('p', { class: 'sutil pequeno rodape-mes' }, m.feriados.length ? 'Feriados do mês: ' + m.feriados.map(x => dataBR(x.data) + ' ' + x.nome).join(' • ') + '.' : 'Sem feriados neste mês.',
      ' Esta escala organiza as folgas e não substitui o controle de ponto oficial.'));
  const resumo = h('div', { class: 'card resumo-mes' }, h('h2', {}, 'Resumo de ' + titulo),
    h('div', { class: 'tabela-rolagem' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Colaborador', 'Função', 'Horário padrão', 'Trabalho', 'Folga', 'F. just.', 'Falta', 'Extra', 'Feriado trab.'].map(t => h('th', {}, t)))),
      h('tbody', {}, m.linhas.map(l => h('tr', {}, h('td', {}, l.nome), h('td', {}, m.funcoesInfo[l.funcao].nome), h('td', {}, l.horario || '—'),
        ['T', 'F', 'FJ', 'FI', 'EX', 'TR'].map(t => h('td', { class: t === 'FI' && l.resumo[t] ? 'def' : '' }, String(l.resumo[t])))))))));
  app.replaceChildren(nav, card, resumo);
}

function baixarEscala(m, titulo) {
  const linhas = [['Escala ' + titulo], ['Colaborador', 'Função', ...m.dias.map(d => dataBR(d.data) + ' ' + DIAS[d.dia]), 'Folgas', 'F. just.', 'Falta', 'Extra', 'Feriado trab.']];
  m.ordem.forEach(f => m.linhas.filter(l => l.funcao === f).forEach(l => linhas.push([l.nome, m.funcoesInfo[f].nome,
    ...l.dias.map(c => [SIG[c.t] || 'T', c.h].filter(Boolean).join(' ')), l.resumo.F, l.resumo.FJ, l.resumo.FI, l.resumo.EX, l.resumo.TR])));
  linhas.push([], ['T = trabalho, F = folga, FJ = falta justificada, FI = falta, EX = dia extra, TR = trabalhou no feriado']);
  baixarArquivo('escala-' + m.mes + '.csv', csv(linhas), 'text/csv;charset=utf-8');
  toast('Planilha baixada. Ela abre no Excel ou no Google Planilhas.');
}

function modalSalvarVersao() {
  const hoje = new Date();
  const nome = h('input', { value: 'Escala de ' + String(hoje.getDate()).padStart(2, '0') + '/' + String(hoje.getMonth() + 1).padStart(2, '0'), maxlength: '50', 'aria-label': 'Nome da versão' });
  const msg = h('div');
  abrirModal(h('h2', { class: 'neon-sm' }, 'Salvar versão da escala'),
    h('p', { class: 'sutil' }, 'Guarda uma cópia da escala como está agora. Se depois algo der errado, você volta para ela na aba "Backup e histórico".'),
    h('label', {}, 'Nome'), nome, msg,
    h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: async () => {
      try { await api('/api/gestor/versoes', { acao: 'salvar', nome: nome.value }); fecharModal(); toast('Versão salva.'); }
      catch (e) { msg.replaceChildren(erroBox(e)); }
    } }, 'Salvar'), h('button', { onclick: fecharModal }, 'Cancelar')));
}

// ---------- um dia de uma pessoa: tipo do dia, troca de folga, horário e observação
function modalDia(l, k, m) {
  const d = m.dias[k], c = l.dias[k] || { t: 'T' };
  if (!c.t) { toast('Esta pessoa ainda não tem escala nesse dia.', true); return; }
  const w = somaDias(d.data, -d.dia), par = l.pares[w];
  const podeTrocar = m.editaveis.includes(w) && d.data >= m.hoje && !!par;
  const motivoTroca = d.data < m.hoje ? 'Esse dia já passou.' : 'A folga só muda de dia na semana atual e na próxima.';
  const base = (c.t === 'F' || c.t === 'EX') ? 'F' : 'T';
  let tipo = c.t, destino = null;
  const opcoes = base === 'T'
    ? [['T', 'Trabalho'], ['F', 'Folga (troca de dia)'], ['FJ', 'Falta justificada'], ['FI', 'Falta injustificada']].concat(d.feriado ? [['TR', 'Trabalhou no feriado']] : [])
    : [['F', 'Folga'], ['T', 'Trabalho (troca de dia)'], ['EX', 'Dia extra (trabalhou na folga)']];
  const bloqueio = t => {
    if (t !== base && (t === 'F' || t === 'T') && !podeTrocar) return motivoTroca;
    if (t === 'FI' && d.data > m.hoje) return 'Falta injustificada só em dia que já chegou.';
    return null;
  };
  const chips = h('div', { class: 'chips' });
  const areaTroca = h('div');
  const motivo = h('select', { 'aria-label': 'Motivo da falta justificada' }, h('option', { value: '' }, 'Escolha o motivo...'), m.motivos.map(x => h('option', { value: x, selected: c.motivo === x }, x)));
  const areaMotivo = h('div', {}, h('label', {}, 'Motivo'), motivo);
  const ent = h('input', { type: 'time', value: c.manual ? c.h.slice(0, 5) : '', 'aria-label': 'Entrada' });
  const sai = h('input', { type: 'time', value: c.manual ? c.h.slice(-5) : '', 'aria-label': 'Saída' });
  const areaHora = h('div', {}, h('label', {}, 'Horário neste dia'), h('div', { class: 'grade2 hora' }, ent, sai),
    h('p', { class: 'sutil pequeno' }, l.horario ? 'Vazio = horário padrão (' + l.horario + ').' : 'Opcional.'));
  const obs = h('input', { value: c.obs || '', maxlength: '200', placeholder: 'Ex.: trocou com a Camila, chegou atrasado...', 'aria-label': 'Observação' });
  const msg = h('div');
  const salvar = h('button', { class: 'cheio' }, 'Salvar');

  const desenhar = () => {
    chips.replaceChildren(...opcoes.map(([t, rot]) => {
      const pq = bloqueio(t);
      return h('button', { type: 'button', class: 'chip-tipo tp-' + t + (tipo === t ? ' sel' : ''), disabled: !!pq, title: pq || '', 'aria-pressed': tipo === t ? 'true' : 'false',
        onclick: () => { tipo = t; destino = null; msg.replaceChildren(); desenhar(); } }, rot);
    }));
    const troca = tipo !== base && (tipo === 'F' || tipo === 'T');
    areaTroca.replaceChildren();
    if (troca) {
      const alvos = base === 'T'
        ? par.filter(x => somaDias(w, x) >= m.hoje)
        : [0, 1, 2, 3, 4, 5, 6].filter(x => !par.includes(x) && somaDias(w, x) >= m.hoje);
      areaTroca.append(h('label', {}, base === 'T' ? 'Qual folga desta semana vira dia de trabalho?' : 'Para qual dia vai esta folga?'),
        alvos.length ? h('div', { class: 'chips' }, alvos.map(x => h('button', { type: 'button', class: 'chip-dia' + (destino === x ? ' sel' : ''),
          onclick: () => { destino = x; desenhar(); } }, DIAS[x] + ' ' + dataBR(somaDias(w, x)))))
          : h('p', { class: 'sutil' }, 'Não há dia disponível nesta semana.'));
    }
    areaMotivo.hidden = tipo !== 'FJ';
    areaHora.hidden = !(tipo === 'T' || tipo === 'EX' || tipo === 'TR');
    salvar.disabled = troca && destino == null;
  };

  const enviar = async remanejo => {
    if ((ent.value === '') !== (sai.value === '')) { msg.replaceChildren(erroBox({ msg: 'Preencha a entrada e a saída, ou deixe as duas vazias.' })); return; }
    if (tipo === 'FJ' && !motivo.value) { msg.replaceChildren(erroBox({ msg: 'Escolha o motivo da falta justificada.' })); return; }
    const troca = tipo !== base && (tipo === 'F' || tipo === 'T');
    salvar.disabled = true;
    try {
      if (troca) {
        const novo = base === 'T' ? [d.dia, par.find(x => x !== destino)] : [destino, par.find(x => x !== d.dia)];
        const [a, b] = novo.sort((p, q) => p - q);
        try { await api('/api/gestor/folgas', { id: l.id, semana: w, a, b, remanejo: remanejo || [] }); }
        catch (e) {
          if (e.codigo === 'cobertura' && !remanejo) { // abriria furo: mostra quem pode cobrir e pede a aprovação do gestor
            const pl = await api('/api/gestor/previa', { id: l.id, semana: w, a, b }).catch(() => null);
            if (pl) {
              msg.replaceChildren(blocoPlano(pl, 'Esta troca deixaria furo:'),
                pl.resolve ? h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: () => enviar(remanejoDe(pl)) }, 'Salvar com este remanejamento')) : null);
              return;
            }
          }
          throw e;
        }
      }
      const s = (tipo === 'T' || tipo === 'F') ? '' : tipo;
      const r = await api('/api/gestor/dia', { id: l.id, data: d.data, s, motivo: motivo.value, ent: ent.value, sai: sai.value, obs: obs.value });
      fecharModal();
      toast(r.aviso || (troca ? 'Folga trocada de dia.' : 'Dia salvo.'), !!r.aviso);
      painelGestor();
    } catch (e) { msg.replaceChildren(erroBox(e)); }
    finally { salvar.disabled = false; desenhar(); }
  };
  salvar.addEventListener('click', () => enviar(null));
  desenhar();
  abrirModal(h('h2', { class: 'neon-sm' }, l.nome),
    h('p', { class: 'sutil' }, DIAS_L[d.dia] + ', ' + dataBRc(d.data) + (d.feriado ? ' • feriado: ' + d.feriado : '') + (d.data >= m.previsao ? ' • previsão' : '') + '. Folgas da semana: ' + parTxt(par) + '.'),
    h('label', {}, 'O que vale neste dia?'), chips, areaTroca, areaMotivo, areaHora,
    h('label', {}, 'Observação'), obs, msg,
    h('div', { class: 'acoes' }, salvar, h('button', { onclick: fecharModal }, 'Cancelar')));
}

// ---------- equipe
const campoHora = (valor, rot) => h('input', { type: 'time', value: valor || '', 'aria-label': rot });
function gEquipe(g) {
  const nome = h('input', { placeholder: 'Nome completo' });
  const cpf = h('input', { inputmode: 'numeric', maxlength: '14', placeholder: '000.000.000-00', autocomplete: 'off' });
  const fn = h('select', {}, g.ordem.map(f => h('option', { value: f }, g.funcoesInfo[f].nome)));
  const dom = h('select', {}, h('option', { value: '3' }, 'Homem: folga 1 domingo a cada 3 semanas'), h('option', { value: '2' }, 'Mulher: folga 1 domingo a cada 2 semanas'));
  const ent = campoHora('', 'Entrada'), sai = campoHora('', 'Saída');
  const msg = h('div');
  const cadastrar = async () => {
    try {
      const r = await api('/api/gestor/funcionarios', { nome: nome.value, cpf: cpf.value, funcao: fn.value, domingoSemanas: Number(dom.value), hEnt: ent.value, hSai: sai.value });
      await painelGestor(); toast(r.nome + ' cadastrado. Ele entra com o nome completo e o CPF.');
    } catch (e) { msg.replaceChildren(erroBox(e)); }
  };
  const remover = f => confirmar('Remover ' + f.nome + '?', 'O colaborador sai da escala e perde o acesso. Se faltar gente, a escala mostra o furo e sugere quem pode cobrir, para você aprovar.', 'Remover',
    async () => { try { await api('/api/gestor/funcionarios/remover', { id: f.id }); toast('Removido.'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
  const revogar = f => confirmar('Encerrar as sessões de ' + f.nome + '?', 'Ele sai de todos os aparelhos onde estiver logado. Depois pode entrar de novo com nome e CPF.', 'Encerrar',
    async () => { try { await api('/api/gestor/funcionarios/acesso', { id: f.id }); toast('Sessões encerradas.'); } catch (e) { toast(e.msg, true); } }, true);
  const editar = f => {
    const n = h('input', { value: f.nome, maxlength: '60' });
    const fu = h('select', {}, g.ordem.map(x => h('option', { value: x, selected: x === f.funcao }, g.funcoesInfo[x].nome)));
    const dm = h('select', {}, h('option', { value: '3', selected: f.domingoSemanas === 3 }, 'Folga 1 domingo a cada 3 semanas'), h('option', { value: '2', selected: f.domingoSemanas === 2 }, 'Folga 1 domingo a cada 2 semanas'));
    const e1 = campoHora(f.hEnt, 'Entrada'), s1 = campoHora(f.hSai, 'Saída');
    const m2 = h('div');
    abrirModal(h('h2', { class: 'neon-sm' }, 'Editar ' + f.nome),
      h('div', { class: 'grade2' }, h('div', {}, h('label', {}, 'Nome completo'), n), h('div', {}, h('label', {}, 'Função'), fu),
        h('div', {}, h('label', {}, 'Regra de domingo'), dm), h('div', {}, h('label', {}, 'Horário padrão (entrada e saída)'), h('div', { class: 'grade2 hora' }, e1, s1))),
      h('p', { class: 'sutil pequeno' }, 'O CPF não muda aqui (é o login dele). Para trocar o CPF, remova e cadastre de novo.'), m2,
      h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: async () => {
        try { await api('/api/gestor/funcionarios/editar', { id: f.id, nome: n.value, funcao: fu.value, domingoSemanas: Number(dm.value), hEnt: e1.value, hSai: s1.value }); fecharModal(); toast('Dados salvos.'); painelGestor(); }
        catch (e) { m2.replaceChildren(erroBox(e)); }
      } }, 'Salvar'), h('button', { onclick: fecharModal }, 'Cancelar')));
  };
  const temDemo = g.equipe.some(f => f.demo);
  const removerDemo = () => confirmar('Remover equipe de demonstração?', 'Remove todos os colaboradores fictícios. Os que você cadastrou ficam.', 'Remover',
    async () => { try { const r = await api('/api/gestor/demo/remover', {}); toast(r.removidos + ' removido(s).'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
  return h('div', {},
    h('div', { class: 'card' }, h('h2', {}, 'Cadastrar colaborador'),
      h('div', { class: 'grade2' }, h('div', {}, h('label', {}, 'Nome'), nome), h('div', {}, h('label', {}, 'CPF (é o login dele)'), cpf), h('div', {}, h('label', {}, 'Função'), fn),
        h('div', {}, h('label', {}, 'Regra de domingo'), dom), h('div', {}, h('label', {}, 'Horário padrão (opcional)'), h('div', { class: 'grade2 hora' }, ent, sai))),
      msg, h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: cadastrar }, 'Cadastrar')),
      h('p', { class: 'sutil pequeno' }, 'O colaborador entra com o nome completo e o CPF. O sistema guarda só um código irreversível do CPF (e os 2 últimos dígitos). As folgas são encaixadas sem mexer nas dos outros.')),
    h('div', { class: 'card' }, h('h2', {}, 'Equipe (' + g.equipe.length + ')'),
      temDemo ? h('div', { class: 'msg' }, 'Há colaboradores fictícios de demonstração. ', h('button', { class: 'perigo pq', onclick: removerDemo }, 'Remover demonstração')) : null,
      h('div', { class: 'tabela-rolagem' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Nome', 'Função', 'CPF', 'Domingo', 'Horário', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, g.equipe.map(f => h('tr', {}, h('td', {}, f.nome, f.demo ? h('span', { class: 'badge' }, 'demo') : null), h('td', {}, g.funcoesInfo[f.funcao].nome), h('td', {}, f.cpf),
          h('td', {}, 'a cada ' + f.domingoSemanas + ' sem.'), h('td', {}, f.hEnt ? f.hEnt + '–' + f.hSai : '—'),
          h('td', { class: 'acoes-linha' }, h('button', { class: 'pq', onclick: () => editar(f) }, 'Editar'), h('button', { class: 'pq', onclick: () => revogar(f) }, 'Encerrar sessões'), h('button', { class: 'perigo pq', onclick: () => remover(f) }, 'Remover'))))))))
  );
}

function gCobertura(g) {
  const linhas = g.ordem.map(f => {
    const ins = DIAS.map((_, d) => h('input', { type: 'number', min: '0', max: '30', value: String(g.minimos[f][d]), 'aria-label': g.funcoesInfo[f].nome + ' ' + DIAS_L[d] }));
    return h('tr', {}, h('td', {}, g.funcoesInfo[f].nome), ins.map(i => h('td', {}, i)),
      h('td', {}, h('button', { onclick: async () => { try { await api('/api/gestor/minimos', { funcao: f, dias: ins.map(i => Number(i.value)) }); toast('Cobertura salva.'); painelGestor(); } catch (e) { toast(e.msg, true); } } }, 'Salvar')));
  });
  return h('div', {}, h('div', { class: 'card' }, h('h2', {}, 'Cobertura mínima por dia'),
    h('p', { class: 'sutil' }, 'Quantas pessoas de cada função precisam trabalhar em cada dia. O sistema usa esses números para montar as semanas e para barrar qualquer troca que deixe furo.'),
    h('div', { class: 'tabela-rolagem' }, h('table', { class: 'minimos' }, h('thead', {}, h('tr', {}, h('th', {}, 'Função'), DIAS.map(d => h('th', {}, d)), h('th', {}))), h('tbody', {}, linhas)))));
}

function gRegras(g) {
  const rot = { lei: ['ok', 'lei'], cct2019: ['warn', 'acordo 2019'], sistema: ['', 'regra do sistema'], confirmar: ['bad', 'confirmar'] };
  const data = h('input', { type: 'date', 'aria-label': 'Data do feriado', min: g.semana });
  const nome = h('input', { placeholder: 'Ex.: Aniversário de Araraquara', maxlength: '50', 'aria-label': 'Nome do feriado' });
  const msg = h('div');
  const adicionar = async () => {
    try { await api('/api/gestor/feriados', { data: data.value, nome: nome.value }); toast('Feriado cadastrado.'); painelGestor(); }
    catch (e) { msg.replaceChildren(erroBox(e)); }
  };
  const remover = x => confirmar('Remover o feriado de ' + dataBRc(x.data) + '?', x.nome + ' deixa de ser feriado na escala.', 'Remover',
    async () => { try { await api('/api/gestor/feriados', { data: x.data, remover: true }); toast('Feriado removido.'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
  return h('div', {},
    h('div', { class: 'card' }, h('h2', {}, 'Feriados'),
      h('p', { class: 'sutil' }, 'Os nacionais já vêm cadastrados. Inclua os de Araraquara e de São Paulo e remova o que não valer. Feriado conta para a escala e para o "trabalhou no feriado".'),
      h('div', { class: 'grade-feriado' }, data, nome, h('button', { class: 'cheio', onclick: adicionar }, 'Adicionar')), msg,
      h('ul', { class: 'limpa lista-fer' }, g.listaFeriados.map(x => h('li', {}, h('span', {}, h('b', {}, dataBRc(x.data)), ' ' + x.nome),
        x.data >= g.semana ? h('button', { class: 'pq perigo', onclick: () => remover(x) }, 'Remover') : h('span', { class: 'sutil pequeno' }, 'já passou'))))),
    h('div', { class: 'card' }, h('h2', {}, 'Regras aplicadas e fonte'),
      h('div', { class: 'msg' }, 'Não é parecer jurídico. Confira cada item com o SINTHORESSARA ou com o contador antes de usar como oficial.'),
      g.regras.map(r => h('div', { class: 'pedido' }, h('b', {}, r.titulo), ' ', h('span', { class: 'badge ' + rot[r.status][0] }, rot[r.status][1]), h('p', {}, r.descricao), h('div', { class: 'sutil' }, 'Fonte: ' + r.fonte)))));
}

function gAudit(g) {
  const cab = ['Colaborador', 'Folgas', 'Máx. dias seguidos', 'Semanas sem folgar domingo', 'Feriados trabalhados', 'Situação'];
  const baixar = () => baixarArquivo('auditoria-' + g.semana + '.csv', csv([['Auditoria da semana de ' + dataBRc(g.semana)], cab,
    ...g.auditoria.map(a => [a.nome, a.folgas, a.maxSeq, a.semDom, a.feriados, a.ok ? 'em regra' : 'verificar'])]), 'text/csv;charset=utf-8');
  return h('div', { class: 'card' }, h('div', { class: 'topo-escala' }, h('h2', {}, 'Auditoria da semana de ' + dataBR(g.semana)), h('button', { onclick: baixar }, 'Baixar planilha')),
    h('p', { class: 'sutil' }, 'Confere cada pessoa contra as regras: 2 folgas na semana, no máximo 6 dias seguidos e o domingo de folga no prazo.'),
    h('div', { class: 'tabela-rolagem' }, h('table', {},
      h('thead', {}, h('tr', {}, cab.map(t => h('th', {}, t)))),
      h('tbody', {}, g.auditoria.map(a => h('tr', {}, h('td', {}, a.nome), h('td', {}, String(a.folgas)), h('td', {}, String(a.maxSeq)), h('td', {}, String(a.semDom)), h('td', {}, String(a.feriados)),
        h('td', {}, h('span', { class: 'badge ' + (a.ok ? 'ok' : 'bad') }, a.ok ? 'em regra' : 'verificar'))))))));
}

// ---------- identidade da empresa
function gEmpresa(g) {
  const mc = Object.assign({ nome: 'Quintal do Carmo', subtitulo: '', logo: '', cor: '', demoBotoes: false }, g.marca);
  let logo = mc.logo || '';
  const nome = h('input', { value: mc.nome || 'Quintal do Carmo', maxlength: '40' });
  const sub = h('input', { value: mc.subtitulo || '', maxlength: '60', placeholder: 'Ex.: Restaurante e Choperia' });
  const cor = h('input', { type: 'color', value: mc.cor || '#5ad2aa', 'aria-label': 'Cor principal' });
  const demo = h('input', { type: 'checkbox', checked: !!mc.demoBotoes });
  const previa = h('img', { class: 'previa-logo', src: logo || 'logo.png', alt: 'Logo' });
  const arquivo = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-label': 'Escolher logo' });
  const msg = h('div');
  arquivo.addEventListener('change', () => {
    const f = arquivo.files[0]; if (!f) return;
    if (f.size > 400 * 1024) { msg.replaceChildren(erroBox({ msg: 'Imagem grande demais (máximo 400 KB).' })); arquivo.value = ''; return; }
    const r = new FileReader();
    r.onload = () => { logo = r.result; previa.src = logo; msg.replaceChildren(); };
    r.readAsDataURL(f);
  });
  const salvar = async corEscolhida => {
    try {
      await api('/api/gestor/marca', { nome: nome.value, subtitulo: sub.value, logo, cor: corEscolhida, demoBotoes: demo.checked });
      MARCA = null; await carregarMarca(); toast('Identidade salva.'); painelGestor();
    } catch (e) { msg.replaceChildren(erroBox(e)); }
  };
  return h('div', { class: 'card' }, h('h2', {}, 'Identidade da empresa'),
    h('p', { class: 'sutil' }, 'Nome, logo e cor aparecem na tela de entrada, no topo e na escala impressa.'),
    h('div', { class: 'grade2' },
      h('div', {}, h('label', {}, 'Nome da empresa'), nome, h('label', {}, 'Subtítulo'), sub, h('label', {}, 'Cor principal'), cor),
      h('div', {}, h('label', {}, 'Logo (PNG ou JPG, até 400 KB)'), previa, arquivo,
        logo ? h('button', { class: 'pq', onclick: () => { logo = ''; previa.src = 'logo.png'; } }, 'Voltar ao logo padrão') : null)),
    h('label', { class: 'check' }, demo, 'Mostrar os botões de entrada rápida (contas de demonstração) na tela de entrada'),
    h('p', { class: 'sutil pequeno' }, 'Desmarque antes de usar com a equipe de verdade.'), msg,
    h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: () => salvar(cor.value.toLowerCase() === '#5ad2aa' ? '' : cor.value) }, 'Salvar'),
      h('button', { onclick: () => { cor.value = '#5ad2aa'; salvar(''); } }, 'Voltar à cor padrão')));
}

// ---------- backup, versões salvas e histórico
function gBackup(g) {
  const baixar = async () => {
    try {
      const b = await api('/api/gestor/backup');
      baixarArquivo('backup-escala-' + g.hoje + '.json', JSON.stringify(b, null, 1), 'application/json');
      toast('Backup baixado. Guarde o arquivo num lugar seguro.');
    } catch (e) { toast(e.msg, true); }
  };
  const arquivo = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Arquivo de backup' });
  const restaurar = () => {
    const f = arquivo.files[0];
    if (!f) { toast('Escolha o arquivo de backup (.json).', true); return; }
    const r = new FileReader();
    r.onload = () => {
      let obj; try { obj = JSON.parse(r.result); } catch (e) { toast('Arquivo inválido.', true); return; }
      confirmar('Restaurar o backup?', 'Todos os dados atuais (equipe, escala, faltas, feriados) serão trocados pelos do arquivo "' + f.name + '". Baixe um backup do jeito atual antes, por garantia.', 'Restaurar',
        async () => { try { await api('/api/gestor/backup/restaurar', { estado: obj }); MARCA = null; await carregarMarca(); toast('Backup restaurado.'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
    };
    r.readAsText(f);
  };
  const voltar = v => confirmar('Voltar para "' + v.nome + '"?', 'A escala de hoje em diante volta a ficar como estava nessa versão (folgas da semana atual e da próxima, faltas e horários). O que já passou não muda, e nada que quebre a lei é aplicado.', 'Voltar para esta versão',
    async () => { try { await api('/api/gestor/versoes', { acao: 'restaurar', id: v.id }); toast('Escala voltou para a versão.'); abaGestor = 'escala'; painelGestor(); } catch (e) { toast(e.msg, true); } });
  const excluir = v => confirmar('Excluir a versão "' + v.nome + '"?', 'A escala atual não muda.', 'Excluir',
    async () => { try { await api('/api/gestor/versoes', { acao: 'excluir', id: v.id }); toast('Versão excluída.'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
  return h('div', {},
    h('div', { class: 'card' }, h('h2', {}, 'Versões salvas da escala'),
      h('p', { class: 'sutil' }, 'Use "Salvar versão" na Escala do mês antes de uma mudança grande. Se não gostar do resultado, volte aqui.'),
      g.copias.length ? h('ul', { class: 'limpa lista-fer' }, g.copias.map(v => h('li', {}, h('span', {}, h('b', {}, v.nome), h('span', { class: 'sutil pequeno' }, ' • ' + v.em + ' • ' + v.por)),
        h('span', { class: 'acoes-linha' }, h('button', { class: 'pq', onclick: () => voltar(v) }, 'Voltar para esta'), h('button', { class: 'pq perigo', onclick: () => excluir(v) }, 'Excluir')))))
        : h('p', { class: 'sutil' }, 'Nenhuma versão salva ainda.')),
    h('div', { class: 'card' }, h('h2', {}, 'Backup'),
      h('p', { class: 'sutil' }, 'Um arquivo com todos os dados. Baixe de vez em quando e antes de qualquer mudança grande.'),
      h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: baixar }, 'Baixar backup')),
      h('label', {}, 'Restaurar um backup'), h('div', { class: 'grade-arquivo' }, arquivo, h('button', { class: 'perigo', onclick: restaurar }, 'Restaurar'))),
    h('div', { class: 'card' }, h('h2', {}, 'Histórico'), h('p', { class: 'sutil pequeno' }, 'Tudo o que foi alterado, por quem e quando.'),
      h('ul', { class: 'limpa historico' }, g.log.map(l => h('li', {}, h('span', { class: 'sutil' }, l.t + ' '), l.texto)))));
}

iniciar();
