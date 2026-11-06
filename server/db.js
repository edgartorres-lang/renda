/* Banco SQLite (node:sqlite, embutido no Node 24, sem compilação): esquema, datas e store de sessão. */
const path = require("path");
const fs = require("fs");
const sqlite = require("node:sqlite");
const session = require("express-session");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "app.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

/* Restauração: se existir data/restaurar.db na partida, ele vira o banco atual.
   O banco anterior é guardado como app.db.antes-<data>. */
const RESTAURAR = path.join(path.dirname(DB_PATH), "restaurar.db");
if (fs.existsSync(RESTAURAR)) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  if (fs.existsSync(DB_PATH)) fs.renameSync(DB_PATH, `${DB_PATH}.antes-${stamp}`);
  for (const s of ["-wal", "-shm"]) fs.rmSync(DB_PATH + s, { force: true });
  fs.renameSync(RESTAURAR, DB_PATH);
  console.log(`Banco restaurado a partir de restaurar.db (o anterior ficou em ${path.basename(DB_PATH)}.antes-${stamp})`);
}

const db = new sqlite.DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

/* Mesmo uso do better-sqlite3: db.transaction(fn)() roda fn dentro de BEGIN/COMMIT. */
db.transaction = (fn) => (...args) => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn(...args);
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
};
/* Cópia consistente do banco num arquivo (API de backup do SQLite). */
db.backup = (destino) => sqlite.backup(db, destino);

/* status é validado no servidor (index.js), sem CHECK, para poder criar status novos sem recriar a tabela */
const CLIENTES_COLS = "id, user_id, nome, profissao, renda, status, proxima_retomada, criado_em, atualizado_em, email, telefone, idade, origem, agendou, rd_tags, rd_conversao";
function clientesSql(nome) {
  return `CREATE TABLE IF NOT EXISTS ${nome} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  nome TEXT NOT NULL,
  profissao TEXT,
  renda REAL,
  status TEXT NOT NULL DEFAULT 'novo',
  proxima_retomada TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  email TEXT,
  telefone TEXT,
  idade INTEGER,
  origem TEXT,
  agendou INTEGER NOT NULL DEFAULT 0,
  rd_tags TEXT,
  rd_conversao TEXT
);`;
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'corretor' CHECK (papel IN ('admin','corretor')),
  ativo INTEGER NOT NULL DEFAULT 1,
  trocar_senha INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
${clientesSql("clientes")}
CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_retomada ON clientes(proxima_retomada);
CREATE TABLE IF NOT EXISTS estudos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  dados_json TEXT NOT NULL,
  essencial REAL,
  completa REAL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_estudos_cliente ON estudos(cliente_id);
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  tipo TEXT NOT NULL,
  detalhe TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_cliente ON eventos(cliente_id);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expira INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT
);
CREATE TABLE IF NOT EXISTS rd_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recebido_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  resultado TEXT,
  payload TEXT
);
`);

/* ---------- migrações de bancos antigos ---------- */
const colunas = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
// clientes: tira o CHECK de status (para os status Lead novo e Em negociação) e cria as colunas do RD Station
const sqlCli = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'clientes'").get().sql;
if (/CHECK\s*\(\s*status/i.test(sqlCli)) {
  const antigas = colunas("clientes").filter((c) => CLIENTES_COLS.split(", ").includes(c)).join(", ");
  // cópia de segurança do banco antes de mexer na tabela
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  fs.copyFileSync(DB_PATH, `${DB_PATH}.antes-rd`);
  db.exec("PRAGMA foreign_keys = OFF");
  db.transaction(() => {
    db.exec(clientesSql("clientes_nova"));
    db.exec(`INSERT INTO clientes_nova (${antigas}) SELECT ${antigas} FROM clientes`);
    db.exec("DROP TABLE clientes");
    db.exec("ALTER TABLE clientes_nova RENAME TO clientes");
    db.exec("CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id); CREATE INDEX IF NOT EXISTS idx_clientes_retomada ON clientes(proxima_retomada);");
  })();
  db.exec("PRAGMA foreign_keys = ON");
  console.log("Banco atualizado: clientes aceita os status novos e os dados do RD Station.");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email COLLATE NOCASE)");
// users: nome que vai nas mensagens e link de agendamento (Calendly)
for (const [c, tipo] of [["assinatura", "TEXT"], ["calendly", "TEXT"]]) if (!colunas("users").includes(c)) db.exec(`ALTER TABLE users ADD COLUMN ${c} ${tipo}`);

const getConfig = (k) => { const r = db.prepare("SELECT valor FROM config WHERE chave = ?").get(k); return r ? r.valor : null; };
const setConfig = (k, v) => db.prepare("INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(k, v);

/* Datas no fuso do servidor (TZ=America/Belem no Docker = horário de Macapá). */
function hoje(somarDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + somarDias);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Store de sessão do express-session gravando na tabela sessions. */
class SqliteStore extends session.Store {
  constructor() {
    super();
    this.q = {
      get: db.prepare("SELECT sess FROM sessions WHERE sid = ? AND expira > ?"),
      set: db.prepare("INSERT INTO sessions (sid, sess, expira) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expira = excluded.expira"),
      del: db.prepare("DELETE FROM sessions WHERE sid = ?"),
      touch: db.prepare("UPDATE sessions SET expira = ? WHERE sid = ?"),
      limpar: db.prepare("DELETE FROM sessions WHERE expira <= ?"),
      delUser: db.prepare("DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?")
    };
    const t = setInterval(() => this.q.limpar.run(Date.now()), 15 * 60 * 1000);
    t.unref();
  }
  expira(sess) {
    const e = sess && sess.cookie && sess.cookie.expires;
    return e ? new Date(e).getTime() : Date.now() + 12 * 3600 * 1000;
  }
  get(sid, cb) {
    try { const r = this.q.get.get(sid, Date.now()); cb(null, r ? JSON.parse(r.sess) : null); } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try { this.q.set.run(sid, JSON.stringify(sess), this.expira(sess)); cb && cb(null); } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) {
    try { this.q.del.run(sid); cb && cb(null); } catch (e) { cb && cb(e); }
  }
  touch(sid, sess, cb) {
    try { this.q.touch.run(this.expira(sess), sid); cb && cb(null); } catch (e) { cb && cb(e); }
  }
  /* derruba todas as sessões de um usuário (desativado ou senha trocada pelo admin) */
  destroyUser(userId) { this.q.delUser.run(userId); }
}

module.exports = { db, hoje, SqliteStore, DB_PATH, getConfig, setConfig };
