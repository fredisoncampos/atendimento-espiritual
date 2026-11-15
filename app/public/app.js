/* Sistema de Atendimento Espiritual - interface */
'use strict';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
let estado = { usuario: null, casa: {} };
let menuAberto = false;

// ---------- Comunicação com o servidor ----------
async function api(metodo, url, corpo) {
  const op = { method: metodo, headers: {} };
  if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
  else if (metodo !== 'GET') { op.headers['Content-Type'] = 'application/json'; op.body = '{}'; }
  let r;
  try { r = await fetch(url, op); }
  catch { throw new Error('Não foi possível falar com o sistema. Verifique se o computador central está ligado.'); }
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith('/login')) { estado.usuario = null; mostrarEntrada(); throw new Error(dados.erro || 'Sessão expirada.'); }
  if (!r.ok) throw new Error(dados.erro || 'Erro inesperado.');
  return dados;
}
function aviso(msg, erro = false) {
  const el = $('#aviso');
  el.innerHTML = `<span class="aviso-icone">${erro ? '✕' : '✓'}</span><span>${esc(msg)}</span>`;
  el.className = 'visivel' + (erro ? ' erro-aviso' : ' ok-aviso');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { el.className = ''; }, erro ? 6000 : 3200);
}
const ehAdmin = () => estado.usuario && estado.usuario.perfil === 'admin';

// ---------- Guardar preferências no aparelho (com segurança) ----------
function prefGet(chave, padrao) { try { const v = localStorage.getItem(chave); return v === null ? padrao : v; } catch { return padrao; } }
function prefSet(chave, valor) { try { localStorage.setItem(chave, valor); } catch { /* ignora */ } }

// ---------- Tamanho da letra (acessibilidade) ----------
const NIVEIS_FONTE = [1, 1.15, 1.3, 1.5];
function aplicarFonte(nivel) {
  const n = NIVEIS_FONTE.includes(+nivel) ? +nivel : 1;
  try { document.body.style.zoom = n; } catch { /* ignora */ }
  prefSet('fonte', String(n));
  const el = $('#fonte-nivel'); if (el) el.textContent = Math.round(n * 100) + '%';
}
function mudarFonte(passo) {
  const atual = +prefGet('fonte', '1');
  let i = NIVEIS_FONTE.indexOf(NIVEIS_FONTE.includes(atual) ? atual : 1);
  i = Math.max(0, Math.min(NIVEIS_FONTE.length - 1, i + passo));
  aplicarFonte(NIVEIS_FONTE[i]);
}

// ---------- Janela (modal) reutilizável ----------
function abrirModal(html, largura = 540) {
  fecharModal();
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  fundo.innerHTML = `<div class="modal" style="max-width:${largura}px" role="dialog" aria-modal="true">
    <button class="modal-x" aria-label="Fechar">✕</button>${html}</div>`;
  fundo.addEventListener('click', e => { if (e.target === fundo) fecharModal(); });
  fundo.querySelector('.modal-x').onclick = fecharModal;
  document.body.appendChild(fundo);
  return fundo;
}
function fecharModal() { const m = $('.modal-fundo'); if (m) m.remove(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });

// ---------- Ajuda de cada tela ----------
const AJUDA = {
  inicio: ['Tela inicial', 'Mostra os números do dia e do mês, a agenda de retornos e os atendimentos em andamento. Use os botões no topo para cadastrar um paciente ou começar um novo atendimento. Clique numa linha para abrir o atendimento.'],
  pacientes: ['Pacientes', 'Lista dos pacientes cadastrados. Busque pelo nome ou telefone — não precisa colocar acento. Clique num paciente para ver o histórico, ou em "Novo paciente" para cadastrar. Se já existir alguém parecido, o sistema avisa.'],
  atendentes: ['Atendentes', 'Cadastro das pessoas que fazem a recepção. Quem também vai entrar no sistema recebe um usuário e uma senha. Apenas administradores podem cadastrar ou alterar atendentes.'],
  encaminhamentos: ['Encaminhamentos', 'Cadastro dos tipos de encaminhamento (ex.: Cromoterapia, Reiki). Eles ficam disponíveis para marcar no item 12 da tela de Atendimento. Apenas administradores cadastram; você pode renomear ou desativar um tipo sem apagar os registros antigos.'],
  pesquisa: ['Pesquisa', 'Encontre pacientes e atendimentos por nome, telefone, período (de/até), recepcionante ou situação.'],
  novo: ['Novo atendimento', 'Preencha a ficha: 1) escolha quem está recepcionando; 2) busque e selecione o paciente (ou cadastre um novo); 3) responda os passos. No fim, clique em "Salvar e imprimir ficha" para imprimir e anotar à mão durante os atendimentos.'],
  atendimento: ['Atendimento', 'Aqui você passa para o sistema o que foi anotado à mão, semana a semana. Clique numa semana para abri-la e preencher data, triador e triagem. Marque o próximo retorno; se o paciente faltar, use "Registrar falta e reagendar".'],
  relatorio: ['Relatório do mês', 'Resumo do mês para conferência e impressão. Escolha o mês na lista e clique em "Imprimir relatório". Serve para a prestação de contas da casa.'],
  config: ['Configurações', 'Dados da casa (que saem na ficha), cor do tema, cópia de segurança (backup) e restauração, acesso por outros aparelhos e registro de quem usou o sistema.'],
};
let rotaAtual = 'inicio';
function mostrarAjuda() {
  const [titulo, texto] = AJUDA[rotaAtual] || AJUDA.inicio;
  abrirModal(`<h2 style="margin-top:0">Ajuda — ${esc(titulo)}</h2><p style="font-size:16px">${esc(texto)}</p>
    <div class="acoes" style="margin-top:16px"><button class="primario" onclick="fecharModal()">Entendi</button>
    <button onclick="fecharModal();mostrarTour()">Ver o passo a passo</button></div>`);
}

// ---------- Passo a passo do primeiro uso ----------
const TOUR = [
  ['Bem-vindo(a) ao sistema!', 'Vou mostrar, em 4 passos rápidos, como funciona o dia a dia. Você pode rever isto quando quiser clicando em "Ajuda" no canto inferior do menu.'],
  ['1. Cadastre o paciente', 'No menu <b>A · Cadastros › Pacientes</b>, clique em "Novo paciente" e preencha os dados. A idade é calculada sozinha a partir da data de nascimento.'],
  ['2. Comece o atendimento', 'No menu <b>C · Novo atendimento</b>, escolha quem está recepcionando, selecione o paciente e responda os passos. No fim, clique em <b>"Salvar e imprimir ficha"</b> para imprimir e anotar à mão.'],
  ['3. Lance a evolução', 'A cada semana, no menu <b>D · Atendimento</b>, abra o paciente e preencha a semana com o que foi anotado na ficha. Marque o próximo retorno — ele aparece na tela inicial.'],
  ['Pronto!', 'É só isso para começar. Qualquer dúvida, clique em <b>Ajuda</b> no canto inferior do menu — ela explica a tela em que você estiver.'],
];
function mostrarTour(passo = 0) {
  const total = TOUR.length;
  const [titulo, texto] = TOUR[passo];
  const pontos = TOUR.map((_, i) => `<span style="width:9px;height:9px;border-radius:50%;display:inline-block;background:${i === passo ? 'var(--cor)' : 'var(--borda)'}"></span>`).join(' ');
  const fundo = abrirModal(`<div style="min-height:150px"><h2 style="margin-top:0">${esc(titulo)}</h2><p style="font-size:16px">${texto}</p></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
      <div style="display:flex;gap:6px">${pontos}</div>
      <div class="acoes">${passo > 0 ? '<button id="t-ant">Voltar</button>' : '<button onclick="fecharModal()">Pular</button>'}
      <button class="primario" id="t-prox">${passo < total - 1 ? 'Próximo' : 'Começar a usar'}</button></div>
    </div>`);
  if ($('#t-ant')) $('#t-ant').onclick = () => mostrarTour(passo - 1);
  $('#t-prox').onclick = () => { if (passo < total - 1) mostrarTour(passo + 1); else { prefSet('tour_visto', '1'); fecharModal(); } };
}

// ---------- Sobre o sistema ----------
function mostrarSobre() {
  const v = (estado && estado.versao) || '';
  abrirModal(`<h2 style="margin-top:0">Sobre o sistema</h2>
    <p style="font-size:16px;margin:0 0 4px"><b>Sistema de Atendimento Espiritual</b></p>
    <p class="sub" style="margin:0 0 14px">Versão ${esc(v)}</p>
    <p style="font-size:15px;margin:0 0 4px"><b>Desenvolvimento</b></p>
    <ul style="margin:0 0 14px 18px;font-size:15px"><li>Fredison — idealização e coordenação</li><li>Claude (assistente de IA da Anthropic) — programação</li></ul>
    <p style="font-size:14px;color:var(--texto-suave);margin:0 0 10px">Software livre, distribuído sob a licença AGPL-3.0. Pode ser usado e melhorado livremente por casas espíritas e espiritualistas, mantendo o código sempre aberto.</p>
    <p style="font-size:14px;margin:0 0 16px">Código-fonte: <a href="https://github.com/fredisoncampos/atendimento-espiritual" target="_blank" rel="noopener">github.com/fredisoncampos/atendimento-espiritual</a></p>
    <div class="acoes"><button class="primario" id="b-manual">Abrir manual de uso</button><button onclick="fecharModal()">Fechar</button></div>`, 560);
  $('#b-manual').onclick = () => ir('/manual');
}
const ir = rota => { location.hash = rota; };

function formatarTelefone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function ativarMascaraTelefone(raiz = document) {
  $$('input[data-telefone]', raiz).forEach(i => i.addEventListener('input', () => { i.value = formatarTelefone(i.value); }));
}

// ---------- Datas em dd/mm/aaaa (iguais em qualquer computador) ----------
function mascaraData(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length >= 3) out += '/' + d.slice(2, 4);
  if (d.length >= 5) out += '/' + d.slice(4, 8);
  return out;
}
// "31/12/2026" -> "2026-12-31" (ou '' se inválida).
function isoDeData(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br || '').trim());
  if (!m) return '';
  const dia = +m[1], mes = +m[2], ano = +m[3];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2200) return '';
  const dt = new Date(ano, mes - 1, dia);
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}
// Campo de data: texto com máscara dd/mm/aaaa. Guarde o id para ler depois com lerCampoData.
function campoData(id, isoValor, extra = '') {
  return `<input type="text" inputmode="numeric" class="campo-data" id="${id}" placeholder="dd/mm/aaaa" maxlength="10" value="${dataBR(isoValor)}" ${extra}>`;
}
// Lê um campo de data pelo id. Retorna { iso, valido }. Vazio é válido (sem data).
function lerCampoData(id) {
  const el = $('#' + id);
  const bruto = (el ? el.value : '').trim();
  if (!bruto) return { iso: '', valido: true };
  const iso = isoDeData(bruto);
  return { iso, valido: !!iso };
}
// Liga a máscara nos campos de data presentes (chamado uma vez; usa delegação).
document.addEventListener('input', e => {
  if (e.target && e.target.classList && e.target.classList.contains('campo-data')) {
    const pos = e.target.selectionStart, antes = e.target.value;
    e.target.value = mascaraData(e.target.value);
    if (pos === antes.length) e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
  }
});
function linkWhatsapp(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length < 10) return esc(tel || '');
  return `<a href="https://wa.me/55${d}" target="_blank" rel="noopener">${esc(tel)}</a>`;
}
// Botão de lembrete: abre o WhatsApp do paciente com a mensagem modelo preenchida.
function botaoLembreteWhatsapp(telefone, pacienteNome, retornoISO, rotulo = 'WhatsApp') {
  const d = String(telefone || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  const modelo = (estado.casa && estado.casa.whatsapp_modelo) || '';
  const msg = modelo
    .replace(/\{paciente\}/g, (pacienteNome || '').split(' ')[0])
    .replace(/\{casa\}/g, (estado.casa && estado.casa.nome) || 'nossa casa espírita')
    .replace(/\{data\}/g, retornoISO ? dataBR(retornoISO) : '');
  const url = `https://wa.me/55${d}?text=${encodeURIComponent(msg)}`;
  return `<a class="botao pequeno zap" href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><span aria-hidden="true">✆</span> ${rotulo}</a>`;
}
function dadosFormulario(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.value;
  }
  return o;
}
function statusEtiqueta(a) {
  let h = a.status === 'concluido' ? '<span class="etiqueta cinza">Concluído</span>' : '<span class="etiqueta ok">Em andamento</span>';
  if (a.alerta_risco) h += ' <span class="etiqueta risco">Atenção</span>';
  return h;
}
const opcoesEstadoCivil = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Separado(a)', 'Divorciado(a)', 'Viúvo(a)'];

// ---------- Estrutura ----------
function mostrarEntrada() {
  const logo = estado.casa.logo || 'icone.svg';
  if (!estado.configurado) {
    $('#app').innerHTML = `<div class="entrada"><div class="cartao">
      <div class="marca"><img src="icone.svg" alt=""><div><h1>Bem-vindo(a)</h1><div class="sub" style="margin:0">Configuração inicial do sistema</div></div></div>
      <p>Preencha uma única vez. Você será o <b>administrador</b> e poderá cadastrar os demais atendentes depois.</p>
      <form id="f-setup">
        <div class="campo"><label for="casa_nome">Nome da casa espírita</label><input id="casa_nome" name="casa_nome" type="text" required></div>
        <div class="campo"><label for="nome">Seu nome completo</label><input id="nome" name="nome" type="text" required></div>
        <div class="campo"><label for="whatsapp">Seu WhatsApp</label><input id="whatsapp" name="whatsapp" type="tel" data-telefone></div>
        <div class="campo"><label for="usuario">Usuário para entrar</label><input id="usuario" name="usuario" type="text" autocomplete="username" required></div>
        <div class="campo"><label for="senha">Senha (mínimo 6 caracteres)</label><input id="senha" name="senha" type="password" autocomplete="new-password" required minlength="6"></div>
        <button class="primario" type="submit">Começar a usar</button>
        <div class="erro" id="erro"></div>
      </form></div></div>`;
    ativarMascaraTelefone();
    $('#f-setup').onsubmit = async e => {
      e.preventDefault();
      try { await api('POST', '/api/setup', dadosFormulario(e.target)); await iniciar(); }
      catch (err) { $('#erro').textContent = err.message; }
    };
    return;
  }
  $('#app').innerHTML = `<div class="entrada"><div class="cartao">
    <div class="marca"><img src="${esc(logo)}" alt=""><div><h1>${esc(estado.casa.nome || 'Atendimento Espiritual')}</h1><div class="sub" style="margin:0">Sistema de Atendimento Espiritual</div></div></div>
    ${!estado.casa.nome ? '<div class="caixa info" style="margin-bottom:16px">Primeiro acesso? Entre com <b>Usuário: Admin</b> e <b>Senha: 123456</b>, e troque a senha em seguida.</div>' : ''}
    <form id="f-login">
      <div class="campo"><label for="usuario">Usuário</label><input id="usuario" name="usuario" type="text" autocomplete="username" required autofocus></div>
      <div class="campo"><label for="senha">Senha</label><input id="senha" name="senha" type="password" autocomplete="current-password" required></div>
      <button class="primario" type="submit">Entrar</button>
      <div class="erro" id="erro"></div>
      <a href="#" id="b-esqueci" style="font-size:13px;color:var(--texto-suave)">Esqueci minha senha</a>
    </form></div></div>`;
  $('#f-login').onsubmit = async e => {
    e.preventDefault();
    try { await api('POST', '/api/login', dadosFormulario(e.target)); await iniciar(); }
    catch (err) { $('#erro').textContent = err.message; }
  };
  $('#b-esqueci').onclick = e => {
    e.preventDefault();
    alert('Esqueceu a senha?\n\n• Se houver outro administrador, peça para ele redefinir a sua senha em Cadastros › Atendentes.\n\n• Se você for o único administrador: no COMPUTADOR onde o sistema está instalado, abra o menu Iniciar, procure a pasta "Atendimento Espiritual" e clique em "Recuperar acesso de administrador". Ele vai mostrar uma senha temporária. Entre com ela e troque a senha em "Alterar minha senha".');
  };
}

function montarLayout() {
  const logo = estado.casa.logo || 'icone.svg';
  $('#app').innerHTML = `
  <div class="barra-movel"><button id="b-menu" aria-label="Abrir menu">☰ Menu</button><strong>${esc(estado.casa.nome || 'Atendimento')}</strong></div>
  <div class="layout">
    <aside class="menu" id="menu">
      <div class="menu-topo"><img src="${esc(logo)}" alt=""><div><strong>${esc(estado.casa.nome || 'Casa Espírita')}</strong><small>Atendimento Espiritual</small></div></div>
      <nav>
        <a href="#/inicio" data-r="inicio">Início</a>
        <div class="grupo">Menu</div>
        <a href="#/pacientes" data-r="cadastros"><span class="letra">A</span> Cadastros</a>
        <a href="#/pacientes" data-r="pacientes" class="sub-item">Pacientes</a>
        <a href="#/atendentes" data-r="atendentes" class="sub-item">Atendentes</a>
        <a href="#/encaminhamentos" data-r="encaminhamentos" class="sub-item">Encaminhamentos</a>
        <a href="#/pesquisa" data-r="pesquisa"><span class="letra">B</span> Pesquisa</a>
        <a href="#/novo" data-r="novo"><span class="letra">C</span> Novo atendimento</a>
        <a href="#/atendimento" data-r="atendimento"><span class="letra">D</span> Atendimento</a>
        <a href="#/relatorio" data-r="relatorio"><span class="letra">E</span> Relatório do mês</a>
        ${ehAdmin() ? '<div class="grupo">Administração</div><a href="#/config" data-r="config">Configurações</a>' : ''}
      </nav>
      <div class="menu-rodape">
        <div class="fonte-controle">
          <span>Tamanho da letra</span>
          <div class="fonte-botoes"><button id="b-fonte-menos" aria-label="Diminuir letra">A−</button><span id="fonte-nivel">100%</span><button id="b-fonte-mais" aria-label="Aumentar letra">A+</button></div>
        </div>
        <button id="b-ajuda" class="pequeno" style="width:100%;margin-bottom:6px">? Ajuda desta tela</button>
        <div>${esc(estado.usuario.nome)}</div>
        <a href="#/senha" style="padding:4px 0;font-size:13px;opacity:.85">Alterar minha senha</a>
        <button id="b-sair" class="pequeno">Sair</button>
        <a href="#" id="b-sobre" style="display:block;margin-top:10px;font-size:12px;opacity:.6">Sobre o sistema</a>
      </div>
    </aside>
    <main class="conteudo" id="conteudo"></main>
  </div>`;
  $('#b-sair').onclick = async () => {
    if (!confirm('Sair e encerrar o sistema neste computador?\n\nOutros aparelhos que estejam usando pela rede também perderão o acesso até o sistema ser aberto novamente pelo ícone.')) return;
    try { await api('POST', '/api/sair'); } catch { /* o servidor já pode ter encerrado */ }
    document.body.innerHTML = '<div class="entrada"><div class="cartao"><h1>Sistema encerrado</h1><p>Você saiu e o sistema foi encerrado. Pode fechar esta janela.</p><p>Para abrir de novo, use o ícone <b>Atendimento Espiritual</b> na área de trabalho.</p></div></div>';
  };
  $('#b-menu').onclick = () => { menuAberto = !menuAberto; $('#menu').classList.toggle('aberto', menuAberto); };
  $('#b-ajuda').onclick = mostrarAjuda;
  $('#b-sobre').onclick = e => { e.preventDefault(); mostrarSobre(); };
  $('#b-fonte-menos').onclick = () => mudarFonte(-1);
  $('#b-fonte-mais').onclick = () => mudarFonte(1);
  aplicarFonte(prefGet('fonte', '1'));
}

function marcarMenu(chave) {
  $$('#menu a[data-r]').forEach(a => a.classList.toggle('ativo', a.dataset.r === chave));
  menuAberto = false; $('#menu').classList.remove('aberto');
}
const tela = html => { $('#conteudo').innerHTML = html; window.scrollTo(0, 0); };

// ---------- Rotas ----------
const ROTAS = [
  [/^\/inicio$/, 'inicio', telaInicio],
  [/^\/pacientes$/, 'pacientes', telaPacientes],
  [/^\/pacientes\/novo$/, 'pacientes', () => telaPacienteForm(null)],
  [/^\/pacientes\/(\d+)$/, 'pacientes', m => telaPacienteDetalhe(m[1])],
  [/^\/pacientes\/(\d+)\/editar$/, 'pacientes', m => telaPacienteForm(m[1])],
  [/^\/atendentes$/, 'atendentes', telaAtendentes],
  [/^\/atendentes\/novo$/, 'atendentes', () => telaAtendenteForm(null)],
  [/^\/atendentes\/(\d+)$/, 'atendentes', m => telaAtendenteForm(m[1])],
  [/^\/encaminhamentos$/, 'encaminhamentos', telaEncaminhamentos],
  [/^\/pesquisa$/, 'pesquisa', telaPesquisa],
  [/^\/novo$/, 'novo', () => telaNovoAtendimento(null)],
  [/^\/atendimentos\/(\d+)\/editar$/, 'atendimento', m => telaNovoAtendimento(m[1])],
  [/^\/ficha\/(\d+)$/, 'atendimento', m => telaFicha(m[1])],
  [/^\/atendimento$/, 'atendimento', telaAtendimentos],
  [/^\/atendimento\/(\d+)$/, 'atendimento', m => telaEvolucao(m[1])],
  [/^\/relatorio$/, 'relatorio', telaRelatorio],
  [/^\/manual$/, '', telaManual],
  [/^\/config$/, 'config', telaConfig],
  [/^\/senha$/, '', telaSenha],
];
function parametro(nome) {
  const q = location.hash.split('?')[1] || '';
  return new URLSearchParams(q).get(nome);
}
async function navegar() {
  if (!estado.usuario) return;
  aplicarTema(estado.casa && estado.casa.cor); // garante a cor salva ao trocar de tela
  const caminho = (location.hash.replace(/^#/, '').split('?')[0]) || '/inicio';
  const r = ROTAS.find(([re]) => re.test(caminho));
  if (!r) return ir('/inicio');
  rotaAtual = r[1] || 'inicio';
  marcarMenu(r[1]);
  try { await r[2](caminho.match(r[0])); }
  catch (e) { tela(`<div class="caixa risco">${esc(e.message)}</div>`); }
}
window.addEventListener('hashchange', navegar);

// ---------- Tema (cor da casa) ----------
function _rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function _hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function _mistura(c1, c2, p) { return c1.map((v, i) => v + (c2[i] - v) * p); }
function _luz([r, g, b]) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function aplicarTema(cor) {
  const raiz = document.documentElement.style;
  if (!cor || !/^#[0-9a-fA-F]{6}$/.test(cor)) {
    ['--cor', '--cor-escura', '--cor-clara'].forEach(v => raiz.removeProperty(v));
    return;
  }
  const base = _rgb(cor);
  // escurece até o menu ficar legível com texto branco
  let escura = base;
  while (_luz(escura) > 0.32) escura = _mistura(escura, [0, 0, 0], 0.2);
  const clara = _mistura(base, [255, 255, 255], 0.86);
  raiz.setProperty('--cor', cor);
  raiz.setProperty('--cor-escura', _hex(...escura));
  raiz.setProperty('--cor-clara', _hex(...clara));
}

async function iniciar() {
  estado = await api('GET', '/api/estado');
  aplicarTema(estado.casa && estado.casa.cor);
  if (!estado.usuario) return mostrarEntrada();
  montarLayout();
  navegar();
  if (prefGet('tour_visto', '') !== '1') setTimeout(() => mostrarTour(), 400); // passo a passo no 1º uso
}

// ---------- Início ----------
async function telaInicio() {
  const [res, agenda, lista] = await Promise.all([api('GET', '/api/resumo'), api('GET', '/api/agenda'), api('GET', '/api/atendimentos?status=em_andamento')]);
  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  tela(`
  ${estado.aviso_senha_padrao && ehAdmin() ? `<div class="caixa risco"><b>Atenção — segurança:</b> o sistema ainda está com a senha padrão (123456). Por favor, <a href="#/senha">troque a sua senha agora</a> para proteger os dados dos pacientes.</div>` : ''}
  ${!estado.casa.nome && ehAdmin() ? `<div class="caixa info">Bem-vindo(a)! Comece preenchendo o nome e os dados da casa em <a href="#/config">Configurações</a>, para que apareçam na ficha impressa.</div>` : ''}
  <div class="cabecalho"><div><h1>Olá, ${esc(estado.usuario.nome.split(' ')[0])}</h1><p class="sub">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
    <div class="acoes"><a class="botao" href="#/pacientes/novo">Cadastrar paciente</a><a class="botao primario" href="#/novo">Novo atendimento</a></div></div>
  <div class="indicadores">
    <div class="indicador"><b>${res.hoje}</b><span>Atendimentos iniciados hoje</span></div>
    <div class="indicador"><b>${res.em_andamento}</b><span>Atendimentos em andamento</span></div>
    <div class="indicador ${res.retornos_atrasados ? 'atencao' : ''}"><b>${res.retornos_atrasados}</b><span>Retornos atrasados</span></div>
    <div class="indicador ${res.alertas ? 'atencao' : ''}"><b>${res.alertas}</b><span>Em andamento com sinal de atenção</span></div>
  </div>
  <div class="cartao"><h3 style="margin-bottom:12px">Resumo de ${esc(mesNome)}</h3>
    <div class="indicadores" style="margin:0">
      <div class="indicador"><b>${res.mes_novos}</b><span>Atendimentos iniciados no mês</span></div>
      <div class="indicador"><b>${res.mes_concluidos}</b><span>Concluídos no mês</span></div>
      <div class="indicador"><b>${res.pacientes}</b><span>Pacientes cadastrados (total)</span></div>
    </div>
  </div>
  ${blocoAgenda(agenda)}
  <div class="cartao"><h2>Atendimentos em andamento</h2>${tabelaAtendimentos(lista.slice(0, 15))}
  ${lista.length > 15 ? '<p><a href="#/atendimento">Ver todos</a></p>' : ''}</div>`);
  ligarLinhas();
}

// Dias entre hoje e uma data ISO (negativo = passado, 0 = hoje, positivo = futuro).
function diasAte(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1, d);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / 86400000);
}
// Etiqueta colorida da situação do retorno.
function situacaoRetorno(iso) {
  const d = diasAte(iso);
  if (d === null) return '';
  if (d < 0) return `<span class="etiqueta risco">Atrasado ${-d} ${-d === 1 ? 'dia' : 'dias'}</span>`;
  if (d === 0) return '<span class="etiqueta alerta">Hoje</span>';
  if (d === 1) return '<span class="etiqueta info">Amanhã</span>';
  return `<span class="etiqueta info">Faltam ${d} dias</span>`;
}

function blocoAgenda(agenda) {
  const todos = [...agenda.atrasados, ...agenda.hoje, ...agenda.proximos.slice(0, 20)];
  if (!todos.length) return '';
  const linha = l => `<tr class="clicavel" data-ir="/atendimento/${l.id}">
    <td>${dataBR(l.proximo_retorno)}</td>
    <td>${situacaoRetorno(l.proximo_retorno)}</td>
    <td>${esc(l.paciente)}${l.alerta_risco ? ' <span class="etiqueta risco">Atenção</span>' : ''}</td>
    <td>${esc(l.atendente || '')}</td>
    <td>${botaoLembreteWhatsapp(l.telefone, l.paciente, l.proximo_retorno, 'Lembrar')}</td></tr>`;
  return `<div class="cartao"><h2>Agenda de retornos</h2>
    <div class="rolagem"><table class="tabela"><thead><tr><th>Retorno</th><th>Situação</th><th>Paciente</th><th>Recepcionado por</th><th></th></tr></thead>
    <tbody>${todos.map(linha).join('')}</tbody></table></div>
  </div>`;
}

function contaEncaminhamentos(a) {
  try { return (JSON.parse(a.encaminhamento_tipos || '[]') || []).length; } catch { return 0; }
}
function tabelaAtendimentos(lista) {
  if (!lista.length) return '<div class="vazio">Nenhum atendimento encontrado.</div>';
  return `<div class="rolagem"><table class="tabela"><thead><tr><th>Ficha</th><th>Paciente</th><th>Início</th><th>Recepcionado por</th><th>Semanas</th><th>Encam.</th><th>Situação</th></tr></thead><tbody>
  ${lista.map(a => { const ne = contaEncaminhamentos(a); return `<tr class="clicavel" data-ir="/atendimento/${a.id}"><td>${numeroFicha(a.id)}</td><td>${esc(a.paciente)}</td><td>${dataBR(a.data_inicio)}</td><td>${esc(a.atendente || '')}</td><td>${a.semanas}/${N_SEMANAS}</td><td>${ne ? `<span class="etiqueta">${ne}</span>` : '<span class="sub">—</span>'}</td><td>${statusEtiqueta(a)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function ligarLinhas(raiz = document) { $$('tr[data-ir]', raiz).forEach(tr => { tr.onclick = () => ir(tr.dataset.ir); }); }

// ---------- A. Cadastros: Pacientes ----------
async function telaPacientes() {
  tela(`<div class="cabecalho"><div><h1>Pacientes</h1><p class="sub">Cadastros › Pacientes</p></div><a class="botao primario" href="#/pacientes/novo">+ Novo paciente</a></div>
  <div class="cartao"><input type="search" id="busca" placeholder="Buscar por nome ou telefone…" aria-label="Buscar paciente"><div id="lista" style="margin-top:14px"></div></div>`);
  const carregar = async () => {
    const lista = await api('GET', '/api/pacientes?q=' + encodeURIComponent($('#busca').value));
    $('#lista').innerHTML = !lista.length ? '<div class="vazio">Nenhum paciente encontrado.</div>' :
      `<div class="rolagem"><table class="tabela"><thead><tr><th>Nome</th><th>Idade</th><th>Telefone/WhatsApp</th><th>Atendimentos</th><th>Último</th></tr></thead><tbody>
      ${lista.map(p => `<tr class="clicavel" data-ir="/pacientes/${p.id}"><td>${esc(p.nome)}</td><td>${textoIdade(p.nascimento)}</td><td>${esc(p.telefone)}</td><td>${p.total_atendimentos}</td><td>${dataBR(p.ultimo_atendimento)}</td></tr>`).join('')}
      </tbody></table></div>`;
    ligarLinhas($('#lista'));
  };
  let t; $('#busca').oninput = () => { clearTimeout(t); t = setTimeout(carregar, 250); };
  $('#busca').focus();
  carregar();
}

async function telaPacienteForm(id) {
  const p = id ? await api('GET', `/api/pacientes/${id}`) : {};
  const voltar = parametro('voltar');
  tela(`<div class="cabecalho"><div><h1>${id ? 'Editar paciente' : 'Cadastro do paciente'}</h1><p class="sub">Cadastros › Pacientes</p></div></div>
  <form class="cartao" id="f-pac">
    <div class="grade">
      <div class="campo largo"><label for="nome">Nome completo *</label><input id="nome" name="nome" type="text" required value="${esc(p.nome)}"></div>
      <div class="campo"><label for="nascimento">Data de nascimento</label>${campoData('nascimento', p.nascimento)}<small id="idade">${textoIdade(p.nascimento) ? 'Idade: ' + textoIdade(p.nascimento) : '&nbsp;'}</small></div>
      <div class="campo"><label for="estado_civil">Estado civil</label><select id="estado_civil" name="estado_civil"><option value="">Selecione…</option>
        ${opcoesEstadoCivil.map(o => `<option ${p.estado_civil === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      <div class="campo"><label for="telefone">Telefone/WhatsApp</label><input id="telefone" name="telefone" type="tel" data-telefone value="${esc(p.telefone)}" placeholder="(00) 00000-0000"></div>
      <div class="campo largo"><label for="endereco">Endereço</label><input id="endereco" name="endereco" type="text" value="${esc(p.endereco)}" placeholder="Rua, número, bairro, cidade"></div>
      <div class="campo"><label for="profissao">Profissão</label><input id="profissao" name="profissao" type="text" value="${esc(p.profissao)}"></div>
      <div class="campo"><label for="religiao">Religião</label><input id="religiao" name="religiao" type="text" value="${esc(p.religiao)}"></div>
      <div class="campo largo"><label for="observacoes">Observações</label><textarea id="observacoes" name="observacoes" rows="3" placeholder="Anotações livres sobre o paciente (opcional)">${esc(p.observacoes)}</textarea></div>
    </div>
    <div class="erro" id="erro"></div>
    <div class="acoes" style="margin-top:10px"><button class="primario" type="submit">Salvar</button><a class="botao" href="${id ? `#/pacientes/${id}` : '#/pacientes'}">Cancelar</a></div>
  </form>`);
  ativarMascaraTelefone();
  const atualizaIdade = () => { const t = textoIdade(isoDeData($('#nascimento').value)); $('#idade').innerHTML = t ? 'Idade: <b>' + t + '</b>' : '&nbsp;'; };
  $('#nascimento').addEventListener('input', atualizaIdade);
  $('#nome').focus();
  $('#f-pac').onsubmit = async e => {
    e.preventDefault();
    $('#erro').textContent = '';
    const nasc = lerCampoData('nascimento');
    if (!nasc.valido) { $('#erro').textContent = 'Data de nascimento inválida. Use dd/mm/aaaa.'; return; }
    const dados = { ...dadosFormulario(e.target), nascimento: nasc.iso };
    const salvar = async confirmar => {
      const corpo = confirmar ? { ...dados, confirmar_duplicado: true } : dados;
      const r = id ? await api('PUT', `/api/pacientes/${id}`, corpo) : await api('POST', '/api/pacientes', corpo);
      if (r.duplicado) { mostrarDuplicados(r.duplicados, salvar); return; }
      aviso('Paciente salvo.');
      ir(voltar === 'novo' ? `/novo?paciente=${r.id}` : `/pacientes/${r.id}`);
    };
    try { await salvar(false); } catch (err) { $('#erro').textContent = err.message; }
  };
}

// Mostra um aviso de paciente parecido, com a opção de abrir o existente ou cadastrar mesmo assim.
function mostrarDuplicados(lista, aoConfirmar) {
  const alvo = $('#erro');
  const itens = lista.map(d => `<li style="margin:4px 0"><a href="#/pacientes/${d.id}"><b>${esc(d.nome)}</b></a>${d.telefone ? ' · ' + esc(d.telefone) : ''}${d.nascimento ? ' · ' + textoIdade(d.nascimento) : ''}</li>`).join('');
  alvo.innerHTML = `<div class="caixa alerta" style="text-align:left">
    <b>Já existe paciente parecido:</b>
    <ul style="margin:6px 0 10px 18px">${itens}</ul>
    Confira se não é a mesma pessoa. Se já estiver cadastrada, clique no nome acima para usá-la.
    <div class="acoes" style="margin-top:10px"><button type="button" class="pequeno" id="b-dup-sim">Cadastrar mesmo assim</button></div>
  </div>`;
  $('#b-dup-sim').onclick = async () => { try { await aoConfirmar(true); } catch (err) { aviso(err.message, true); } };
}

async function telaPacienteDetalhe(id) {
  const p = await api('GET', `/api/pacientes/${id}`);
  tela(`<div class="cabecalho"><div><h1>${esc(p.nome)}</h1><p class="sub">Paciente desde ${dataBR(p.criado_em)}</p></div>
    <div class="acoes"><a class="botao" href="#/pacientes/${p.id}/editar">Editar cadastro</a><a class="botao primario" href="#/novo?paciente=${p.id}">Novo atendimento</a></div></div>
  <div class="cartao"><h2>Dados do paciente</h2>${blocoDadosPaciente(p)}</div>
  <div class="cartao"><h2>Histórico de atendimentos</h2>
  ${!p.atendimentos.length ? '<div class="vazio">Este paciente ainda não tem atendimentos.</div>' :
    `<div class="rolagem"><table class="tabela"><thead><tr><th>Ficha</th><th>Início</th><th>Recepcionado por</th><th>Semanas</th><th>Situação</th></tr></thead><tbody>
    ${p.atendimentos.map(a => `<tr class="clicavel" data-ir="/atendimento/${a.id}"><td>${numeroFicha(a.id)}</td><td>${dataBR(a.data_inicio)}</td><td>${esc(a.atendente || '')}</td><td>${a.semanas}/${N_SEMANAS}</td><td>${statusEtiqueta(a)}</td></tr>`).join('')}
    </tbody></table></div>`}
  </div>
  ${ehAdmin() ? `<div class="cartao"><h3>Excluir paciente</h3><p class="sub" style="margin-bottom:10px">Apaga definitivamente o cadastro e todos os atendimentos deste paciente (direito de exclusão da LGPD).</p><button class="perigo" id="b-excluir">Excluir paciente e histórico</button></div>` : ''}`);
  ligarLinhas();
  if ($('#b-excluir')) $('#b-excluir').onclick = async () => {
    const conf = prompt(`Para confirmar, digite EXCLUIR.\nIsto apaga ${p.nome} e ${p.atendimentos.length} atendimento(s).`);
    if (conf !== 'EXCLUIR') return;
    try { await api('DELETE', `/api/pacientes/${p.id}`); aviso('Paciente excluído.'); ir('/pacientes'); }
    catch (e) { aviso(e.message, true); }
  };
}

function blocoDadosPaciente(p) {
  const item = (r, v) => `<div><span>${r}</span>${v || '—'}</div>`;
  return `<div class="dados-paciente">
    ${item('Nome', esc(p.nome))}
    ${item('Data de nascimento', p.nascimento ? `${dataBR(p.nascimento)} <b>(${textoIdade(p.nascimento)})</b>` : '')}
    ${item('Estado civil', esc(p.estado_civil))}
    ${item('Telefone/WhatsApp', linkWhatsapp(p.telefone))}
    ${item('Endereço', esc(p.endereco))}
    ${item('Profissão', esc(p.profissao))}
    ${item('Religião', esc(p.religiao))}
  </div>${p.observacoes ? `<div style="margin-top:12px"><span style="color:var(--texto-suave);font-size:13px;display:block">Observações</span><div style="white-space:pre-wrap">${esc(p.observacoes)}</div></div>` : ''}`;
}

// ---------- A. Cadastros: Atendentes ----------
async function telaAtendentes() {
  const lista = await api('GET', '/api/atendentes');
  tela(`<div class="cabecalho"><div><h1>Atendentes</h1><p class="sub">Cadastros › Atendentes</p></div>${ehAdmin() ? '<a class="botao primario" href="#/atendentes/novo">+ Novo atendente</a>' : ''}</div>
  <div class="cartao">${!lista.length ? '<div class="vazio">Nenhum atendente cadastrado.</div>' :
    `<div class="rolagem"><table class="tabela"><thead><tr><th>Nome completo</th><th>WhatsApp</th><th>Acesso ao sistema</th><th>Situação</th></tr></thead><tbody>
    ${lista.map(a => `<tr ${ehAdmin() ? `class="clicavel" data-ir="/atendentes/${a.id}"` : ''}><td>${esc(a.nome)}</td><td>${linkWhatsapp(a.whatsapp)}</td>
      <td>${a.usuario ? `${esc(a.usuario)} <span class="etiqueta">${a.perfil === 'admin' ? 'Administrador' : 'Atendente'}</span>` : '<span class="etiqueta cinza">Sem acesso</span>'}</td>
      <td>${a.ativo ? '<span class="etiqueta ok">Ativo</span>' : '<span class="etiqueta cinza">Inativo</span>'}</td></tr>`).join('')}
    </tbody></table></div>`}
  ${!ehAdmin() ? '<p class="sub" style="margin:12px 0 0">Somente administradores podem cadastrar ou alterar atendentes.</p>' : ''}</div>`);
  ligarLinhas();
}

async function telaAtendenteForm(id) {
  if (!ehAdmin()) return ir('/atendentes');
  const a = id ? (await api('GET', '/api/atendentes')).find(x => x.id === Number(id)) : { ativo: 1 };
  if (!a) throw new Error('Atendente não encontrado.');
  tela(`<div class="cabecalho"><div><h1>${id ? 'Editar atendente' : 'Cadastro do atendente'}</h1><p class="sub">Cadastros › Atendentes</p></div></div>
  <form class="cartao" id="f-at">
    <div class="grade">
      <div class="campo"><label for="nome">Nome completo *</label><input id="nome" name="nome" type="text" required value="${esc(a.nome)}"></div>
      <div class="campo"><label for="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" type="tel" data-telefone value="${esc(a.whatsapp)}" placeholder="(00) 00000-0000"></div>
    </div>
    <div class="passo" style="margin-top:18px">
      <label class="opcao" style="display:inline-flex"><input type="checkbox" name="acesso" id="acesso" ${a.usuario ? 'checked' : ''}> Pode entrar no sistema (usuário e senha)</label>
      <div class="grade" id="bloco-acesso" style="margin-top:14px">
        <div class="campo"><label for="usuario">Usuário</label><input id="usuario" name="usuario" type="text" autocomplete="off" value="${esc(a.usuario)}"></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" name="senha" type="password" autocomplete="new-password" placeholder="${a.usuario ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres'}"></div>
        <div class="campo"><label for="perfil">Perfil</label><select id="perfil" name="perfil">
          <option value="atendente" ${a.perfil !== 'admin' ? 'selected' : ''}>Atendente</option>
          <option value="admin" ${a.perfil === 'admin' ? 'selected' : ''}>Administrador (gerencia atendentes e configurações)</option></select></div>
      </div>
    </div>
    <div class="passo"><label class="opcao" style="display:inline-flex"><input type="checkbox" name="ativo" ${a.ativo ? 'checked' : ''}> Atendente ativo</label></div>
    <div class="erro" id="erro"></div>
    <div class="acoes" style="margin-top:10px"><button class="primario" type="submit">Salvar</button><a class="botao" href="#/atendentes">Cancelar</a></div>
  </form>`);
  ativarMascaraTelefone();
  const alterna = () => { $('#bloco-acesso').style.display = $('#acesso').checked ? '' : 'none'; };
  $('#acesso').onchange = alterna; alterna();
  $('#f-at').onsubmit = async e => {
    e.preventDefault();
    try {
      const d = dadosFormulario(e.target);
      if (id) await api('PUT', `/api/atendentes/${id}`, d); else await api('POST', '/api/atendentes', d);
      aviso('Atendente salvo.'); ir('/atendentes');
    } catch (err) { $('#erro').textContent = err.message; }
  };
}

// ---------- A. Cadastros: Encaminhamentos ----------
async function telaEncaminhamentos() {
  const lista = await api('GET', '/api/encaminhamentos?todos=1');
  const admin = ehAdmin();
  tela(`<div class="cabecalho"><div><h1>Encaminhamentos</h1><p class="sub">Cadastros › Encaminhamentos — tipos usados no item 12 do atendimento (ex.: Cromoterapia, Reiki).</p></div>
    ${admin ? '<button class="botao primario" id="b-novo-enc">+ Novo encaminhamento</button>' : ''}</div>
  <div class="cartao">${!lista.length ? '<div class="vazio">Nenhum encaminhamento cadastrado ainda.</div>' :
    `<div class="rolagem"><table class="tabela"><thead><tr><th>Nome</th><th>Situação</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
    ${lista.map(e => `<tr><td>${esc(e.nome)}</td><td>${e.ativo ? '<span class="etiqueta ok">Ativo</span>' : '<span class="etiqueta cinza">Inativo</span>'}</td>
      ${admin ? `<td style="text-align:right"><button class="pequeno" data-editar="${e.id}" data-nome="${esc(e.nome)}">Renomear</button> <button class="pequeno" data-ativar="${e.id}" data-ativo="${e.ativo}">${e.ativo ? 'Desativar' : 'Ativar'}</button></td>` : ''}</tr>`).join('')}
    </tbody></table></div>`}
    ${!admin ? '<p class="sub" style="margin:12px 0 0">Somente administradores podem cadastrar ou alterar encaminhamentos.</p>' : ''}</div>`);
  if (!admin) return;
  $('#b-novo-enc').onclick = async () => {
    const nome = prompt('Nome do novo encaminhamento (ex.: Cromoterapia):');
    if (!nome || !nome.trim()) return;
    try { await api('POST', '/api/encaminhamentos', { nome: nome.trim() }); aviso('Encaminhamento criado.'); telaEncaminhamentos(); }
    catch (e) { aviso(e.message, true); }
  };
  $$('button[data-editar]').forEach(b => b.onclick = async () => {
    const nome = prompt('Novo nome do encaminhamento:', b.dataset.nome);
    if (!nome || !nome.trim()) return;
    try { await api('PUT', `/api/encaminhamentos/${b.dataset.editar}`, { nome: nome.trim() }); aviso('Encaminhamento alterado.'); telaEncaminhamentos(); }
    catch (e) { aviso(e.message, true); }
  });
  $$('button[data-ativar]').forEach(b => b.onclick = async () => {
    try { await api('PUT', `/api/encaminhamentos/${b.dataset.ativar}`, { nome: b.previousElementSibling.dataset.nome, ativo: b.dataset.ativo === '0' }); telaEncaminhamentos(); }
    catch (e) { aviso(e.message, true); }
  });
}

// ---------- B. Pesquisa ----------
async function telaPesquisa() {
  const atendentes = await api('GET', '/api/atendentes');
  tela(`<div class="cabecalho"><div><h1>Pesquisa</h1><p class="sub">Encontre pacientes e atendimentos</p></div></div>
  <form class="cartao" id="f-pesq">
    <div class="grade">
      <div class="campo largo"><label for="q">Nome ou telefone do paciente</label><input id="q" name="q" type="search" placeholder="Digite parte do nome ou do telefone"></div>
      <div class="campo"><label for="de">Atendimentos de</label>${campoData('de', '')}</div>
      <div class="campo"><label for="ate">até</label>${campoData('ate', '')}</div>
      <div class="campo"><label for="atendente">Recepcionado por</label><select id="atendente" name="atendente"><option value="">Todos</option>${atendentes.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('')}</select></div>
      <div class="campo"><label for="status">Situação</label><select id="status" name="status"><option value="">Todas</option><option value="em_andamento">Em andamento</option><option value="concluido">Concluído</option></select></div>
    </div>
    <div class="acoes" style="margin-top:14px"><button class="primario" type="submit">Pesquisar</button><button type="reset" id="b-limpar">Limpar</button></div>
  </form>
  <div id="resultado"></div>`);
  const pesquisar = async () => {
    const d = dadosFormulario($('#f-pesq'));
    d.de = lerCampoData('de').iso; d.ate = lerCampoData('ate').iso; // datas em ISO para o servidor
    const qs = new URLSearchParams(d).toString();
    const [pacs, ats] = await Promise.all([
      d.q ? api('GET', '/api/pacientes?q=' + encodeURIComponent(d.q)) : Promise.resolve(null),
      api('GET', '/api/atendimentos?' + qs),
    ]);
    const digitos = d.q.replace(/\D/g, '');
    // pesquisa por telefone: também traz os atendimentos dos pacientes encontrados
    let atendimentos = ats;
    if (pacs && digitos.length >= 3) {
      const ids = new Set(pacs.map(p => p.id));
      const todos = await api('GET', '/api/atendimentos?' + new URLSearchParams({ ...d, q: '' }));
      atendimentos = todos.filter(a => ids.has(a.paciente_id));
    }
    $('#resultado').innerHTML = `
      ${pacs ? `<div class="cartao"><h2>Pacientes (${pacs.length})</h2>${!pacs.length ? '<div class="vazio">Nenhum paciente encontrado.</div>' :
        `<div class="rolagem"><table class="tabela"><thead><tr><th>Nome</th><th>Idade</th><th>Telefone</th><th>Atendimentos</th></tr></thead><tbody>
        ${pacs.map(p => `<tr class="clicavel" data-ir="/pacientes/${p.id}"><td>${esc(p.nome)}</td><td>${textoIdade(p.nascimento)}</td><td>${esc(p.telefone)}</td><td>${p.total_atendimentos}</td></tr>`).join('')}
        </tbody></table></div>`}</div>` : ''}
      <div class="cartao"><h2>Atendimentos (${atendimentos.length})</h2>${tabelaAtendimentos(atendimentos)}</div>`;
    ligarLinhas($('#resultado'));
  };
  $('#f-pesq').onsubmit = e => { e.preventDefault(); pesquisar().catch(err => aviso(err.message, true)); };
  $('#b-limpar').onclick = () => setTimeout(pesquisar, 0);
  $('#q').focus();
  pesquisar();
}

// ---------- C. Novo atendimento ----------
function htmlPergunta(p, respostas) {
  const v = respostas[p.id];
  let campo;
  if (p.tipo === 'radio' || p.tipo === 'checks') {
    const tipo = p.tipo === 'radio' ? 'radio' : 'checkbox';
    campo = `<div class="opcoes ${p.colunas === 2 ? 'colunas-2' : ''}">${p.opcoes.map(([val, rot]) => {
      const marcado = Array.isArray(v) ? v.includes(val) : v === val;
      return `<label class="opcao"><input type="${tipo}" name="q_${p.id}" value="${val}" ${marcado ? 'checked' : ''}> ${esc(rot)}</label>`;
    }).join('')}</div>`;
  } else if (p.tipo === 'area') {
    campo = `<textarea name="q_${p.id}" aria-label="${esc(p.rotulo)}">${esc(v || '')}</textarea>`;
  } else {
    campo = `<input type="text" name="q_${p.id}" value="${esc(v || '')}" aria-label="${esc(p.rotulo)}">`;
  }
  const alerta = p.alerta ? `<div class="caixa risco" data-alerta="${p.id}" style="display:none;margin-top:10px">
    <b>Atenção:</b> acolha esta pessoa com prioridade e cuidado. Informe o coordenador do Atendimento Fraterno e oriente a buscar apoio profissional.
    O <b>CVV</b> atende 24 horas, de graça, pelo telefone <b>188</b> ou em cvv.org.br. Em emergência, ligue <b>192</b> (SAMU). Esta ficha ficará marcada com sinal de atenção.</div>` : '';
  return `<div class="pergunta ${p.se ? 'condicional' : ''}" data-pergunta="${p.id}">
    <div class="rotulo">${esc(p.rotulo)}</div>${campo}${alerta}</div>`;
}
function lerRespostas(raiz) {
  const r = {};
  for (const s of QUESTIONARIO) for (const p of s.perguntas) {
    const els = $$(`[name="q_${p.id}"]`, raiz);
    if (p.tipo === 'radio') { const m = els.find(e => e.checked); if (m) r[p.id] = m.value; }
    else if (p.tipo === 'checks') { const m = els.filter(e => e.checked).map(e => e.value); if (m.length) r[p.id] = m; }
    else if (els[0] && els[0].value.trim()) r[p.id] = els[0].value.trim();
  }
  // remove respostas de perguntas que ficaram ocultas
  for (const s of QUESTIONARIO) for (const p of s.perguntas) if (!perguntaVisivel(p, r)) delete r[p.id];
  return r;
}
function atualizarVisibilidade(raiz) {
  const r = lerRespostas(raiz);
  const bruto = {};
  for (const s of QUESTIONARIO) for (const p of s.perguntas) {
    const els = $$(`[name="q_${p.id}"]`, raiz);
    if (p.tipo === 'radio') { const m = els.find(e => e.checked); if (m) bruto[p.id] = m.value; }
    if (p.tipo === 'checks') bruto[p.id] = els.filter(e => e.checked).map(e => e.value);
  }
  for (const s of QUESTIONARIO) for (const p of s.perguntas) {
    const el = $(`[data-pergunta="${p.id}"]`, raiz);
    if (el) el.style.display = perguntaVisivel(p, bruto) ? '' : 'none';
    if (p.alerta) { const a = $(`[data-alerta="${p.id}"]`, raiz); if (a) a.style.display = r[p.id] === 'sim' ? '' : 'none'; }
  }
}

let rascunhoNovo = null; // guarda o que já foi preenchido ao ir cadastrar um novo paciente

async function telaNovoAtendimento(idEdicao) {
  const [atendentes, cfg] = await Promise.all([api('GET', '/api/atendentes'), api('GET', '/api/config')]);
  let at = null;
  if (idEdicao) at = await api('GET', `/api/atendimentos/${idEdicao}`);
  let paciente = at ? at.paciente : null;
  const pacParam = parametro('paciente');
  if (!paciente && pacParam) paciente = await api('GET', `/api/pacientes/${pacParam}`).catch(() => null);
  // Ao voltar do cadastro de paciente, recupera o que já havia sido preenchido.
  const rascunho = (!at && rascunhoNovo) ? rascunhoNovo : null;
  rascunhoNovo = null;
  const respostas = at ? at.respostas : (rascunho ? rascunho.respostas : {});
  const ativos = atendentes.filter(a => a.ativo || (at && a.id === at.atendente_id));
  // Começa vazio em um novo atendimento: a pessoa precisa escolher quem recepcionou,
  // para não gravar o usuário logado por engano.
  const atendenteSel = at ? at.atendente_id : (rascunho ? rascunho.atendente_id : '');
  const consentMarcado = at ? at.consentimento : (rascunho ? rascunho.consentimento : false);
  const dataInicio = at ? at.data_inicio : new Date().toLocaleDateString('sv-SE');

  tela(`<div class="cabecalho"><div><h1>${at ? `Editar ficha nº ${numeroFicha(at.id)}` : 'Novo atendimento'}</h1><p class="sub">Preencha os passos abaixo. Ao final, a ficha será impressa para as anotações das semanas.</p></div></div>
  <form id="f-novo" novalidate>
    <div class="cartao">
      <div class="grade">
        <div class="campo"><label>Data de início do atendimento</label><input type="text" readonly value="${dataBR(dataInicio)}"><small>Preenchida automaticamente</small></div>
        <div class="campo"><label for="atendente_id">1. Quem está recepcionando o paciente *</label>
          <select id="atendente_id" name="atendente_id" required><option value="">Selecione o atendente…</option>
          ${ativos.map(a => `<option value="${a.id}" ${String(a.id) === String(atendenteSel) ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select>
          <small><a href="#/atendentes">Gerenciar atendentes</a></small></div>
      </div>
    </div>
    <div class="cartao">
      <div class="passo-titulo"><span class="passo-num">2</span><h2 style="margin:0">Dados do paciente</h2></div>
      <div id="paciente-area"></div>
    </div>
    <div class="cartao" id="questionario">
      ${QUESTIONARIO.map(s => `<div class="passo"><div class="passo-titulo"><span class="passo-num">${s.n}</span><h2 style="margin:0">${esc(s.titulo)}</h2></div>
        ${s.perguntas.map(p => htmlPergunta(p, respostas)).join('')}</div>`).join('')}
    </div>
    <div class="cartao">
      <h3>Termo de consentimento (LGPD)</h3>
      <p class="sub" style="margin-bottom:10px">${esc(cfg.termo)}</p>
      <label class="opcao"><input type="checkbox" name="consentimento" ${consentMarcado ? 'checked' : ''}> O paciente concordou e assinou o termo</label>
      <p class="sub" style="margin:8px 0 0;font-size:13px">O termo sai impresso na ficha para assinatura. Você pode marcar esta opção depois, na tela Atendimento.</p>
    </div>
    <div class="erro" id="erro"></div>
    <div class="barra-salvar"><div class="acoes"><button class="primario" type="submit" data-acao="imprimir">Salvar e imprimir ficha</button><button type="submit" data-acao="salvar">Somente salvar</button>
      <a class="botao" href="${at ? `#/atendimento/${at.id}` : '#/inicio'}">Cancelar</a></div></div>
  </form>`);

  const renderPaciente = () => {
    const area = $('#paciente-area');
    if (paciente) {
      area.innerHTML = `${blocoDadosPaciente(paciente)}<div class="acoes" style="margin-top:12px"><button type="button" class="pequeno" id="b-trocar">Trocar paciente</button><a class="botao pequeno" href="#/pacientes/${paciente.id}/editar">Corrigir cadastro</a></div>`;
      $('#b-trocar').onclick = () => { paciente = null; renderPaciente(); };
      return;
    }
    area.innerHTML = `<label for="busca-pac">Buscar paciente cadastrado</label>
      <input id="busca-pac" type="search" placeholder="Digite o nome ou telefone…" autocomplete="off">
      <div id="busca-res"></div>
      <p style="margin:12px 0 0">Não encontrou? <a href="#/pacientes/novo?voltar=novo" id="b-cadastrar-pac">Cadastrar novo paciente</a></p>`;
    // Antes de sair para cadastrar o paciente, guarda o que já foi preenchido na ficha.
    $('#b-cadastrar-pac').onclick = () => {
      rascunhoNovo = { atendente_id: $('#atendente_id').value, respostas: lerRespostas(q), consentimento: $('#f-novo').consentimento.checked };
    };
    let t;
    $('#busca-pac').oninput = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = $('#busca-pac').value.trim();
        if (q.length < 2) { $('#busca-res').innerHTML = ''; return; }
        const lista = await api('GET', '/api/pacientes?q=' + encodeURIComponent(q));
        $('#busca-res').innerHTML = !lista.length ? '<p style="margin:10px 0 0;font-weight:700;color:#000;font-size:15px">PACIENTE NÃO ENCONTRADO</p>' :
          `<div class="busca-lista">${lista.slice(0, 20).map(p => `<button type="button" data-id="${p.id}"><b>${esc(p.nome)}</b> <span class="sub">${[textoIdade(p.nascimento), p.telefone].filter(Boolean).map(esc).join(' · ')}</span></button>`).join('')}</div>`;
        $$('#busca-res button').forEach(b => { b.onclick = () => { paciente = lista.find(p => p.id === Number(b.dataset.id)); renderPaciente(); }; });
      }, 250);
    };
  };
  renderPaciente();

  const q = $('#questionario');
  q.addEventListener('change', () => atualizarVisibilidade(q));
  atualizarVisibilidade(q);

  let acao = 'imprimir';
  $$('#f-novo button[type=submit]').forEach(b => { b.onclick = () => { acao = b.dataset.acao; }; });
  const irAteCampo = (el, mensagem) => {
    $('#erro').textContent = mensagem;
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => { try { el.focus(); } catch { /* ignora */ } }, 300); }
  };
  $('#f-novo').onsubmit = async e => {
    e.preventDefault();
    $('#erro').textContent = '';
    // leva a tela direto ao primeiro campo obrigatório não preenchido
    if (!$('#atendente_id').value) return irAteCampo($('#atendente_id'), 'Falta escolher quem está recepcionando o paciente (passo 1).');
    if (!paciente) return irAteCampo($('#busca-pac') || $('#paciente-area'), 'Falta selecionar ou cadastrar o paciente (passo 2).');
    const corpo = {
      paciente_id: paciente.id, atendente_id: Number($('#atendente_id').value), data_inicio: dataInicio,
      respostas: lerRespostas(q), consentimento: e.target.consentimento.checked,
    };
    try {
      const r = at ? await api('PUT', `/api/atendimentos/${at.id}`, corpo) : await api('POST', '/api/atendimentos', corpo);
      aviso('Atendimento salvo.');
      ir(acao === 'imprimir' ? `/ficha/${r.id}` : `/atendimento/${r.id}`);
    } catch (err) { $('#erro').textContent = err.message; }
  };
}

// ---------- Ficha impressa ----------
async function telaFicha(id) {
  const [a, cfg] = await Promise.all([api('GET', `/api/atendimentos/${id}`), api('GET', '/api/config')]);
  tela(`<div class="ficha-barra nao-imprimir">
    <div class="cabecalho"><div><h1>Ficha nº ${numeroFicha(a.id)}</h1><p class="sub">${esc(a.paciente.nome)} · confira e clique em Imprimir</p></div>
    <div class="acoes"><a class="botao" href="#/atendimento/${a.id}">Ir para o atendimento</a><button class="primario" id="b-imprimir">Imprimir ficha</button></div></div>
  </div>
  ${renderFicha(a, cfg)}`);
  $('#b-imprimir').onclick = () => window.print();
}

// ---------- D. Atendimento (evolução semanal) ----------
async function telaAtendimentos() {
  tela(`<div class="cabecalho"><div><h1>Atendimento</h1><p class="sub">Registre aqui o que foi anotado à mão na ficha, a cada semana.</p></div></div>
  <div class="cartao">
    <div class="grade" style="margin-bottom:14px">
      <div class="campo"><label for="busca">Paciente</label><input id="busca" type="search" placeholder="Nome do paciente"></div>
      <div class="campo"><label for="status">Situação</label><select id="status"><option value="em_andamento">Em andamento</option><option value="concluido">Concluídos</option><option value="">Todos</option></select></div>
    </div>
    <div id="lista"></div>
  </div>`);
  const carregar = async () => {
    const lista = await api('GET', `/api/atendimentos?status=${$('#status').value}&q=${encodeURIComponent($('#busca').value)}`);
    $('#lista').innerHTML = tabelaAtendimentos(lista);
    ligarLinhas($('#lista'));
  };
  let t; $('#busca').oninput = () => { clearTimeout(t); t = setTimeout(carregar, 250); };
  $('#status').onchange = carregar;
  carregar();
}

function resumoRespostas(r) {
  const linhas = [];
  for (const s of QUESTIONARIO) {
    const itens = s.perguntas.filter(p => r[p.id] !== undefined).map(p => {
      const v = r[p.id];
      let txt;
      if (p.opcoes) {
        const mapa = Object.fromEntries(p.opcoes);
        txt = (Array.isArray(v) ? v : [v]).map(x => mapa[x] || x).join(', ');
      } else txt = v;
      return `<div class="f-lin" style="margin:3px 0"><span class="sub">${esc(p.rotulo)}</span> <b>${esc(txt)}</b></div>`;
    });
    if (itens.length) linhas.push(`<div style="margin-bottom:10px"><h3 style="margin-bottom:2px">${s.n}. ${esc(s.titulo)}</h3>${itens.join('')}</div>`);
  }
  return linhas.join('') || '<div class="vazio">Nenhuma resposta registrada.</div>';
}

async function telaEvolucao(id) {
  const [a, atendentes, encaminhamentos] = await Promise.all([api('GET', `/api/atendimentos/${id}`), api('GET', '/api/atendentes'), api('GET', '/api/encaminhamentos')]);
  const evo = {}; for (const e of a.evolucoes) evo[e.semana] = e;
  const concluido = a.status === 'concluido';
  tela(`<div class="cabecalho"><div><h1>${esc(a.paciente.nome)}</h1>
      <p class="sub">Ficha nº ${numeroFicha(a.id)} · início em ${dataBR(a.data_inicio)} · recepcionado por ${esc(a.atendente_nome || '—')} &nbsp;${statusEtiqueta(a)}</p></div>
    <div class="acoes"><a class="botao" href="#/ficha/${a.id}">Imprimir ficha</a><a class="botao" href="#/atendimentos/${a.id}/editar">Editar ficha inicial</a>
      <button id="b-status">${concluido ? 'Reabrir atendimento' : 'Concluir atendimento'}</button></div></div>
  ${a.alerta_risco ? '<div class="caixa risco"><b>Sinal de atenção:</b> o paciente relatou pensamentos de morte/suicídio na ficha inicial. Acompanhe com prioridade e oriente a buscar apoio profissional (CVV: 188, gratuito, 24 horas).</div>' : ''}
  ${!a.consentimento ? '<div class="caixa alerta">O termo de consentimento ainda não foi marcado como assinado. <button class="pequeno" id="b-consent" style="margin-left:8px">Marcar como assinado</button></div>' : ''}
  <div class="cartao">
    <div style="display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
      <div class="campo" style="flex:0 0 190px"><label for="retorno">Próximo retorno</label>${campoData('retorno', a.proximo_retorno)}</div>
      <button class="pequeno" id="b-retorno">Salvar data do retorno</button>
      ${a.proximo_retorno ? `<button class="pequeno" id="b-retorno-limpar">Limpar</button>` : ''}
      <button class="pequeno" id="b-falta">Registrar falta e reagendar</button>
      ${botaoLembreteWhatsapp(a.paciente.telefone, a.paciente.nome, a.proximo_retorno, 'Lembrar no WhatsApp')}
      <span class="etiqueta ${a.faltas ? 'alerta' : 'cinza'}" style="margin-bottom:6px">Faltas: ${a.faltas || 0}</span>
    </div>
    <p class="sub" style="margin:8px 0 0;font-size:13px">O retorno aparece na agenda do início. Para registrar uma falta, informe a nova data acima e clique em "Registrar falta e reagendar". O botão verde abre o WhatsApp do paciente com o lembrete pronto.</p>
  </div>
  <details class="cartao"><summary style="cursor:pointer;font-weight:600">Dados do paciente e respostas da ficha inicial</summary>
    <div style="margin-top:14px">${blocoDadosPaciente(a.paciente)}</div><div class="passo">${resumoRespostas(a.respostas)}</div></details>
  <div class="cabecalho" style="margin-bottom:10px"><h2 style="margin:0">11. Evolução (atendimento uma vez por semana)</h2>
    <span class="sub" style="margin:0;font-size:13px">Clique numa semana para abrir e preencher.</span></div>
  <datalist id="lista-atendentes">${atendentes.filter(x => x.ativo).map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist>
  <div class="semanas-lista">
  ${NOMES_SEMANAS.map((nome, i) => {
    const s = i + 1, e = evo[s] || {};
    const cheia = e.data || e.triagem;
    return `<div class="semana-item ${cheia ? 'preenchida' : ''}" data-semana="${s}">
      <button type="button" class="semana-cab" data-cab="${s}">
        <span class="semana-nome">${nome.charAt(0) + nome.slice(1).toLowerCase()}</span>
        <span class="semana-meta">${cheia ? `<span class="etiqueta ok">Registrada</span>${e.data ? ' ' + dataBR(e.data) : ''}` : '<span class="etiqueta cinza">Pendente</span>'} <span class="chevron">▾</span></span>
      </button>
      <form class="semana-corpo" data-semana="${s}" style="display:none">
        <div class="grade">
          <div class="campo"><label>Data</label>${campoData(`data-sem-${s}`, e.data)}</div>
          <div class="campo"><label>Triador</label><input type="text" name="triador" list="lista-atendentes" value="${esc(e.triador)}"></div>
        </div>
        <div class="campo" style="margin-top:10px"><label>Triagem (síntese do atendimento)</label><textarea name="triagem" rows="5">${esc(e.triagem)}</textarea></div>
        <div class="acoes" style="margin-top:10px"><button class="primario pequeno" type="submit">Salvar semana</button>
        ${e.registrado_por ? `<span class="meta">Lançado por ${esc(e.registrado_por)} em ${dataBR(e.atualizado_em)}</span>` : ''}</div>
      </form>
    </div>`;
  }).join('')}
  </div>
  <h2 style="margin-top:24px">12. Encaminhamento</h2>
  <form class="cartao" id="f-encaminhamento">
    ${(() => {
      const nomes = [...new Set([...encaminhamentos.map(e => e.nome), ...(a.encaminhamento_tipos || [])])];
      if (!nomes.length) return '<p class="sub" style="margin:0 0 10px">Nenhum tipo de encaminhamento cadastrado. O administrador pode cadastrar em <a href="#/encaminhamentos">Cadastros › Encaminhamentos</a>.</p>';
      return `<div class="campo" style="margin-bottom:12px"><label>Tipos de encaminhamento</label>
        <div class="opcoes colunas-2" style="margin-top:4px">${nomes.map(n => `<label class="opcao"><input type="checkbox" class="enc-tipo" value="${esc(n)}" ${(a.encaminhamento_tipos || []).includes(n) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div></div>`;
    })()}
    <div class="grade">
      <div class="campo"><label for="enc-data">Data</label>${campoData('enc-data', a.encaminhamento_data)}</div>
      <div class="campo"><label for="enc-triador">Triador</label><input type="text" id="enc-triador" list="lista-atendentes" value="${esc(a.encaminhamento_triador)}"></div>
    </div>
    <div class="campo" style="margin-top:10px"><label for="enc-texto">Observações do encaminhamento</label><textarea id="enc-texto" rows="4" placeholder="Campo livre — detalhes do encaminhamento">${esc(a.encaminhamento_texto)}</textarea></div>
    <div class="acoes" style="margin-top:10px"><button class="primario pequeno" type="submit">Salvar encaminhamento</button></div>
  </form>
  ${ehAdmin() ? `<div class="cartao" style="margin-top:24px"><h3>Excluir este atendimento</h3><p class="sub" style="margin-bottom:10px">Apaga a ficha e as evoluções (o cadastro do paciente continua). Disponível somente para administradores.</p><button class="perigo" id="b-excluir">Excluir atendimento</button></div>` : ''}`);

  // abre/fecha cada semana; começa aberta a primeira pendente
  const abrir = s => {
    $$('.semana-corpo').forEach(c => { c.style.display = c.dataset.semana === String(s) ? '' : 'none'; });
    $$('.semana-cab .chevron').forEach(ch => { ch.textContent = ch.closest('.semana-cab').dataset.cab === String(s) ? '▴' : '▾'; });
  };
  $$('.semana-cab').forEach(btn => { btn.onclick = () => {
    const corpo = $(`.semana-corpo[data-semana="${btn.dataset.cab}"]`);
    abrir(corpo.style.display === 'none' ? btn.dataset.cab : -1);
  }; });
  const primeiraPendente = NOMES_SEMANAS.findIndex((_, i) => { const e = evo[i + 1] || {}; return !(e.data || e.triagem); });
  if (primeiraPendente >= 0) abrir(primeiraPendente + 1);

  $('#f-encaminhamento').onsubmit = async e => {
    e.preventDefault();
    const dt = lerCampoData('enc-data');
    if (!dt.valido) { aviso('Data do encaminhamento inválida. Use dd/mm/aaaa.', true); return; }
    const tipos = $$('.enc-tipo').filter(c => c.checked).map(c => c.value);
    try {
      await api('PUT', `/api/atendimentos/${a.id}`, { apenas_encaminhamento: true, encaminhamento_data: dt.iso, encaminhamento_triador: $('#enc-triador').value, encaminhamento_texto: $('#enc-texto').value, encaminhamento_tipos: tipos });
      aviso('Encaminhamento salvo.');
    } catch (err) { aviso(err.message, true); }
  };

  $$('form.semana-corpo').forEach(f => {
    f.onsubmit = async e => {
      e.preventDefault();
      const s = f.dataset.semana;
      const dt = lerCampoData(`data-sem-${s}`);
      if (!dt.valido) { aviso('Data inválida. Use dd/mm/aaaa.', true); return; }
      const triagem = f.querySelector('textarea[name=triagem]').value;
      if (!dt.iso && !triagem.trim()) { aviso('Preencha ao menos a data ou a triagem.', true); return; }
      try { await api('PUT', `/api/atendimentos/${a.id}/evolucoes/${s}`, { data: dt.iso, triador: f.querySelector('input[name=triador]').value, triagem }); aviso(`Semana ${s} salva.`); telaEvolucao(id); }
      catch (err) { aviso(err.message, true); }
    };
  });
  $('#b-status').onclick = async () => {
    await api('PUT', `/api/atendimentos/${a.id}`, { apenas_status: true, status: concluido ? 'em_andamento' : 'concluido' });
    aviso(concluido ? 'Atendimento reaberto.' : 'Atendimento concluído.'); telaEvolucao(id);
  };
  const salvarRetorno = async valor => {
    try { await api('PUT', `/api/atendimentos/${a.id}`, { apenas_retorno: true, proximo_retorno: valor }); aviso(valor ? 'Retorno marcado.' : 'Retorno removido.'); telaEvolucao(id); }
    catch (err) { aviso(err.message, true); }
  };
  $('#b-retorno').onclick = () => { const dt = lerCampoData('retorno'); if (!dt.valido) return aviso('Data inválida. Use dd/mm/aaaa.', true); salvarRetorno(dt.iso); };
  if ($('#b-retorno-limpar')) $('#b-retorno-limpar').onclick = () => salvarRetorno('');
  $('#b-falta').onclick = async () => {
    const dt = lerCampoData('retorno');
    if (!dt.valido) return aviso('Data inválida. Use dd/mm/aaaa.', true);
    if (!confirm(dt.iso ? `Registrar uma falta e reagendar o retorno para ${dataBR(dt.iso)}?` : 'Registrar uma falta? (sem nova data de retorno)')) return;
    try { await api('PUT', `/api/atendimentos/${a.id}`, { apenas_falta: true, proximo_retorno: dt.iso }); aviso('Falta registrada.'); telaEvolucao(id); }
    catch (err) { aviso(err.message, true); }
  };
  if ($('#b-consent')) $('#b-consent').onclick = async () => {
    await api('PUT', `/api/atendimentos/${a.id}`, { paciente_id: a.paciente_id, atendente_id: a.atendente_id, data_inicio: a.data_inicio, respostas: a.respostas, consentimento: true });
    aviso('Termo marcado como assinado.'); telaEvolucao(id);
  };
  if ($('#b-excluir')) $('#b-excluir').onclick = async () => {
    if (prompt('Para confirmar, digite EXCLUIR.') !== 'EXCLUIR') return;
    try { await api('DELETE', `/api/atendimentos/${a.id}`); aviso('Atendimento excluído.'); ir(`/pacientes/${a.paciente_id}`); }
    catch (e) { aviso(e.message, true); }
  };
}

// ---------- Relatório do mês ----------
function mesPorExtenso(mesISO) {
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const [a, m] = mesISO.split('-');
  const nome = nomes[+m - 1] || '';
  return `${nome.charAt(0).toUpperCase() + nome.slice(1)} de ${a}`;
}
async function telaRelatorio() {
  const agora = new Date();
  // lista dos últimos 18 meses para escolher
  const meses = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  let mesSel = meses[0];
  const carregar = async () => {
    const r = await api('GET', '/api/relatorio-mes?mes=' + mesSel);
    const n = r.numeros;
    $('#rel-conteudo').innerHTML = `
      <div class="so-impressao" style="margin-bottom:12px">
        <h2 style="margin:0">${esc(estado.casa.nome || 'Casa Espírita')}</h2>
        <div class="sub" style="margin:0">Relatório de atendimentos — ${esc(mesPorExtenso(r.mes))}</div>
      </div>
      <div class="indicadores">
        <div class="indicador"><b>${n.novos}</b><span>Atendimentos iniciados</span></div>
        <div class="indicador"><b>${n.sessoes}</b><span>Atendimentos realizados (evoluções)</span></div>
        <div class="indicador"><b>${n.concluidos}</b><span>Atendimentos concluídos</span></div>
        <div class="indicador"><b>${n.encaminhamentos}</b><span>Encaminhamentos</span></div>
        <div class="indicador"><b>${n.faltas}</b><span>Faltas registradas</span></div>
        <div class="indicador"><b>${n.pacientes_novos}</b><span>Pacientes novos</span></div>
      </div>
      <div class="cartao"><h3 style="margin-bottom:10px">Atendimentos iniciados em ${esc(mesPorExtenso(r.mes))} (${r.lista.length})</h3>
      ${!r.lista.length ? '<div class="vazio">Nenhum atendimento iniciado neste mês.</div>' :
        `<div class="rolagem"><table class="tabela"><thead><tr><th>Ficha</th><th>Início</th><th>Paciente</th><th>Recepcionado por</th><th>Situação</th></tr></thead><tbody>
        ${r.lista.map(a => `<tr><td>${numeroFicha(a.id)}</td><td>${dataBR(a.data_inicio)}</td><td>${esc(a.paciente)}</td><td>${esc(a.atendente || '')}</td><td>${statusEtiqueta(a)}</td></tr>`).join('')}
        </tbody></table></div>`}
      </div>
      <div class="cartao"><h3 style="margin-bottom:4px">Frequência — pacientes com faltas</h3>
        <p class="sub" style="margin:0 0 10px">Situação atual (todos os atendimentos com falta registrada), para acompanhamento.</p>
      ${!r.faltosos.length ? '<div class="vazio">Nenhuma falta registrada. 👏</div>' :
        `<div class="rolagem"><table class="tabela"><thead><tr><th>Paciente</th><th>Faltas</th><th>Sessões feitas</th><th>Próximo retorno</th><th>Situação</th></tr></thead><tbody>
        ${r.faltosos.map(f => `<tr><td>${esc(f.paciente)}</td><td><span class="etiqueta alerta">${f.faltas}</span></td><td>${f.sessoes}/${N_SEMANAS}</td><td>${f.proximo_retorno ? dataBR(f.proximo_retorno) + ' ' + situacaoRetorno(f.proximo_retorno) : '—'}</td><td>${f.status === 'concluido' ? '<span class="etiqueta cinza">Concluído</span>' : '<span class="etiqueta ok">Em andamento</span>'}</td></tr>`).join('')}
        </tbody></table></div>`}
      </div>`;
  };
  tela(`<div class="cabecalho nao-imprimir"><div><h1>Relatório do mês</h1><p class="sub">Números e lista de atendimentos, para conferência e impressão.</p></div>
    <div class="acoes">
      <select id="rel-mes">${meses.map(m => `<option value="${m}">${esc(mesPorExtenso(m))}</option>`).join('')}</select>
      <button class="primario" id="b-rel-imprimir">Imprimir relatório</button>
    </div></div>
  <div id="rel-conteudo"></div>`);
  $('#rel-mes').onchange = () => { mesSel = $('#rel-mes').value; carregar().catch(e => aviso(e.message, true)); };
  $('#b-rel-imprimir').onclick = () => window.print();
  carregar();
}

// ---------- Manual de uso ----------
function telaManual() {
  tela(`<div class="cabecalho nao-imprimir"><div><h1>Manual de uso</h1><p class="sub">Guia rápido do sistema, em linguagem simples.</p></div>
    <div class="acoes"><button id="b-manual-imprimir" class="primario">Imprimir manual</button></div></div>
  <div class="cartao manual">
    <h2>O que é este sistema</h2>
    <p>Um programa para organizar o <b>atendimento fraterno</b> da casa: cadastrar pacientes e atendentes, preencher a ficha de cada atendimento, imprimir essa ficha e, a cada semana, registrar a evolução. Tudo fica guardado no computador da casa, sem precisar de internet.</p>

    <h2>Primeiro acesso</h2>
    <p>Ao instalar, já existe um administrador padrão:</p>
    <ul><li><b>Usuário:</b> Admin</li><li><b>Senha:</b> 123456</li></ul>
    <p><b>Troque a senha logo no primeiro uso</b>, em "Alterar minha senha" (no rodapé do menu). Depois, em <b>Configurações</b>, preencha o nome e os dados da casa, que saem na ficha impressa.</p>

    <h2>O menu lateral</h2>
    <ul>
      <li><b>Início</b> — resumo do dia e do mês, agenda de retornos e atendimentos em andamento.</li>
      <li><b>A · Cadastros</b> — Pacientes e Atendentes.</li>
      <li><b>B · Pesquisa</b> — encontrar pacientes e atendimentos.</li>
      <li><b>C · Novo atendimento</b> — a ficha de um novo atendimento.</li>
      <li><b>D · Atendimento</b> — lançar a evolução, semana a semana.</li>
      <li><b>E · Relatório do mês</b> — números e listas para conferência e impressão.</li>
      <li><b>Configurações</b> (administrador) — dados da casa, cor do tema, backup, acesso em rede.</li>
    </ul>

    <h2>Como atender um paciente (passo a passo)</h2>
    <ol>
      <li><b>Cadastre o paciente</b> em A · Cadastros › Pacientes › Novo paciente. A idade é calculada sozinha.</li>
      <li><b>Comece o atendimento</b> em C · Novo atendimento: escolha quem está recepcionando, selecione o paciente e responda os passos 1 a 10.</li>
      <li><b>Imprima a ficha</b> clicando em "Salvar e imprimir ficha". Durante os atendimentos, as anotações são feitas à mão na ficha.</li>
      <li><b>Registre a evolução</b> em D · Atendimento: abra o paciente e, a cada semana, preencha data, triador e triagem. Se precisar, use o item 12 (Encaminhamento).</li>
      <li><b>Marque o próximo retorno</b> na tela de Atendimento — ele aparece na agenda do Início. Se o paciente faltar, use "Registrar falta e reagendar".</li>
    </ol>

    <h2>Datas</h2>
    <p>Todas as datas são digitadas no formato <b>dd/mm/aaaa</b> (dia/mês/ano). É só digitar os números que as barras aparecem sozinhas.</p>

    <h2>Lembrete por WhatsApp</h2>
    <p>Na agenda de retornos (tela Início) e na tela de Atendimento, o botão de WhatsApp abre a conversa com o paciente já com a mensagem de lembrete pronta. O texto da mensagem pode ser ajustado em Configurações.</p>

    <h2>Backup (cópia de segurança)</h2>
    <p>O sistema faz uma cópia dos dados automaticamente todos os dias. Em <b>Configurações</b>, escolha uma pasta segura (um pendrive ou pasta do Google Drive/OneDrive). Para recuperar, use "Restaurar um backup" na mesma tela.</p>

    <h2>Esqueci a senha</h2>
    <p>Se houver outro administrador, ele redefine a sua senha em Atendentes. Se você for o único, use o atalho <b>"Recuperar acesso de administrador"</b> no menu Iniciar do Windows (pasta Atendimento Espiritual): ele mostra uma senha temporária.</p>

    <h2>Usar em vários aparelhos</h2>
    <p>O computador onde o sistema está instalado funciona como central e precisa ficar ligado. Outros computadores, tablets e celulares no mesmo Wi-Fi abrem o sistema pelo navegador, digitando o endereço que aparece em Configurações (algo como http://192.168.0.10:3210).</p>

    <h2>Fechar o sistema</h2>
    <p>Clique em <b>Sair</b>, no rodapé do menu: ele encerra o sistema no computador central. Para abrir de novo, use o ícone na área de trabalho.</p>

    <h2>Proteção dos dados (LGPD)</h2>
    <p>A ficha guarda dados sensíveis (saúde, religião). Proteja o computador com senha do Windows, não compartilhe usuários e guarde as fichas impressas em local seguro. O termo de consentimento sai impresso na ficha para assinatura.</p>
  </div>`);
  $('#b-manual-imprimir').onclick = () => window.print();
}

// ---------- Configurações ----------
async function telaConfig() {
  if (!ehAdmin()) return ir('/inicio');
  const c = await api('GET', '/api/config');
  const ultimo = c.ultimo_backup ? new Date(c.ultimo_backup).toLocaleString('pt-BR') : 'nunca';
  tela(`<div class="cabecalho"><div><h1>Configurações</h1><p class="sub">Versão ${esc(c.versao)} · dados guardados em ${esc(c.pasta_dados)}</p></div></div>
  <form class="cartao" id="f-casa"><h2>Dados da casa (aparecem na ficha impressa)</h2>
    <div class="grade">
      <div class="campo largo"><label for="casa_nome">Nome da casa</label><input id="casa_nome" name="casa_nome" type="text" value="${esc(c.casa_nome)}"></div>
      <div class="campo largo"><label for="casa_endereco">Endereço</label><input id="casa_endereco" name="casa_endereco" type="text" value="${esc(c.casa_endereco)}"></div>
      <div class="campo"><label for="casa_telefone">Telefone</label><input id="casa_telefone" name="casa_telefone" type="tel" data-telefone value="${esc(c.casa_telefone)}"></div>
      <div class="campo"><label for="logo">Logotipo</label><input id="logo" type="file" accept="image/png,image/jpeg,image/webp">
        <div style="margin-top:8px;display:flex;gap:10px;align-items:center"><img id="logo-prev" src="${esc(c.casa_logo || '')}" alt="" style="max-height:60px;${c.casa_logo ? '' : 'display:none'}"><button type="button" class="pequeno" id="b-sem-logo" ${c.casa_logo ? '' : 'style="display:none"'}>Remover</button></div></div>
      <div class="campo largo"><label for="termo">Texto do termo de consentimento</label><textarea id="termo" name="termo" rows="5">${esc(c.termo)}</textarea></div>
      <div class="campo largo"><label for="whatsapp_modelo">Mensagem de lembrete por WhatsApp</label><textarea id="whatsapp_modelo" name="whatsapp_modelo" rows="3">${esc(c.whatsapp_modelo)}</textarea>
        <small>Use <code>{paciente}</code>, <code>{casa}</code> e <code>{data}</code> — eles são trocados automaticamente pelo nome do paciente, o nome da casa e a data do retorno.</small></div>
    </div>
    <div class="acoes" style="margin-top:12px"><button class="primario" type="submit">Salvar dados da casa</button></div>
  </form>

  <div class="cartao"><h2>Cor do tema</h2>
    <p class="sub" style="margin-bottom:12px">Escolha a cor principal do sistema para combinar com a casa. Ela aparece no menu lateral e nos botões.</p>
    <div id="paleta" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px"></div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <label class="opcao" style="gap:10px"><input type="color" id="cor-custom" value="${esc(c.cor_tema || '#2f6f73')}" style="width:42px;height:34px;padding:2px;border:1px solid var(--borda);border-radius:8px;cursor:pointer"> Cor personalizada</label>
      <button type="button" id="b-cor-salvar" class="primario">Salvar cor</button>
      <button type="button" id="b-cor-padrao">Voltar ao padrão (verde)</button>
    </div>
  </div>

  <form class="cartao" id="f-backup"><h2>Cópia de segurança (backup)</h2>
    ${c.erro_backup ? `<div class="caixa risco"><b>O último backup falhou:</b> ${esc(c.erro_backup)}<br>Verifique se o pendrive está conectado ou escolha outra pasta.</div>` : ''}
    <p>Último backup: <b>${esc(ultimo)}</b>. O sistema guarda os 30 backups mais recentes.</p>
    <div class="grade">
      <div class="campo largo"><label for="backup_pasta">Pasta onde salvar os backups</label><input id="backup_pasta" name="backup_pasta" type="text" value="${esc(c.backup_pasta)}">
        <small>Dica: use um pendrive (ex.: <code>E:\\Backup Atendimento</code>) ou uma pasta sincronizada com o Google Drive/OneDrive, para não perder os dados se o computador estragar.</small></div>
    </div>
    <label class="opcao" style="margin-top:12px"><input type="checkbox" name="backup_auto" ${c.backup_auto === '1' ? 'checked' : ''}> Fazer backup automático todos os dias</label>
    <div class="acoes" style="margin-top:14px"><button class="primario" type="submit">Salvar</button><button type="button" id="b-backup">Fazer backup agora</button><a class="botao" href="/api/backup/baixar">Baixar uma cópia</a></div>
  </form>

  <div class="cartao"><h2>Restaurar um backup</h2>
    <div class="caixa alerta" style="margin-bottom:14px">Ao restaurar, os dados de hoje são substituídos pelos do backup escolhido. Uma cópia do estado atual é guardada antes, por segurança. O sistema vai <b>fechar</b> para aplicar — abra de novo pelo ícone.</div>
    <div id="lista-backups"><p class="sub">Carregando backups…</p></div>
    <div style="margin-top:14px"><label for="caminho-backup">Ou restaure de um arquivo (ex.: de um pendrive após trocar de computador)</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px"><input id="caminho-backup" type="text" placeholder="E:\\Backup Atendimento\\backup-....db" style="flex:1;min-width:240px"><button type="button" id="b-restaurar-caminho">Restaurar deste arquivo</button></div></div>
  </div>

  <div class="cartao"><h2>Acesso por outros aparelhos</h2>
    <p>Computadores, tablets e celulares conectados ao <b>mesmo Wi-Fi</b> podem abrir o sistema no navegador digitando:</p>
    ${c.rede.length ? `<ul>${c.rede.map(r => `<li><b style="font-size:18px">${esc(r.url)}</b> <span class="sub">(${esc(r.nome)})</span></li>`).join('')}</ul>` : '<p class="sub">Nenhuma rede encontrada neste computador.</p>'}
    <p class="sub" style="margin:0">Este computador precisa estar ligado e com o sistema aberto.</p>
  </div>

  <div class="cartao"><h2>Registro de acessos</h2><p class="sub">Mostra quem consultou ou alterou fichas (exigência de segurança da LGPD).</p>
    <button id="b-audit">Mostrar últimos registros</button><div id="audit" style="margin-top:12px"></div></div>

  <div class="cartao"><h2>Encerrar o sistema</h2><p class="sub">Desliga o sistema neste computador. Para abrir de novo, use o ícone da área de trabalho.</p>
    <button class="perigo" id="b-encerrar">Encerrar sistema</button></div>`);
  ativarMascaraTelefone();

  let logo = c.casa_logo || '';
  $('#logo').onchange = () => {
    const f = $('#logo').files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const esc2 = Math.min(1, 400 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * esc2); cv.height = Math.round(img.height * esc2);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      logo = cv.toDataURL('image/png');
      $('#logo-prev').src = logo; $('#logo-prev').style.display = ''; $('#b-sem-logo').style.display = '';
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  $('#b-sem-logo').onclick = () => { logo = ''; $('#logo-prev').style.display = 'none'; $('#b-sem-logo').style.display = 'none'; };
  $('#f-casa').onsubmit = async e => {
    e.preventDefault();
    try { await api('PUT', '/api/config', { ...dadosFormulario(e.target), casa_logo: logo }); estado = await api('GET', '/api/estado'); aviso('Dados da casa salvos.'); montarLayout(); navegar(); }
    catch (err) { aviso(err.message, true); }
  };
  $('#f-backup').onsubmit = async e => {
    e.preventDefault();
    try { await api('PUT', '/api/config', dadosFormulario(e.target)); aviso('Configuração de backup salva.'); }
    catch (err) { aviso(err.message, true); }
  };
  $('#b-backup').onclick = async () => {
    try { await api('PUT', '/api/config', dadosFormulario($('#f-backup'))); const r = await api('POST', '/api/backup'); aviso('Backup criado: ' + r.arquivo); telaConfig(); }
    catch (err) { aviso(err.message, true); telaConfig(); }
  };
  const telaReiniciar = () => { document.body.innerHTML = '<div class="entrada"><div class="cartao"><h1>Restaurando…</h1><p>O sistema está fechando para aplicar o backup. Abra de novo pelo ícone <b>Atendimento Espiritual</b> na área de trabalho. Seus dados restaurados estarão lá.</p></div></div>'; };
  const restaurar = async corpo => {
    if (!confirm('Tem certeza? Os dados atuais serão substituídos pelos do backup e o sistema vai fechar para aplicar.')) return;
    try { await api('POST', '/api/backup/restaurar', corpo); telaReiniciar(); }
    catch (err) { aviso(err.message, true); }
  };
  const carregarBackups = async () => {
    try {
      const d = await api('GET', '/api/backups');
      $('#lista-backups').innerHTML = !d.arquivos.length ? '<p class="sub">Nenhum backup encontrado na pasta configurada.</p>' :
        `<div class="rolagem"><table class="tabela"><thead><tr><th>Backup</th><th>Data</th><th></th></tr></thead><tbody>
        ${d.arquivos.map(b => `<tr><td>${esc(b.arquivo)}</td><td>${new Date(b.data).toLocaleString('pt-BR')}</td><td><button class="pequeno" data-bkp="${esc(b.arquivo)}">Restaurar</button></td></tr>`).join('')}</tbody></table></div>`;
      $$('#lista-backups button[data-bkp]').forEach(btn => { btn.onclick = () => restaurar({ arquivo: btn.dataset.bkp }); });
    } catch (err) { $('#lista-backups').innerHTML = `<p class="sub">${esc(err.message)}</p>`; }
  };
  carregarBackups();
  $('#b-restaurar-caminho').onclick = () => {
    const caminho = $('#caminho-backup').value.trim();
    if (!caminho) { aviso('Informe o caminho do arquivo de backup.', true); return; }
    restaurar({ caminho });
  };
  // --- tema (cor) ---
  const PRESETS = [['#2f6f73', 'Verde'], ['#1f5fa5', 'Azul'], ['#534ab7', 'Roxo'], ['#0f6e56', 'Verde-mar'], ['#993556', 'Vinho'], ['#993c1d', 'Terracota'], ['#5f5e5a', 'Grafite']];
  $('#paleta').innerHTML = PRESETS.map(([cor, nome]) =>
    `<button type="button" class="pequeno" data-cor="${cor}" title="${nome}" style="background:${cor};color:#fff;border-color:${cor};min-width:92px">${nome}</button>`).join('');
  const previewCor = cor => { aplicarTema(cor); $('#cor-custom').value = cor; };
  $$('#paleta button[data-cor]').forEach(b => { b.onclick = () => previewCor(b.dataset.cor); });
  $('#cor-custom').oninput = () => aplicarTema($('#cor-custom').value);
  const salvarCor = async cor => {
    try {
      await api('PUT', '/api/config', { cor_tema: cor });
      estado = await api('GET', '/api/estado'); aplicarTema(estado.casa.cor);
      aviso('Cor do tema salva.'); montarLayout(); navegar();
    } catch (err) { aviso(err.message, true); }
  };
  $('#b-cor-salvar').onclick = () => salvarCor($('#cor-custom').value);
  $('#b-cor-padrao').onclick = () => salvarCor('');
  $('#b-audit').onclick = async () => {
    const l = await api('GET', '/api/auditoria');
    $('#audit').innerHTML = `<div class="rolagem"><table class="tabela"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>
      ${l.map(x => `<tr><td>${esc(x.quando)}</td><td>${esc(x.nome || '')}</td><td>${esc(x.acao.replace(/_/g, ' '))}</td><td>${esc(x.detalhe)}</td></tr>`).join('')}</tbody></table></div>`;
  };
  $('#b-encerrar').onclick = async () => {
    if (!confirm('Encerrar o sistema? Os outros aparelhos também perderão o acesso até ele ser aberto novamente.')) return;
    await api('POST', '/api/encerrar');
    document.body.innerHTML = '<div class="entrada"><div class="cartao"><h1>Sistema encerrado</h1><p>Pode fechar esta janela. Para abrir de novo, use o ícone <b>Atendimento Espiritual</b> na área de trabalho.</p></div></div>';
  };
}

async function telaSenha() {
  tela(`<div class="cabecalho"><div><h1>Alterar minha senha</h1></div></div>
  <form class="cartao" id="f-senha" style="max-width:460px">
    <div class="campo" style="margin-bottom:12px"><label for="atual">Senha atual</label><input id="atual" name="atual" type="password" required autocomplete="current-password"></div>
    <div class="campo" style="margin-bottom:12px"><label for="nova">Nova senha (mínimo 6 caracteres)</label><input id="nova" name="nova" type="password" required minlength="6" autocomplete="new-password"></div>
    <div class="erro" id="erro"></div>
    <button class="primario" type="submit">Alterar senha</button>
  </form>`);
  $('#f-senha').onsubmit = async e => {
    e.preventDefault();
    try { await api('POST', '/api/minha-senha', dadosFormulario(e.target)); aviso('Senha alterada.'); ir('/inicio'); }
    catch (err) { $('#erro').textContent = err.message; }
  };
}

iniciar().catch(e => { $('#app').innerHTML = `<div class="entrada"><div class="cartao"><h1>Não foi possível abrir</h1><p>${esc(e.message)}</p></div></div>`; });
