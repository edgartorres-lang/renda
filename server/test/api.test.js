/* Teste ponta a ponta da API. Rode com o servidor de pé, num banco de TESTE vazio:
     BASE=http://localhost:3000 DB_PATH=/caminho/teste.db node server/test/api.test.js
   O servidor precisa ter sido iniciado com ADMIN_EMAIL/ADMIN_SENHA iguais aos abaixo e COOKIE_SECURE=false. */
const assert = require("assert");
const BASE = process.env.BASE || "http://localhost:3000";
const ADMIN = { email: process.env.TEST_ADMIN_EMAIL || "admin@teste.local", senha: process.env.TEST_ADMIN_SENHA || "senha-admin-teste-1" };
const TZ = process.env.TZ || "America/Belem";

const hojeMais = (n) => { const d = new Date(Date.now() + n * 864e5); return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); };

function cliente() {
  let cookie = "";
  return async function req(method, path, body, headers = {}) {
    const r = await fetch(BASE + path, {
      method, redirect: "manual",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    let json = null; const t = await r.text(); try { json = JSON.parse(t); } catch (e) {}
    return { status: r.status, json, location: r.headers.get("location"), setCookie: sc };
  };
}

let ok = 0;
async function t(nome, fn) { try { await fn(); ok++; console.log("  ✔", nome); } catch (e) { console.error("  ✘", nome, "\n    ", e.message); process.exitCode = 1; } }

const S = (nome, renda) => ({ cli: { nome, sexo: "F", idade: "34", prof: "fisio", renda: String(renda) }, seg: { premio: "123.45", cobs: [] }, clienteId: null });

(async () => {
  const anon = cliente(), adm = cliente(), a = cliente(), b = cliente();
  let idA, idB, corrA, corrB;

  console.log("Sem login");
  await t("/app.js sem login → 401", async () => assert.strictEqual((await anon("GET", "/app.js")).status, 401));
  await t("/api/clientes sem login → 401", async () => assert.strictEqual((await anon("GET", "/api/clientes")).status, 401));
  await t("/ no navegador sem login → redireciona para /login.html", async () => {
    const r = await anon("GET", "/", null, { Accept: "text/html" }); assert.strictEqual(r.status, 302); assert.strictEqual(r.location, "/login.html");
  });
  await t("/login.html e /img/logo.png abrem sem login", async () => {
    assert.strictEqual((await anon("GET", "/login.html")).status, 200); assert.strictEqual((await anon("GET", "/img/logo.png")).status, 200);
  });
  await t("/img/edgar.jpg (não público) sem login → 401", async () => assert.strictEqual((await anon("GET", "/img/edgar.jpg")).status, 401));

  console.log("Admin e troca de senha");
  await t("login do admin com senha certa → cookie httpOnly, SameSite=Strict", async () => {
    const r = await adm("POST", "/api/login", ADMIN);
    assert.strictEqual(r.status, 200); assert.ok(r.json.user.trocarSenha, "deveria exigir troca de senha");
    assert.match(r.setCookie, /HttpOnly/i); assert.match(r.setCookie, /SameSite=Strict/i);
  });
  await t("antes de trocar a senha, API bloqueada (403 trocarSenha)", async () => {
    const r = await adm("GET", "/api/clientes"); assert.strictEqual(r.status, 403); assert.ok(r.json.trocarSenha);
  });
  ADMIN.nova = ADMIN.senha + "-nova";
  await t("troca de senha obrigatória", async () => {
    assert.strictEqual((await adm("POST", "/api/senha", { atual: ADMIN.senha, nova: ADMIN.nova })).status, 200);
    assert.strictEqual((await adm("GET", "/api/clientes")).status, 200);
  });

  console.log("Usuários");
  await t("admin cria dois corretores", async () => {
    let r = await adm("POST", "/api/usuarios", { nome: "Corretor A", email: "a@teste.local", senha: "senha-a-123", papel: "corretor" });
    assert.strictEqual(r.status, 201); corrA = r.json.usuario;
    r = await adm("POST", "/api/usuarios", { nome: "Corretor B", email: "b@teste.local", senha: "senha-b-123" });
    assert.strictEqual(r.status, 201); corrB = r.json.usuario;
    assert.strictEqual((await adm("POST", "/api/usuarios", { nome: "X", email: "a@teste.local", senha: "12345678" })).status, 409);
  });
  await t("corretores entram e trocam a senha provisória", async () => {
    await a("POST", "/api/login", { email: "a@teste.local", senha: "senha-a-123" });
    assert.strictEqual((await a("POST", "/api/senha", { atual: "senha-a-123", nova: "senha-a-nova" })).status, 200);
    await b("POST", "/api/login", { email: "b@teste.local", senha: "senha-b-123" });
    assert.strictEqual((await b("POST", "/api/senha", { atual: "senha-b-123", nova: "senha-b-nova" })).status, 200);
  });
  await t("corretor não acessa /api/usuarios", async () => assert.strictEqual((await a("GET", "/api/usuarios")).status, 403));

  console.log("Clientes e versões");
  await t("corretor A salva um cliente (versão 1)", async () => {
    const r = await a("POST", "/api/clientes", { nome: "Maria Teste", profissao: "Fisioterapeuta", renda: 10000, essencial: 123.45, completa: null, dados: S("Maria Teste", 10000) });
    assert.strictEqual(r.status, 201); assert.strictEqual(r.json.versao, 1); idA = r.json.cliente.id;
  });
  await t("corretor A salva de novo (versão 2) e lista as versões", async () => {
    const r = await a("POST", `/api/clientes/${idA}/estudos`, { nome: "Maria Teste", renda: 12000, essencial: 150, dados: S("Maria Teste", 12000) });
    assert.strictEqual(r.json.versao, 2);
    const v = await a("GET", `/api/clientes/${idA}/estudos`);
    assert.strictEqual(v.json.estudos.length, 2); assert.strictEqual(v.json.estudos[0].versao, 2);
  });
  await t("reabrir o cliente traz a última versão do estado S", async () => {
    const r = await a("GET", `/api/clientes/${idA}`);
    assert.strictEqual(r.json.estudo.dados.cli.renda, "12000"); assert.strictEqual(r.json.cliente.renda, 12000);
    const v = await a("GET", `/api/clientes/${idA}/estudos`);
    const antiga = await a("GET", `/api/estudos/${v.json.estudos[1].id}`);
    assert.strictEqual(antiga.json.estudo.dados.cli.renda, "10000");
  });
  await t("lista com busca sem acento e filtro de status", async () => {
    assert.strictEqual((await a("GET", "/api/clientes?busca=mária")).json.clientes.length, 1);
    assert.strictEqual((await a("GET", "/api/clientes?status=fechado")).json.clientes.length, 0);
    const c = (await a("GET", "/api/clientes")).json.clientes[0];
    assert.strictEqual(c.versoes, 2); assert.strictEqual(c.essencial, 150);
  });

  console.log("Isolamento entre corretores");
  await t("corretor B cria o próprio cliente e NÃO vê o de A", async () => {
    idB = (await b("POST", "/api/clientes", { nome: "João B", dados: S("João B", 5000) })).json.cliente.id;
    const lista = (await b("GET", "/api/clientes")).json.clientes;
    assert.deepStrictEqual(lista.map((c) => c.id), [idB]);
  });
  await t("corretor B não lê, não edita, não muda status e não exclui cliente de A (404)", async () => {
    assert.strictEqual((await b("GET", `/api/clientes/${idA}`)).status, 404);
    assert.strictEqual((await b("POST", `/api/clientes/${idA}/estudos`, { dados: {} })).status, 404);
    assert.strictEqual((await b("PUT", `/api/clientes/${idA}/status`, { status: "perdido" })).status, 404);
    assert.strictEqual((await b("DELETE", `/api/clientes/${idA}`)).status, 404);
    const v = (await a("GET", `/api/clientes/${idA}/estudos`)).json.estudos[0].id;
    assert.strictEqual((await b("GET", `/api/estudos/${v}`)).status, 404);
  });
  await t("admin vê os clientes de todos", async () => {
    const ids = (await adm("GET", "/api/clientes")).json.clientes.map((c) => c.id).sort();
    assert.deepStrictEqual(ids, [idA, idB].sort());
  });

  console.log("Status e retomadas");
  await t("status 'vou_avaliar' → retomada = hoje + 2 dias", async () => {
    const r = await a("PUT", `/api/clientes/${idA}/status`, { status: "vou_avaliar" });
    assert.strictEqual(r.json.cliente.proxima_retomada, hojeMais(2));
  });
  await t("status 'retomada' → hoje + 5 dias", async () => {
    const r = await b("PUT", `/api/clientes/${idB}/status`, { status: "retomada" });
    assert.strictEqual(r.json.cliente.proxima_retomada, hojeMais(5));
  });
  await t("status inválido → 400", async () => assert.strictEqual((await a("PUT", `/api/clientes/${idA}/status`, { status: "x" })).status, 400));
  await t("'Retomadas de hoje' lista quem venceu e respeita o dono", async () => {
    if (!process.env.DB_PATH) throw new Error("defina DB_PATH para este teste");
    const db = new (require("node:sqlite").DatabaseSync)(process.env.DB_PATH);
    db.prepare("UPDATE clientes SET proxima_retomada = ? WHERE id = ?").run(hojeMais(0), idA);
    db.prepare("UPDATE clientes SET proxima_retomada = ? WHERE id = ?").run(hojeMais(-1), idB);
    db.close();
    assert.deepStrictEqual((await a("GET", "/api/retomadas")).json.retomadas.map((c) => c.id), [idA]);
    assert.strictEqual((await adm("GET", "/api/retomadas")).json.retomadas.length, 2);
    await b("PUT", `/api/clientes/${idB}/status`, { status: "fechado" });
    assert.strictEqual((await adm("GET", "/api/retomadas")).json.retomadas.length, 1);
  });
  await t("eventos: mensagem copiada, PDF gerado e status ficam no histórico", async () => {
    await a("POST", `/api/clientes/${idA}/eventos`, { tipo: "mensagem_copiada", detalhe: "Retomada" });
    await a("POST", `/api/clientes/${idA}/eventos`, { tipo: "pdf_gerado", detalhe: "Estudo.pdf" });
    assert.strictEqual((await a("POST", `/api/clientes/${idA}/eventos`, { tipo: "qualquer" })).status, 400);
    const tipos = (await a("GET", `/api/clientes/${idA}/eventos`)).json.eventos.map((e) => e.tipo);
    for (const x of ["mensagem_copiada", "pdf_gerado", "status_alterado", "estudo_salvo"]) assert.ok(tipos.includes(x), x);
  });

  console.log("RD Station (webhook) e perfil");
  let urlRd, idLead;
  await t("só o admin vê o endereço do webhook", async () => {
    assert.strictEqual((await a("GET", "/api/integracao/rd")).status, 403);
    const r = await adm("GET", "/api/integracao/rd");
    assert.strictEqual(r.status, 200); assert.match(r.json.url, /\/api\/rd\/[0-9a-f]{48}$/);
    urlRd = new URL(r.json.url).pathname;
  });
  await t("endereço errado → 404 e nada é gravado", async () => {
    assert.strictEqual((await anon("POST", "/api/rd/errado", { leads: [{ email: "x@x.com", name: "X" }] })).status, 404);
    assert.strictEqual((await adm("GET", "/api/clientes?busca=x")).json.clientes.filter((c) => c.email === "x@x.com").length, 0);
  });
  const lead = { leads: [{ email: "Lead@Teste.com", name: "Lara Lead", job_title: "Dentista", mobile_phone: "(96) 98888-7777", tags: ["agendou", "instagram"], custom_fields: { "Renda mensal": "De R$ 10.000 a R$ 15.000" } }] };
  await t("oportunidade do RD (sem login) entra como Lead novo, no nome do admin", async () => {
    const r = await anon("POST", urlRd, lead);
    assert.strictEqual(r.status, 200); assert.strictEqual(r.json.recebidos, 1);
    const c = (await adm("GET", "/api/clientes?status=lead_novo")).json.clientes.find((x) => x.email === "lead@teste.com");
    assert.ok(c, "lead não apareceu"); idLead = c.id;
    assert.strictEqual(c.profissao, "Dentista"); assert.strictEqual(c.renda, 12500); assert.strictEqual(c.origem, "instagram"); assert.strictEqual(c.agendou, 1);
    assert.strictEqual(c.telefone, "(96) 98888-7777"); assert.strictEqual(c.corretor, "Administrador");
  });
  await t("o mesmo e-mail de novo atualiza, não duplica", async () => {
    await anon("POST", urlRd, { leads: [{ ...lead.leads[0], email: "lead@teste.com", job_title: "Outra coisa" }] });
    const l = (await adm("GET", "/api/clientes")).json.clientes.filter((x) => x.email === "lead@teste.com");
    assert.strictEqual(l.length, 1); assert.strictEqual(l[0].profissao, "Dentista", "não sobrescreve o que já tinha");
    const ev = (await adm("GET", `/api/clientes/${idLead}/eventos`)).json.eventos.map((e) => e.tipo);
    assert.ok(ev.includes("rd_lead") && ev.includes("rd_oportunidade"));
  });
  await t("envio fica guardado para conferência; corretor não vê o lead do admin", async () => {
    const r = await adm("GET", "/api/integracao/rd");
    assert.ok(r.json.eventos.length >= 2); assert.match(r.json.eventos[0].resultado, /atualizado/);
    assert.ok(!(await a("GET", "/api/clientes")).json.clientes.some((c) => c.id === idLead));
  });
  await t("Lead novo → Em negociação; origem pode ser trocada", async () => {
    assert.strictEqual((await adm("PUT", `/api/clientes/${idLead}/status`, { status: "negociacao" })).json.cliente.status, "negociacao");
    const r = await adm("PUT", `/api/clientes/${idLead}`, { origem: "facebook", agendou: false });
    assert.strictEqual(r.json.cliente.origem, "facebook"); assert.strictEqual(r.json.cliente.agendou, 0);
    assert.strictEqual((await adm("PUT", `/api/clientes/${idLead}`, { origem: "qualquer" })).json.cliente.origem, null);
  });
  await t("gerar endereço novo invalida o antigo", async () => {
    const novo = new URL((await adm("POST", "/api/integracao/rd/novo-endereco")).json.url).pathname;
    assert.notStrictEqual(novo, urlRd);
    assert.strictEqual((await anon("POST", urlRd, lead)).status, 404);
    assert.strictEqual((await anon("POST", novo, { leads: [] })).status, 200);
  });
  await t("perfil: nome nas mensagens e link de agendamento", async () => {
    const me = (await a("GET", "/api/me")).json.user;
    assert.strictEqual(me.assinatura, "Corretor A"); assert.match(me.calendly, /^https:\/\/calendly\.com\//);
    assert.strictEqual((await a("PUT", "/api/perfil", { assinatura: "Ana", calendly: "http://inseguro" })).status, 400);
    const r = await a("PUT", "/api/perfil", { assinatura: "Ana Corretora", calendly: "https://calendly.com/ana/conversa" });
    assert.strictEqual(r.json.user.assinatura, "Ana Corretora"); assert.strictEqual(r.json.user.calendly, "https://calendly.com/ana/conversa");
  });

  console.log("Envio do estudo por e-mail (servidor com EMAIL_TESTE=1: monta e não envia)");
  await t("e-mail: valida, só o dono envia, grava o histórico e muda o status", async () => {
    assert.strictEqual((await a("GET", "/api/me")).json.email.configurado, true);
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(3000, 32)]).toString("base64");
    const ok = { para: "Cliente@Teste.com", assunto: "Seu estudo", texto: "Oi!\n\nInvestimento: *R$ 100,00 por mês*.\n\n_Uma pergunta?_", arquivo: "Estudo Renda Protegida - Teste.pdf", pdf };
    assert.strictEqual((await b("POST", `/api/clientes/${idA}/email-estudo`, ok)).status, 404);
    assert.strictEqual((await a("POST", `/api/clientes/${idA}/email-estudo`, { ...ok, para: "sem-arroba" })).status, 400);
    assert.strictEqual((await a("POST", `/api/clientes/${idA}/email-estudo`, { ...ok, pdf: Buffer.from("não é pdf").toString("base64") })).status, 400);
    const r = await a("POST", `/api/clientes/${idA}/email-estudo`, ok);
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    assert.strictEqual(r.json.cliente.status, "estudo_enviado");
    assert.ok(r.json.cliente.email, "o cliente fica com e-mail");
    const ev = (await a("GET", `/api/clientes/${idA}/eventos`)).json.eventos;
    assert.ok(ev.some((e) => e.tipo === "estudo_email" && /cliente@teste\.com/.test(e.detalhe)), "evento estudo_email");
  });
  await t("e-mail: texto em HTML com negrito, itálico e link", () => {
    const { paraHtml, paraTexto } = require("../email");
    const h = paraHtml("Valor: *R$ 1,00*\n_Uma pergunta?_ https://calendly.com/x <script>");
    assert.match(h, /<b>R\$ 1,00<\/b>/); assert.match(h, /<i>Uma pergunta\?<\/i>/); assert.match(h, /<a href="https:\/\/calendly\.com\/x">/); assert.doesNotMatch(h, /<script>/);
    assert.strictEqual(paraTexto("Valor: *R$ 1,00*\n_Uma pergunta?_"), "Valor: R$ 1,00\nUma pergunta?");
  });

  console.log("Exclusão (LGPD)");
  await t("excluir cliente apaga versões e eventos", async () => {
    assert.strictEqual((await a("DELETE", `/api/clientes/${idA}`)).status, 200);
    assert.strictEqual((await a("GET", `/api/clientes/${idA}`)).status, 404);
    const db = new (require("node:sqlite").DatabaseSync)(process.env.DB_PATH, { readOnly: true });
    const n = db.prepare("SELECT (SELECT COUNT(*) FROM estudos WHERE cliente_id = ?) + (SELECT COUNT(*) FROM eventos WHERE cliente_id = ?) AS n").get(idA, idA).n;
    db.close(); assert.strictEqual(n, 0);
  });

  console.log("Acesso desativado e logout");
  await t("admin desativa o corretor B → sessão dele cai (401)", async () => {
    await adm("PUT", `/api/usuarios/${corrB.id}`, { ativo: false });
    assert.strictEqual((await b("GET", "/api/clientes")).status, 401);
    assert.strictEqual((await b("POST", "/api/login", { email: "b@teste.local", senha: "senha-b-nova" })).status, 401);
  });
  await t("logout encerra a sessão", async () => {
    await a("POST", "/api/logout");
    assert.strictEqual((await a("GET", "/api/me")).status, 401);
  });

  console.log("Limite de tentativas de login");
  await t("senha errada: 401 nas primeiras, 429 (bloqueio) depois de 5 erros", async () => {
    const x = cliente(); const st = [];
    for (let i = 0; i < 6; i++) st.push((await x("POST", "/api/login", { email: ADMIN.email, senha: "errada" + i })).status);
    // a tentativa 5 do corretor B acima já contou; o 6º pedido certamente cai no bloqueio
    assert.ok(st.slice(0, 4).every((s) => s === 401), st.join(","));
    assert.strictEqual(st[5], 429, st.join(","));
    assert.strictEqual((await x("POST", "/api/login", { email: ADMIN.email, senha: ADMIN.nova })).status, 429, "mesmo com a senha certa, o IP fica bloqueado 15 min");
  });

  console.log(`\n${ok} testes passaram${process.exitCode ? ", HOUVE FALHAS" : ""}.`);
})();
