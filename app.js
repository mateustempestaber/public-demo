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
let verResumo = false;
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
// coloca filhos num elemento ignorando vazios (o navegador escreveria "null" na tela)
const por = (el, ...xs) => el.replaceChildren(...xs.flat().filter(x => x != null && x !== false && x !== ''));
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
  abaGestor = 'escala'; mesGestor = ''; mesFunc = 0; verHorarios = false; verResumo = false; // quem entrar começa sempre pela escala
  fecharModal();
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
    h('span', {}, h('i', { class: 'leg-prev' }), 'Folga que ainda pode mudar'),
    h('span', {}, h('i', { class: 'leg-fi' }), 'Faltou'),
    h('span', {}, h('i', { class: 'leg-ex' }), 'Extra'),
    h('span', {}, h('i', { class: 'leg-hoje' }), 'Hoje'),
    h('span', {}, h('i', { class: 'leg-fer' }), 'Feriado'));
}

const ROT_CAL = { FJ: 'faltou', FI: 'faltou', EX: 'extra', TR: 'feriado' };
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
      navMes, calendarioMes(p.calendario, mes), legendaFunc()),
    h('div', { class: 'card' },
      h('h2', {}, 'Suas folgas'),
      p.semanas.map(sem => h('div', { class: 'linha-semana' },
        h('div', {}, h('b', {}, sem.rotulo), h('span', { class: 'sutil' }, ' (' + dataBR(sem.inicio) + ' a ' + dataBR(sem.fim) + ')')),
        h('b', { class: 'neon-sm' }, parTxt(sem.par)))),
      p.horario ? h('div', { class: 'linha-semana' }, h('b', {}, 'Seu horário'), h('b', { class: 'neon-sm' }, p.horario)) : null,
      h('p', { class: 'sutil pequeno' }, 'Precisa mudar uma folga? Fale com o gestor.')));
}

// ---------- gestor: só 3 abas. O que é usado de vez em quando fica em "Mais".
const MAIS = [
  ['cobertura', 'Pessoas por dia', 'Quantas pessoas de cada função precisam trabalhar em cada dia.'],
  ['regras', 'Feriados', 'Cadastrar os feriados da cidade e ver as regras da lei.'],
  ['audit', 'Conferir a lei', 'Ver se alguém está fora da regra nesta semana.'],
  ['backup', 'Cópia de segurança e histórico', 'Guardar ou voltar uma cópia e ver tudo o que foi mudado.'],
  ['empresa', 'Empresa', 'Nome, logo e cor do sistema.']];
async function painelGestor() {
  let g;
  try { g = await api('/api/gestor/painel'); } catch (e) { return; }
  const eu = await api('/api/eu').catch(() => ({ nome: 'Gestor' }));
  barraUsuario(eu.nome || 'Gestor', 'gestor');
  const naMais = abaGestor === 'mais' || MAIS.some(([k]) => k === abaGestor);
  const abas = [['escala', 'Escala'], ['equipe', 'Equipe'], ['mais', 'Mais']];
  const nav = h('div', { class: 'abas' }, abas.map(([k, t]) => h('button', { class: (abaGestor === k || (k === 'mais' && naMais)) ? 'ativa' : '', onclick: () => { abaGestor = k; painelGestor(); } }, t)));
  if (abaGestor === 'escala') { app.replaceChildren(nav, h('div', { class: 'card' }, h('p', { class: 'sutil' }, 'Carregando a escala...'))); return gEscalaMes(nav); }
  if (abaGestor === 'equipe') return app.replaceChildren(nav, gEquipe(g));
  if (abaGestor === 'mais') return app.replaceChildren(nav, h('div', { class: 'menu-mais' }, MAIS.map(([k, t, d]) =>
    h('button', { class: 'item-mais', onclick: () => { abaGestor = k; painelGestor(); } }, h('b', {}, t), h('span', {}, d), h('i', { 'aria-hidden': 'true' }, '›')))));
  const voltar = h('button', { class: 'pq voltar', onclick: () => { abaGestor = 'mais'; painelGestor(); } }, '‹ Voltar');
  app.replaceChildren(nav, voltar, { cobertura: gCobertura, regras: gRegras, audit: gAudit, empresa: gEmpresa, backup: gBackup }[abaGestor](g));
}

// lista do remanejamento sugerido: só vale se o gestor aprovar
function blocoPlano(pl, titulo) {
  if (!pl) return null;
  pl.furos = pl.furos || []; pl.sugestoes = pl.sugestoes || [];
  if (!pl.furos.length && !pl.sugestoes.length) return null;
  return h('div', { class: 'msg' + (pl.resolve ? '' : ' erro') },
    pl.furos.length ? h('div', {}, h('b', {}, titulo), h('ul', {}, pl.furos.map(f => h('li', {}, f)))) : null,
    pl.sugestoes.length ? h('div', {}, h('b', {}, 'Quem pode cobrir (só muda se você confirmar):'),
      h('ul', {}, pl.sugestoes.map(s => h('li', {}, s.nome + ': ' + s.texto)))) : null,
    pl.resolve ? null : h('p', {}, 'Ninguém pode cobrir sem quebrar a lei. Escolha outro dia.'));
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
    corpo.push(h('tr', { class: 'cob' }, h('td', { class: 'col-nome' }, 'Trabalhando / precisa'),
      m.dias.map((d, k) => { const t = m.trabalhando[f][k], mi = m.minimos[f][k]; return h('td', { class: t < mi ? 'def' : '', title: t < mi ? 'Falta gente neste dia' : '' }, t + '/' + mi); }), h('td')));
  });
  // resumo de hoje, em uma frase
  const kh = m.dias.findIndex(d => d.hoje);
  let frase = null;
  if (kh >= 0) {
    const trab = m.ordem.reduce((t, f) => t + m.trabalhando[f][kh], 0);
    const folga = m.linhas.filter(l => l.dias[kh] && l.dias[kh].t === 'F').length;
    const faltas = m.linhas.filter(l => l.dias[kh] && (l.dias[kh].t === 'FJ' || l.dias[kh].t === 'FI')).length;
    const faltaGente = m.ordem.filter(f => m.trabalhando[f][kh] < m.minimos[f][kh]).map(f => m.funcoesInfo[f].plural);
    frase = h('div', { class: 'hoje-frase nao-imprime' + (faltaGente.length ? ' ruim' : '') },
      h('b', {}, 'Hoje: '), trab + ' trabalhando, ' + folga + ' de folga' + (faltas ? ', ' + faltas + (faltas === 1 ? ' falta' : ' faltas') : '') + '. ',
      faltaGente.length ? h('b', {}, 'Falta gente: ' + faltaGente.join(', ') + '.') : 'Tudo certo.');
  }
  const opcoes = h('details', { class: 'mais-opcoes nao-imprime' }, h('summary', {}, 'Mais opções'),
    h('div', { class: 'acoes' },
      h('button', { onclick: () => { verHorarios = !verHorarios; painelGestor(); } }, verHorarios ? 'Esconder horários' : 'Mostrar horários'),
      h('button', { onclick: () => { verResumo = !verResumo; painelGestor(); } }, verResumo ? 'Esconder resumo do mês' : 'Ver resumo do mês'),
      h('button', { onclick: () => baixarEscala(m, titulo) }, 'Baixar planilha (Excel)'),
      h('button', { onclick: modalSalvarVersao }, 'Salvar uma cópia da escala')));
  if (verHorarios || verResumo) opcoes.open = true;
  const card = h('div', { class: 'card escala-mes' + (verHorarios ? ' com-horas' : '') },
    h('div', { class: 'so-imprime cab-impressao' }, h('img', { src: logoSrc(), alt: '' }),
      h('div', {}, h('b', {}, 'Escala de folgas • ' + titulo), h('small', {}, (MARCA ? MARCA.nome + ' • ' : '') + 'F = folga, FJ = falta justificada, FI = falta, EX = dia extra, TR = trabalhou no feriado. Gerada em ' + dataBRc(m.hoje) + '. Não substitui o controle de ponto.'))),
    h('div', { class: 'topo-escala nao-imprime' }, navMes, h('button', { class: 'cheio', onclick: () => window.print() }, 'Imprimir')),
    frase,
    m.furos ? h('div', { class: 'msg erro nao-imprime' }, 'Falta gente em ' + m.furos + (m.furos === 1 ? ' dia' : ' dias') + ' deste mês (números em vermelho).') : null,
    h('div', { class: 'legenda nao-imprime' },
      h('span', {}, h('i', { class: 'leg-folga' }), 'Folga'), h('span', {}, h('i', { class: 'leg-fi' }), 'Faltou'),
      h('span', {}, h('i', { class: 'leg-ex' }), 'Extra'), h('span', {}, h('i', { class: 'leg-hoje' }), 'Hoje'),
      h('span', { class: 'dica' }, 'Toque num dia para mudar')),
    h('div', { class: 'tabela-rolagem' }, h('table', { class: 'tmes' }, h('thead', {}, cab), h('tbody', {}, corpo))),
    m.feriados.length ? h('p', { class: 'sutil pequeno rodape-mes' }, 'Feriados: ' + m.feriados.map(x => dataBR(x.data) + ' ' + x.nome).join(' • ') + '.') : null,
    opcoes);
  const resumo = verResumo ? h('div', { class: 'card resumo-mes' }, h('h2', {}, 'Resumo de ' + titulo),
    h('div', { class: 'tabela-rolagem' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Nome', 'Trabalhou', 'Folgas', 'Faltas com atestado', 'Faltas', 'Extras'].map(t => h('th', {}, t)))),
      h('tbody', {}, m.linhas.map(l => h('tr', {}, h('td', {}, l.nome), h('td', {}, String(l.resumo.T + l.resumo.TR)),
        ['F', 'FJ', 'FI', 'EX'].map(t => h('td', { class: t === 'FI' && l.resumo[t] ? 'def' : '' }, String(l.resumo[t]))))))))) : null;
  por(app, nav, card, resumo);
}

function baixarEscala(m, titulo) {
  const linhas = [['Escala ' + titulo], ['Colaborador', 'Função', ...m.dias.map(d => dataBR(d.data) + ' ' + DIAS[d.dia]), 'Folgas', 'F. just.', 'Falta', 'Extra', 'Feriado trab.']];
  m.ordem.forEach(f => m.linhas.filter(l => l.funcao === f).forEach(l => linhas.push([l.nome, m.funcoesInfo[f].nome,
    ...l.dias.map(c => [SIG[c.t] || 'T', c.h].filter(Boolean).join(' ')), l.resumo.F, l.resumo.FJ, l.resumo.FI, l.resumo.EX, l.resumo.TR])));
  linhas.push([], ['T = trabalho, F = folga, FJ = falta justificada, FI = falta, EX = dia extra, TR = trabalhou no feriado']);
  baixarArquivo('escala-' + m.mes + '.csv', csv(linhas), 'text/csv;charset=utf-8');
  toast('Planilha baixada.');
}

function modalSalvarVersao() {
  const hoje = new Date();
  const nome = h('input', { value: 'Escala de ' + String(hoje.getDate()).padStart(2, '0') + '/' + String(hoje.getMonth() + 1).padStart(2, '0'), maxlength: '50', 'aria-label': 'Nome da cópia' });
  const msg = h('div');
  abrirModal(h('h2', { class: 'neon-sm' }, 'Salvar uma cópia da escala'),
    h('p', { class: 'sutil' }, 'Se algo der errado depois, você volta para esta cópia em Mais › Cópia de segurança.'),
    h('label', {}, 'Nome'), nome, msg,
    h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: async () => {
      try { await api('/api/gestor/versoes', { acao: 'salvar', nome: nome.value }); fecharModal(); toast('Cópia salva.'); }
      catch (e) { msg.replaceChildren(erroBox(e)); }
    } }, 'Salvar'), h('button', { onclick: fecharModal }, 'Cancelar')));
}

// ---------- um dia de uma pessoa: tipo do dia, troca de folga, horário e observação (igual ao site do Fred)
const minDe = x => /^\d\d:\d\d$/.test(x || '') ? (+x.slice(0, 2)) * 60 + (+x.slice(3)) : null;
const fmtH = m => m == null ? '—' : Math.floor(m / 60) + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : '');
const fmtSaldo = m => m === 0 ? '0h' : (m > 0 ? '+' : '−') + fmtH(Math.abs(m));
const brutoDe = (e, s) => { const a = minDe(e), b = minDe(s); if (a == null || b == null) return null; let d = b - a; if (d <= 0) d += 1440; return d; };
// avisos da jornada (mesma regra do servidor e do site do Fred: só alertam, não bloqueiam)
function avisosJornada(ent, sai, it, antes, depois) {
  const av = [];
  if (!ent || !sai || ent === sai) return av;
  const bruto = brutoDe(ent, sai), m = bruto - (it || 0);
  if (m > 600) av.push('Mais de 10 h de trabalho no dia (' + fmtH(m) + ').');
  if (bruto > 360 && (it || 0) < 60) av.push('Turno de mais de 6 h pede 1 h de intervalo.');
  else if (bruto > 240 && bruto <= 360 && (it || 0) < 15) av.push('Turno de 4 a 6 h pede 15 min de intervalo.');
  const gap = (e1, s1, e2) => { let f = minDe(s1); if (f < minDe(e1)) f += 1440; return 1440 + minDe(e2) - f; };
  if (antes) { const g = gap(antes[0], antes[1], ent); if (g < 660) av.push('Só ' + fmtH(g) + ' de descanso desde ontem (o mínimo é 11 h).'); }
  if (depois) { const g = gap(ent, sai, depois[0]); if (g < 660) av.push('Só ' + fmtH(g) + ' de descanso até amanhã (o mínimo é 11 h).'); }
  return av;
}
const listaAvisos = av => av.length ? h('div', { class: 'msg aviso' }, h('b', {}, 'Atenção: '), av.join(' ')) : null;

// janela do dia: poucos botões grandes; o resto aparece só quando precisa
function modalDia(l, k, m) {
  const d = m.dias[k], c = l.dias[k] || { t: '' };
  if (!c.t) { toast('Esta pessoa ainda não tem escala nesse dia.', true); return; }
  const w = somaDias(d.data, -d.dia), par = l.pares[w];
  const podeTrocar = m.editaveis.includes(w) && d.data >= m.hoje && !!par;
  const motivoTroca = d.data < m.hoje ? 'Esse dia já passou.' : 'Só dá para mudar folga nesta semana e na próxima.';
  const base = (c.t === 'F' || c.t === 'EX') ? 'F' : 'T';
  const trabalha = t => t === 'T' || t === 'EX' || t === 'TR';
  // "faltou" é um botão só; depois pergunta se trouxe atestado (FJ) ou não (FI)
  let tipo = c.t, destino = null, leis = null, verHora = !!c.manual;
  const principal = t => (t === 'FJ' || t === 'FI') ? 'FALTOU' : t;
  const botoes = base === 'T'
    ? [['T', 'Trabalha'], ['F', 'Folga neste dia'], ['FALTOU', 'Faltou']].concat(d.feriado ? [['TR', 'Trabalhou no feriado']] : [])
    : [['F', 'Folga'], ['T', 'Mudar a folga de dia'], ['EX', 'Veio trabalhar (extra)']];
  const bloqueio = t => (t !== base && (t === 'F' || t === 'T') && !podeTrocar) ? motivoTroca : null;
  const vizinho = j => { const v = l.dias[j]; if (!v || !v.h) return null; return [v.h.slice(0, 5), v.h.slice(-5)]; };
  const grandes = h('div', { class: 'botoes-dia' });
  const area = h('div');
  const motivo = h('select', { 'aria-label': 'Motivo' }, m.motivos.map(x => h('option', { value: x, selected: (c.motivo || 'Atestado médico') === x }, x)));
  const ent = h('input', { type: 'time', value: c.ent || '', 'aria-label': 'Entrada' });
  const sai = h('input', { type: 'time', value: c.sai || '', 'aria-label': 'Saída' });
  const intv = h('input', { type: 'number', min: '0', max: '480', step: '5', inputmode: 'numeric', placeholder: 'min', value: c.int != null ? String(c.int) : '', 'aria-label': 'Intervalo em minutos' });
  const resumoH = h('p', { class: 'sutil pequeno' });
  const avisos = h('div');
  const obs = h('textarea', { rows: '2', maxlength: '300', placeholder: 'Anotação (opcional)', 'aria-label': 'Anotação' });
  obs.value = c.obs || '';
  const msg = h('div');
  const salvar = h('button', { class: 'cheio' }, 'Salvar');
  const lerInt = () => intv.value === '' ? null : Math.max(0, parseInt(intv.value, 10) || 0);
  [ent, sai, intv].forEach(x => { x.addEventListener('input', analisar); x.addEventListener('change', analisar); });

  function analisar() {
    resumoH.textContent = '';
    if (!trabalha(tipo)) { por(avisos); return; }
    const proprio = ent.value && sai.value;
    const e1 = proprio ? ent.value : l.hEnt, s1 = proprio ? sai.value : l.hSai, it = proprio ? lerInt() : l.hInt;
    const b = brutoDe(e1, s1);
    if (verHora && b != null) resumoH.textContent = 'Trabalha ' + fmtH(b - (it || 0)) + ' neste dia.';
    por(avisos, listaAvisos(avisosJornada(e1, s1, it, vizinho(k - 1), vizinho(k + 1))));
  }

  function desenhar() {
    por(grandes, botoes.map(([t, rot]) => {
      const pq = bloqueio(t);
      return h('button', { type: 'button', class: 'btn-dia tp-' + t + (principal(tipo) === t ? ' sel' : ''), disabled: !!pq, title: pq || '', 'aria-pressed': principal(tipo) === t ? 'true' : 'false',
        onclick: () => { tipo = t === 'FALTOU' ? (c.t === 'FI' ? 'FI' : 'FJ') : t; destino = null; por(msg); desenhar(); } }, rot);
    }), botoes.some(([t]) => bloqueio(t)) ? h('p', { class: 'sutil pequeno' }, motivoTroca) : null);
    const partes = [];
    // trocar a folga de dia
    if (tipo !== base && (tipo === 'F' || tipo === 'T')) {
      const alvos = base === 'T' ? par.filter(x => somaDias(w, x) >= m.hoje) : [0, 1, 2, 3, 4, 5, 6].filter(x => !par.includes(x) && somaDias(w, x) >= m.hoje);
      if (!leis) api('/api/gestor/opcoes?id=' + l.id + '&semana=' + w).then(o => { leis = o; desenhar(); }).catch(e => { leis = []; por(msg, erroBox(e)); });
      const parNovo = x => (base === 'T' ? [d.dia, par.find(y => y !== x)] : [x, par.find(y => y !== d.dia)]).sort((p, q) => p - q);
      const motivoLei = x => { const n = parNovo(x), o = (leis || []).find(o => o.par[0] === n[0] && o.par[1] === n[1]); return o && !o.ok ? o.motivo.replace(/^A lei não deixa: /, '') : null; };
      if (destino != null && motivoLei(destino)) destino = null;
      partes.push(h('label', {}, base === 'T' ? 'Qual folga vira dia de trabalho?' : 'Para qual dia vai a folga?'),
        !leis ? h('p', { class: 'sutil' }, 'Conferindo...') : alvos.length ? h('div', { class: 'chips' }, alvos.map(x => h('button', { type: 'button', class: 'chip-dia' + (destino === x ? ' sel' : ''),
          disabled: !!motivoLei(x), title: motivoLei(x) || '', onclick: () => { destino = x; desenhar(); } }, DIAS[x] + ' ' + dataBR(somaDias(w, x))))) : h('p', { class: 'sutil' }, 'Nenhum dia livre nesta semana.'),
        leis && alvos.some(motivoLei) ? h('p', { class: 'sutil pequeno' }, 'Riscado = a lei não deixa (' + motivoLei(alvos.find(motivoLei)) + ').') : null);
    }
    // faltou: trouxe atestado?
    if (tipo === 'FJ' || tipo === 'FI') {
      const fiBloq = d.data > m.hoje;
      partes.push(h('label', {}, 'Trouxe atestado ou justificativa?'),
        h('div', { class: 'chips' },
          h('button', { type: 'button', class: 'chip-dia' + (tipo === 'FJ' ? ' sel' : ''), onclick: () => { tipo = 'FJ'; desenhar(); } }, 'Sim'),
          h('button', { type: 'button', class: 'chip-dia' + (tipo === 'FI' ? ' sel' : ''), disabled: fiBloq, title: fiBloq ? 'Esse dia ainda não chegou.' : '', onclick: () => { tipo = 'FI'; desenhar(); } }, 'Não')),
        tipo === 'FJ' ? h('div', {}, h('label', {}, 'Motivo'), motivo) : null);
    }
    // horário: escondido até pedir
    if (trabalha(tipo)) {
      if (!verHora) partes.push(h('button', { type: 'button', class: 'pq link', onclick: () => { verHora = true; desenhar(); } }, 'Mudar horário deste dia' + (l.horario ? ' (normal: ' + l.horario + ')' : '')));
      else partes.push(h('label', {}, 'Horário deste dia'), h('div', { class: 'grade3' }, h('div', {}, h('small', {}, 'Entrada'), ent), h('div', {}, h('small', {}, 'Saída'), sai), h('div', {}, h('small', {}, 'Intervalo (min)'), intv)),
        resumoH, l.hEnt ? h('button', { type: 'button', class: 'pq link', onclick: () => { ent.value = ''; sai.value = ''; intv.value = ''; analisar(); } }, 'Usar o horário normal (' + l.horario + ')') : null);
    }
    por(area, partes);
    salvar.disabled = tipo !== base && (tipo === 'F' || tipo === 'T') && destino == null;
    analisar();
  }

  const gravar = async (corpo, remanejo, troca) => {
    salvar.disabled = true;
    try {
      if (troca) {
        const novo = base === 'T' ? [d.dia, par.find(x => x !== destino)] : [destino, par.find(x => x !== d.dia)];
        const [a, b] = novo.sort((p, q) => p - q);
        try { await api('/api/gestor/folgas', { id: l.id, semana: w, a, b, remanejo: remanejo || [] }); }
        catch (e) {
          if (e.codigo === 'cobertura' && !remanejo) { // ficaria faltando gente: mostra quem pode cobrir e pede confirmação
            const pl = await api('/api/gestor/previa', { id: l.id, semana: w, a, b }).catch(() => null);
            if (pl) {
              por(msg, blocoPlano(pl, 'Vai faltar gente:'),
                pl.resolve ? h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: () => gravar(corpo, remanejoDe(pl), true) }, 'Confirmar e salvar')) : null);
              return;
            }
          }
          throw e;
        }
      }
      const r = await api('/api/gestor/dia', corpo);
      fecharModal();
      const av = r.avisos || [];
      toast(av.length ? 'Salvo. Atenção: ' + av.join(' ') : 'Salvo.', av.length > 0);
      painelGestor();
    } catch (e) { por(msg, erroBox(e)); }
    finally { salvar.disabled = false; }
  };
  salvar.addEventListener('click', () => {
    if (verHora && (ent.value === '') !== (sai.value === '')) { por(msg, erroBox({ msg: 'Preencha a entrada e a saída, ou deixe as duas em branco.' })); return; }
    const troca = tipo !== base && (tipo === 'F' || tipo === 'T');
    const s = (tipo === 'T' || tipo === 'F') ? '' : tipo;
    const comHora = verHora && trabalha(tipo) && ent.value;
    gravar({ id: l.id, data: d.data, s, motivo: tipo === 'FJ' ? motivo.value : '', ent: comHora ? ent.value : '', sai: comHora ? sai.value : '', int: comHora ? lerInt() : null, obs: obs.value }, null, troca);
  });
  const temAlgo = c.t !== base || c.ent || c.obs;
  const desfazer = () => confirmar('Desfazer as mudanças deste dia?', 'Falta, extra, horário e anotação deste dia serão apagados. A folga continua onde está.', 'Desfazer',
    () => gravar({ id: l.id, data: d.data, s: '' }, null, false), true);
  desenhar();
  abrirModal(h('h2', { class: 'neon-sm' }, l.nome),
    h('p', { class: 'sutil' }, DIAS_L[d.dia] + ', ' + dataBR(d.data) + (d.feriado ? ' • feriado: ' + d.feriado : '') + '. Folgas da semana: ' + parTxt(par) + '.'),
    grandes, area, obs, avisos, msg,
    h('div', { class: 'acoes' }, salvar, h('button', { onclick: fecharModal }, 'Cancelar'), temAlgo ? h('button', { class: 'perigo', onclick: desfazer }, 'Desfazer') : null),
    c.por ? h('p', { class: 'sutil pequeno' }, 'Mudado por ' + c.por + ' em ' + c.em + '.') : null);
}

// ---------- equipe
const campoHora = (valor, rot) => h('input', { type: 'time', value: valor || '', 'aria-label': rot });
const campoInt = valor => h('input', { type: 'number', min: '0', max: '480', step: '5', placeholder: 'min', value: valor != null ? String(valor) : '', 'aria-label': 'Intervalo em minutos' });
const intDe = x => x.value === '' ? null : Math.max(0, parseInt(x.value, 10) || 0);
const horarioTxt = f => f.hEnt ? f.hEnt + '–' + f.hSai + (f.hInt != null ? ' (int. ' + f.hInt + ' min)' : '') : '—';
function gEquipe(g) {
  const nome = h('input', { placeholder: 'Nome completo' });
  const cpf = h('input', { inputmode: 'numeric', maxlength: '14', placeholder: '000.000.000-00', autocomplete: 'off' });
  const fn = h('select', {}, g.ordem.map(f => h('option', { value: f }, g.funcoesInfo[f].nome)));
  const dom = h('select', {}, h('option', { value: '3' }, 'Homem'), h('option', { value: '2' }, 'Mulher'));
  const ent = campoHora('15:00', 'Entrada'), sai = campoHora('00:00', 'Saída'), intv = campoInt(60);
  const msg = h('div');
  const cadastrar = async () => {
    try {
      const r = await api('/api/gestor/funcionarios', { nome: nome.value, cpf: cpf.value, funcao: fn.value, domingoSemanas: Number(dom.value), hEnt: ent.value, hSai: sai.value, hInt: ent.value ? intDe(intv) : null });
      await painelGestor(); toast(r.nome + ' cadastrado.');
    } catch (e) { msg.replaceChildren(erroBox(e)); }
  };
  const remover = f => confirmar('Remover ' + f.nome + '?', 'Ele sai da escala e não consegue mais entrar no sistema.', 'Remover',
    async () => { try { await api('/api/gestor/funcionarios/remover', { id: f.id }); toast('Removido.'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
  const revogar = f => confirmar('Desconectar ' + f.nome + ' dos aparelhos?', 'Ele sai do sistema em todos os celulares e computadores. Pode entrar de novo com nome e CPF.', 'Desconectar',
    async () => { try { await api('/api/gestor/funcionarios/acesso', { id: f.id }); toast('Desconectado.'); } catch (e) { toast(e.msg, true); } }, true);
  const editar = f => {
    const n = h('input', { value: f.nome, maxlength: '60' });
    const fu = h('select', {}, g.ordem.map(x => h('option', { value: x, selected: x === f.funcao }, g.funcoesInfo[x].nome)));
    const dm = h('select', {}, h('option', { value: '3', selected: f.domingoSemanas === 3 }, 'Homem'), h('option', { value: '2', selected: f.domingoSemanas === 2 }, 'Mulher'));
    const e1 = campoHora(f.hEnt, 'Entrada'), s1 = campoHora(f.hSai, 'Saída'), i1 = campoInt(f.hInt);
    const m2 = h('div');
    abrirModal(h('h2', { class: 'neon-sm' }, 'Editar ' + f.nome),
      h('div', { class: 'grade2' }, h('div', {}, h('label', {}, 'Nome completo'), n), h('div', {}, h('label', {}, 'Função'), fu),
        h('div', {}, h('label', {}, 'Sexo (regra da folga no domingo)'), dm), h('div', {}, h('label', {}, 'Horário normal (entrada, saída, intervalo em min)'), h('div', { class: 'grade3' }, e1, s1, i1))), m2,
      h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: async () => {
        try { await api('/api/gestor/funcionarios/editar', { id: f.id, nome: n.value, funcao: fu.value, domingoSemanas: Number(dm.value), hEnt: e1.value, hSai: s1.value, hInt: e1.value ? intDe(i1) : null }); fecharModal(); toast('Dados salvos.'); painelGestor(); }
        catch (e) { m2.replaceChildren(erroBox(e)); }
      } }, 'Salvar'), h('button', { onclick: fecharModal }, 'Cancelar')),
      h('button', { class: 'pq link', onclick: () => { fecharModal(); revogar(f); } }, 'Desconectar dos aparelhos'));
  };
  const temDemo = g.equipe.some(f => f.demo);
  const removerDemo = () => confirmar('Apagar a equipe de exemplo?', 'Apaga as pessoas de exemplo. As que você cadastrou ficam.', 'Apagar',
    async () => { try { const r = await api('/api/gestor/demo/remover', {}); toast(r.removidos + ' removido(s).'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
  return h('div', {},
    h('div', { class: 'card' }, h('h2', {}, 'Equipe (' + g.equipe.length + ')'),
      h('div', { class: 'tabela-rolagem' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Nome', 'Função', 'Horário', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, g.equipe.map(f => h('tr', {}, h('td', {}, f.nome), h('td', {}, g.funcoesInfo[f.funcao].nome), h('td', {}, f.hEnt ? f.hEnt + '–' + f.hSai : '—'),
          h('td', { class: 'acoes-linha' }, h('button', { class: 'pq', onclick: () => editar(f) }, 'Editar'), h('button', { class: 'perigo pq', onclick: () => remover(f) }, 'Remover'))))))),
      temDemo ? h('p', { class: 'sutil pequeno' }, 'Esta é uma equipe de exemplo. ', h('button', { class: 'pq link', onclick: removerDemo }, 'Apagar equipe de exemplo')) : null),
    h('details', { class: 'card cadastro' }, h('summary', {}, '+ Cadastrar funcionário'),
      h('div', { class: 'grade2' }, h('div', {}, h('label', {}, 'Nome completo'), nome), h('div', {}, h('label', {}, 'CPF (ele entra com o CPF)'), cpf), h('div', {}, h('label', {}, 'Função'), fn),
        h('div', {}, h('label', {}, 'Sexo (regra da folga no domingo)'), dom), h('div', {}, h('label', {}, 'Horário normal (entrada, saída, intervalo em min)'), h('div', { class: 'grade3' }, ent, sai, intv))),
      msg, h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: cadastrar }, 'Cadastrar')))
  );
}

function gCobertura(g) {
  const linhas = g.ordem.map(f => {
    const ins = DIAS.map((_, d) => h('input', { type: 'number', min: '0', max: '30', value: String(g.minimos[f][d]), 'aria-label': g.funcoesInfo[f].nome + ' ' + DIAS_L[d] }));
    return h('tr', {}, h('td', {}, g.funcoesInfo[f].nome), ins.map(i => h('td', {}, i)),
      h('td', {}, h('button', { onclick: async () => { try { await api('/api/gestor/minimos', { funcao: f, dias: ins.map(i => Number(i.value)) }); toast('Salvo.'); painelGestor(); } catch (e) { toast(e.msg, true); } } }, 'Salvar')));
  });
  return h('div', {}, h('div', { class: 'card' }, h('h2', {}, 'Pessoas por dia'),
    h('p', { class: 'sutil' }, 'Quantas pessoas de cada função precisam trabalhar em cada dia. O sistema não deixa ficar menos que isso.'),
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
      h('p', { class: 'sutil' }, 'Os nacionais já estão aqui. Inclua os da cidade (ex.: aniversário de Araraquara).'),
      h('div', { class: 'grade-feriado' }, data, nome, h('button', { class: 'cheio', onclick: adicionar }, 'Adicionar')), msg,
      h('ul', { class: 'limpa lista-fer' }, g.listaFeriados.map(x => h('li', {}, h('span', {}, h('b', {}, dataBRc(x.data)), ' ' + x.nome),
        x.data >= g.semana ? h('button', { class: 'pq perigo', onclick: () => remover(x) }, 'Remover') : h('span', { class: 'sutil pequeno' }, 'já passou'))))),
    h('details', { class: 'card' }, h('summary', {}, 'Regras da lei que o sistema segue'),
      h('div', { class: 'msg' }, 'Não é parecer jurídico. Confira cada item com o SINTHORESSARA ou com o contador antes de usar como oficial.'),
      g.regras.map(r => h('div', { class: 'pedido' }, h('b', {}, r.titulo), ' ', h('span', { class: 'badge ' + rot[r.status][0] }, rot[r.status][1]), h('p', {}, r.descricao), h('div', { class: 'sutil' }, 'Fonte: ' + r.fonte)))));
}

function gAudit(g) {
  const cab = ['Nome', 'Folgas na semana', 'Dias seguidos (máx. 6)', 'Semanas sem folga no domingo', 'Feriados trabalhados', 'Situação'];
  const baixar = () => baixarArquivo('conferir-lei-' + g.semana + '.csv', csv([['Conferência da semana de ' + dataBRc(g.semana)], cab,
    ...g.auditoria.map(a => [a.nome, a.folgas, a.maxSeq, a.semDom, a.feriados, a.ok ? 'certo' : 'verificar'])]), 'text/csv;charset=utf-8');
  const errados = g.auditoria.filter(a => !a.ok);
  return h('div', { class: 'card' }, h('h2', {}, 'Conferir a lei • semana de ' + dataBR(g.semana)),
    h('div', { class: 'hoje-frase' + (errados.length ? ' ruim' : '') }, errados.length ? h('b', {}, errados.length + (errados.length === 1 ? ' pessoa precisa' : ' pessoas precisam') + ' de atenção: ' + errados.map(a => a.nome).join(', ') + '.') : 'Todo mundo está dentro da lei nesta semana.'),
    h('div', { class: 'tabela-rolagem' }, h('table', {},
      h('thead', {}, h('tr', {}, cab.slice(0, 3).concat(['Situação']).map(t => h('th', {}, t)))),
      h('tbody', {}, g.auditoria.map(a => h('tr', {}, h('td', {}, a.nome), h('td', {}, String(a.folgas)), h('td', {}, String(a.maxSeq)),
        h('td', {}, h('span', { class: 'badge ' + (a.ok ? 'ok' : 'bad') }, a.ok ? 'certo' : 'verificar'))))))),
    h('div', { class: 'acoes' }, h('button', { onclick: baixar }, 'Baixar planilha (Excel)')));
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
      baixarArquivo('copia-escala-' + g.hoje + '.json', JSON.stringify(b, null, 1), 'application/json');
      toast('Cópia baixada. Guarde o arquivo num lugar seguro.');
    } catch (e) { toast(e.msg, true); }
  };
  const arquivo = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Arquivo da cópia' });
  const restaurar = () => {
    const f = arquivo.files[0];
    if (!f) { toast('Escolha o arquivo da cópia (.json).', true); return; }
    const r = new FileReader();
    r.onload = () => {
      let obj; try { obj = JSON.parse(r.result); } catch (e) { toast('Arquivo inválido.', true); return; }
      confirmar('Restaurar esta cópia?', 'Tudo o que está no sistema agora (equipe, escala, faltas, feriados) será trocado pelo que está no arquivo "' + f.name + '".', 'Restaurar',
        async () => { try { await api('/api/gestor/backup/restaurar', { estado: obj }); MARCA = null; await carregarMarca(); toast('Cópia restaurada.'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
    };
    r.readAsText(f);
  };
  const voltar = v => confirmar('Voltar para "' + v.nome + '"?', 'A escala de hoje em diante volta a ficar como estava nessa cópia. O que já passou não muda.', 'Voltar',
    async () => { try { await api('/api/gestor/versoes', { acao: 'restaurar', id: v.id }); toast('Escala voltou para a cópia.'); abaGestor = 'escala'; painelGestor(); } catch (e) { toast(e.msg, true); } });
  const excluir = v => confirmar('Apagar a cópia "' + v.nome + '"?', 'A escala de agora não muda.', 'Apagar',
    async () => { try { await api('/api/gestor/versoes', { acao: 'excluir', id: v.id }); toast('Cópia apagada.'); painelGestor(); } catch (e) { toast(e.msg, true); } }, true);
  return h('div', {},
    h('div', { class: 'card' }, h('h2', {}, 'Cópias da escala'),
      h('p', { class: 'sutil' }, 'Para salvar uma: Escala › Mais opções › Salvar uma cópia da escala.'),
      g.copias.length ? h('ul', { class: 'limpa lista-fer' }, g.copias.map(v => h('li', {}, h('span', {}, h('b', {}, v.nome), h('span', { class: 'sutil pequeno' }, ' • ' + v.em + ' • ' + v.por)),
        h('span', { class: 'acoes-linha' }, h('button', { class: 'pq', onclick: () => voltar(v) }, 'Voltar para esta'), h('button', { class: 'pq perigo', onclick: () => excluir(v) }, 'Apagar')))))
        : h('p', { class: 'sutil' }, 'Nenhuma cópia salva ainda.')),
    h('div', { class: 'card' }, h('h2', {}, 'Cópia de segurança (arquivo)'),
      h('p', { class: 'sutil' }, 'Um arquivo com todos os dados, para guardar no computador ou no pen drive.'),
      h('div', { class: 'acoes' }, h('button', { class: 'cheio', onclick: baixar }, 'Baixar cópia')),
      h('label', {}, 'Restaurar uma cópia'), h('div', { class: 'grade-arquivo' }, arquivo, h('button', { class: 'perigo', onclick: restaurar }, 'Restaurar'))),
    h('div', { class: 'card' }, h('h2', {}, 'Histórico'), h('p', { class: 'sutil pequeno' }, 'Tudo o que foi mudado, por quem e quando.'),
      h('ul', { class: 'limpa historico' }, g.log.map(l => h('li', {}, h('span', { class: 'sutil' }, l.t + ' '), l.texto)))));
}

iniciar();
