/* Renda Protegida · servidor (Express + SQLite) — Setor Norte Seguros */
const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const { db, hoje, SqliteStore } = require("./db");
const { agendarBackup, enviarBackup } = require("./backup");

const PORT = +process.env.PORT || 3000;
const PUBLIC = process.env.PUBLIC_DIR || path.join(__dirname, "..", "public");
const SECURE = process.env.COOKIE_SECURE !== "false"; // só desligue para teste local em http
const BCRYPT_CUSTO = 12;
const STATUS = ["novo", "estudo_enviado", "vou_avaliar", "retomada", "fechado", "perdido"];
const STATUS_NOME = { novo: "Novo", estudo_enviado: "Estudo enviado", vou_avaliar: "Vou avaliar", retomada: "Retomada", fechado: "Fechado", perdido: "Perdido" };
const DIAS_RETOMADA ={ vou_avaliar: 2, retomada: 5 };
const EVENTOS_CLIENTE = ["mensagem_copiada", "pdf_gerado", "apresentacao_gerada"];

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres). Veja o .env.example.");
  process.exit(1);
}

/* ---------- primeiro start: admin a partir do .env ---------- */
const totalUsers = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (!totalUsers) {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA || "";
  if (email && senha) {
    db.prepare("INSERT INTO users (nome, email, senha_hash, papel, trocar_senha) VALUES (?, ?, ?, 'admin', 1)")
      .run("Administrador", email, bcrypt.hashSync(senha, BCRYPT_CUSTO));
    console.log(`Admin criado: ${email} (troca de senha obrigatória no primeiro login)`);
  } else {
    console.warn("Nenhum usuário no banco e ADMIN_EMAIL/ADMIN_SENHA não definidos no .env.");
  }
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY || 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:"],
      "font-src": ["'self'", "data:"],
      "connect-src": ["'self'", "blob:", "data:"],
      "worker-src": ["'self'", "blob:"],
      "object-src": ["'none'"],
      "frame-ancestors": ["'none'"],
      "form-action": ["'self'"],
      "upgrade-insecure-requests": SECURE ? [] : null
    }
  },
  strictTransportSecurity: SECURE ? { maxAge: 15552000 } : false
}));

const store = new SqliteStore();
app.use(session({
  name: "rp.sid",
  secret: process.env.SESSION_SECRET,
  store,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: SECURE, sameSite: "strict", maxAge: 12 * 3600 * 1000 }
}));
app.use(express.json({ limit: "15mb" })); // estado S pode conter a foto de capa enviada (data URL)

/* ---------- utilidades ---------- */
const erro = (res, code, msg, extra) => res.status(code).json({ erro: msg, ...(extra || {}) });
const userPublico = (u) => u && { id: u.id, nome: u.nome, email: u.email, papel: u.papel, ativo: !!u.ativo, trocarSenha: !!u.trocar_senha, criado_em: u.criado_em };
const qUser = db.prepare("SELECT * FROM users WHERE id = ?");
const qUserEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const isApi = (req) => req.originalUrl.startsWith("/api/");
const querHtml = (req) => req.method === "GET" && (req.get("accept") || "").includes("text/html");
const DUMMY_HASH = bcrypt.hashSync("senha-inexistente", BCRYPT_CUSTO);
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const txt = (v, max = 200) => (v == null ? "" : String(v)).trim().slice(0, max);
const numOuNull = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);

/* carrega o usuário da sessão; null se não logado/inativo */
function usuarioDaSessao(req) {
  if (!req.session || !req.session.userId) return null;
  const u = qUser.get(req.session.userId);
  if (!u || !u.ativo) { req.session.destroy(() => {}); return null; }
  return u;
}

function exigirLogin(req, res, next) {
  const u = usuarioDaSessao(req);
  if (!u) {
    if (!isApi(req) && querHtml(req)) return res.redirect(302, "/login.html");
    return erro(res, 401, "Faça login para continuar.");
  }
  req.user = u;
  if (u.trocar_senha) {
    if (!isApi(req) && querHtml(req)) return res.redirect(302, "/login.html?trocar=1");
    return erro(res, 403, "Troque a sua senha para continuar.", { trocarSenha: true });
  }
  next();
}
function exigirAdmin(req, res, next) {
  if (req.user.papel !== "admin") return erro(res, 403, "Apenas o administrador pode fazer isso.");
  next();
}

/* corretor só acessa os próprios clientes; admin acessa todos */
const qCliente = db.prepare("SELECT * FROM clientes WHERE id = ?");
function carregarCliente(req, res, next) {
  const c = qCliente.get(+req.params.id);
  if (!c || (req.user.papel !== "admin" && c.user_id !== req.user.id)) return erro(res, 404, "Cliente não encontrado.");
  req.cliente = c;
  next();
}
const registrar = db.prepare("INSERT INTO eventos (cliente_id, user_id, tipo, detalhe) VALUES (?, ?, ?, ?)");

/* ---------- páginas e arquivos públicos (sem login) ---------- */
const PUBLICOS = new Set(["/login.html", "/login.js", "/img/logo.png", "/fonts/fonts.css"]);
const estatico = express.static(PUBLIC, { index: false, maxAge: "1h" });
app.use((req, res, next) => {
  if ((req.method === "GET" || req.method === "HEAD") && (PUBLICOS.has(req.path) || /^\/fonts\/[\w.-]+\.woff2$/.test(req.path))) return estatico(req, res, next);
  next();
});

/* ---------- autenticação ---------- */
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true, // só tentativas erradas contam
  handler: (req, res) => erro(res, 429, "Muitas tentativas de login. Aguarde 15 minutos e tente de novo.")
});

app.post("/api/login", limiteLogin, (req, res) => {
  const email = txt(req.body && req.body.email, 200).toLowerCase();
  const senha = String((req.body && req.body.senha) || "");
  const u = email ? qUserEmail.get(email) : null;
  const ok = bcrypt.compareSync(senha, u ? u.senha_hash : DUMMY_HASH);
  if (!u || !ok || !u.ativo) return erro(res, 401, "E-mail ou senha incorretos.");
  req.session.regenerate((e) => {
    if (e) return erro(res, 500, "Erro ao iniciar a sessão.");
    req.session.userId = u.id;
    req.session.save(() => res.json({ user: userPublico(u) }));
  });
});

app.post("/api/logout", (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie("rp.sid", { httpOnly: true, secure: SECURE, sameSite: "strict" });
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  const u = usuarioDaSessao(req);
  if (!u) return erro(res, 401, "Não logado.");
  res.json({ user: userPublico(u) });
});

/* troca da própria senha (liberada mesmo com troca obrigatória pendente) */
app.post("/api/senha", (req, res) => {
  const u = usuarioDaSessao(req);
  if (!u) return erro(res, 401, "Faça login para continuar.");
  const atual = String((req.body && req.body.atual) || "");
  const nova = String((req.body && req.body.nova) || "");
  if (!bcrypt.compareSync(atual, u.senha_hash)) return erro(res, 400, "A senha atual está incorreta.");
  if (nova.length < 8) return erro(res, 400, "A nova senha precisa ter pelo menos 8 caracteres.");
  if (nova === atual) return erro(res, 400, "A nova senha precisa ser diferente da atual.");
  db.prepare("UPDATE users SET senha_hash = ?, trocar_senha = 0 WHERE id = ?").run(bcrypt.hashSync(nova, BCRYPT_CUSTO), u.id);
  res.json({ ok: true });
});

/* daqui para baixo, tudo exige login (API e arquivos estáticos) */
app.use(exigirLogin);

/* ---------- clientes ---------- */
const SQL_LISTA = `
  SELECT c.*, u.nome AS corretor,
         e.id AS estudo_id, e.criado_em AS estudo_em, e.essencial, e.completa,
         (SELECT COUNT(*) FROM estudos x WHERE x.cliente_id = c.id) AS versoes
  FROM clientes c
  JOIN users u ON u.id = c.user_id
  LEFT JOIN estudos e ON e.id = (SELECT MAX(id) FROM estudos y WHERE y.cliente_id = c.id)`;
const escopo = (req) => (req.user.papel === "admin" ? { where: "1 = 1", args: [] } : { where: "c.user_id = ?", args: [req.user.id] });

app.get("/api/clientes", (req, res) => {
  const s = escopo(req);
  const status = STATUS.includes(req.query.status) ? req.query.status : null;
  let rows = db.prepare(`${SQL_LISTA} WHERE ${s.where} ${status ? "AND c.status = ?" : ""} ORDER BY c.atualizado_em DESC, c.id DESC`)
    .all(...s.args, ...(status ? [status] : []));
  const busca = norm(req.query.busca);
  if (busca) rows = rows.filter((r) => norm(r.nome).includes(busca));
  res.json({ clientes: rows });
});

app.get("/api/retomadas", (req, res) => {
  const s = escopo(req);
  const rows = db.prepare(`${SQL_LISTA} WHERE ${s.where} AND c.proxima_retomada IS NOT NULL AND c.proxima_retomada <= ?
    AND c.status NOT IN ('fechado', 'perdido') ORDER BY c.proxima_retomada, c.nome`).all(...s.args, hoje());
  res.json({ hoje: hoje(), retomadas: rows });
});

function dadosEstudo(body) {
  const d = body && body.dados;
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  return JSON.stringify(d);
}

app.post("/api/clientes", (req, res) => {
  const b = req.body || {};
  const nome = txt(b.nome) || "Cliente sem nome";
  const dados = dadosEstudo(b);
  const r = db.transaction(() => {
    const c = db.prepare("INSERT INTO clientes (user_id, nome, profissao, renda) VALUES (?, ?, ?, ?)")
      .run(req.user.id, nome, txt(b.profissao) || null, numOuNull(b.renda));
    let estudoId = null;
    if (dados) {
      estudoId = db.prepare("INSERT INTO estudos (cliente_id, user_id, dados_json, essencial, completa) VALUES (?, ?, ?, ?, ?)")
        .run(c.lastInsertRowid, req.user.id, dados, numOuNull(b.essencial), numOuNull(b.completa)).lastInsertRowid;
      registrar.run(c.lastInsertRowid, req.user.id, "estudo_salvo", "versão 1");
    }
    return { id: c.lastInsertRowid, estudoId };
  })();
  res.status(201).json({ cliente: qCliente.get(r.id), estudo_id: r.estudoId, versao: r.estudoId ? 1 : 0 });
});

app.get("/api/clientes/:id", carregarCliente, (req, res) => {
  const ult = db.prepare("SELECT * FROM estudos WHERE cliente_id = ? ORDER BY id DESC LIMIT 1").get(req.cliente.id);
  res.json({ cliente: req.cliente, estudo: ult ? { ...ult, dados: JSON.parse(ult.dados_json), dados_json: undefined } : null });
});

app.put("/api/clientes/:id", carregarCliente, (req, res) => {
  const b = req.body || {};
  const c = req.cliente;
  db.prepare("UPDATE clientes SET nome = ?, profissao = ?, renda = ?, atualizado_em = datetime('now','localtime') WHERE id = ?")
    .run(txt(b.nome) || c.nome, b.profissao !== undefined ? txt(b.profissao) || null : c.profissao, b.renda !== undefined ? numOuNull(b.renda) : c.renda, c.id);
  res.json({ cliente: qCliente.get(c.id) });
});

/* LGPD: apaga o cliente com todas as versões e eventos */
app.delete("/api/clientes/:id", carregarCliente, (req, res) => {
  db.transaction(() => {
    db.prepare("DELETE FROM eventos WHERE cliente_id = ?").run(req.cliente.id);
    db.prepare("DELETE FROM estudos WHERE cliente_id = ?").run(req.cliente.id);
    db.prepare("DELETE FROM clientes WHERE id = ?").run(req.cliente.id);
  })();
  res.json({ ok: true });
});

app.get("/api/clientes/:id/estudos", carregarCliente, (req, res) => {
  const rows = db.prepare(`SELECT e.id, e.criado_em, e.essencial, e.completa, u.nome AS autor,
      ROW_NUMBER() OVER (ORDER BY e.id) AS versao
    FROM estudos e JOIN users u ON u.id = e.user_id WHERE e.cliente_id = ? ORDER BY e.id DESC`).all(req.cliente.id);
  res.json({ estudos: rows });
});

app.post("/api/clientes/:id/estudos", carregarCliente, (req, res) => {
  const b = req.body || {};
  const dados = dadosEstudo(b);
  if (!dados) return erro(res, 400, "Envie o estudo em 'dados'.");
  const c = req.cliente;
  const r = db.transaction(() => {
    const id = db.prepare("INSERT INTO estudos (cliente_id, user_id, dados_json, essencial, completa) VALUES (?, ?, ?, ?, ?)")
      .run(c.id, req.user.id, dados, numOuNull(b.essencial), numOuNull(b.completa)).lastInsertRowid;
    db.prepare("UPDATE clientes SET nome = ?, profissao = ?, renda = ?, atualizado_em = datetime('now','localtime') WHERE id = ?")
      .run(txt(b.nome) || c.nome, b.profissao !== undefined ? txt(b.profissao) || null : c.profissao, b.renda !== undefined ? numOuNull(b.renda) : c.renda, c.id);
    const versao = db.prepare("SELECT COUNT(*) AS n FROM estudos WHERE cliente_id = ?").get(c.id).n;
    registrar.run(c.id, req.user.id, "estudo_salvo", "versão " + versao);
    return { id, versao };
  })();
  res.status(201).json({ cliente: qCliente.get(c.id), estudo_id: r.id, versao: r.versao });
});

app.get("/api/estudos/:id", (req, res) => {
  const e = db.prepare("SELECT e.*, c.user_id AS dono FROM estudos e JOIN clientes c ON c.id = e.cliente_id WHERE e.id = ?").get(+req.params.id);
  if (!e || (req.user.papel !== "admin" && e.dono !== req.user.id)) return erro(res, 404, "Estudo não encontrado.");
  const { dados_json, dono, ...resto } = e;
  res.json({ estudo: { ...resto, dados: JSON.parse(dados_json) }, cliente: qCliente.get(e.cliente_id) });
});

app.put("/api/clientes/:id/status", carregarCliente, (req, res) => {
  const status = req.body && req.body.status;
  if (!STATUS.includes(status)) return erro(res, 400, "Status inválido.");
  const prox = DIAS_RETOMADA[status] ? hoje(DIAS_RETOMADA[status]) : null;
  db.prepare("UPDATE clientes SET status = ?, proxima_retomada = ?, atualizado_em = datetime('now','localtime') WHERE id = ?").run(status, prox, req.cliente.id);
  const nomeSt = (s) => STATUS_NOME[s] || s;
  registrar.run(req.cliente.id, req.user.id, "status_alterado", `${nomeSt(req.cliente.status)} → ${nomeSt(status)}${prox ? " · retomada em " + prox.split("-").reverse().join("/") : ""}`);
  res.json({ cliente: qCliente.get(req.cliente.id) });
});

app.get("/api/clientes/:id/eventos", carregarCliente, (req, res) => {
  const rows = db.prepare(`SELECT e.id, e.tipo, e.detalhe, e.criado_em, u.nome AS autor FROM eventos e JOIN users u ON u.id = e.user_id
    WHERE e.cliente_id = ? ORDER BY e.id DESC LIMIT 200`).all(req.cliente.id);
  res.json({ eventos: rows });
});

app.post("/api/clientes/:id/eventos", carregarCliente, (req, res) => {
  const tipo = req.body && req.body.tipo;
  if (!EVENTOS_CLIENTE.includes(tipo)) return erro(res, 400, "Tipo de evento inválido.");
  registrar.run(req.cliente.id, req.user.id, tipo, txt(req.body.detalhe, 300) || null);
  res.status(201).json({ ok: true });
});

/* ---------- usuários (só admin) ---------- */
app.get("/api/usuarios", exigirAdmin, (req, res) => {
  const rows = db.prepare("SELECT u.*, (SELECT COUNT(*) FROM clientes c WHERE c.user_id = u.id) AS clientes FROM users u ORDER BY u.nome").all();
  res.json({ usuarios: rows.map((u) => ({ ...userPublico(u), clientes: u.clientes })) });
});

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
app.post("/api/usuarios", exigirAdmin, (req, res) => {
  const b = req.body || {};
  const nome = txt(b.nome), email = txt(b.email).toLowerCase(), senha = String(b.senha || "");
  const papel = b.papel === "admin" ? "admin" : "corretor";
  if (!nome) return erro(res, 400, "Informe o nome.");
  if (!emailValido(email)) return erro(res, 400, "E-mail inválido.");
  if (senha.length < 8) return erro(res, 400, "A senha precisa ter pelo menos 8 caracteres.");
  if (qUserEmail.get(email)) return erro(res, 409, "Já existe um usuário com esse e-mail.");
  const r = db.prepare("INSERT INTO users (nome, email, senha_hash, papel, trocar_senha) VALUES (?, ?, ?, ?, 1)")
    .run(nome, email, bcrypt.hashSync(senha, BCRYPT_CUSTO), papel);
  res.status(201).json({ usuario: userPublico(qUser.get(r.lastInsertRowid)) });
});

app.put("/api/usuarios/:id", exigirAdmin, (req, res) => {
  const u = qUser.get(+req.params.id);
  if (!u) return erro(res, 404, "Usuário não encontrado.");
  const b = req.body || {};
  const proprio = u.id === req.user.id;
  const nome = b.nome !== undefined ? txt(b.nome) || u.nome : u.nome;
  const email = b.email !== undefined ? txt(b.email).toLowerCase() : u.email;
  const papel = b.papel !== undefined ? (b.papel === "admin" ? "admin" : "corretor") : u.papel;
  const ativo = b.ativo !== undefined ? (b.ativo ? 1 : 0) : u.ativo;
  if (!emailValido(email)) return erro(res, 400, "E-mail inválido.");
  const outro = qUserEmail.get(email);
  if (outro && outro.id !== u.id) return erro(res, 409, "Já existe um usuário com esse e-mail.");
  if (proprio && (papel !== "admin" || !ativo)) return erro(res, 400, "Você não pode remover o seu próprio acesso de administrador.");
  let hash = u.senha_hash, trocar = u.trocar_senha;
  if (b.senha) {
    if (String(b.senha).length < 8) return erro(res, 400, "A senha precisa ter pelo menos 8 caracteres.");
    hash = bcrypt.hashSync(String(b.senha), BCRYPT_CUSTO);
    trocar = proprio ? 0 : 1; // senha definida pelo admin é provisória
  }
  db.prepare("UPDATE users SET nome = ?, email = ?, papel = ?, ativo = ?, senha_hash = ?, trocar_senha = ? WHERE id = ?")
    .run(nome, email, papel, ativo, hash, trocar, u.id);
  if (!proprio && (!ativo || b.senha)) store.destroyUser(u.id); // derruba sessões abertas
  res.json({ usuario: userPublico(qUser.get(u.id)) });
});

app.delete("/api/usuarios/:id", exigirAdmin, (req, res) => {
  const u = qUser.get(+req.params.id);
  if (!u) return erro(res, 404, "Usuário não encontrado.");
  if (u.id === req.user.id) return erro(res, 400, "Você não pode excluir o próprio usuário.");
  const n = db.prepare("SELECT COUNT(*) AS n FROM clientes WHERE user_id = ?").get(u.id).n;
  const n2 = db.prepare("SELECT (SELECT COUNT(*) FROM estudos WHERE user_id = ?) + (SELECT COUNT(*) FROM eventos WHERE user_id = ?) AS n").get(u.id, u.id).n;
  if (n || n2) return erro(res, 409, `Esse usuário tem ${n} cliente(s) e histórico. Desative o acesso em vez de excluir.`);
  db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
  store.destroyUser(u.id);
  res.json({ ok: true });
});

/* ---------- backup (só admin): baixa uma cópia do banco feita na hora ---------- */
app.get("/api/backup", exigirAdmin, (req, res, next) => {
  enviarBackup(res).catch(next);
});

/* ---------- API desconhecida ---------- */
app.use("/api", (req, res) => erro(res, 404, "Rota não encontrada."));

/* ---------- ferramenta (arquivos estáticos, só logado) ---------- */
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC, "index.html")));
app.use(express.static(PUBLIC, { index: false, maxAge: 0, setHeaders: (res) => res.setHeader("Cache-Control", "private, no-cache") }));
app.use((req, res) => res.status(404).send("Não encontrado"));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === "entity.too.large") return erro(res, 413, "Estudo grande demais para salvar (a foto de capa pode estar pesada).");
  if (err.type === "entity.parse.failed") return erro(res, 400, "JSON inválido.");
  erro(res, 500, "Erro interno.");
});

if (process.env.BACKUP_AUTO !== "false") agendarBackup();
app.listen(PORT, () => console.log(`Renda Protegida rodando na porta ${PORT} · ${new Date().toString()}`));
