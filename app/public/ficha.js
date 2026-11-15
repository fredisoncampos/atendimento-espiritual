/* Utilidades compartilhadas e montagem da ficha impressa. */

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** 2026-11-04 -> 04/11/2026 */
function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : '';
}
function idade(nascimento) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento || '')) return null;
  const [a, m, d] = nascimento.split('-').map(Number);
  const hoje = new Date();
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos--;
  return anos >= 0 && anos < 130 ? anos : null;
}
function textoIdade(nascimento) {
  const i = idade(nascimento);
  return i == null ? '' : `${i} ${i === 1 ? 'ano' : 'anos'}`;
}
const numeroFicha = id => String(id).padStart(5, '0');
const NOMES_SEMANAS = ['PRIMEIRA SEMANA', 'SEGUNDA SEMANA', 'TERCEIRA SEMANA', 'QUARTA SEMANA', 'QUINTA SEMANA', 'SEXTA SEMANA', 'SÉTIMA SEMANA', 'OITAVA SEMANA'];
const N_SEMANAS = NOMES_SEMANAS.length;

function fichaTopo(cfg, a) {
  const contato = [cfg.casa_endereco, cfg.casa_telefone].filter(Boolean).join(' · ');
  return `<div class="f-topo">
    ${cfg.casa_logo ? `<img src="${esc(cfg.casa_logo)}" alt="">` : ''}
    <div class="f-casa"><strong>${esc(cfg.casa_nome || 'Casa Espírita')}</strong>${contato ? `<small>${esc(contato)}</small>` : ''}</div>
    <div class="f-num">Ficha nº <b>${numeroFicha(a.id)}</b><br>Início: <b>${dataBR(a.data_inicio)}</b></div>
  </div>`;
}

const caixa = marcada => `<span class="f-cx">${marcada ? 'X' : ''}</span>`;

function fichaPergunta(p, r) {
  const v = r[p.id];
  if (p.tipo === 'radio' || p.tipo === 'checks') {
    const ops = p.opcoes.map(([val, rot]) => {
      const marcada = Array.isArray(v) ? v.includes(val) : v === val;
      return `<span class="f-op">${caixa(marcada)}${esc(rot)}</span>`;
    }).join('');
    return `<b>${esc(p.rotulo)}</b> ${ops}`;
  }
  if (p.tipo === 'area') {
    return `<b>${esc(p.rotulo)}</b><div class="f-linhas">${v ? `<div class="f-linha" style="height:auto;min-height:24px">${esc(v)}</div>` : '<div class="f-linha"></div><div class="f-linha"></div>'}</div>`;
  }
  return `<span style="white-space:nowrap"><b>${esc(p.rotulo)}</b> <span class="f-txt">${esc(v || '')}&nbsp;</span></span>`;
}

function renderFicha(a, cfg) {
  const p = a.paciente || {};
  const r = a.respostas || {};
  const linha = (rot, val) => `<div class="f-lin"><b>${rot}:</b> ${esc(val || '')}</div>`;

  let secoes = '';
  for (const s of QUESTIONARIO) {
    const linhas = [];
    for (const q of s.perguntas) {
      const html = fichaPergunta(q, r);
      // perguntas complementares curtas ("Qual?", "Quem?") ficam na mesma linha da anterior
      if (q.se && q.tipo === 'texto' && linhas.length) linhas[linhas.length - 1] += ' &nbsp; ' + html;
      else linhas.push(html);
    }
    secoes += `<div class="f-sec"><div class="f-sec-t">${s.n}. ${esc(s.titulo)}</div>${linhas.map(l => `<div class="f-lin">${l}</div>`).join('')}</div>`;
  }

  const alerta = a.alerta_risco
    ? `<div class="f-alerta">ATENÇÃO: o paciente relatou pensamentos de morte/suicídio. Acolher com prioridade no Atendimento Fraterno e orientar a buscar apoio profissional. CVV: ligue 188 (gratuito, 24 horas) ou cvv.org.br.</div>`
    : '';

  const evo = {};
  for (const e of a.evolucoes || []) evo[e.semana] = e;
  const dataOuBranco = v => v ? dataBR(v) : '&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/';
  // Item 11 compacto: DATA e TRIADOR na mesma linha + 2 linhas de triagem, para caber 8 semanas + item 12 numa página.
  const semanas = NOMES_SEMANAS.map((nome, i) => {
    const e = evo[i + 1] || {};
    const linhasTriagem = e.triagem
      ? `<div class="f-linha" style="height:auto;min-height:38px;white-space:pre-wrap">${esc(e.triagem)}</div>`
      : '<div class="f-linha"></div>'.repeat(2);
    return `<div class="f-semana f-compacta">
      <div class="f-semana-t">${nome}</div>
      <div class="f-campo"><b>DATA:</b><span class="f-linha" style="flex:0 0 90px">${dataOuBranco(e.data)}</span>
        <b style="margin-left:8px">TRIADOR:</b><span class="f-linha">${esc(e.triador || '')}</span></div>
      <div class="f-linhas">${linhasTriagem}</div>
    </div>`;
  }).join('');

  // Item 12: Encaminhamento (bloco único, sem semanas).
  const tipos = Array.isArray(a.encaminhamento_tipos) ? a.encaminhamento_tipos : [];
  const enc = `<div class="f-semana f-compacta">
    ${tipos.length ? `<div class="f-lin" style="margin-bottom:2px"><b>Tipos:</b> ${esc(tipos.join(', '))}</div>` : ''}
    <div class="f-campo"><b>DATA:</b><span class="f-linha" style="flex:0 0 90px">${dataOuBranco(a.encaminhamento_data)}</span>
      <b style="margin-left:8px">TRIADOR:</b><span class="f-linha">${esc(a.encaminhamento_triador || '')}</span></div>
    <div class="f-linhas">${a.encaminhamento_texto
      ? `<div class="f-linha" style="height:auto;min-height:60px;white-space:pre-wrap">${esc(a.encaminhamento_texto)}</div>`
      : '<div class="f-linha"></div>'.repeat(3)}</div>
  </div>`;

  return `<div class="ficha">
    ${fichaTopo(cfg, a)}
    <h1>FICHA DE ATENDIMENTO ESPIRITUAL</h1>
    <div class="f-sec"><div class="f-sec-t">1. Recepção</div>
      ${linha('Recepcionado por', a.atendente_nome)}
    </div>
    <div class="f-sec"><div class="f-sec-t">2. Dados do paciente</div>
      ${linha('Nome', p.nome)}
      <div class="f-grid">
        ${linha('Data de nascimento', p.nascimento ? `${dataBR(p.nascimento)} (${textoIdade(p.nascimento)})` : '')}
        ${linha('Estado civil', p.estado_civil)}
        ${linha('Telefone/WhatsApp', p.telefone)}
        ${linha('Profissão', p.profissao)}
        ${linha('Religião', p.religiao)}
      </div>
      ${linha('Endereço', p.endereco)}
    </div>
    ${alerta}
    ${secoes}
    <div class="f-termo"><b>Termo de consentimento:</b> ${esc(cfg.termo || '')}</div>
    <div class="f-assina"><div>Assinatura do paciente</div><div>Atendente</div></div>

    <div class="f-quebra"></div>
    ${fichaTopo(cfg, a)}
    <div class="f-lin" style="margin-bottom:6px"><b>Paciente:</b> ${esc(p.nome || '')}</div>
    <div class="f-sec-t" style="margin-bottom:6px">11. Evolução (atendimento uma vez por semana) — SÍNTESE DO ATENDIMENTO</div>
    ${semanas}
    <div class="f-sec-t" style="margin:8px 0 6px">12. Encaminhamento</div>
    ${enc}
    <div class="f-rodape">Documento sigiloso — contém dados pessoais sensíveis protegidos pela LGPD. Guardar em local seguro.</div>
  </div>`;
}

