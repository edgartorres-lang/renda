/* Renda Protegida · aba Clientes, login, salvar versões e retomadas (conversa com /api) */
(function () {
"use strict";
const A = window.__app;
const $ = (s, el) => (el || document).querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = (v) => (v == null || v === "" ? "—" : "R$ " + (+v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dia = (d) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const diaHora = (d) => (d ? dia(d) + " " + d.slice(11, 16) : "—");
const OWNER = "sn_rp_owner";
const STATUS = [["novo", "Novo"], ["estudo_enviado", "Estudo enviado"], ["vou_avaliar", "Vou avaliar"], ["retomada", "Retomada"], ["fechado", "Fechado"], ["perdido", "Perdido"]];
const STATUS_NOME = Object.fromEntries(STATUS);
const EVENTO_NOME = { estudo_salvo: "Estudo salvo", status_alterado: "Status alterado", mensagem_copiada: "Mensagem copiada", pdf_gerado: "PDF do estudo gerado", apresentacao_gerada: "Apresentação gerada" };
let ME = null, salvo = null; // salvo = foto do estado na última vez que salvou/abriu

/* ---------- API ---------- */
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (r.status === 401) { location.href = "/login.html"; throw new Error("sessão expirada"); }
  if (r.status === 403 && j.trocarSenha) { location.href = "/login.html?trocar=1"; throw new Error("troque a senha"); }
  if (!r.ok) throw new Error(j.erro || "erro " + r.status);
  return j;
}
const foto = () => JSON.stringify(A.S);
const alterado = () => salvo !== null && foto() !== salvo && !!(A.S.cli.nome || A.S.seg.cobs.length);
function confirmaDescarte() { return !alterado() || confirm("Há alterações não salvas neste estudo. Continuar e descartar?"); }

/* ---------- início ---------- */
async function iniciar() {
  try { ME = (await api("GET", "/api/me")).user; } catch (e) { return; }
  if (ME.trocarSenha) { location.href = "/login.html?trocar=1"; return; }
  $("#userName").textContent = ME.nome + (ME.papel === "admin" ? " · admin" : "");
  // rascunho local de outro usuário neste navegador: descarta
  try { if (localStorage.getItem(OWNER) !== String(ME.id)) { A.setState({}); localStorage.setItem(OWNER, String(ME.id)); } } catch (e) {}
  salvo = foto();
  $("#cliStatus").innerHTML = `<option value="">Todos os status</option>` + STATUS.map(([k, t]) => `<option value="${k}">${t}</option>`).join("");
  if (ME.papel === "admin") document.querySelectorAll("#gearMenu .adm").forEach((b) => (b.hidden = false));
  carregarTudo();
}

window.addEventListener("rp:tab", (e) => { if (e.detail === "clientes" && ME) carregarTudo(); });
window.addEventListener("rp:evento", (e) => {
  const id = A.S.clienteId; if (!id) return;
  api("POST", `/api/clientes/${id}/eventos`, e.detail).catch(() => {});
});

/* ---------- salvar / sair ---------- */
$("#btnSalvar").addEventListener("click", async (ev) => {
  const btn = ev.currentTarget; if (btn.disabled) return;
  const S = A.S, m = A.calc();
  if (!(S.cli.nome || "").trim()) { A.toast("Informe o nome do cliente na aba Dados antes de salvar."); A.showTab("dados"); return; }
  const body = { nome: S.cli.nome.trim(), profissao: m.prof || "", renda: m.renda || null, essencial: m.essencial || null, completa: m.prevOn ? m.completa : null, dados: S };
  btn.disabled = true; btn.textContent = "Salvando…";
  try {
    let r;
    if (S.clienteId) {
      try { r = await api("POST", `/api/clientes/${S.clienteId}/estudos`, body); }
      catch (e) { if (!/não encontrado/i.test(e.message)) throw e; S.clienteId = null; } // cliente excluído: cria de novo
    }
    if (!r) { r = await api("POST", "/api/clientes", body); S.clienteId = r.cliente.id; }
    A.save(); salvo = foto();
    A.toast(`Salvo: ${r.cliente.nome} · versão ${r.versao}`);
  } catch (e) { A.toast("Não foi possível salvar: " + e.message); }
  btn.disabled = false; btn.textContent = "Salvar";
});

async function sair() {
  if (!confirmaDescarte()) return;
  try { await fetch("/api/logout", { method: "POST", credentials: "same-origin" }); } catch (e) {}
  try { localStorage.removeItem(A.KEY); localStorage.removeItem(OWNER); } catch (e) {}
  location.href = "/login.html";
}

/* ---------- Ajustes (engrenagem): senha, usuários, backup, sair ---------- */
const gearBtn = $("#btnGear"), gearMenu = $("#gearMenu");
function menu(abrir) { gearMenu.hidden = !abrir; gearBtn.setAttribute("aria-expanded", abrir ? "true" : "false"); }
gearBtn.addEventListener("click", (e) => { e.stopPropagation(); menu(gearMenu.hidden); });
document.addEventListener("click", (e) => { if (!gearMenu.hidden && !gearMenu.contains(e.target)) menu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { menu(false); fecharModal(); } });
gearMenu.querySelectorAll("[data-gear]").forEach((b) => b.addEventListener("click", () => {
  menu(false);
  const k = b.dataset.gear;
  if (k === "sair") sair();
  if (k === "senha") janelaSenha();
  if (k === "usuarios") { abrirModal("Usuários", `<div class="muted small">Carregando…</div>`); carregarUsuarios(); }
  if (k === "backup") janelaBackup();
}));
function abrirModal(titulo, html) { $("#modalTitle").textContent = titulo; $("#modalBody").innerHTML = html; $("#modal").hidden = false; }
function fecharModal() { $("#modal").hidden = true; $("#modalBody").innerHTML = ""; }
$("#modalX").addEventListener("click", fecharModal);
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });

function janelaSenha() {
  abrirModal("Alterar senha", `<form id="fSenhaNova" class="form-col" autocomplete="off">
    <label class="f">Senha atual<input name="atual" type="password" autocomplete="current-password" required></label>
    <label class="f">Nova senha<input name="nova" type="password" minlength="8" autocomplete="new-password" required></label>
    <label class="f">Repita a nova senha<input name="nova2" type="password" minlength="8" autocomplete="new-password" required></label>
    <div class="muted small">Mínimo de 8 caracteres.</div>
    <div><button class="primary">Salvar nova senha</button></div></form>`);
  $("#fSenhaNova").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    if (f.get("nova") !== f.get("nova2")) { A.toast("As duas senhas novas não são iguais."); return; }
    try {
      const r = await fetch("/api/senha", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ atual: f.get("atual"), nova: f.get("nova") }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "erro " + r.status);
      fecharModal(); A.toast("Senha alterada.");
    } catch (er) { A.toast("Não foi possível: " + er.message); }
  });
}
function janelaBackup() {
  abrirModal("Backup", `<p class="small" style="margin-top:0">O servidor faz um backup automático todo dia às 02:30 e guarda os últimos 30 dias.</p>
    <p class="small">Baixe uma cópia de vez em quando e guarde fora do servidor, por exemplo no Google Drive.</p>
    <button class="primary" id="btnBackup">Baixar backup agora</button>`);
  $("#btnBackup").onclick = () => { const a = document.createElement("a"); a.href = "/api/backup"; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); A.toast("Backup sendo baixado…"); };
}

$("#cliNovo").addEventListener("click", () => {
  if (!confirmaDescarte()) return;
  const keep = A.S.deck.custom; A.setState({ deck: { custom: keep } }); salvo = foto(); A.showTab("dados");
});

/* ---------- abrir cliente / versão ---------- */
function aplicar(dados, clienteId, sel) {
  const d = JSON.parse(JSON.stringify(dados || {}));
  d.clienteId = clienteId;
  A.setState(d);
  if (sel) { A.S.wa.sel = sel; A.save(); }
  salvo = foto();
}
async function abrirCliente(id, aba, sel) {
  if (A.S.clienteId !== id && !confirmaDescarte()) return;
  try {
    const r = await api("GET", `/api/clientes/${id}`);
    aplicar(r.estudo ? r.estudo.dados : { cli: { nome: r.cliente.nome } }, id, sel);
    A.showTab(aba || "dados");
    if (!r.estudo) A.toast("Cliente sem estudo salvo ainda. Preencha e clique em Salvar.");
  } catch (e) { A.toast("Não foi possível abrir: " + e.message); }
}
async function abrirVersao(estudoId) {
  if (!confirmaDescarte()) return;
  try {
    const r = await api("GET", `/api/estudos/${estudoId}`);
    aplicar(r.estudo.dados, r.cliente.id);
    A.showTab("dados");
    A.toast("Versão de " + diaHora(r.estudo.criado_em) + " aberta. Salvar cria uma nova versão.");
  } catch (e) { A.toast("Não foi possível abrir: " + e.message); }
}

/* ---------- listas ---------- */
let tBusca;
$("#cliBusca").addEventListener("input", () => { clearTimeout(tBusca); tBusca = setTimeout(carregarLista, 250); });
$("#cliStatus").addEventListener("change", carregarLista);

function carregarTudo() { carregarRetomadas(); carregarLista(); }

async function carregarRetomadas() {
  const box = $("#retomadas");
  try {
    const r = await api("GET", "/api/retomadas");
    const itens = r.retomadas.map((c) => {
      const atrasada = c.proxima_retomada < r.hoje;
      return `<div class="ret-it"><div><b>${esc(c.nome)}</b><span class="muted small"> · ${STATUS_NOME[c.status]}${ME.papel === "admin" ? " · " + esc(c.corretor) : ""}</span>
        <div class="small ${atrasada ? "atras" : "muted"}">${atrasada ? "Atrasada desde " : "Retomar hoje · "}${dia(c.proxima_retomada)}</div></div>
        <button class="primary" data-msg="${c.id}" data-st="${c.status}">Abrir mensagem</button></div>`;
    }).join("");
    box.innerHTML = `<h3>Retomadas de hoje <span class="pill">${r.retomadas.length}</span></h3>${itens || `<div class="muted small">Nenhuma retomada para hoje.</div>`}`;
    box.querySelectorAll("[data-msg]").forEach((b) => b.addEventListener("click", () => abrirCliente(+b.dataset.msg, "wa", b.dataset.st === "vou_avaliar" ? "avaliar" : "retomada")));
  } catch (e) { box.innerHTML = `<h3>Retomadas de hoje</h3><div class="muted small">Erro: ${esc(e.message)}</div>`; }
}

async function carregarLista() {
  const box = $("#cliLista");
  const q = new URLSearchParams(); const b = $("#cliBusca").value.trim(), st = $("#cliStatus").value;
  if (b) q.set("busca", b); if (st) q.set("status", st);
  try {
    const { clientes } = await api("GET", "/api/clientes?" + q);
    if (!clientes.length) { box.innerHTML = `<div class="muted small" style="padding:10px 2px">${b || st ? "Nenhum cliente com esse filtro." : "Nenhum cliente salvo ainda. Preencha a aba Dados e clique em Salvar."}</div>`; return; }
    const adm = ME.papel === "admin";
    box.innerHTML = `<div class="tbl-wrap"><table class="cli"><thead><tr><th>Cliente</th>${adm ? "<th>Corretor</th>" : ""}<th>Status</th><th>Última versão</th><th class="n">Essencial</th><th class="n">Completa</th><th>Retomada</th><th></th></tr></thead><tbody>
      ${clientes.map((c) => `<tr data-id="${c.id}" class="${A.S.clienteId === c.id ? "atual" : ""}">
        <td><button class="lnk" data-abrir="${c.id}">${esc(c.nome)}</button><div class="muted small">${esc(c.profissao || "")}${c.renda ? (c.profissao ? " · " : "") + "renda " + brl(c.renda) : ""}</div></td>
        ${adm ? `<td class="small">${esc(c.corretor)}</td>` : ""}
        <td><select data-st="${c.id}">${STATUS.map(([k, t]) => `<option value="${k}"${c.status === k ? " selected" : ""}>${t}</option>`).join("")}</select></td>
        <td class="small">${c.estudo_em ? diaHora(c.estudo_em) + `<div class="muted">v${c.versoes}</div>` : "—"}</td>
        <td class="n">${brl(c.essencial)}</td><td class="n">${brl(c.completa)}</td>
        <td class="small">${c.proxima_retomada && !["fechado", "perdido"].includes(c.status) ? dia(c.proxima_retomada) : "—"}</td>
        <td class="acts"><button data-abrir="${c.id}">Abrir</button><button data-hist="${c.id}">Versões</button><button class="del" data-del="${c.id}" data-nome="${esc(c.nome)}">Excluir</button></td>
      </tr>`).join("")}</tbody></table></div>`;
    box.querySelectorAll("[data-abrir]").forEach((x) => x.addEventListener("click", () => abrirCliente(+x.dataset.abrir)));
    box.querySelectorAll("[data-st]").forEach((x) => x.addEventListener("change", async () => {
      try { const r = await api("PUT", `/api/clientes/${x.dataset.st}/status`, { status: x.value }); A.toast(`Status: ${STATUS_NOME[r.cliente.status]}${r.cliente.proxima_retomada ? " · retomada em " + dia(r.cliente.proxima_retomada) : ""}`); carregarTudo(); }
      catch (e) { A.toast("Erro: " + e.message); }
    }));
    box.querySelectorAll("[data-hist]").forEach((x) => x.addEventListener("click", () => historico(+x.dataset.hist, x.closest("tr"))));
    box.querySelectorAll("[data-del]").forEach((x) => x.addEventListener("click", () => excluir(+x.dataset.del, x.dataset.nome)));
  } catch (e) { box.innerHTML = `<div class="muted small">Erro: ${esc(e.message)}</div>`; }
}

async function historico(id, tr) {
  const aberto = tr.nextElementSibling && tr.nextElementSibling.classList.contains("hist");
  document.querySelectorAll("tr.hist").forEach((x) => x.remove());
  if (aberto) return;
  try {
    const [{ estudos }, { eventos }] = await Promise.all([api("GET", `/api/clientes/${id}/estudos`), api("GET", `/api/clientes/${id}/eventos`)]);
    const row = document.createElement("tr"); row.className = "hist";
    row.innerHTML = `<td colspan="${tr.children.length}"><div class="hist-grid">
      <div><h4>Versões do estudo</h4>${estudos.map((e) => `<div class="hv"><span><b>v${e.versao}</b> · ${diaHora(e.criado_em)} · ${esc(e.autor)}<br><span class="muted small">Essencial ${brl(e.essencial)}${e.completa ? " · Completa " + brl(e.completa) : ""}</span></span><button data-ver="${e.id}">Abrir esta versão</button></div>`).join("") || `<div class="muted small">Nenhuma versão salva.</div>`}</div>
      <div><h4>Histórico</h4>${eventos.map((e) => `<div class="he small"><b>${diaHora(e.criado_em)}</b> · ${EVENTO_NOME[e.tipo] || esc(e.tipo)}${e.detalhe ? ": " + esc(e.detalhe) : ""} <span class="muted">(${esc(e.autor)})</span></div>`).join("") || `<div class="muted small">Sem eventos.</div>`}</div>
    </div></td>`;
    tr.after(row);
    row.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => abrirVersao(+b.dataset.ver)));
  } catch (e) { A.toast("Erro: " + e.message); }
}

async function excluir(id, nome) {
  if (!confirm(`Excluir "${nome}" com todas as versões do estudo e o histórico?\n\nIsso não pode ser desfeito (pedido de exclusão LGPD).`)) return;
  try {
    await api("DELETE", `/api/clientes/${id}`);
    if (A.S.clienteId === id) { A.S.clienteId = null; A.save(); salvo = foto(); }
    A.toast("Cliente excluído"); carregarTudo();
  } catch (e) { A.toast("Erro: " + e.message); }
}

/* ---------- usuários (admin) ---------- */
async function carregarUsuarios() {
  const box = $("#modalBody");
  if ($("#modal").hidden) return;
  try {
    const { usuarios } = await api("GET", "/api/usuarios");
    box.innerHTML = `
      <div class="tbl-wrap"><table class="cli"><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th class="n">Clientes</th><th>Situação</th><th></th></tr></thead><tbody>
      ${usuarios.map((u) => `<tr><td>${esc(u.nome)}${u.id === ME.id ? ' <span class="muted small">(você)</span>' : ""}</td><td class="small">${esc(u.email)}</td><td>${u.papel === "admin" ? "Admin" : "Corretor"}</td><td class="n">${u.clientes}</td>
        <td class="small">${u.ativo ? "Ativo" : "Desativado"}${u.trocarSenha ? " · troca de senha pendente" : ""}</td>
        <td class="acts">${u.id === ME.id ? "" : `<button data-uat="${u.id}" data-v="${u.ativo ? 0 : 1}">${u.ativo ? "Desativar" : "Ativar"}</button><button data-usen="${u.id}" data-nome="${esc(u.nome)}">Nova senha</button>${u.clientes ? "" : `<button class="del" data-udel="${u.id}" data-nome="${esc(u.nome)}">Excluir</button>`}`}</td></tr>`).join("")}
      </tbody></table></div>
      <form id="novoUser" class="novo-user" autocomplete="off">
        <input name="nome" placeholder="Nome" required><input name="email" type="email" placeholder="E-mail" required>
        <input name="senha" type="text" placeholder="Senha provisória (mín. 8)" minlength="8" required autocomplete="new-password">
        <select name="papel"><option value="corretor">Corretor</option><option value="admin">Admin</option></select>
        <button class="primary">Criar usuário</button>
      </form><div class="muted small">A pessoa troca a senha provisória no primeiro login.</div>`;
    box.querySelectorAll("[data-uat]").forEach((b) => b.addEventListener("click", () => acaoUser(b.dataset.uat, { ativo: !!+b.dataset.v })));
    box.querySelectorAll("[data-usen]").forEach((b) => b.addEventListener("click", () => {
      const s = prompt(`Senha provisória para ${b.dataset.nome} (mínimo 8 caracteres):`); if (s) acaoUser(b.dataset.usen, { senha: s });
    }));
    box.querySelectorAll("[data-udel]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm(`Excluir o usuário ${b.dataset.nome}?`)) return;
      try { await api("DELETE", `/api/usuarios/${b.dataset.udel}`); carregarUsuarios(); } catch (e) { A.toast("Erro: " + e.message); }
    }));
    $("#novoUser").addEventListener("submit", async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      try { await api("POST", "/api/usuarios", Object.fromEntries(f)); A.toast("Usuário criado"); carregarUsuarios(); } catch (er) { A.toast("Erro: " + er.message); }
    });
  } catch (e) { box.innerHTML = `<div class="muted small">Erro: ${esc(e.message)}</div>`; }
}
async function acaoUser(id, body) {
  try { await api("PUT", `/api/usuarios/${id}`, body); A.toast("Usuário atualizado"); carregarUsuarios(); } catch (e) { A.toast("Erro: " + e.message); }
}

iniciar();
window.__clientes = { carregarTudo, abrirCliente, abrirVersao };
})();
