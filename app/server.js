'use strict';
/*
 * Sistema de Atendimento Espiritual - servidor local
 * Sem dependências externas: usa apenas módulos nativos do Node.js (http, sqlite, crypto).
 *
 * Copyright (C) 2026  Fredison Campos e colaboradores
 * Repositório: https://github.com/fredisoncampos/atendimento-espiritual
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo
 * sob os termos da Licença Pública Geral Affero GNU (AGPL) versão 3, publicada
 * pela Free Software Foundation. Veja o arquivo LICENSE ou https://www.gnu.org/licenses/.
 * Distribuído na esperança de ser útil, mas SEM NENHUMA GARANTIA.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { exec } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const VERSAO = '1.9.3';

// ---------- Pastas e configuração ----------
const DIR_DADOS = process.env.ATENDIMENTO_DADOS
  || (process.platform === 'win32'
    ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'AtendimentoEspiritual')
    : path.join(__dirname, '..', 'dados'));
fs.mkdirSync(DIR_DADOS, { recursive: true });
const ARQ_DB = path.join(DIR_DADOS, 'atendimento.db');
const ARQ_LOG = path.join(DIR_DADOS, 'sistema.log');
const ARQ_CFG = path.join(DIR_DADOS, 'config.json');
const DIR_PUBLIC = path.join(__dirname, 'public');

let cfgArquivo = { porta: 3210 };
try { cfgArquivo = { ...cfgArquivo, ...JSON.parse(fs.readFileSync(ARQ_CFG, 'utf8')) }; }
catch { fs.writeFileSync(ARQ_CFG, JSON.stringify(cfgArquivo, null, 2)); }
const PORTA = Number(process.env.PORTA || cfgArquivo.porta || 3210);

function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(ARQ_LOG, linha); } catch { /* ignora */ }
  if (process.stdout.isTTY) process.stdout.write(linha);
}

// ---------- Restauração de backup (aplicada antes de abrir o banco) ----------
// Quando o administrador pede para restaurar, o arquivo escolhido é copiado para
// "restaurar.pendente.db" e o sistema reinicia. Aqui, na abertura, aplicamos a troca
// com segurança (o banco ainda não está aberto, então não há risco de corromper).
const ARQ_RESTAURAR = path.join(DIR_DADOS, 'restaurar.pendente.db');
if (fs.existsSync(ARQ_RESTAURAR)) {
  try {
    if (fs.existsSync(ARQ_DB)) {
      const seguranca = path.join(DIR_DADOS, `antes-da-restauracao-${Date.now()}.db`);
      fs.copyFileSync(ARQ_DB, seguranca);
    }
    for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(ARQ_DB + ext); } catch { /* ignora */ } }
    fs.renameSync(ARQ_RESTAURAR, ARQ_DB);
    log('Backup restaurado com sucesso.');
  } catch (e) { log(`Falha ao restaurar backup: ${e.message}`); }
}

// ---------- Banco de dados ----------
const db = new DatabaseSync(ARQ_DB);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS atendentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  usuario TEXT UNIQUE COLLATE NOCASE,
  senha_hash TEXT,
  perfil TEXT NOT NULL DEFAULT 'atendente',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS pacientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  nascimento TEXT,
  estado_civil TEXT,
  endereco TEXT,
  telefone TEXT,
  profissao TEXT,
  religiao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT
);
CREATE TABLE IF NOT EXISTS atendimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  atendente_id INTEGER REFERENCES atendentes(id),
  data_inicio TEXT NOT NULL,
  respostas TEXT NOT NULL DEFAULT '{}',
  consentimento INTEGER NOT NULL DEFAULT 0,
  alerta_risco INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT
);
CREATE TABLE IF NOT EXISTS encaminhamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS evolucoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atendimento_id INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  semana INTEGER NOT NULL CHECK (semana BETWEEN 1 AND 8),
  data TEXT,
  triador TEXT,
  triagem TEXT,
  registrado_por INTEGER REFERENCES atendentes(id),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (atendimento_id, semana)
);
CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  atendente_id INTEGER NOT NULL REFERENCES atendentes(id) ON DELETE CASCADE,
  expira INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quando TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  atendente_id INTEGER,
  acao TEXT NOT NULL,
  detalhe TEXT
);
CREATE INDEX IF NOT EXISTS idx_pac_nome ON pacientes(nome);
CREATE INDEX IF NOT EXISTS idx_at_pac ON atendimentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_at_data ON atendimentos(data_inicio);
`);

// Migração: bancos da v1 limitavam a evolução a 4 semanas. Recria a tabela aceitando 8.
try {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='evolucoes'").get();
  if (sql && /BETWEEN 1 AND 4/.test(sql.sql)) {
    db.exec(`
      ALTER TABLE evolucoes RENAME TO evolucoes_antiga;
      CREATE TABLE evolucoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        atendimento_id INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
        semana INTEGER NOT NULL CHECK (semana BETWEEN 1 AND 8),
        data TEXT, triador TEXT, triagem TEXT,
        registrado_por INTEGER REFERENCES atendentes(id),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        UNIQUE (atendimento_id, semana)
      );
      INSERT INTO evolucoes SELECT * FROM evolucoes_antiga;
      DROP TABLE evolucoes_antiga;
    `);
    log('Banco migrado: evolução agora aceita até 8 semanas.');
  }
} catch (e) { log(`Falha na migração de evolucoes: ${e.message}`); }

// Migração: colunas novas da v1.2 (adicionadas só se ainda não existirem).
function adicionarColuna(tabela, coluna, definicao) {
  try {
    const existe = db.prepare(`SELECT 1 FROM pragma_table_info(?) WHERE name = ?`).get(tabela, coluna);
    if (!existe) { db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`); log(`Coluna ${tabela}.${coluna} adicionada.`); }
  } catch (e) { log(`Falha ao adicionar ${tabela}.${coluna}: ${e.message}`); }
}
adicionarColuna('pacientes', 'observacoes', 'TEXT');
adicionarColuna('atendimentos', 'proximo_retorno', 'TEXT');
adicionarColuna('atendimentos', 'encaminhamento_data', 'TEXT');
adicionarColuna('atendimentos', 'encaminhamento_triador', 'TEXT');
adicionarColuna('atendimentos', 'encaminhamento_texto', 'TEXT');
adicionarColuna('pacientes', 'nome_norm', 'TEXT'); // nome sem acento/minúsculo, para busca
adicionarColuna('atendimentos', 'faltas', 'INTEGER NOT NULL DEFAULT 0');
adicionarColuna('atendimentos', 'encaminhamento_tipos', 'TEXT'); // tipos escolhidos (JSON), item 12

// Administrador padrão na primeira instalação: usuário "Admin", senha "123456".
// A senha deve ser trocada no primeiro uso (há um aviso destacado no sistema).
if (!existeAdmin()) {
  db.prepare("INSERT INTO atendentes (nome, usuario, senha_hash, perfil) VALUES ('Administrador', 'Admin', ?, 'admin')")
    .run(hashSenha('123456'));
  cfgSet('aviso_senha_padrao', '1');
  log('Administrador padrão criado (usuário Admin, senha 123456).');
}

// ---------- Recuperação de acesso (senha do administrador esquecida) ----------
// Uso: node server.js --recuperar [--usuario=NOME]
// Redefine a senha de um administrador para uma senha temporária, impressa na saída.
// É seguro para uso local: quem tem acesso ao computador já poderia abrir o arquivo do banco.
if (process.argv.includes('--recuperar')) {
  const arg = process.argv.find(a => a.startsWith('--usuario=')) || '';
  const usuario = arg.slice('--usuario='.length).trim();
  const admin = usuario
    ? db.prepare("SELECT * FROM atendentes WHERE usuario = ? AND perfil = 'admin'").get(usuario)
    : db.prepare("SELECT * FROM atendentes WHERE perfil = 'admin' AND usuario IS NOT NULL ORDER BY id LIMIT 1").get();
  if (!admin) {
    console.log('ERRO|' + (usuario ? 'Nenhum administrador com o usuário "' + usuario + '".' : 'Nenhum administrador cadastrado neste sistema.'));
    process.exit(2);
  }
  const nova = crypto.randomBytes(4).toString('hex'); // 8 caracteres
  db.prepare('UPDATE atendentes SET senha_hash = ?, ativo = 1 WHERE id = ?').run(hashSenha(nova), admin.id);
  db.prepare('DELETE FROM sessoes WHERE atendente_id = ?').run(admin.id);
  auditar({ id: admin.id }, 'recuperou_senha_admin', 'senha temporária gerada');
  console.log(`OK|${admin.usuario}|${nova}`);
  process.exit(0);
}

const TERMO_PADRAO = 'Declaro que as informações prestadas nesta ficha são verdadeiras e autorizo a Casa a registrá-las e utilizá-las exclusivamente para fins do meu acompanhamento no atendimento espiritual, de forma sigilosa, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Estou ciente de que o atendimento espiritual não substitui tratamento médico ou psicológico e de que posso solicitar, a qualquer momento, a consulta, correção ou exclusão dos meus dados.';

function cfgGet(chave, padrao = '') {
  const r = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave);
  return r ? r.valor : padrao;
}
function cfgSet(chave, valor) {
  db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor')
    .run(chave, valor == null ? '' : String(valor));
}
const CHAVES_CFG = ['casa_nome', 'casa_endereco', 'casa_telefone', 'casa_logo', 'termo', 'backup_pasta', 'backup_auto', 'ultimo_backup', 'cor_tema', 'whatsapp_modelo'];
const WHATSAPP_PADRAO = 'Olá {paciente}, tudo bem? Aqui é da {casa}. Passando para lembrar do seu atendimento espiritual no dia {data}. Que a paz esteja com você. 🙏';
function configCompleta() {
  const c = {};
  for (const k of CHAVES_CFG) c[k] = cfgGet(k);
  if (!c.termo) c.termo = TERMO_PADRAO;
  if (!c.whatsapp_modelo) c.whatsapp_modelo = WHATSAPP_PADRAO;
  if (!c.backup_pasta) c.backup_pasta = path.join(DIR_DADOS, 'backups');
  if (c.backup_auto === '') c.backup_auto = '1';
  return c;
}

function auditar(usuario, acao, detalhe = '') {
  db.prepare('INSERT INTO auditoria (atendente_id, acao, detalhe) VALUES (?, ?, ?)')
    .run(usuario ? usuario.id : null, acao, String(detalhe).slice(0, 500));
}

// ---------- Senhas e sessões ----------
function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(senha, sal, 64);
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`;
}
function conferirSenha(senha, armazenado) {
  if (!armazenado) return false;
  const [, salHex, hHex] = armazenado.split('$');
  const h = crypto.scryptSync(senha, Buffer.from(salHex, 'hex'), 64);
  return crypto.timingSafeEqual(h, Buffer.from(hHex, 'hex'));
}
const DURACAO_SESSAO = 12 * 60 * 60 * 1000;
function criarSessao(atendenteId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessoes (token, atendente_id, expira) VALUES (?, ?, ?)').run(token, atendenteId, Date.now() + DURACAO_SESSAO);
  return token;
}
function lerCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function usuarioDaRequisicao(req) {
  const token = lerCookies(req).sessao;
  if (!token) return null;
  const r = db.prepare(`SELECT a.id, a.nome, a.usuario, a.perfil, s.expira FROM sessoes s
    JOIN atendentes a ON a.id = s.atendente_id WHERE s.token = ? AND a.ativo = 1`).get(token);
  if (!r || r.expira < Date.now()) return null;
  db.prepare('UPDATE sessoes SET expira = ? WHERE token = ?').run(Date.now() + DURACAO_SESSAO, token);
  return { id: r.id, nome: r.nome, usuario: r.usuario, perfil: r.perfil, token };
}
const tentativas = new Map(); // proteção simples contra tentativa de senha
function bloqueado(chave) {
  const t = tentativas.get(chave);
  return t && t.n >= 5 && Date.now() - t.ultima < 60_000;
}
function registrarFalha(chave) {
  const t = tentativas.get(chave) || { n: 0, ultima: 0 };
  if (Date.now() - t.ultima > 60_000) t.n = 0;
  t.n++; t.ultima = Date.now();
  tentativas.set(chave, t);
}

// ---------- Backup ----------
function nomeBackup() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.db`;
}
function fazerBackup(pastaDestino) {
  const pasta = pastaDestino || configCompleta().backup_pasta;
  fs.mkdirSync(pasta, { recursive: true });
  const destino = path.join(pasta, nomeBackup());
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  // mantém somente os 30 backups mais recentes
  const antigos = fs.readdirSync(pasta).filter(f => /^backup-.*\.db$/.test(f)).sort().reverse().slice(30);
  for (const f of antigos) { try { fs.unlinkSync(path.join(pasta, f)); } catch { /* ignora */ } }
  cfgSet('ultimo_backup', new Date().toISOString());
  log(`Backup criado: ${destino}`);
  return destino;
}
function backupAutomatico() {
  try {
    const c = configCompleta();
    if (c.backup_auto !== '1') return;
    if (!existeAdmin()) return; // não faz backup de instalação ainda vazia
    const ultimo = c.ultimo_backup ? new Date(c.ultimo_backup) : null;
    const hoje = new Date().toDateString();
    if (!ultimo || ultimo.toDateString() !== hoje) fazerBackup();
  } catch (e) {
    log(`Falha no backup automático: ${e.message}`);
    cfgSet('erro_backup', `${new Date().toISOString()} - ${e.message}`);
  }
}

// ---------- Utilidades HTTP ----------
function enviarJSON(res, status, dados, extraHeaders = {}) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(corpo);
}
class ErroHttp extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const falha = (status, msg) => { throw new ErroHttp(status, msg); };

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0; const partes = [];
    req.on('data', c => {
      tamanho += c.length;
      if (tamanho > 5 * 1024 * 1024) { reject(new ErroHttp(413, 'Conteúdo muito grande')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      if (!partes.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8'))); }
      catch { reject(new ErroHttp(400, 'Dados inválidos')); }
    });
    req.on('error', reject);
  });
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function servirEstatico(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const arq = path.normalize(path.join(DIR_PUBLIC, rel));
  if (!arq.startsWith(DIR_PUBLIC)) { res.writeHead(403); return res.end(); }
  // 'no-store' garante que, após atualizar o sistema, todos os aparelhos carreguem
  // a versão nova (sem ficar com a tela antiga em cache).
  fs.readFile(arq, (err, dados) => {
    if (err) {
      // rotas da interface caem no index.html
      return fs.readFile(path.join(DIR_PUBLIC, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); return res.end('Não encontrado'); }
        res.writeHead(200, { 'Content-Type': TIPOS['.html'], 'Cache-Control': 'no-store' }); res.end(html);
      });
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
}

const txt = (v, max = 2000) => (v == null ? '' : String(v).trim().slice(0, max));
// Remove acentos e deixa minúsculo, para buscar "jose" e achar "José".
const normalizar = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const soDigitos = v => String(v || '').replace(/\D/g, '');
const dataISO = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
// Preenche nome_norm dos pacientes cadastrados antes desta versão.
try {
  const faltando = db.prepare("SELECT id, nome FROM pacientes WHERE nome_norm IS NULL OR nome_norm = ''").all();
  if (faltando.length) {
    const up = db.prepare('UPDATE pacientes SET nome_norm = ? WHERE id = ?');
    for (const p of faltando) up.run(normalizar(p.nome), p.id);
    log(`nome_norm preenchido para ${faltando.length} paciente(s).`);
  }
} catch (e) { log(`Falha ao preencher nome_norm: ${e.message}`); }
const hojeISO = () => {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
function enderecosRede() {
  const lista = [];
  for (const [nome, ifs] of Object.entries(os.networkInterfaces())) {
    for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) lista.push({ nome, url: `http://${i.address}:${PORTA}` });
  }
  return lista;
}

// ---------- Rotas da API ----------
const rotas = [];
const rota = (metodo, padrao, opcoes, fn) => rotas.push({ metodo, padrao, ...opcoes, fn });
const PUBLICA = { publica: true };
const LOGADO = {};
const ADMIN = { admin: true };

function existeAdmin() {
  return !!db.prepare("SELECT 1 FROM atendentes WHERE perfil = 'admin' AND usuario IS NOT NULL").get();
}

rota('GET', /^\/api\/estado$/, PUBLICA, ({ usuario }) => {
  const c = configCompleta();
  return {
    versao: VERSAO, configurado: existeAdmin(),
    usuario: usuario ? { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil } : null,
    casa: { nome: c.casa_nome, logo: c.casa_logo, cor: c.cor_tema, whatsapp_modelo: c.whatsapp_modelo },
    aviso_senha_padrao: cfgGet('aviso_senha_padrao') === '1',
  };
});

rota('POST', /^\/api\/setup$/, PUBLICA, ({ corpo, res }) => {
  if (existeAdmin()) falha(400, 'O sistema já foi configurado.');
  const nome = txt(corpo.nome, 200), usuario = txt(corpo.usuario, 60), senha = String(corpo.senha || '');
  if (!txt(corpo.casa_nome)) falha(400, 'Informe o nome da casa.');
  if (!nome || !usuario) falha(400, 'Informe seu nome e um usuário.');
  if (senha.length < 6) falha(400, 'A senha deve ter pelo menos 6 caracteres.');
  cfgSet('casa_nome', txt(corpo.casa_nome, 200));
  const r = db.prepare("INSERT INTO atendentes (nome, whatsapp, usuario, senha_hash, perfil) VALUES (?, ?, ?, ?, 'admin')")
    .run(nome, txt(corpo.whatsapp, 30), usuario, hashSenha(senha));
  const token = criarSessao(r.lastInsertRowid);
  auditar({ id: r.lastInsertRowid }, 'configuracao_inicial');
  res.setHeader('Set-Cookie', `sessao=${token}; HttpOnly; SameSite=Strict; Path=/`);
  return { ok: true };
});

rota('POST', /^\/api\/login$/, PUBLICA, ({ corpo, res, req }) => {
  const chave = (req.socket.remoteAddress || '') + '|' + txt(corpo.usuario).toLowerCase();
  if (bloqueado(chave)) falha(429, 'Muitas tentativas. Aguarde um minuto e tente novamente.');
  const a = db.prepare('SELECT * FROM atendentes WHERE usuario = ? AND ativo = 1').get(txt(corpo.usuario));
  if (!a || !conferirSenha(String(corpo.senha || ''), a.senha_hash)) {
    registrarFalha(chave);
    falha(401, 'Usuário ou senha incorretos.');
  }
  tentativas.delete(chave);
  const token = criarSessao(a.id);
  auditar(a, 'login');
  res.setHeader('Set-Cookie', `sessao=${token}; HttpOnly; SameSite=Strict; Path=/`);
  return { ok: true };
});

rota('POST', /^\/api\/logout$/, LOGADO, ({ usuario, res }) => {
  db.prepare('DELETE FROM sessoes WHERE token = ?').run(usuario.token);
  res.setHeader('Set-Cookie', 'sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  return { ok: true };
});

// Sair e encerrar: o botão Sair sai da conta E desliga o sistema neste computador.
rota('POST', /^\/api\/sair$/, LOGADO, ({ usuario, res }) => {
  db.prepare('DELETE FROM sessoes WHERE token = ?').run(usuario.token);
  res.setHeader('Set-Cookie', 'sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  auditar(usuario, 'saiu_e_encerrou');
  setTimeout(() => { log('Sistema encerrado pelo botão Sair.'); process.exit(0); }, 300);
  return { ok: true };
});

rota('POST', /^\/api\/minha-senha$/, LOGADO, ({ usuario, corpo }) => {
  const a = db.prepare('SELECT senha_hash FROM atendentes WHERE id = ?').get(usuario.id);
  if (!conferirSenha(String(corpo.atual || ''), a.senha_hash)) falha(400, 'Senha atual incorreta.');
  if (String(corpo.nova || '').length < 6) falha(400, 'A nova senha deve ter pelo menos 6 caracteres.');
  db.prepare('UPDATE atendentes SET senha_hash = ? WHERE id = ?').run(hashSenha(String(corpo.nova)), usuario.id);
  if (usuario.perfil === 'admin') cfgSet('aviso_senha_padrao', '0');
  auditar(usuario, 'alterou_propria_senha');
  return { ok: true };
});

// --- Configurações ---
rota('GET', /^\/api\/config$/, LOGADO, ({ usuario }) => {
  const c = configCompleta();
  const base = { casa_nome: c.casa_nome, casa_endereco: c.casa_endereco, casa_telefone: c.casa_telefone, casa_logo: c.casa_logo, termo: c.termo };
  if (usuario.perfil !== 'admin') return base;
  return { ...c, erro_backup: cfgGet('erro_backup'), pasta_dados: DIR_DADOS, rede: enderecosRede(), versao: VERSAO, porta: PORTA };
});
rota('PUT', /^\/api\/config$/, ADMIN, ({ usuario, corpo }) => {
  for (const k of ['casa_nome', 'casa_endereco', 'casa_telefone', 'termo', 'backup_pasta', 'whatsapp_modelo']) if (k in corpo) cfgSet(k, txt(corpo[k], 5000));
  if ('cor_tema' in corpo) {
    const cor = txt(corpo.cor_tema, 7);
    if (cor && !/^#[0-9a-fA-F]{6}$/.test(cor)) falha(400, 'Cor inválida.');
    cfgSet('cor_tema', cor);
  }
  if ('backup_auto' in corpo) cfgSet('backup_auto', corpo.backup_auto ? '1' : '0');
  if ('casa_logo' in corpo) {
    const logo = String(corpo.casa_logo || '');
    if (logo && !/^data:image\/(png|jpeg|webp);base64,/.test(logo)) falha(400, 'Imagem inválida.');
    cfgSet('casa_logo', logo.slice(0, 1_500_000));
  }
  auditar(usuario, 'alterou_configuracoes');
  return { ok: true };
});
rota('POST', /^\/api\/backup$/, ADMIN, ({ usuario }) => {
  try {
    const destino = fazerBackup();
    cfgSet('erro_backup', '');
    auditar(usuario, 'backup_manual', destino);
    return { ok: true, arquivo: destino };
  } catch (e) {
    cfgSet('erro_backup', `${new Date().toISOString()} - ${e.message}`);
    falha(500, 'Não foi possível criar o backup nesta pasta: ' + e.message);
  }
});
rota('GET', /^\/api\/backup\/baixar$/, ADMIN, ({ usuario, res }) => {
  const tmp = path.join(os.tmpdir(), `atendimento-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  auditar(usuario, 'download_backup');
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${nomeBackup()}"` });
  fs.createReadStream(tmp).on('close', () => fs.unlink(tmp, () => {})).pipe(res);
  return null;
});
rota('GET', /^\/api\/backups$/, ADMIN, () => {
  const pasta = configCompleta().backup_pasta;
  let arquivos = [];
  try {
    arquivos = fs.readdirSync(pasta).filter(f => /^backup-.*\.db$/.test(f)).map(f => {
      const st = fs.statSync(path.join(pasta, f));
      return { arquivo: f, tamanho: st.size, data: st.mtime.toISOString() };
    }).sort((a, b) => b.arquivo.localeCompare(a.arquivo));
  } catch { /* pasta ainda não existe */ }
  return { pasta, arquivos };
});
// Restaura um backup. Por segurança, o arquivo escolhido é validado, copiado para
// "restaurar.pendente.db" e aplicado no próximo início — então o sistema reinicia.
rota('POST', /^\/api\/backup\/restaurar$/, ADMIN, ({ usuario, corpo }) => {
  let origem;
  if (corpo.arquivo) {
    const nome = path.basename(String(corpo.arquivo));
    if (!/^backup-.*\.db$/.test(nome)) falha(400, 'Nome de backup inválido.');
    origem = path.join(configCompleta().backup_pasta, nome);
  } else if (corpo.caminho) {
    origem = String(corpo.caminho).trim();
  } else falha(400, 'Escolha um backup para restaurar.');
  if (!fs.existsSync(origem)) falha(404, 'Arquivo de backup não encontrado.');
  // valida que é um banco deste sistema (precisa ter a tabela pacientes)
  try {
    const teste = new DatabaseSync(origem, { readOnly: true });
    const ok = teste.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='pacientes'").get();
    teste.close();
    if (!ok) falha(400, 'Este arquivo não parece um backup do sistema.');
  } catch (e) {
    if (e instanceof ErroHttp) throw e;
    falha(400, 'Arquivo inválido ou danificado: ' + e.message);
  }
  fs.copyFileSync(origem, ARQ_RESTAURAR);
  auditar(usuario, 'restaurou_backup', origem);
  log(`Restauração agendada a partir de: ${origem}`);
  setTimeout(() => { log('Reiniciando para aplicar a restauração.'); process.exit(0); }, 400);
  return { ok: true };
});
rota('GET', /^\/api\/auditoria$/, ADMIN, () =>
  db.prepare(`SELECT au.quando, au.acao, au.detalhe, a.nome FROM auditoria au LEFT JOIN atendentes a ON a.id = au.atendente_id ORDER BY au.id DESC LIMIT 300`).all());
rota('POST', /^\/api\/encerrar$/, ADMIN, ({ usuario }) => {
  auditar(usuario, 'encerrou_sistema');
  setTimeout(() => { log('Sistema encerrado pelo administrador.'); process.exit(0); }, 300);
  return { ok: true };
});

// --- Atendentes ---
const camposAtendente = 'id, nome, whatsapp, usuario, perfil, ativo, criado_em';
rota('GET', /^\/api\/atendentes$/, LOGADO, () =>
  db.prepare(`SELECT ${camposAtendente} FROM atendentes ORDER BY ativo DESC, nome COLLATE NOCASE`).all());
function salvarAtendente(id, corpo, usuario) {
  const nome = txt(corpo.nome, 200);
  if (!nome) falha(400, 'Informe o nome completo.');
  const acesso = !!corpo.acesso;
  const login = acesso ? txt(corpo.usuario, 60) : null;
  const perfil = corpo.perfil === 'admin' ? 'admin' : 'atendente';
  const senha = String(corpo.senha || '');
  if (acesso && !login) falha(400, 'Informe o usuário de acesso.');
  if (login && db.prepare('SELECT 1 FROM atendentes WHERE usuario = ? AND id != ?').get(login, id || 0)) falha(400, 'Este usuário já está em uso.');
  if (acesso && senha && senha.length < 6) falha(400, 'A senha deve ter pelo menos 6 caracteres.');
  const ativo = corpo.ativo === false ? 0 : 1;
  if (id) {
    const atual = db.prepare('SELECT * FROM atendentes WHERE id = ?').get(id) || falha(404, 'Atendente não encontrado.');
    if (acesso && !senha && !atual.senha_hash) falha(400, 'Defina uma senha para o acesso.');
    if (id === usuario.id && (perfil !== 'admin' || !ativo || !acesso)) falha(400, 'Você não pode remover o seu próprio acesso de administrador.');
    const hash = !acesso ? null : (senha ? hashSenha(senha) : atual.senha_hash);
    db.prepare('UPDATE atendentes SET nome=?, whatsapp=?, usuario=?, senha_hash=?, perfil=?, ativo=? WHERE id=?')
      .run(nome, txt(corpo.whatsapp, 30), login, hash, perfil, ativo, id);
    if (senha && perfil === 'admin') cfgSet('aviso_senha_padrao', '0'); // trocou a senha do admin
    if (!ativo || !acesso) db.prepare('DELETE FROM sessoes WHERE atendente_id = ?').run(id);
    auditar(usuario, 'alterou_atendente', `#${id} ${nome}`);
    return { id };
  }
  if (acesso && !senha) falha(400, 'Defina uma senha para o acesso.');
  const r = db.prepare('INSERT INTO atendentes (nome, whatsapp, usuario, senha_hash, perfil, ativo) VALUES (?,?,?,?,?,?)')
    .run(nome, txt(corpo.whatsapp, 30), login, acesso ? hashSenha(senha) : null, perfil, ativo);
  auditar(usuario, 'cadastrou_atendente', `#${r.lastInsertRowid} ${nome}`);
  return { id: Number(r.lastInsertRowid) };
}
rota('POST', /^\/api\/atendentes$/, ADMIN, ({ corpo, usuario }) => salvarAtendente(null, corpo, usuario));
rota('PUT', /^\/api\/atendentes\/(\d+)$/, ADMIN, ({ corpo, usuario, m }) => salvarAtendente(Number(m[1]), corpo, usuario));

// --- Encaminhamentos (tipos: Cromoterapia, Reiki, etc.) ---
rota('GET', /^\/api\/encaminhamentos$/, LOGADO, ({ url }) => {
  const todos = url.searchParams.get('todos') === '1';
  return db.prepare(`SELECT id, nome, ativo FROM encaminhamentos ${todos ? '' : 'WHERE ativo = 1'} ORDER BY ativo DESC, nome COLLATE NOCASE`).all();
});
rota('POST', /^\/api\/encaminhamentos$/, ADMIN, ({ corpo, usuario }) => {
  const nome = txt(corpo.nome, 120);
  if (!nome) falha(400, 'Informe o nome do encaminhamento.');
  if (db.prepare('SELECT 1 FROM encaminhamentos WHERE nome = ? COLLATE NOCASE').get(nome)) falha(400, 'Já existe um encaminhamento com esse nome.');
  const r = db.prepare('INSERT INTO encaminhamentos (nome) VALUES (?)').run(nome);
  auditar(usuario, 'cadastrou_encaminhamento', nome);
  return { id: Number(r.lastInsertRowid) };
});
rota('PUT', /^\/api\/encaminhamentos\/(\d+)$/, ADMIN, ({ corpo, usuario, m }) => {
  const nome = txt(corpo.nome, 120);
  if (!nome) falha(400, 'Informe o nome do encaminhamento.');
  const r = db.prepare('UPDATE encaminhamentos SET nome = ?, ativo = ? WHERE id = ?').run(nome, corpo.ativo === false ? 0 : 1, Number(m[1]));
  if (!r.changes) falha(404, 'Encaminhamento não encontrado.');
  auditar(usuario, 'alterou_encaminhamento', `#${m[1]} ${nome}`);
  return { id: Number(m[1]) };
});

// --- Pacientes ---
function dadosPaciente(corpo) {
  const p = {
    nome: txt(corpo.nome, 200), nascimento: dataISO(corpo.nascimento), estado_civil: txt(corpo.estado_civil, 40),
    endereco: txt(corpo.endereco, 400), telefone: txt(corpo.telefone, 30), profissao: txt(corpo.profissao, 120), religiao: txt(corpo.religiao, 120),
    observacoes: txt(corpo.observacoes, 5000),
  };
  if (!p.nome) falha(400, 'Informe o nome do paciente.');
  p.nome_norm = normalizar(p.nome);
  return p;
}
// Procura pacientes parecidos (mesmo nome sem acento, ou mesmo telefone).
function pacientesParecidos(p, ignorarId = 0) {
  const tel = soDigitos(p.telefone);
  return db.prepare(`SELECT id, nome, telefone, nascimento FROM pacientes
    WHERE id != :id AND ( nome_norm = :nn
      OR (:tel != '' AND length(:tel) >= 8 AND replace(replace(replace(replace(replace(telefone,'(',''),')',''),'-',''),' ',''),'.','') = :tel) )
    LIMIT 10`).all({ id: ignorarId, nn: p.nome_norm, tel });
}
rota('GET', /^\/api\/pacientes$/, LOGADO, ({ url }) => {
  const q = txt(url.searchParams.get('q'), 100);
  const qn = normalizar(q); // busca sem acento e sem diferenciar maiúsculas
  const digitos = soDigitos(q);
  return db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM atendimentos a WHERE a.paciente_id = p.id) AS total_atendimentos,
      (SELECT MAX(data_inicio) FROM atendimentos a WHERE a.paciente_id = p.id) AS ultimo_atendimento
    FROM pacientes p
    WHERE (:qn = '' OR p.nome_norm LIKE '%' || :qn || '%' OR (:d != '' AND replace(replace(replace(replace(replace(p.telefone,'(',''),')',''),'-',''),' ',''),'.','') LIKE '%' || :d || '%'))
    ORDER BY p.nome COLLATE NOCASE LIMIT 500`).all({ qn, d: digitos });
});
rota('GET', /^\/api\/pacientes\/(\d+)$/, LOGADO, ({ m, usuario }) => {
  const p = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(Number(m[1])) || falha(404, 'Paciente não encontrado.');
  p.atendimentos = db.prepare(`SELECT a.id, a.data_inicio, a.status, a.alerta_risco, at.nome AS atendente,
      (SELECT COUNT(*) FROM evolucoes e WHERE e.atendimento_id = a.id AND (e.data != '' OR e.triagem != '')) AS semanas
    FROM atendimentos a LEFT JOIN atendentes at ON at.id = a.atendente_id WHERE a.paciente_id = ? ORDER BY a.data_inicio DESC, a.id DESC`).all(p.id);
  auditar(usuario, 'visualizou_paciente', `#${p.id}`);
  return p;
});
rota('POST', /^\/api\/pacientes$/, LOGADO, ({ corpo, usuario }) => {
  const p = dadosPaciente(corpo);
  // Avisa sobre paciente parecido (mesmo nome ou telefone), a menos que já tenha confirmado.
  if (!corpo.confirmar_duplicado) {
    const dup = pacientesParecidos(p);
    if (dup.length) return { duplicado: true, duplicados: dup };
  }
  const r = db.prepare(`INSERT INTO pacientes (nome, nascimento, estado_civil, endereco, telefone, profissao, religiao, observacoes, nome_norm)
    VALUES (:nome, :nascimento, :estado_civil, :endereco, :telefone, :profissao, :religiao, :observacoes, :nome_norm)`).run(p);
  auditar(usuario, 'cadastrou_paciente', `#${r.lastInsertRowid}`);
  return { id: Number(r.lastInsertRowid) };
});
rota('PUT', /^\/api\/pacientes\/(\d+)$/, LOGADO, ({ corpo, usuario, m }) => {
  const p = dadosPaciente(corpo);
  const r = db.prepare(`UPDATE pacientes SET nome=:nome, nascimento=:nascimento, estado_civil=:estado_civil, endereco=:endereco,
    telefone=:telefone, profissao=:profissao, religiao=:religiao, observacoes=:observacoes, nome_norm=:nome_norm, atualizado_em=datetime('now','localtime') WHERE id=:id`).run({ ...p, id: Number(m[1]) });
  if (!r.changes) falha(404, 'Paciente não encontrado.');
  auditar(usuario, 'alterou_paciente', `#${m[1]}`);
  return { id: Number(m[1]) };
});
rota('DELETE', /^\/api\/pacientes\/(\d+)$/, ADMIN, ({ usuario, m }) => {
  const r = db.prepare('DELETE FROM pacientes WHERE id = ?').run(Number(m[1]));
  if (!r.changes) falha(404, 'Paciente não encontrado.');
  auditar(usuario, 'excluiu_paciente', `#${m[1]} (e todos os seus atendimentos)`);
  return { ok: true };
});

// --- Atendimentos ---
function dadosAtendimento(corpo) {
  const respostas = corpo.respostas && typeof corpo.respostas === 'object' ? corpo.respostas : {};
  const json = JSON.stringify(respostas);
  if (json.length > 100_000) falha(400, 'Respostas muito longas.');
  const pacienteId = Number(corpo.paciente_id);
  if (!pacienteId || !db.prepare('SELECT 1 FROM pacientes WHERE id = ?').get(pacienteId)) falha(400, 'Selecione o paciente.');
  const atendenteId = Number(corpo.atendente_id);
  if (!atendenteId || !db.prepare('SELECT 1 FROM atendentes WHERE id = ?').get(atendenteId)) falha(400, 'Selecione quem está recepcionando.');
  return {
    paciente_id: pacienteId, atendente_id: atendenteId,
    data_inicio: dataISO(corpo.data_inicio) || hojeISO(),
    respostas: json, consentimento: corpo.consentimento ? 1 : 0,
    alerta_risco: respostas.pensamentos_morte === 'sim' ? 1 : 0,
    proximo_retorno: dataISO(corpo.proximo_retorno),
  };
}
rota('GET', /^\/api\/atendimentos$/, LOGADO, ({ url }) => {
  const sp = url.searchParams;
  const f = {
    q: txt(sp.get('q'), 100), de: dataISO(sp.get('de')), ate: dataISO(sp.get('ate')),
    atendente: Number(sp.get('atendente')) || 0, status: txt(sp.get('status'), 20),
  };
  return db.prepare(`SELECT a.id, a.data_inicio, a.status, a.alerta_risco, a.paciente_id, a.proximo_retorno, a.encaminhamento_tipos, p.nome AS paciente, p.telefone, at.nome AS atendente,
      (SELECT COUNT(*) FROM evolucoes e WHERE e.atendimento_id = a.id AND (e.data != '' OR e.triagem != '')) AS semanas
    FROM atendimentos a JOIN pacientes p ON p.id = a.paciente_id LEFT JOIN atendentes at ON at.id = a.atendente_id
    WHERE (:q = '' OR p.nome LIKE '%' || :q || '%')
      AND (:de = '' OR a.data_inicio >= :de) AND (:ate = '' OR a.data_inicio <= :ate)
      AND (:atendente = 0 OR a.atendente_id = :atendente) AND (:status = '' OR a.status = :status)
    ORDER BY a.data_inicio DESC, a.id DESC LIMIT 500`).all(f);
});
rota('GET', /^\/api\/atendimentos\/(\d+)$/, LOGADO, ({ m, usuario }) => {
  const a = db.prepare(`SELECT a.*, at.nome AS atendente_nome, at.whatsapp AS atendente_whatsapp FROM atendimentos a
    LEFT JOIN atendentes at ON at.id = a.atendente_id WHERE a.id = ?`).get(Number(m[1])) || falha(404, 'Atendimento não encontrado.');
  a.respostas = JSON.parse(a.respostas || '{}');
  try { a.encaminhamento_tipos = JSON.parse(a.encaminhamento_tipos || '[]'); } catch { a.encaminhamento_tipos = []; }
  a.paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(a.paciente_id);
  a.evolucoes = db.prepare(`SELECT e.semana, e.data, e.triador, e.triagem, e.atualizado_em, at.nome AS registrado_por
    FROM evolucoes e LEFT JOIN atendentes at ON at.id = e.registrado_por WHERE e.atendimento_id = ? ORDER BY e.semana`).all(a.id);
  auditar(usuario, 'visualizou_atendimento', `#${a.id}`);
  return a;
});
rota('POST', /^\/api\/atendimentos$/, LOGADO, ({ corpo, usuario }) => {
  const d = dadosAtendimento(corpo);
  const r = db.prepare(`INSERT INTO atendimentos (paciente_id, atendente_id, data_inicio, respostas, consentimento, alerta_risco, proximo_retorno)
    VALUES (:paciente_id, :atendente_id, :data_inicio, :respostas, :consentimento, :alerta_risco, :proximo_retorno)`).run(d);
  auditar(usuario, 'novo_atendimento', `#${r.lastInsertRowid}`);
  return { id: Number(r.lastInsertRowid) };
});
rota('PUT', /^\/api\/atendimentos\/(\d+)$/, LOGADO, ({ corpo, usuario, m }) => {
  const id = Number(m[1]);
  if (corpo.apenas_status) {
    const st = corpo.status === 'concluido' ? 'concluido' : 'em_andamento';
    const r = db.prepare("UPDATE atendimentos SET status = ?, atualizado_em = datetime('now','localtime') WHERE id = ?").run(st, id);
    if (!r.changes) falha(404, 'Atendimento não encontrado.');
    auditar(usuario, st === 'concluido' ? 'concluiu_atendimento' : 'reabriu_atendimento', `#${id}`);
    return { id };
  }
  if (corpo.apenas_retorno !== undefined) {
    const r = db.prepare("UPDATE atendimentos SET proximo_retorno = ?, atualizado_em = datetime('now','localtime') WHERE id = ?").run(dataISO(corpo.proximo_retorno), id);
    if (!r.changes) falha(404, 'Atendimento não encontrado.');
    auditar(usuario, 'marcou_retorno', `#${id} ${dataISO(corpo.proximo_retorno) || '(limpo)'}`);
    return { id };
  }
  if (corpo.apenas_falta) {
    const r = db.prepare("UPDATE atendimentos SET faltas = faltas + 1, proximo_retorno = ?, atualizado_em = datetime('now','localtime') WHERE id = ?")
      .run(dataISO(corpo.proximo_retorno), id);
    if (!r.changes) falha(404, 'Atendimento não encontrado.');
    auditar(usuario, 'registrou_falta', `#${id}`);
    return { id };
  }
  if (corpo.apenas_encaminhamento) {
    const tipos = Array.isArray(corpo.encaminhamento_tipos)
      ? JSON.stringify(corpo.encaminhamento_tipos.map(t => txt(t, 120)).filter(Boolean).slice(0, 30)) : '[]';
    const r = db.prepare("UPDATE atendimentos SET encaminhamento_data = ?, encaminhamento_triador = ?, encaminhamento_texto = ?, encaminhamento_tipos = ?, atualizado_em = datetime('now','localtime') WHERE id = ?")
      .run(dataISO(corpo.encaminhamento_data), txt(corpo.encaminhamento_triador, 200), txt(corpo.encaminhamento_texto, 10000), tipos, id);
    if (!r.changes) falha(404, 'Atendimento não encontrado.');
    auditar(usuario, 'registrou_encaminhamento', `#${id}`);
    return { id };
  }
  // proximo_retorno não entra aqui de propósito: é controlado na tela de atendimento,
  // para não ser apagado quando a ficha inicial é editada.
  const { proximo_retorno, ...d } = dadosAtendimento(corpo);
  const r = db.prepare(`UPDATE atendimentos SET paciente_id=:paciente_id, atendente_id=:atendente_id, data_inicio=:data_inicio, respostas=:respostas,
    consentimento=:consentimento, alerta_risco=:alerta_risco, atualizado_em=datetime('now','localtime') WHERE id=:id`).run({ ...d, id });
  if (!r.changes) falha(404, 'Atendimento não encontrado.');
  auditar(usuario, 'alterou_atendimento', `#${id}`);
  return { id };
});
rota('DELETE', /^\/api\/atendimentos\/(\d+)$/, ADMIN, ({ usuario, m }) => {
  const r = db.prepare('DELETE FROM atendimentos WHERE id = ?').run(Number(m[1]));
  if (!r.changes) falha(404, 'Atendimento não encontrado.');
  auditar(usuario, 'excluiu_atendimento', `#${m[1]}`);
  return { ok: true };
});
rota('PUT', /^\/api\/atendimentos\/(\d+)\/evolucoes\/([1-8])$/, LOGADO, ({ corpo, usuario, m }) => {
  const id = Number(m[1]), semana = Number(m[2]);
  if (!db.prepare('SELECT 1 FROM atendimentos WHERE id = ?').get(id)) falha(404, 'Atendimento não encontrado.');
  const dados = { id, semana, data: dataISO(corpo.data), triador: txt(corpo.triador, 200), triagem: txt(corpo.triagem, 10000), por: usuario.id };
  db.prepare(`INSERT INTO evolucoes (atendimento_id, semana, data, triador, triagem, registrado_por)
    VALUES (:id, :semana, :data, :triador, :triagem, :por)
    ON CONFLICT(atendimento_id, semana) DO UPDATE SET data=excluded.data, triador=excluded.triador, triagem=excluded.triagem,
      registrado_por=excluded.registrado_por, atualizado_em=datetime('now','localtime')`).run(dados);
  db.prepare("UPDATE atendimentos SET atualizado_em = datetime('now','localtime') WHERE id = ?").run(id);
  auditar(usuario, 'registrou_evolucao', `#${id} semana ${semana}`);
  return { ok: true };
});

rota('GET', /^\/api\/resumo$/, LOGADO, () => {
  const hoje = hojeISO();
  const mes = hoje.slice(0, 7); // AAAA-MM
  return {
    pacientes: db.prepare('SELECT COUNT(*) n FROM pacientes').get().n,
    em_andamento: db.prepare("SELECT COUNT(*) n FROM atendimentos WHERE status = 'em_andamento'").get().n,
    hoje: db.prepare('SELECT COUNT(*) n FROM atendimentos WHERE data_inicio = ?').get(hoje).n,
    alertas: db.prepare("SELECT COUNT(*) n FROM atendimentos WHERE status = 'em_andamento' AND alerta_risco = 1").get().n,
    mes_novos: db.prepare("SELECT COUNT(*) n FROM atendimentos WHERE substr(data_inicio,1,7) = ?").get(mes).n,
    mes_concluidos: db.prepare("SELECT COUNT(*) n FROM atendimentos WHERE status = 'concluido' AND substr(atualizado_em,1,7) = ?").get(mes).n,
    retornos_atrasados: db.prepare("SELECT COUNT(*) n FROM atendimentos WHERE status = 'em_andamento' AND proximo_retorno != '' AND proximo_retorno IS NOT NULL AND proximo_retorno < ?").get(hoje).n,
  };
});

// Agenda: retornos marcados (atrasados e próximos), dos atendimentos em andamento.
rota('GET', /^\/api\/agenda$/, LOGADO, () => {
  const hoje = hojeISO();
  const linhas = db.prepare(`SELECT a.id, a.proximo_retorno, a.alerta_risco, p.nome AS paciente, p.telefone, at.nome AS atendente
    FROM atendimentos a JOIN pacientes p ON p.id = a.paciente_id LEFT JOIN atendentes at ON at.id = a.atendente_id
    WHERE a.status = 'em_andamento' AND a.proximo_retorno IS NOT NULL AND a.proximo_retorno != ''
    ORDER BY a.proximo_retorno LIMIT 200`).all();
  return {
    atrasados: linhas.filter(l => l.proximo_retorno < hoje),
    hoje: linhas.filter(l => l.proximo_retorno === hoje),
    proximos: linhas.filter(l => l.proximo_retorno > hoje),
  };
});

// Relatório mensal (números + lista de atendimentos iniciados no mês).
rota('GET', /^\/api\/relatorio-mes$/, LOGADO, ({ url }) => {
  let mes = txt(url.searchParams.get('mes'), 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) mes = hojeISO().slice(0, 7);
  const n = (sql, ...p) => db.prepare(sql).get(...p).n;
  const numeros = {
    novos: n("SELECT COUNT(*) n FROM atendimentos WHERE substr(data_inicio,1,7) = ?", mes),
    concluidos: n("SELECT COUNT(*) n FROM atendimentos WHERE status = 'concluido' AND substr(atualizado_em,1,7) = ?", mes),
    sessoes: n("SELECT COUNT(*) n FROM evolucoes WHERE substr(data,1,7) = ?", mes),
    encaminhamentos: n("SELECT COUNT(*) n FROM atendimentos WHERE substr(encaminhamento_data,1,7) = ?", mes),
    faltas: n("SELECT COALESCE(SUM(faltas),0) n FROM atendimentos WHERE substr(atualizado_em,1,7) = ?", mes),
    pacientes_novos: n("SELECT COUNT(*) n FROM pacientes WHERE substr(criado_em,1,7) = ?", mes),
  };
  const lista = db.prepare(`SELECT a.id, a.data_inicio, a.status, a.alerta_risco, p.nome AS paciente, at.nome AS atendente
    FROM atendimentos a JOIN pacientes p ON p.id = a.paciente_id LEFT JOIN atendentes at ON at.id = a.atendente_id
    WHERE substr(a.data_inicio,1,7) = ? ORDER BY a.data_inicio, p.nome COLLATE NOCASE`).all(mes);
  // Frequência: pacientes com faltas registradas (estado atual), para acompanhamento.
  const faltosos = db.prepare(`SELECT a.id, a.faltas, a.proximo_retorno, a.status, p.nome AS paciente, p.telefone,
      (SELECT COUNT(*) FROM evolucoes e WHERE e.atendimento_id = a.id AND (e.data != '' OR e.triagem != '')) AS sessoes
    FROM atendimentos a JOIN pacientes p ON p.id = a.paciente_id
    WHERE a.faltas > 0 ORDER BY a.faltas DESC, p.nome COLLATE NOCASE LIMIT 200`).all();
  return { mes, numeros, lista, faltosos };
});

// ---------- Servidor ----------
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!url.pathname.startsWith('/api/')) return servirEstatico(req, res, url);
  try {
    const r = rotas.find(x => x.metodo === req.method && x.padrao.test(url.pathname));
    if (!r) falha(404, 'Rota não encontrada.');
    // proteção contra envio de formulários de outros sites
    if (req.method !== 'GET' && !(req.headers['content-type'] || '').includes('application/json')) falha(415, 'Formato não suportado.');
    const usuario = usuarioDaRequisicao(req);
    if (!r.publica && !usuario) falha(401, 'Sua sessão expirou. Entre novamente.');
    if (r.admin && usuario.perfil !== 'admin') falha(403, 'Apenas administradores podem fazer isso.');
    const corpo = req.method === 'GET' ? {} : await lerCorpo(req);
    const resultado = await r.fn({ req, res, url, usuario, corpo, m: url.pathname.match(r.padrao) });
    if (resultado !== null && !res.headersSent) enviarJSON(res, 200, resultado);
  } catch (e) {
    if (!(e instanceof ErroHttp)) log(`Erro: ${e.stack || e}`);
    if (!res.headersSent) enviarJSON(res, e.status || 500, { erro: e instanceof ErroHttp ? e.message : 'Erro interno. Verifique o arquivo sistema.log.' });
  }
});

function abrirNavegador(aoTerminar) {
  const url = `http://localhost:${PORTA}`;
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  // IMPORTANTE: só encerra depois que o comando de abrir o navegador terminou.
  // Sem isso, um process.exit() imediato matava o comando antes de ele rodar,
  // e o ícone parecia "não abrir" quando o sistema já estava ligado.
  exec(cmd, () => { if (typeof aoTerminar === 'function') aoTerminar(); });
}

servidor.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    // o sistema já está aberto neste computador: apenas reabre o navegador e sai
    if (process.argv.includes('--abrir')) {
      abrirNavegador(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref(); // segurança, caso o navegador demore
    } else {
      process.exit(0);
    }
    return;
  }
  log(`Erro no servidor: ${e.message}`);
  process.exit(1);
});

servidor.listen(PORTA, '0.0.0.0', () => {
  log(`Sistema de Atendimento Espiritual ${VERSAO} em http://localhost:${PORTA} (dados em ${DIR_DADOS})`);
  db.prepare('DELETE FROM sessoes WHERE expira < ?').run(Date.now());
  backupAutomatico();
  setInterval(backupAutomatico, 60 * 60 * 1000).unref();
  if (process.argv.includes('--abrir')) abrirNavegador();
});

function encerrar() { try { db.close(); } catch { /* ignora */ } process.exit(0); }
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
