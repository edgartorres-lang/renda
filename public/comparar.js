/* Renda Protegida · aba Comparar (uso interno): compara as versões do cliente feitas com cotações de seguradoras diferentes.
   Não entra no estudo, nos slides nem nas mensagens. Sem IA: contas fixas sobre os dados de cada cotação. */
(function () {
"use strict";
const A = window.__app;
const $ = (s, el) => (el || document).querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = (v) => "R$ " + (+v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = (v) => "R$ " + Math.round(+v || 0).toLocaleString("pt-BR");
const dia = (d) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const PRIOS = [["equilibrio", "Mais proteção por real"], ["renda", "Melhor renda por afastamento"], ["preco", "Menor preço"]];
const MAX = 4;

let versoes = [], marcadas = null, cache = {}, clienteDe = null;
let prio = "equilibrio";
try { prio = localStorage.getItem("sn_rp_comp_prio") || prio; } catch (e) {}

async function api(url) {
  const r = await fetch(url, { credentials: "same-origin" });
  if (r.status === 401) { location.href = "/login.html"; throw new Error("sessão expirada"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || "erro " + r.status);
  return j;
}

/* observações fixas por seguradora, tiradas das cotações e dos descritivos */
const NOTAS = [
  [/icatu/i, ["Renda por afastamento limitada a 10% da cobertura de morte.", "Acidente paga desde o 1º dia; doença a partir do 16º."]],
  [/mag/i, ["A renda paga respeita a renda comprovada, na contratação e no pagamento.", "Pode pedir formulário de saúde e, em alguns casos, exames.", "Valores corrigidos todo ano pelo IPCA e pela faixa de idade."]],
  [/azos/i, ["Coberturas contratadas separadamente (sem venda casada).", "Análise de risco simplificada, sem exames.", "Doenças Graves 30: antecipa 30% do capital em estágios leves de câncer, AVC e infarto (50% no câncer moderado).", "Cotação válida por só 7 dias."]]
];
const notasDe = (seg) => (NOTAS.find(([re]) => re.test(seg || "")) || [null, []])[1];

/* quanto a renda por afastamento paga num afastamento de N dias, com a franquia fr */
function pagoEm(m, dias, fr) {
  if (!m.dit) return 0;
  if (m.retro) return dias > fr ? m.dit * Math.min(dias, m.ditMeses * 30) / 30 : 0;
  return m.dit * Math.min(Math.max(0, dias - fr), m.ditMeses * 30) / 30;
}

/* tipos de cobertura que o comparador alinha numa mesma linha */
const TIPOS = [
  ["Renda por afastamento", (m) => m.ditCob],
  ["Morte", (m) => m.cobs.find((c) => /^morte\b/i.test(c.nome))],
  ["Invalidez por acidente", (m) => m.cobs.find((c) => /invalidez/i.test(c.nome))],
  ["Doenças graves", (m) => m.cobs.find((c) => /graves/i.test(c.nome))],
  ["Fraturas e rupturas", (m) => m.cobs.find((c) => /fratura|ruptura/i.test(c.nome))],
  ["Funeral", (m) => m.cobs.find((c) => /funeral/i.test(c.nome))]
];

async function carregar() {
  const box = $("#comp");
  const id = A.S.clienteId;
  if (!id) { box.innerHTML = `<div class="card cmp-vazio"><h3>Comparar cotações <span class="tag-int">uso interno</span></h3><p class="muted">Abra um cliente na aba Clientes, ou importe a primeira cotação aqui: o cliente é criado com o nome que vier no PDF.</p>${dropHtml()}</div>`; ligarDrop(); return; }
  try {
    const r = await api(`/api/clientes/${id}/estudos`);
    versoes = r.estudos.filter((e) => e.essencial > 0);
    if (clienteDe !== id || !marcadas) {
      clienteDe = id;
      // padrão: a última versão de cada seguradora
      const vistas = new Set(); marcadas = new Set();
      versoes.forEach((e) => { const k = (e.seguradora || "?").toLowerCase(); if (!vistas.has(k) && marcadas.size < MAX) { vistas.add(k); marcadas.add(e.id); } });
    } else marcadas = new Set([...marcadas].filter((x) => versoes.some((e) => e.id === x)));
    await render();
  } catch (e) { box.innerHTML = `<div class="card"><div class="muted">Erro: ${esc(e.message)}</div></div>`; }
}

const dropHtml = () => `<label class="drop cmp-drop">Importar cotações (Icatu, MAG ou Azos)<small>Pode escolher vários PDFs. Cada cotação vira uma versão do cliente.</small><input type="file" accept="application/pdf" multiple data-cmpimp hidden></label><div class="status" id="cmpStatus"></div>`;
function ligarDrop() {
  const inp = $("[data-cmpimp]"); if (!inp) return;
  inp.addEventListener("change", async () => {
    const fs = [...inp.files]; inp.value = "";
    for (const f of fs) { const st = $("#cmpStatus"); if (st) st.textContent = "Lendo " + f.name + "…"; try { await A.importPdf(f); } catch (e) {} }
    marcadas = null; // depois de importar, volta ao padrão: a última de cada seguradora
    A.showTab("comp");
  });
}

async function render() {
  const box = $("#comp");
  const sel = versoes.filter((e) => marcadas.has(e.id));
  const lista = versoes.map((e) => `<label class="cmp-v"><input type="checkbox" data-cv="${e.id}"${marcadas.has(e.id) ? " checked" : ""}> <b>v${e.versao}</b> · ${esc(e.seguradora || "seguradora?")} · ${brl(e.essencial)} <span class="muted small">${dia(e.criado_em)}</span></label>`).join("");
  let corpo = "";
  if (sel.length < 2) corpo = `<div class="card"><p class="muted" style="margin:0">Marque pelo menos duas versões para comparar. ${versoes.length < 2 ? "Importe as cotações das outras seguradoras acima." : ""}</p></div>`;
  else {
    const sim = { meses: A.S.sim.meses };
    const cols = [];
    for (const e of sel) {
      if (!cache[e.id]) cache[e.id] = (await api(`/api/estudos/${e.id}`)).estudo.dados;
      cols.push({ e, m: A.calcCom(cache[e.id], sim) });
    }
    corpo = analise(cols);
  }
  box.innerHTML = `<div class="card"><h3>Comparar cotações <span class="tag-int">uso interno</span></h3>
      <p class="muted small" style="margin-top:0">Não entra no estudo, nos slides nem nas mensagens. Cliente: <b>${esc(A.S.cli.nome || "")}</b>.</p>
      <div class="cmp-top"><div>${dropHtml()}</div><div><div class="small" style="font-weight:800;margin-bottom:6px">Versões para comparar (até ${MAX})</div>${lista || `<div class="muted small">Nenhuma versão com cotação ainda.</div>`}</div></div></div>${corpo}`;
  ligarDrop();
  box.querySelectorAll("[data-cv]").forEach((c) => c.addEventListener("change", () => {
    const id = +c.dataset.cv;
    if (c.checked) { if (marcadas.size >= MAX) { c.checked = false; A.toast(`Compare até ${MAX} versões por vez.`); return; } marcadas.add(id); } else marcadas.delete(id);
    render();
  }));
  box.querySelectorAll("[data-prio]").forEach((b) => b.addEventListener("click", () => { prio = b.dataset.prio; try { localStorage.setItem("sn_rp_comp_prio", prio); } catch (e) {} render(); }));
  box.querySelectorAll("[data-usar]").forEach((b) => b.addEventListener("click", () => window.__clientes.abrirVersao(+b.dataset.usar)));
}

function analise(cols) {
  const n = cols.length, meses = cols[0].m.meses;
  const nomeCol = (c) => `${esc(c.m.seguradora)} <span class="muted small">v${c.e.versao}</span>`;
  // indicadores (melhor = menor ou maior)
  const ind = [
    { k: "total", t: "Total por mês", v: (m) => m.premio, f: brl, melhor: "min" },
    { k: "custo", t: "Custo de cada R$ 1.000 de renda por mês", v: (m) => (m.ditCob && m.dit ? m.ditCob.premio / m.dit * 1000 : null), f: brl, melhor: "min" },
    { k: "curto", t: "Recebe num afastamento de 15 dias por doença", v: (m) => pagoEm(m, 15, m.franquia), f: brl0, melhor: "max" },
    { k: "acid", t: `Recebe num afastamento de ${meses} meses por acidente`, v: (m) => m.pagoAcid, f: brl0, melhor: "max" },
    { k: "medio", t: `Recebe num afastamento de ${meses} meses por doença`, v: (m) => m.pagoDoenca, f: brl0, melhor: "max" },
    { k: "longo", t: "Recebe num afastamento de 18 meses por doença", v: (m) => pagoEm(m, 540, m.franquia), f: brl0, melhor: "max" }
  ];
  const vals = ind.map((x) => cols.map((c) => x.v(c.m)));
  const melhor = ind.map((x, i) => { const vs = vals[i].filter((v) => v != null); if (vs.length < 2 || Math.max(...vs) === Math.min(...vs)) return null; return x.melhor === "min" ? Math.min(...vs) : Math.max(...vs); });
  const pior = ind.map((x, i) => { const vs = vals[i].filter((v) => v != null); if (vs.length < 2 || Math.max(...vs) === Math.min(...vs)) return null; return x.melhor === "min" ? Math.max(...vs) : Math.min(...vs); });

  // sugestão conforme a prioridade
  const somaRenda = (m) => pagoEm(m, 15, m.franquia) + m.pagoDoenca + pagoEm(m, 540, m.franquia);
  const nota = { preco: (m) => -m.premio, renda: (m) => somaRenda(m), equilibrio: (m) => (m.premio ? somaRenda(m) / m.premio : 0) }[prio] || ((m) => 0);
  const ordem = cols.map((c, i) => ({ i, s: nota(c.m) })).sort((a, b) => b.s - a.s);
  const win = cols[ordem[0].i];
  const explica = {
    preco: "a de menor total por mês",
    renda: `a que mais paga somando três afastamentos por doença (15 dias, ${meses} meses e 18 meses)`,
    equilibrio: `a que mais paga em afastamentos (15 dias, ${meses} e 18 meses, por doença) para cada real de mensalidade`
  }[prio];
  const pros = (ci) => ind.map((x, i) => (melhor[i] != null && vals[i][ci] === melhor[i] ? `${x.t}: ${x.f(vals[i][ci])}` : null)).filter(Boolean);
  const contras = (ci) => ind.map((x, i) => (pior[i] != null && vals[i][ci] === pior[i] ? `${x.t}: ${x.f(vals[i][ci])}` : null)).filter(Boolean);

  // tabela de coberturas
  const linha = (titulo, fn) => {
    const cel = cols.map((c) => fn(c.m));
    const caps = cel.filter(Boolean).map((x) => x.capital);
    const iguais = caps.length >= 2 && caps.every((v) => v === caps[0]);
    const difer = caps.length >= 2 && !iguais;
    const precos = cel.filter(Boolean).map((x) => x.premio);
    const minP = iguais ? Math.min(...precos) : null;
    return `<tr><th>${titulo}${difer ? ` <span class="cmp-dif" title="Capitais diferentes: a comparação de preço não é igual">capitais diferentes</span>` : ""}</th>${cel.map((x) => (x ? `<td class="${minP != null && x.premio === minP && precos.length > 1 ? "best" : ""}"><b>${brl0(x.capital)}${titulo.startsWith("Renda") ? "/mês" : ""}</b><span>${brl(x.premio)}/mês</span></td>` : `<td class="nao">não tem</td>`)).join("")}</tr>`;
  };
  const conhecidas = (c) => TIPOS.map(([, f]) => f(c.m)).filter(Boolean);
  const outras = {};
  cols.forEach((c, ci) => c.m.cobs.filter((x) => !conhecidas(c).includes(x)).forEach((x) => { (outras[x.nome] = outras[x.nome] || [])[ci] = x; }));
  const linhasOutras = Object.entries(outras).map(([nome, arr]) => linha(esc(nome), (m) => arr[cols.findIndex((c) => c.m === m)] || null)).join("");
  const regra = (t, f) => `<tr class="regra"><th>${t}</th>${cols.map((c) => `<td>${f(c.m)}</td>`).join("")}</tr>`;
  const indRows = ind.map((x, i) => `<tr><th>${x.t}</th>${cols.map((c, ci) => { const v = vals[i][ci]; return `<td class="${v != null && v === melhor[i] ? "best" : ""}">${v == null ? "—" : x.f(v)}</td>`; }).join("")}</tr>`).join("");
  const difDit = (() => { const d = cols.map((c) => c.m.dit).filter(Boolean); return d.length > 1 && !d.every((v) => v === d[0]); })();

  return `<div class="card cmp-sug">
      <div class="cmp-sug-h"><h3 style="margin:0">Sugestão de oferta</h3><div class="seg">${PRIOS.map(([k, t]) => `<button data-prio="${k}" class="${prio === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
      <p class="cmp-win">Ofertar <b>${esc(win.m.seguradora)}</b> (v${win.e.versao} · ${brl(win.m.premio)}/mês): é ${explica}.</p>
      ${difDit ? `<p class="small cmp-aviso">⚠️ A renda por afastamento tem valores diferentes entre as cotações (${cols.map((c) => `${esc(c.m.seguradora)} ${brl0(c.m.dit)}`).join(" · ")}). Para uma comparação igual, cote o mesmo valor nas seguradoras.</p>` : ""}
      <div class="cmp-cards">${cols.map((c, ci) => `<div class="cmp-c${c === win ? " win" : ""}"><b>${nomeCol(c)}</b>
        ${pros(ci).length ? `<div class="small ok">✅ ${pros(ci).join("<br>✅ ")}</div>` : ""}
        ${contras(ci).length ? `<div class="small no">➖ ${contras(ci).join("<br>➖ ")}</div>` : ""}
        ${notasDe(c.m.seguradora).length ? `<div class="small muted">• ${notasDe(c.m.seguradora).join("<br>• ")}</div>` : ""}
        <button class="primary" data-usar="${c.e.id}">Usar esta no estudo</button></div>`).join("")}</div>
      <p class="muted small" style="margin-bottom:0">A sugestão é uma ajuda: considera só o que vem nas cotações. A escolha final é sua.</p>
    </div>
    <div class="card"><h3>Lado a lado</h3><div class="cmp-wrap"><table class="cmp">
      <thead><tr><th></th>${cols.map((c) => `<th>${nomeCol(c)}<br><span class="muted small">${esc(c.m.produto)}</span></th>`).join("")}</tr></thead>
      <tbody>
        <tr class="sec"><td colspan="${n + 1}">Coberturas · capital e mensalidade</td></tr>
        ${TIPOS.map(([t, f]) => linha(t, f)).join("")}${linhasOutras}
        <tr class="sec"><td colspan="${n + 1}">Regras da renda por afastamento</td></tr>
        ${regra("Começa a pagar", (m) => (m.dit ? cap(m.quando) : "—"))}
        ${regra("Paga por até", (m) => (m.dit ? `${m.ditMeses} meses` : "—"))}
        ${regra("LER/DORT/LTC", (m) => (m.ler ? `carência de ${m.lerCar} dias, paga até ${m.lerMax} dias` : "sem regra especial"))}
        ${regra("Carência por doença", (m) => `${m.carencia} dias`)}
        ${regra("Limite pela cobertura de morte", (m) => (m.limPct ? `até ${m.limPct}% da morte` : "não tem"))}
        <tr class="sec"><td colspan="${n + 1}">Indicadores (verde = melhor)</td></tr>
        ${indRows}
      </tbody></table></div>
      <p class="muted small" style="margin-bottom:0">Afastamentos calculados com a renda por afastamento de cada cotação e as regras acima. O de ${meses} meses segue a simulação da aba Dados.</p></div>`;
}

window.addEventListener("rp:tab", (e) => { if (e.detail === "comp") carregar(); });
// versão nova (cotação importada ou Salvar): a seleção volta ao padrão, a última de cada seguradora
window.addEventListener("rp:versoes", () => { marcadas = null; if (document.querySelector("#v-comp.on")) carregar(); });
// a página abriu direto na aba Comparar (#comp): o app.js já mostrou a aba antes deste arquivo carregar
if (document.querySelector("#v-comp.on")) carregar();
})();
