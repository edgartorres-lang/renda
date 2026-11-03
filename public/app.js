/* Renda Protegida · Estudo e Apresentação — Setor Norte Seguros */
(function () {
"use strict";
const P = window.IcatuParser;
const KEY = "sn_renda_protegida_v2";
const TETO_PADRAO = "8.475,55", PISO_PADRAO = "1.621,00";
const CORRETOR = { nome: "Edgar Torres", tel: "(96) 98133-9955", email: "edgartorres@setornorteseguros.com.br", ig: "@edgartorres.seguros" };

/* ---------- utilidades ---------- */
const num = P.num;
const $ = (s, el) => (el || document).querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (v, dec) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 });
const brl = (v) => "R$ " + fmt(v, true);
const brl0 = (v) => "R$ " + fmt(Math.round(v || 0), false);
const short = (v) => v >= 1e6 ? "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : v >= 1e4 ? "R$ " + Math.round(v / 1e3) + " mil" : brl0(v);
const inBR = (v, dec) => v ? fmt(v, dec) : "";
const fv = (pmt, aa, months) => { const r = Math.pow(1 + aa / 100, 1 / 12) - 1; return r ? pmt * (Math.pow(1 + r, months) - 1) / r : pmt * months; };
const first = (n) => (String(n || "").trim().split(/\s+/)[0] || "");
const dataLonga = (d) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const dataCurta = (d) => d.toLocaleDateString("pt-BR");
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600); }

/* ---------- profissões ---------- */
const PROF = {
  fisio: { M: "Fisioterapeuta", F: "Fisioterapeuta", cover: "fisio1", ab: "Todos os dias, você usa as próprias mãos para trazer alívio e qualidade de vida para outras pessoas. O seu corpo é o seu grande instrumento de trabalho.", rot: "a sua rotina exige muito fisicamente", imp: "uma lesão no punho ou no ombro" },
  to: { M: "Terapeuta ocupacional", F: "Terapeuta ocupacional", cover: "fisio2", ab: "Todos os dias, você ajuda outras pessoas a reconquistar autonomia e a fazer por conta própria aquilo que importa para elas. O seu corpo é o seu grande instrumento de trabalho.", rot: "a sua rotina exige muito fisicamente", imp: "uma lesão no ombro" },
  dent: { M: "Dentista", F: "Dentista", cover: "dent1", ab: "Todos os dias, você usa a precisão das suas mãos para devolver saúde, conforto e confiança ao sorriso de outras pessoas. As suas mãos são o seu grande instrumento de trabalho.", rot: "a sua rotina exige precisão, postura e horas seguidas de concentração", imp: "uma tendinite no punho" },
  enf: { M: "Enfermeiro", F: "Enfermeira", cover: "enf1", ab: "Todos os dias, você está ao lado de quem mais precisa, cuidando com as mãos, com a atenção e com o corpo inteiro. O seu corpo é o seu grande instrumento de trabalho.", rot: "a sua rotina exige muito fisicamente, entre plantões e horas em pé", imp: "uma lesão na coluna durante um plantão" },
  psi: { M: "Psicólogo", F: "Psicóloga", cover: "saude1", ab: "Todos os dias, você acolhe as histórias de outras pessoas e ajuda cada uma a encontrar o próprio caminho. A sua presença é o seu grande instrumento de trabalho.", rot: "a sua agenda depende de você estar presente, sessão após sessão", imp: "uma cirurgia ou uma fratura que exija semanas de repouso" },
  fono: { M: "Fonoaudiólogo", F: "Fonoaudióloga", cover: "saude1", ab: "Todos os dias, você ajuda outras pessoas a falar, ouvir e se expressar melhor. A sua saúde é o que sustenta cada atendimento.", rot: "a sua agenda depende de você estar presente, sessão após sessão", imp: "uma cirurgia que exija semanas de repouso" },
  farm: { M: "Farmacêutico", F: "Farmacêutica", cover: "saude1", ab: "Todos os dias, você garante que cada medicamento chegue ao paciente com segurança e precisão. A sua atenção aos detalhes é o seu grande instrumento de trabalho.", rot: "a sua rotina exige atenção constante e muitas horas em pé", imp: "uma lesão por esforço repetitivo no punho" },
  biom: { M: "Biomédico", F: "Biomédica", cover: "saude1", ab: "Todos os dias, você usa a precisão das suas mãos e do seu olhar para dar respostas que mudam diagnósticos e tratamentos.", rot: "a sua rotina exige precisão, movimentos repetitivos e horas de concentração", imp: "uma tendinite no punho ou no ombro" },
  med: { M: "Médico", F: "Médica", cover: "saude1", ab: "Todos os dias, você decide sobre a saúde de outras pessoas, com conhecimento, atenção e presença. Você é o seu grande instrumento de trabalho.", rot: "a sua agenda depende de você estar presente, plantão após plantão", imp: "uma cirurgia ou uma fratura que exija semanas de repouso" },
  outra: { M: "", F: "", cover: "saude1", ab: "Todos os dias, você coloca o seu conhecimento e a sua dedicação a serviço de outras pessoas. É o seu trabalho que sustenta a sua renda.", rot: "a sua renda depende de você estar presente e em plena forma", imp: "uma cirurgia ou uma fratura que exija semanas de repouso" }
};
const PROF_OPTS = [["", "Selecione"], ["fisio", "Fisioterapia"], ["to", "Terapia ocupacional"], ["dent", "Odontologia"], ["enf", "Enfermagem"], ["psi", "Psicologia"], ["fono", "Fonoaudiologia"], ["farm", "Farmácia"], ["biom", "Biomedicina"], ["med", "Medicina"], ["outra", "Outra (digitar)"]];
const COVERS = { fisio1: "img/fisio1.jpg", fisio2: "img/fisio2.jpg", dent1: "img/dent1.jpg", dent2: "img/dent2.jpg", enf1: "img/enf1.jpg", enf2: "img/enf2.jpg", saude1: "img/saude1.jpg" };
const COVER_POS = { fisio1: "42% 30%", fisio2: "38% 30%", dent1: "62% 30%", dent2: "30% 30%", enf1: "50% 25%", enf2: "38% 30%", saude1: "68% 25%", custom: "50% 50%" };

/* ---------- estado ---------- */
const DEF = () => ({
  cli: { nome: "", sexo: "", idade: "", prof: "", profOutra: "", renda: "" },
  inss: { modo: "base", base: "", valor: "", teto: TETO_PADRAO, piso: PISO_PADRAO },
  sim: { meses: "6", reserva: "", validade: "10" },
  seg: { seguradora: "Icatu Seguros", produto: "Seguro Essencial", premio: "", cobs: [], proj: [], ditMeses: "12", franquia: "15", carencia: "60", lerCar: "", lerMax: "", limPct: "10", nome: "", idade: "" },
  prev: { on: false, produto: "Atitude + Simples", aporte: "", risco: "", riscoNome: "Renda por Invalidez", riscoCap: "", taxa: "", anos: "", idadeApos: "", reserva: "", rendaVit: "", sexo: "", idade: "", nome: "" },
  deck: { cover: "auto", custom: "", off: { inss: true, faq: true } },
  wa: { opcao: "essencial", sel: "estudo" },
  imp: { seg: "", prev: "" },
  clienteId: null
});
let S = DEF();
try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) S = deepMerge(DEF(), s); } catch (e) {}
function deepMerge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object") a[k] = deepMerge(a[k], b[k]); else a[k] = b[k]; } return a; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { try { const c = { ...S, deck: { ...S.deck, custom: "" } }; localStorage.setItem(KEY, JSON.stringify(c)); } catch (e2) {} } }
const getPath = (p) => p.split(".").reduce((o, k) => (o == null ? o : o[k]), S);
const setPath = (p, v) => { const ks = p.split("."); let o = S; ks.slice(0, -1).forEach((k) => (o = o[k])); o[ks[ks.length - 1]] = v; };

/* ---------- cálculo ---------- */
function calc() {
  const c = S.cli, sg = S.seg, pv = S.prev;
  const m = {};
  m.nome = (c.nome || "").trim() || "Cliente"; m.first = first(m.nome);
  m.sexo = c.sexo || ""; m.ela = m.sexo === "F";
  const pk = PROF[c.prof] ? c.prof : "outra"; m.profKey = pk; m.P = PROF[pk];
  m.prof = pk === "outra" ? (c.profOutra || "").trim() : (m.ela ? m.P.F : m.P.M);
  m.idade = Math.round(num(c.idade)) || Math.round(num(sg.idade)) || Math.round(num(pv.idade)) || 0;
  m.renda = num(c.renda);
  // INSS
  const teto = num(S.inss.teto) || 8475.55, piso = num(S.inss.piso) || 1621;
  m.inss = null; m.inssOrig = "";
  if (S.inss.modo === "base" && num(S.inss.base) > 0) { m.inss = Math.max(piso, Math.min(num(S.inss.base), teto) * 0.91); m.inssOrig = "base"; }
  if (S.inss.modo === "manual" && num(S.inss.valor) > 0) { m.inss = num(S.inss.valor); m.inssOrig = "manual"; }
  m.teto = teto;
  // coberturas
  m.cobs = (sg.cobs || []).map((x) => ({ nome: (x.nome || "").trim(), capital: num(x.capital), premio: num(x.premio) })).filter((x) => x.nome);
  const find = (re) => m.cobs.find((x) => re.test(x.nome));
  const dit = find(/incapacidade tempor|\bDIT\b|di[áa]ria de incap/i);
  m.ditCob = dit; m.dit = dit ? dit.capital : 0;
  m.morte = (find(/^morte\b/i) || {}).capital || 0;
  m.dg = (find(/graves/i) || {}).capital || 0;
  m.ipa = (find(/invalidez permanente/i) || {}).capital || 0;
  m.apoio = (find(/apoio financeiro/i) || {}).capital || 0;
  m.funeral = (find(/funeral/i) || {}).capital || 0;
  m.adiant = !!find(/adiantamento/i);
  m.soma = Math.round(m.cobs.reduce((a, x) => a + x.premio, 0) * 100) / 100;
  m.premio = num(sg.premio) || m.soma;
  m.ditMeses = Math.round(num(sg.ditMeses)) || 12;
  m.franquia = Math.round(num(sg.franquia)) || 15;
  m.carencia = Math.round(num(sg.carencia)) || 60;
  m.ler = dit && /LER|DORT/i.test(dit.nome);
  m.lerCar = Math.round(num(sg.lerCar)) || 150; m.lerMax = Math.round(num(sg.lerMax)) || 90;
  m.limPct = num(sg.limPct) || 10;
  // previdência
  m.aporte = num(pv.aporte); m.risco = num(pv.risco);
  m.prevOn = !!pv.on && m.aporte + m.risco > 0;
  m.taxa = num(pv.taxa) || 10; m.anos = Math.round(num(pv.anos)) || 0;
  m.idadeApos = Math.round(num(pv.idadeApos)) || (m.idade && m.anos ? m.idade + m.anos : 65);
  m.reserva = num(pv.reserva) || (m.anos ? fv(m.aporte, m.taxa, m.anos * 12) : 0);
  m.rendaVit = num(pv.rendaVit); m.riscoNome = pv.riscoNome || "Renda por Invalidez"; m.riscoCap = num(pv.riscoCap);
  m.prevTot = m.aporte + m.risco;
  m.essencial = m.premio; m.completa = m.premio + (m.prevOn ? m.prevTot : 0);
  m.pct = (v) => (m.renda ? (v / m.renda * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "");
  m.dia = (v) => v / 30;
  // simulação
  m.meses = Math.max(1, Math.round(num(S.sim.meses)) || 6);
  m.reservaMeses = num(S.sim.reserva);
  const inss = m.inss || 0;
  m.gapMes = Math.max(0, m.renda - inss);
  m.perdaSem = m.gapMes * m.meses;
  m.pagoAcid = m.dit * Math.min(m.meses, m.ditMeses);
  m.pagoDoenca = m.dit * Math.min(Math.max(0, m.meses * 30 - m.franquia), m.ditMeses * 30) / 30;
  m.perdaAcid = Math.max(0, m.perdaSem - m.pagoAcid);
  m.perdaDoenca = Math.max(0, m.perdaSem - m.pagoDoenca);
  m.rendaCom = inss + m.dit;
  // guardar sozinho
  m.taxaGuardar = m.taxa || 10;
  m.guardar = [1, 2, 3, 5].map((y) => ({ y, v: fv(m.premio, m.taxaGuardar, y * 12) }));
  // validade
  const hoje = new Date(); m.hoje = hoje; m.hojeLonga = "Macapá, " + dataLonga(hoje);
  m.validadeDias = Math.round(num(S.sim.validade)) || 10;
  const vd = new Date(hoje); vd.setDate(vd.getDate() + m.validadeDias); m.validade = dataCurta(vd); m.validadeCurta = vd.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  m.seguradora = sg.seguradora || "Icatu Seguros"; m.produto = sg.produto || "Seguro Essencial";
  // capa
  let ck = S.deck.cover; if (ck === "auto" || (!COVERS[ck] && ck !== "custom") || (ck === "custom" && !S.deck.custom)) ck = m.P.cover;
  m.coverKey = ck; m.coverSrc = ck === "custom" ? S.deck.custom : COVERS[ck];
  m.ready = m.renda > 0 && m.dit > 0 && m.premio > 0;
  return m;
}

function alertas(m) {
  const a = [];
  const add = (t, x) => a.push({ t, x });
  if (!S.imp.seg && !m.cobs.length) add("info", "Importe o PDF do seguro (Icatu Essencial) ou preencha as coberturas.");
  if (!m.renda) add("err", "Informe a renda mensal do cliente.");
  if (!m.dit) add("err", "Não encontrei a Diária de Incapacidade Temporária (DIT) nas coberturas.");
  if (m.cobs.length && Math.abs(m.soma - m.premio) > 0.02) add("err", `A soma das coberturas (${brl(m.soma)}) é diferente do prêmio total (${brl(m.premio)}). Falta alguma linha?`);
  else if (m.cobs.length) add("ok", `Soma das ${m.cobs.length} coberturas confere com o prêmio de ${brl(m.premio)}.`);
  if (m.dit && m.morte && m.dit > m.morte * m.limPct / 100) add("err", `DIT de ${brl0(m.dit)} passa do limite de ${m.limPct}% da cobertura de morte (${brl0(m.morte * m.limPct / 100)}).`);
  if (m.dit && m.renda && m.dit > m.renda) add("warn", `DIT (${brl0(m.dit)}) maior que a renda informada (${brl0(m.renda)}). Na indenização, a seguradora pode exigir comprovação de renda.`);
  if (m.inss == null) add("warn", "INSS em branco: o estudo vai mostrar a perda sem considerar o INSS. Informe a base de contribuição ou o valor.");
  if (!m.sexo) add("warn", "Informe o sexo do cliente (define a carta no feminino ou no masculino e confere o orçamento da previdência).");
  if (!S.cli.prof) add("warn", "Escolha a profissão (define a carta e a foto da capa).");
  if (S.cli.prof === "outra" && !S.cli.profOutra) add("warn", "Digite o nome da profissão.");
  if (S.prev.on) {
    if (S.prev.sexo && m.sexo && S.prev.sexo !== m.sexo) add("err", `O orçamento de previdência foi feito com sexo ${S.prev.sexo === "M" ? "masculino" : "feminino"}, mas o cliente é ${m.sexo === "M" ? "masculino" : "feminino"}. A renda por invalidez usa tábua por sexo: refaça o orçamento.`);
    const i1 = Math.round(num(S.seg.idade)), i2 = Math.round(num(S.prev.idade));
    if (i1 && i2 && i1 !== i2) add("warn", `Idade diferente entre os orçamentos: seguro ${i1} anos, previdência ${i2} anos.`);
    if (S.seg.nome && S.prev.nome && norm(S.seg.nome) !== norm(S.prev.nome)) add("err", `Os dois PDFs parecem ser de pessoas diferentes: "${S.seg.nome}" e "${S.prev.nome}".`);
    if (m.taxa >= 8) add("info", `A projeção da previdência usa ${fmt(m.taxa)}% ao ano (rentabilidade real estimada pela Icatu). É uma estimativa, não garantia: o estudo informa isso nos avisos.`);
  }
  if (m.ler) add("info", `DIT com LER/DORT/LTC: para essas lesões, carência de ${m.lerCar} dias e pagamento por até ${m.lerMax} dias. O estudo explica.`);
  return a;
}

/* ---------- FORMULÁRIO ---------- */
const fld = (path, label, opts = {}) => {
  const v = getPath(path);
  const val = opts.money && v !== "" && !isNaN(+v) ? inBR(+v, true) : v;
  if (opts.select) return `<label class="f">${label}<select data-k="${path}">${opts.select.map(([k, t]) => `<option value="${k}"${String(v) === k ? " selected" : ""}>${t}</option>`).join("")}</select>${opts.hint ? `<span class="hint">${opts.hint}</span>` : ""}</label>`;
  return `<label class="f">${label}<input data-k="${path}" value="${esc(val)}" placeholder="${esc(opts.ph || "")}" inputmode="${opts.num ? "decimal" : "text"}">${opts.hint ? `<span class="hint">${opts.hint}</span>` : ""}</label>`;
};
function renderForm() {
  const m = calc();
  const cobRows = (S.seg.cobs || []).map((c, i) => `<tr><td><input data-cob="${i}" data-f="nome" value="${esc(c.nome)}"></td><td style="width:130px"><input data-cob="${i}" data-f="capital" value="${esc(c.capital)}" inputmode="decimal"></td><td style="width:110px"><input data-cob="${i}" data-f="premio" value="${esc(c.premio)}" inputmode="decimal"></td><td class="x"><button data-delcob="${i}" title="Remover">×</button></td></tr>`).join("");
  $("#form").innerHTML = `
  <div class="card">
    <h3>Importar orçamentos da Icatu</h3>
    <div class="drops">
      <label class="drop ${S.imp.seg ? "ok" : ""}">PDF do seguro de vida<small>${S.imp.seg ? esc(S.imp.seg) : "Seguro Essencial · \"Sua simulação\""}</small><input type="file" accept="application/pdf" data-imp="seguro" hidden></label>
      <label class="drop ${S.imp.prev ? "ok" : ""}">PDF da previdência<small>${S.imp.prev ? esc(S.imp.prev) : "Atitude + Simples · opcional"}</small><input type="file" accept="application/pdf" data-imp="prev" hidden></label>
    </div>
    <div class="status" id="impStatus">Você também pode arrastar os dois PDFs para esta página.</div>
  </div>
  <div class="card">
    <h3>Cliente</h3>
    <div class="fgrid">
      ${fld("cli.nome", "Nome completo")}
      ${fld("cli.sexo", "Sexo", { select: [["", "Selecione"], ["F", "Feminino"], ["M", "Masculino"]] })}
      ${fld("cli.idade", "Idade", { num: 1 })}
      ${fld("cli.prof", "Profissão", { select: PROF_OPTS })}
      ${S.cli.prof === "outra" ? fld("cli.profOutra", "Qual profissão?") : ""}
      ${fld("cli.renda", "Renda mensal (R$)", { num: 1, ph: "10.000,00" })}
    </div>
  </div>
  <div class="card">
    <h3>INSS</h3>
    <div class="fgrid">
      ${fld("inss.modo", "Como informar", { select: [["base", "Pela base de contribuição"], ["manual", "Valor do benefício"]] })}
      ${S.inss.modo === "base" ? fld("inss.base", "Base de contribuição (R$/mês)", { num: 1, ph: "1.621,00", hint: "Valor sobre o qual o cliente recolhe. Benefício = 91%, entre o piso e o teto." }) : fld("inss.valor", "Benefício estimado (R$/mês)", { num: 1 })}
      ${fld("inss.teto", "Teto do INSS", { num: 1, hint: "2026: R$ 8.475,55" })}
      ${fld("inss.piso", "Piso (salário mínimo)", { num: 1, hint: "2026: R$ 1.621,00" })}
    </div>
    <div class="status" id="inssStatus"></div>
  </div>
  <div class="card">
    <h3>Simulação e validade</h3>
    <div class="fgrid">
      ${fld("sim.meses", "Meses de afastamento simulados", { num: 1 })}
      ${fld("sim.reserva", "Reserva do cliente (meses)", { num: 1, hint: "Opcional: a resposta dele para \"quanto tempo você aguentaria?\"" })}
      ${fld("sim.validade", "Validade do estudo (dias)", { num: 1 })}
    </div>
  </div>
  <div class="card">
    <h3>Seguro de vida</h3>
    <div class="fgrid">
      ${fld("seg.seguradora", "Seguradora")}
      ${fld("seg.produto", "Produto")}
      ${fld("seg.premio", "Prêmio mensal total (R$)", { num: 1 })}
      ${fld("seg.ditMeses", "DIT paga por até (meses)", { num: 1 })}
      ${fld("seg.franquia", "Franquia da DIT por doença (dias)", { num: 1, hint: "Icatu: paga a partir do 16º dia" })}
      ${fld("seg.carencia", "Carência da DIT por doença (dias)", { num: 1, hint: "Contada da contratação" })}
    </div>
    <h3 style="margin-top:16px">Coberturas</h3>
    <table class="cobs"><thead><tr><th>Cobertura</th><th>Capital (R$)</th><th>Prêmio/mês</th><th></th></tr></thead><tbody>${cobRows || `<tr><td colspan="4" class="muted small" style="padding:8px">Nenhuma cobertura. Importe o PDF ou adicione.</td></tr>`}</tbody></table>
    <div class="sumline"><button id="addCob">+ Adicionar cobertura</button><span>Soma das coberturas: <b id="somaCob">${brl(m.soma)}</b></span></div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Previdência</h3>
    <label class="switch"><input type="checkbox" data-k="prev.on" ${S.prev.on ? "checked" : ""}> Incluir no plano Completo</label></div>
    <div class="fgrid" style="margin-top:12px;${S.prev.on ? "" : "opacity:.5"}">
      ${fld("prev.produto", "Plano")}
      ${fld("prev.aporte", "Contribuição · acumulação (R$)", { num: 1 })}
      ${fld("prev.riscoNome", "Cobertura de risco")}
      ${fld("prev.riscoCap", "Renda/capital da cobertura (R$)", { num: 1 })}
      ${fld("prev.risco", "Contribuição · risco (R$)", { num: 1 })}
      ${fld("prev.taxa", "Rentabilidade da projeção (% a.a.)", { num: 1 })}
      ${fld("prev.idadeApos", "Idade de aposentadoria", { num: 1 })}
      ${fld("prev.reserva", "Reserva estimada (R$)", { num: 1 })}
      ${fld("prev.rendaVit", "Renda vitalícia estimada (R$/mês)", { num: 1 })}
      ${fld("prev.sexo", "Sexo no orçamento", { select: [["", "—"], ["F", "Feminino"], ["M", "Masculino"]] })}
    </div>
  </div>`;
  bindForm();
}
function bindForm() {
  const form = $("#form");
  form.querySelectorAll("[data-k]").forEach((el) => {
    const ev = el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
    el.addEventListener(ev, () => {
      const k = el.dataset.k; const v = el.type === "checkbox" ? el.checked : el.value;
      setPath(k, v); save();
      if (el.tagName === "SELECT" || el.type === "checkbox") renderForm();
      refresh();
    });
  });
  form.querySelectorAll("[data-cob]").forEach((el) => el.addEventListener("input", () => {
    S.seg.cobs[+el.dataset.cob][el.dataset.f] = el.value; save(); $("#somaCob").textContent = brl(calc().soma); refresh();
  }));
  form.querySelectorAll("[data-delcob]").forEach((b) => b.addEventListener("click", () => { S.seg.cobs.splice(+b.dataset.delcob, 1); save(); renderForm(); refresh(); }));
  $("#addCob").addEventListener("click", () => { S.seg.cobs.push({ nome: "", capital: "", premio: "" }); save(); renderForm(); });
  form.querySelectorAll("[data-imp]").forEach((inp) => inp.addEventListener("change", () => { const f = inp.files[0]; inp.value = ""; if (f) importPdf(f); }));
}

/* ---------- importação ---------- */
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
async function importPdf(file) {
  const st = $("#impStatus"); if (st) st.textContent = "Lendo " + file.name + "…";
  try {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const lines = await P.linesFromPdf(pdf);
    const r = P.parse(lines);
    if (!r) throw new Error("não reconheci o formato (esperado: Icatu Seguro Essencial ou Previdência Atitude+Simples)");
    if (r.tipo === "seguro") {
      Object.assign(S.seg, {
        seguradora: r.seguradora, produto: r.produto, premio: String(r.premio || ""), nome: r.nome || "", idade: String(r.idade || ""),
        cobs: r.coberturas.map((c) => ({ nome: c.nome, capital: String(c.capital || ""), premio: String(c.premio || "") })),
        proj: r.projecao.map((p) => p.premio), franquia: String(r.ditFranquiaDias || 15), carencia: String(r.ditCarenciaDias || 60),
        lerCar: r.lerCarenciaDias ? String(r.lerCarenciaDias) : "", lerMax: r.lerMaxDias ? String(r.lerMaxDias) : "", limPct: String(r.ditLimitePctMorte || 10)
      });
      if (!S.cli.nome && r.nome) S.cli.nome = r.nome;
      if (!S.cli.idade && r.idade) S.cli.idade = String(r.idade);
      S.imp.seg = file.name + " · " + r.coberturas.length + " coberturas";
    } else {
      Object.assign(S.prev, {
        on: true, produto: r.produto, aporte: String(r.aporte || ""), risco: String(r.risco || ""), taxa: String(r.taxa || ""), anos: String(r.anos || ""),
        idadeApos: String(r.idadeApos || ""), reserva: String(r.reserva || ""), rendaVit: String(r.rendaVitalicia || ""), sexo: r.sexo || "", idade: String(r.idade || ""), nome: r.nome || ""
      });
      const rr = (r.riscos || []).find((x) => /invalidez/i.test(x.nome)) || (r.riscos || [])[0];
      if (rr) { S.prev.riscoNome = rr.nome; S.prev.riscoCap = String(rr.capital || ""); }
      if (r.nome && (!S.cli.nome || norm(S.cli.nome) === norm(r.nome))) S.cli.nome = r.nome; // nome da previdência vem com acentos
      if (!S.cli.idade && r.idade) S.cli.idade = String(r.idade);
      S.imp.prev = file.name;
    }
    save(); renderForm(); refresh();
    const st2 = $("#impStatus"); if (st2) st2.textContent = "Pronto: " + (r.tipo === "seguro" ? "seguro de vida" : "previdência") + " importado. Confira a coluna Conferência.";
  } catch (e) {
    const st2 = $("#impStatus"); if (st2) st2.textContent = "Não consegui ler esse PDF: " + e.message + ". Preencha os campos manualmente.";
  }
}
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", async (e) => { e.preventDefault(); const fs = [...(e.dataTransfer.files || [])].filter((f) => /pdf$/i.test(f.name) || f.type === "application/pdf"); for (const f of fs) await importPdf(f); if (fs.length) showTab("dados"); });

/* ---------- RESUMO ---------- */
function renderResumo(m) {
  const row = (k, v) => `<div class="res-row"><span>${k}</span><b>${v}</b></div>`;
  $("#resumo").innerHTML = [
    row("Cliente", esc(m.nome)),
    row("Renda", m.renda ? brl0(m.renda) : "—"),
    row("INSS considerado", m.inss != null ? brl0(m.inss) : "—"),
    row("DIT (renda se parar)", m.dit ? brl0(m.dit) + "/mês" : "—"),
    row("Essencial (seguro)", m.premio ? brl(m.premio) + " · " + brl(m.dia(m.premio)) + "/dia" : "—"),
    m.prevOn ? row("Completa (+ previdência)", brl(m.completa) + " · " + brl(m.dia(m.completa)) + "/dia") : "",
    row("Validade do estudo", m.validade)
  ].join("");
  $("#alertas").innerHTML = alertas(m).map((a) => `<div class="alert ${a.t}">${a.t === "err" ? "⛔" : a.t === "warn" ? "⚠️" : a.t === "ok" ? "✅" : "ℹ️"}<span>${a.x}</span></div>`).join("");
  $("#whoName").textContent = m.nome;
  const is = $("#inssStatus"); if (is) is.innerHTML = m.inss != null ? `Benefício considerado: <b>${brl(m.inss)}</b> por mês.` : "Sem INSS informado.";
}

/* ====================== ESTUDO ====================== */
function pgHead(m) { return `<div class="bar"></div><div class="hd"><img src="img/logo.png" alt="Setor Norte Seguros"><span>${esc(m.hojeLonga)}</span></div>`; }
function pgFoot(n) { return `<div class="ft"><span><b>Torres Norte Corretora de Seguros Ltda</b> · CNPJ 11.903.619/0001-22 · SUSEP 202087923 · www.setornorteseguros.com.br</span><span>${n}/3</span></div>`; }
function carta(m) {
  const P = m.P, o = m.ela ? "a" : "o";
  const p2 = m.inss != null
    ? `Sabemos que ${P.rot}. Um imprevisto, como ${P.imp}, pode tirar você do trabalho por semanas. Hoje, nessa situação, a sua renda cairia de ${brl0(m.renda)} para cerca de ${brl0(m.inss)} por mês, pagos pelo INSS depois da perícia.`
    : `Sabemos que ${P.rot}. Um imprevisto, como ${P.imp}, pode tirar você do trabalho por semanas, e a renda deixa de entrar enquanto as contas continuam chegando.`;
  return [
    `${P.ab} Mas quem cuida de você se precisar de uma pausa?`,
    p2,
    `Preparei este estudo com os valores oficiais da ${esc(m.seguradora)} para que você possa se recuperar tranquil${o}: se precisar parar, você recebe ${brl0(m.dit)} por mês enquanto se recupera. A página 3 mostra ${m.prevOn ? "as duas opções de plano" : "o seu plano"} em detalhe.`
  ];
}
function riscoCells(m) {
  if (m.inss != null) return `<div class="cells">
      <div class="cell"><span class="k">Sua renda hoje</span><span class="v">${brl0(m.renda)}</span></div>
      <div class="cell r"><span class="k">Afastad${m.ela ? "a" : "o"}, só com o INSS</span><span class="v r">${brl0(m.inss)}</span><span class="s">${Math.round((1 - m.inss / m.renda) * 100)}% a menos por mês</span></div>
      <div class="cell r"><span class="k">Perda em ${m.meses} meses</span><span class="v r">${brl0(m.perdaSem)}</span><span class="s">sem proteção de renda</span></div></div>`;
  return `<div class="cells">
      <div class="cell"><span class="k">Sua renda hoje</span><span class="v">${brl0(m.renda)}</span></div>
      <div class="cell r"><span class="k">Perda em ${m.meses} meses</span><span class="v r">${brl0(m.perdaSem)}</span><span class="s">sem contar o INSS</span></div></div>`;
}
function page1(m) {
  return `<div class="pg">${pgHead(m)}
  <p class="eyebrow">Renda Protegida · Estudo personalizado</p>
  <h1>Olá, ${esc(m.first)},</h1>
  ${carta(m).map((p) => `<p class="l">${p}</p>`).join("")}
  <h2>O seu risco hoje</h2>
  ${riscoCells(m)}
  <div class="prot">
    <div><span class="k" style="color:#3F7F2E">A sua proteção</span><div class="big">${brl0(m.dit)} por mês</div><div class="txt">se você precisar se afastar, por até ${m.ditMeses} meses, somados ao INSS</div></div>
    <div style="text-align:right"><span class="k" style="color:#3F7F2E">A partir de</span><div class="big" style="font-size:22px">${brl(m.dia(m.essencial))} por dia</div><div class="txt">${esc(m.produto)}: ${brl(m.essencial)}/mês</div></div>
  </div>
  <div class="next">
    <div><b>Próximo passo</b><span>Para garantir estes valores, me responda pelo WhatsApp até ${m.validade}.<br>A proposta é digital e você assina pelo celular.</span></div>
    <div class="tel">${CORRETOR.tel}<span style="font-size:11px;font-weight:600;color:#9FB8C9;font-family:Nunito,sans-serif">WhatsApp do corretor</span></div>
  </div>
  <div class="sign"><b>${CORRETOR.nome}</b><span>Corretor de seguros · Setor Norte Seguros · ${CORRETOR.email}</span></div>
  <img class="wm" src="img/sym.png" alt="">
  ${pgFoot(1)}</div>`;
}
function simBars(m, big) {
  const max = Math.max(m.renda, m.rendaCom, 1), W = big ? 62 : 74;
  const rows = [{ l: "Hoje", s: "trabalhando", v: m.renda, c: "#396C97" }];
  if (m.inss != null) rows.push({ l: "Afastad" + (m.ela ? "a" : "o"), s: "só com o INSS", v: m.inss, c: "#E5484D" });
  else rows.push({ l: "Afastad" + (m.ela ? "a" : "o"), s: "sem proteção", v: 0, c: "#E5484D" });
  rows.push({ l: "Afastad" + (m.ela ? "a" : "o"), s: "com a proteção", v: m.rendaCom, c: "#5DB84E" });
  return rows.map((r) => `<div class="brow"><div class="blab"><b>${r.l}</b><span>${r.s}</span></div><div class="bfill" style="width:${Math.max(0.6, r.v / max * W).toFixed(1)}%;background:${r.c}"></div><div class="bval" style="color:${big ? r.c : "#1F2A33"}">${brl0(r.v)}</div></div>`).join("");
}
function reservaTxt(m) {
  if (!(m.reservaMeses > 0)) return "";
  const r = m.reservaMeses;
  if (r >= m.meses) return `Você contou que a sua reserva aguenta cerca de ${fmt(r)} meses. Num afastamento de ${m.meses} meses, ela seria usada quase toda. Com a proteção, ela continua guardada para o que foi feita.`;
  return `Você contou que a sua reserva aguenta cerca de ${fmt(r)} ${r === 1 ? "mês" : "meses"}. Num afastamento de ${m.meses} meses, a partir do ${Math.floor(r) + 1}º mês faltariam ${brl0(m.gapMes)} por mês. Com a proteção, a renda entra já no primeiro mês e a reserva fica intacta.`;
}
function guardarChart(m, big) {
  const max = Math.max(m.pagoAcid, ...m.guardar.map((g) => g.v), 1);
  const H = big ? 100 : 100;
  const grp = m.guardar.map((g) => `<div class="cmpg"><div class="cmpc"><b style="color:#5E6B76">${brl0(g.v)}</b><i style="height:${Math.max(1.5, g.v / max * 82).toFixed(1)}%;background:#9AA6B0"></i></div><div class="cmpc"><b style="color:#3F7F2E">${brl0(m.pagoAcid)}</b><i style="height:${(m.pagoAcid / max * 82).toFixed(1)}%;background:#5DB84E"></i></div></div>`).join("");
  const lab = m.guardar.map((g) => `<span>No ${g.y}º ano</span>`).join("");
  return { grp, lab, H };
}
function page2(m) {
  const g = guardarChart(m);
  const rt = reservaTxt(m);
  return `<div class="pg">${pgHead(m)}
  <h1>Se você precisar parar</h1>
  <div class="sub">Simulação de um afastamento de ${m.meses} meses</div>
  <div class="bars">${simBars(m)}</div>
  <div class="cards">
    <div class="cardx r"><span class="k">Sem proteção</span><span class="v r">${brl0(m.perdaSem)}</span><span class="s">a menos em ${m.meses} meses${m.inss == null ? " (sem contar o INSS)" : ""}</span></div>
    <div class="cardx g"><span class="k">Por acidente</span><span class="v g">${brl0(m.pagoAcid)}</span><span class="s">você recebe, desde o 1º dia de afastamento</span></div>
    <div class="cardx g"><span class="k">Por doença</span><span class="v g">${brl0(m.pagoDoenca)}</span><span class="s">você recebe, a partir do ${m.franquia + 1}º dia de afastamento</span></div>
  </div>
  ${rt ? `<div class="callout">${rt}</div>` : ""}
  <h2>E se eu guardar esse dinheiro?</h2>
  <div class="leg"><span><i style="background:#9AA6B0"></i>Guardando ${brl(m.premio)} por mês, com rendimento de ${fmt(m.taxaGuardar)}% ao ano</span><span><i style="background:#5DB84E"></i>O que o seguro paga em ${m.meses} meses de afastamento por acidente</span></div>
  <div class="cmp">${g.grp}</div><div class="cmpl">${g.lab}</div>
  <div class="take">Guardando por conta própria, você levaria anos para juntar o que o seguro paga num único afastamento. Com o seguro, a proteção vale desde o início do contrato${m.carencia ? ` (para doença, depois da carência de ${m.carencia} dias)` : ""}.</div>
  <h2>E se for mais grave</h2>
  <div class="cards" style="margin-top:4px">
    ${m.dg ? `<div class="cardx b"><span class="k">Doença grave</span><span class="v">${brl0(m.dg)}</span><span class="s">de uma vez, no diagnóstico (24 doenças, como câncer, AVC e infarto), para usar como quiser</span></div>` : ""}
    ${m.ipa ? `<div class="cardx b"><span class="k">Invalidez por acidente</span><span class="v">${brl0(m.ipa)}</span><span class="s">total ou proporcional ao grau da invalidez</span></div>` : ""}
    ${m.prevOn && m.riscoCap ? `<div class="cardx b"><span class="k">${esc(m.riscoNome)}</span><span class="v">${brl0(m.riscoCap)}/mês</span><span class="s">por toda a vida, por acidente ou doença (plano Completo)</span></div>` : ""}
  </div>
  ${pgFoot(2)}</div>`;
}
function optItems(m, kind) {
  const base = [`${brl0(m.dit)}/mês se precisar parar`, m.dg ? `${short(m.dg)} no diagnóstico de doença grave` : "", m.ipa ? `${short(m.ipa)} por invalidez por acidente` : "", m.morte ? `${short(m.morte)} para a família` : ""].filter(Boolean);
  if (kind === "completa") return [`Tudo da Essencial`, m.riscoCap ? `${brl0(m.riscoCap)}/mês vitalício por invalidez` : "", m.aporte ? `${brl(m.aporte)}/mês para a sua reserva (${short(m.reserva)} aos ${m.idadeApos})` : ""].filter(Boolean);
  return base;
}
function page3(m) {
  const segRows = m.cobs.map((c) => {
    let d = "";
    if (c === m.ditCob) d = `Paga por até ${m.ditMeses} meses. Acidente: desde o 1º dia. Doença: a partir do ${m.franquia + 1}º dia.` + (m.ler ? ` LER/DORT/LTC: carência de ${m.lerCar} dias, paga por até ${m.lerMax} dias.` : "");
    return `<tr><td>${esc(c.nome)}${d ? `<small>${d}</small>` : ""}</td><td class="n">${c.capital ? brl0(c.capital) + (c === m.ditCob ? "/mês" : "") : "—"}</td><td class="n">${c.premio ? brl(c.premio) : "incluído"}</td></tr>`;
  }).join("");
  const prevRows = m.prevOn ? `<tr class="grp"><td colspan="2">${esc(S.prev.produto || "Previdência")} · previdência com proteção</td><td class="n">${brl(m.prevTot)}</td></tr>
    ${m.risco ? `<tr><td>${esc(m.riscoNome)}<small>Renda mensal vitalícia em caso de invalidez total e permanente.</small></td><td class="n">${m.riscoCap ? brl0(m.riscoCap) + "/mês" : "—"}</td><td class="n">${brl(m.risco)}</td></tr>` : ""}
    ${m.aporte ? `<tr><td>Acumulação de reserva<small>Reserva no seu nome, resgatável conforme o regulamento do plano.</small></td><td class="n">—</td><td class="n">${brl(m.aporte)}</td></tr>` : ""}` : "";
  const opt = (kind, hi) => {
    const v = kind === "completa" ? m.completa : m.essencial;
    return `<div class="opt${hi ? " hi" : ""}">${hi ? `<span class="tag">Recomendado</span>` : ""}<div class="on">${kind === "completa" ? "Completa · seguro + previdência" : "Essencial · seguro de vida"}</div>
      <div class="pr">${brl(v)}<span style="font-size:12px;color:#5E6B76;font-family:Nunito,sans-serif"> /mês</span></div>
      <div class="pd">${brl(m.dia(v))} por dia${m.renda ? " · " + m.pct(v) + " da renda" : ""}</div>
      <ul>${optItems(m, kind).map((x) => `<li>${x}</li>`).join("")}</ul></div>`;
  };
  return `<div class="pg">${pgHead(m)}
  <h1>Seu plano de proteção</h1>
  <div class="sub">preparado para ${esc(m.nome)}${m.prof ? " · " + esc(m.prof) : ""}${m.idade ? " · " + m.idade + " anos" : ""}</div>
  <div class="opts">${m.prevOn ? opt("completa", true) + opt("essencial", false) : opt("essencial", true).replace('<span class="tag">Recomendado</span>', "")}</div>
  <h2>Coberturas</h2>
  <table class="t"><thead><tr><th>Cobertura</th><th class="n">Capital</th><th class="n">Por mês</th></tr></thead><tbody>
    <tr class="grp"><td colspan="2">${esc(m.seguradora)} · ${esc(m.produto)}</td><td class="n">${brl(m.premio)}</td></tr>
    ${segRows}${prevRows}
    <tr class="tot"><td colspan="2">${m.prevOn ? "Total da opção Completa" : "Total mensal"}</td><td class="n">${brl(m.completa)}</td></tr>
  </tbody></table>
  ${m.prevOn && (m.reserva || m.rendaVit) ? `<div class="prevbox">
    ${m.reserva ? `<div><span class="k">Reserva estimada aos ${m.idadeApos} anos</span><span class="v">${brl0(m.reserva)}</span></div>` : ""}
    ${m.rendaVit ? `<div><span class="k">Ou renda vitalícia estimada</span><span class="v">${brl0(m.rendaVit)}/mês</span></div>` : ""}
    <div><span class="k">Rentabilidade usada</span><span class="v" style="font-size:16px">${fmt(m.taxa)}% ao ano</span><span class="s">estimativa da seguradora, sem garantia</span></div></div>` : ""}
  <h2>Regras importantes</h2>
  <ul class="rules">
    <li>Renda por afastamento: por acidente, desde o 1º dia; por doença, a partir do ${m.franquia + 1}º dia de afastamento, com carência de ${m.carencia} dias contados da contratação.</li>
    ${m.ler ? `<li>Lesões por esforço repetitivo (LER, DORT e LTC): carência de ${m.lerCar} dias e pagamento por até ${m.lerMax} dias.</li>` : ""}
    ${m.dg ? `<li>Doenças graves: carência de 60 dias. Paga uma doença diagnosticada durante a vigência, estando o segurado vivo 30 dias após o diagnóstico.</li>` : ""}
    <li>Valores atualizados todo ano pelo IPCA, e o prêmio do seguro é reajustado conforme a idade no aniversário da apólice.</li>
  </ul>
  <h2>Avisos</h2>
  <div class="legal">
    <p>Estudo elaborado pela Setor Norte Seguros com base nos orçamentos emitidos pela ${esc(m.seguradora)} em ${dataCurta(m.hoje)}. Não substitui a proposta. A aceitação e os valores definitivos dependem da análise de risco da seguradora e da Declaração Pessoal de Saúde, quando exigida. Os seguros obedecem às Condições Gerais e ao regulamento do plano, disponíveis em www.susep.gov.br e no site da seguradora. O registro do produto na SUSEP não representa aprovação ou recomendação.</p>
    ${m.prevOn ? `<p>A rentabilidade da projeção (${fmt(m.taxa)}% a.a., informada pela seguradora como rentabilidade real estimada) não é garantia de resultado. Fundos de previdência não contam com garantia do FGC. O resgate está sujeito a imposto de renda conforme o regime tributário.</p>` : ""}
    <p>Consulte a situação cadastral do corretor em www.susep.gov.br pelo registro SUSEP 202087923. <b>Estudo válido até ${m.validade}.</b></p>
  </div>
  <div class="sign" style="margin-top:12px"><b>${CORRETOR.nome}</b><span>Corretor de seguros · ${CORRETOR.tel} · ${CORRETOR.email}</span></div>
  ${pgFoot(3)}</div>`;
}
function studyPages(m) { return [page1(m), page2(m), page3(m)]; }

/* ====================== APRESENTAÇÃO ====================== */
const SLIDES = [
  { id: "capa", nome: "Capa" }, { id: "quem", nome: "Quem cuida de você" }, { id: "dor", nome: "A sua renda depende de você" },
  { id: "sim", nome: "Sua renda, antes e depois" }, { id: "inss", nome: "INSS x Proteção (opcional)", opt: 1 }, { id: "recebe", nome: "O que você recebe" },
  { id: "conf", nome: "Confirmação (antes do preço)" }, { id: "guardar", nome: "E se eu guardar esse dinheiro?" }, { id: "inv", nome: "Seu investimento" },
  { id: "prev", nome: "Previdência", needPrev: 1 }, { id: "faq", nome: "Perguntas frequentes (opcional)", opt: 1 }, { id: "fim", nome: "Próximos passos" }
];
function activeSlides(m) { return SLIDES.filter((s) => !S.deck.off[s.id] && !(s.needPrev && !m.prevOn)); }
function sl(cls, inner) { return `<div class="sl ${cls}">${inner}</div>`; }
function slideHtml(id, m) {
  const ela = m.ela;
  switch (id) {
    case "capa": return sl("dark", `<div class="photo" style="right:0;width:860px;background-image:url('${m.coverSrc}');background-position:${COVER_POS[m.coverKey] || "50% 50%"}"></div>
      <div class="logo" style="left:120px;top:100px"><img src="img/logo.png" alt=""></div>
      <div style="position:absolute;left:120px;top:330px;width:900px"><div class="ey">Plano de proteção de renda</div>
      <div class="t1" style="font-size:104px;line-height:1;margin-top:26px">Renda Protegida</div>
      <div class="lead" style="font-size:40px;font-weight:700;margin-top:30px">Preparado para <span style="color:#fff">${esc(m.nome)}</span>${m.prof ? "<br>" + esc(m.prof) : ""}</div></div>
      <div style="position:absolute;left:120px;bottom:100px;display:flex;gap:80px;font-size:28px;color:#D5E2EB"><div>Corretor<br><b style="font-family:Montserrat,sans-serif;font-size:34px;color:#fff">${CORRETOR.nome}</b></div><div>Data<br><b style="font-family:Montserrat,sans-serif;font-size:34px;color:#fff">${dataCurta(m.hoje)}</b></div></div>`);
    case "quem": return sl("", `<div class="photo" style="left:0;width:720px;background-image:url('img/edgar.jpg');background-position:50% 30%"></div>
      <div style="position:absolute;left:830px;right:110px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center"><div class="ey">Quem cuida de você</div>
      <div class="t1" style="font-size:92px">${CORRETOR.nome}</div>
      <div class="lead" style="font-size:38px">Corretor de seguros na Setor Norte Seguros, especializado em proteção de renda para profissionais da saúde. Acompanho você da escolha das coberturas até o pagamento de um eventual sinistro.</div>
      <div style="display:flex;flex-direction:column;gap:24px;margin-top:48px;font-size:34px;font-weight:700">
        ${["Mais de 10 anos de experiência · formação pela Escola Nacional de Seguros", "Comparação entre seguradoras, com atendimento consultivo", "Apoio completo no pedido de indenização"].map((t) => `<div style="display:flex;gap:18px;align-items:center"><span style="width:20px;height:20px;border-radius:50%;background:#5DB84E;flex:none"></span>${t}</div>`).join("")}
      </div><div style="margin-top:40px;font-size:24px;color:#8496A4">Corretora desde 2010 · SUSEP 202087923</div></div>`);
    case "dor": return sl("dark", `<div class="photo" style="right:0;width:720px;background-image:url('img/mao.jpg');background-position:55% 50%"></div>
      <div style="position:absolute;left:0;right:0;top:0;bottom:0;background:linear-gradient(90deg,#0D3A53 0,#0D3A53 58%,rgba(13,58,83,0) 75%)"></div>
      <div class="pad" style="right:640px"><div class="ey">Por que proteger a renda</div>
      <div class="t1" style="font-size:84px">Seus ${m.renda ? brl0(m.renda) : "rendimentos"} por mês dependem de você trabalhar.</div>
      <div class="lead">As contas continuam chegando mesmo com a agenda parada. ${m.inss != null ? `O INSS pagaria cerca de ${brl0(m.inss)}, depois da perícia.` : "O INSS paga só uma parte, depois da perícia."}</div>
      <div class="q" style="margin-top:auto">Se você parasse hoje, por quanto tempo conseguiria manter as suas contas?</div></div>`);
    case "sim": {
      const rt = reservaTxt(m);
      return sl("", `<div class="pad"><div class="ey">Simulação de afastamento</div><div class="t2">Sua renda mensal, antes e depois</div>
      <div style="display:flex;flex-direction:column;gap:36px;margin-top:56px">${simBars(m, true).replace(/class="brow"/g, 'class="brow"')}</div>
      <div style="display:flex;gap:30px;margin-top:auto">
        <div class="box" style="flex:1;background:#FDF0F0"><div class="k">Sem proteção, em ${m.meses} meses</div><div class="bign" style="font-size:60px;color:#C0363B">− ${brl0(m.perdaSem)}</div></div>
        <div class="box" style="flex:1;background:#EAF4E3"><div class="k">Por acidente · 1º dia</div><div class="bign" style="font-size:60px;color:#3F7F2E">+ ${brl0(m.pagoAcid)}</div></div>
        <div class="box" style="flex:1;background:#EAF4E3"><div class="k">Por doença · ${m.franquia + 1}º dia</div><div class="bign" style="font-size:60px;color:#3F7F2E">+ ${brl0(m.pagoDoenca)}</div></div>
      </div>${rt ? `<div style="margin-top:22px;font-size:27px;color:#5A3D00;background:#FFF6E2;border-radius:20px;padding:18px 28px">${rt}</div>` : ""}</div>`);
    }
    case "inss": return sl("soft", `<div class="pad"><div class="t2" style="margin-top:0">INSS x Proteção de renda</div>
      <table class="t" style="margin-top:44px"><tr><th></th><th>Só o INSS</th><th class="b">Com a proteção</th></tr>
      <tr><td class="k2">Quando começa</td><td>Depois da perícia</td><td class="b">Acidente: 1º dia · Doença: ${m.franquia + 1}º dia</td></tr>
      <tr><td class="k2">Quanto por mês</td><td>${m.inss != null ? "Cerca de " + brl0(m.inss) : "Limitado ao teto"}</td><td class="b">+ ${brl0(m.dit)} por até ${m.ditMeses} meses</td></tr>
      <tr><td class="k2">Como recebe</td><td>Perícia agendada, com fila</td><td class="b">Atestado médico e documentos</td></tr>
      <tr><td class="k2">Doença grave</td><td>Sem pagamento específico</td><td class="b">${m.dg ? brl0(m.dg) + " no diagnóstico" : "—"}</td></tr>
      <tr><td class="k2">Invalidez</td><td>Aposentadoria, limitada ao teto</td><td class="b">${m.ipa ? brl0(m.ipa) + " por acidente" : "—"}${m.prevOn && m.riscoCap ? " + " + brl0(m.riscoCap) + "/mês vitalício" : ""}</td></tr></table></div>`);
    case "recebe": {
      const items = [
        { h: "Se precisar parar", n: brl0(m.dit) + "/mês", d: `por até ${m.ditMeses} meses · acidente desde o 1º dia, doença a partir do ${m.franquia + 1}º dia` },
        m.dg ? { h: "Doença grave", n: brl0(m.dg), d: "de uma vez, no diagnóstico de 24 doenças, como câncer, AVC e infarto. Você usa como quiser, inclusive no tratamento" } : null,
        { h: "Invalidez", n: m.ipa ? brl0(m.ipa) : "—", d: (m.ipa ? "por acidente, total ou proporcional" : "") + (m.prevOn && m.riscoCap ? ` · + ${brl0(m.riscoCap)}/mês vitalício por acidente ou doença` : "") },
        m.morte ? { h: "Para a família", n: brl0(m.morte), d: [m.apoio ? `+ ${brl0(m.apoio)} de apoio imediato` : "", m.funeral ? "assistência funeral" : "", m.adiant ? "adiantamento em doença terminal" : ""].filter(Boolean).join(" · ") } : null
      ].filter(Boolean);
      return sl("soft", `<div class="pad"><div class="ey">O que você recebe</div><div class="t2">Uma proteção para cada situação</div>
      <div class="grid4" style="margin-top:50px;flex:1;grid-auto-rows:1fr">${items.map((i) => `<div class="sit"><div class="h">${i.h}</div><div class="n">${i.n}</div><div class="d">${i.d}</div></div>`).join("")}</div></div>`);
    }
    case "conf": return sl("dark", `<div class="pad" style="justify-content:center"><div class="ey">Antes de falar de valores</div>
      <div class="t1" style="font-size:96px;line-height:1.08;margin-top:34px">${brl0(m.dit)} por mês cobrem as suas contas se você precisar parar?</div>
      <div class="lead" style="margin-top:40px;font-size:38px">Se precisar, ajustamos o valor agora, antes de seguir.</div></div>`);
    case "guardar": {
      const g = guardarChart(m, true);
      return sl("soft", `<div class="pad"><div class="ey">E se eu guardar esse dinheiro?</div><div class="t2">Num afastamento de ${m.meses} meses, quanto você teria?</div>
      <div style="display:flex;gap:40px;font-size:27px;color:#3C4B57;margin-top:22px"><span><i style="display:inline-block;width:26px;height:26px;border-radius:6px;background:#9AA6B0;vertical-align:-4px;margin-right:12px"></i>Guardando ${brl(m.premio)}/mês sozinh${ela ? "a" : "o"}</span><span><i style="display:inline-block;width:26px;height:26px;border-radius:6px;background:#5DB84E;vertical-align:-4px;margin-right:12px"></i>O que o seguro paga (acidente)</span></div>
      <div class="cmpS" style="flex:1;display:flex;align-items:flex-end;gap:70px;border-bottom:3px solid #C9D9E4;padding:30px 20px 0">${m.guardar.map((x) => {
        const max = Math.max(m.pagoAcid, ...m.guardar.map((q) => q.v), 1);
        return `<div style="flex:1;display:flex;align-items:flex-end;gap:16px;height:100%"><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:10px;height:100%"><b style="font-family:Montserrat,sans-serif;font-size:28px;color:#5B6B78;white-space:nowrap">${brl0(x.v)}</b><div style="width:100%;height:${Math.max(1.2, x.v / max * 80).toFixed(1)}%;background:#9AA6B0;border-radius:12px 12px 0 0"></div></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:10px;height:100%"><b style="font-family:Montserrat,sans-serif;font-size:28px;color:#2F7A25;white-space:nowrap">${brl0(m.pagoAcid)}</b><div style="width:100%;height:${(m.pagoAcid / max * 80).toFixed(1)}%;background:#5DB84E;border-radius:12px 12px 0 0"></div></div></div>`;
      }).join("")}</div>
      <div style="display:flex;gap:70px;padding:12px 20px 0">${m.guardar.map((x) => `<b style="flex:1;text-align:center;font-family:Montserrat,sans-serif;font-size:30px">No ${x.y}º ano</b>`).join("")}</div></div>`);
    }
    case "inv": {
      const opt = (kind, hi) => {
        const v = kind === "completa" ? m.completa : m.essencial;
        return `<div class="opt ${hi ? "hi" : "lo"}">${hi && m.prevOn ? `<span class="tag">Recomendado</span>` : ""}<div class="on">${kind === "completa" ? "Completa" : "Essencial"}</div>
        <div style="font-size:26px;opacity:.75">${kind === "completa" ? "seguro + previdência" : "seguro de vida"}</div>
        <div class="pr">${brl(v)}</div><div class="pd">${brl(m.dia(v))} por dia</div>
        <ul>${optItems(m, kind).map((x) => `<li>${x}</li>`).join("")}</ul></div>`;
      };
      return sl("dark", `<div class="pad"><div class="ey">Seu investimento</div><div class="t2" style="color:#fff">${m.prevOn ? "Duas formas de se proteger" : "Sua proteção completa por mês"}</div>
      <div style="display:flex;gap:44px;margin-top:66px;flex:1">${m.prevOn ? opt("completa", true) + opt("essencial", false) : opt("essencial", true)}</div>
      ${m.renda ? `<div style="margin-top:26px;font-size:26px;color:#9FB8C9">${m.prevOn ? `Completa: ${m.pct(m.completa)} da renda · Essencial: ${m.pct(m.essencial)} da renda` : `${m.pct(m.essencial)} da sua renda`}</div>` : ""}</div>`);
    }
    case "prev": {
      const ys = []; const A = m.anos || Math.max(5, m.idadeApos - m.idade); const step = A <= 10 ? 2 : 5; for (let y = step; y < A; y += step) ys.push(y); ys.push(A);
      const bars = ys.slice(-5).map((y) => ({ y, v: fv(m.aporte, m.taxa, y * 12), inv: m.aporte * 12 * y }));
      const max = Math.max(...bars.map((b) => b.v), 1);
      return sl("", `<div class="pad"><div class="ey">Previdência</div><div class="t2">${brl(m.aporte)} por mês viram ${short(m.reserva)} aos ${m.idadeApos} anos</div>
      <div style="display:flex;gap:60px;flex:1;margin-top:40px">
        <div style="flex:1.4;display:flex;flex-direction:column"><div style="flex:1;display:flex;align-items:flex-end;gap:36px;border-bottom:3px solid #E3EAF0">${bars.map((b) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:10px;height:100%"><b style="font-family:Montserrat,sans-serif;font-size:28px;color:#0C6594;white-space:nowrap">${short(b.v)}</b><div style="width:100%;height:${(b.v / max * 82).toFixed(1)}%;background:#0C6594;border-radius:12px 12px 0 0;display:flex;align-items:flex-end"><div style="width:100%;height:${(b.inv / b.v * 100).toFixed(1)}%;background:#9DC0D8;border-radius:0"></div></div></div>`).join("")}</div>
        <div style="display:flex;gap:36px;padding-top:10px">${bars.map((b) => `<b style="flex:1;text-align:center;font-family:Montserrat,sans-serif;font-size:26px">${b.y} anos</b>`).join("")}</div>
        <div style="font-size:22px;color:#5B6B78;margin-top:10px">Azul-claro: total aportado. Projeção com ${fmt(m.taxa)}% ao ano, estimativa da seguradora, sem garantia.</div></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:24px">
          ${m.rendaVit ? `<div class="box" style="background:#EEF4F8"><div class="k">Ou renda vitalícia estimada</div><div class="bign" style="font-size:64px;color:#0C6594">${brl0(m.rendaVit)}/mês</div></div>` : ""}
          ${m.riscoCap ? `<div class="box" style="background:#EAF4E3"><div class="k">${esc(m.riscoNome)}</div><div class="bign" style="font-size:64px;color:#3F7F2E">${brl0(m.riscoCap)}/mês</div><div style="font-size:26px;color:#3C4B57;margin-top:8px">por toda a vida, se não puder mais trabalhar, por acidente ou doença</div></div>` : ""}
          <div style="font-size:26px;color:#3C4B57;line-height:1.4">A reserva é sua: se você nunca usar o seguro, o dinheiro da previdência continua no seu nome.</div>
        </div></div></div>`);
    }
    case "faq": return sl("", `<div class="pad"><div class="t2" style="margin-top:0">Perguntas frequentes</div><div class="faq" style="margin-top:60px">
      <div><b>"Já tenho reserva de emergência."</b><span>Ótimo. O seguro evita que ela seja consumida num afastamento e deixa a reserva para o que ela foi feita.</span></div>
      <div><b>"Já pago o INSS."</b><span>${m.inss != null ? `O INSS pagaria cerca de ${brl0(m.inss)} e depende de perícia.` : "O INSS tem teto e depende de perícia."} A proteção soma ${brl0(m.dit)} por mês a esse valor.</span></div>
      <div><b>"Sou jovem e saudável."</b><span>É quando o preço é menor e a aprovação é mais simples. Acidentes não escolhem idade.</span></div>
      <div><b>"E se eu nunca usar?"</b><span>${m.prevOn ? `A previdência fica com você: a reserva estimada é de ${short(m.reserva)} aos ${m.idadeApos} anos.` : "Você terá passado esses anos trabalhando com a tranquilidade de saber que a sua renda estava garantida."}</span></div></div></div>`);
    case "fim": return sl("dark", `<div class="pad"><div class="ey">Próximos passos</div><div class="t2" style="color:#fff">Vamos garantir a sua proteção?</div>
      <div style="display:flex;gap:70px;margin-top:56px;flex:1">
        <div class="steps" style="flex:1;justify-content:center;gap:34px">${[["Envio dos dados", "Você me manda as informações ao lado."], ["Proposta digital", "Você recebe a proposta e assina pelo celular."], ["Análise", "A seguradora avalia em até 15 dias úteis."], ["Apólice emitida", "Você recebe a apólice e já está protegid" + (ela ? "a" : "o") + "."]].map((s, i) => `<div class="step"><i>${i + 1}</i><div><b>${s[0]}</b><span>${s[1]}</span></div></div>`).join("")}</div>
        <div class="box" style="flex:1;font-size:29px;line-height:1.4;color:#D5E2EB;display:flex;flex-direction:column;gap:16px;justify-content:center"><b style="font-family:Montserrat,sans-serif;font-size:36px;color:#fff">Dados para a proposta</b>
          ${["Nome completo, CPF, data de nascimento e estado civil", "Peso e altura", "Endereço com CEP, e-mail e telefone", "Beneficiários: nome, parentesco, data de nascimento e %", "Pagamento: débito em conta ou cartão de crédito"].map((t) => `<div style="display:flex;gap:16px"><span style="color:#5DB84E;font-weight:900">✓</span><span>${t}</span></div>`).join("")}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:30px"><div style="font-size:28px;color:#9FB8C9">Valores válidos até <b style="color:#fff">${m.validade}</b></div>
      <div style="font-size:28px;color:#D5E2EB"><b style="color:#fff">${CORRETOR.nome}</b> · ${CORRETOR.tel} · ${CORRETOR.ig}</div></div></div>`);
  }
  return "";
}

/* ---------- render saídas ---------- */
function scaled(html, w, h, maxW) {
  const k = Math.min(1, maxW / w);
  return `<div class="scaler" style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px"><div style="transform:scale(${k})">${html}</div></div>`;
}
let curTab = "dados";
function refresh() {
  const m = calc();
  renderResumo(m);
  if (curTab === "estudo") renderEstudo(m);
  if (curTab === "deck") renderDeck(m);
  if (curTab === "wa") renderWA(m);
}
function renderEstudo(m) {
  const w = Math.min(860, (document.querySelector("main").clientWidth || 900) - 40);
  $("#pages").innerHTML = studyPages(m).map((p) => scaled(p, 794, 1123, w)).join("");
}
function renderDeck(m) {
  const list = activeSlides(m);
  const w = Math.min(1100, ($("#deckList").clientWidth || 900));
  $("#deckList").innerHTML = list.map((s, i) => `<div class="deck-item" data-start="${i}"><span class="num">${i + 1} · ${esc(s.nome)}</span>${scaled(slideHtml(s.id, m), 1920, 1080, w)}</div>`).join("");
  $("#deckList").querySelectorAll("[data-start]").forEach((el) => el.addEventListener("click", () => present(+el.dataset.start)));
  // capas
  const cov = Object.keys(COVERS).map((k) => `<button data-cover="${k}" class="${m.coverKey === k ? "on" : ""}" style="background-image:url('${COVERS[k]}')" title="${k}"></button>`).join("") + (S.deck.custom ? `<button data-cover="custom" class="${m.coverKey === "custom" ? "on" : ""}" style="background-image:url('${S.deck.custom}')"></button>` : "");
  $("#covers").innerHTML = cov;
  $("#covers").querySelectorAll("[data-cover]").forEach((b) => b.addEventListener("click", () => { S.deck.cover = b.dataset.cover; save(); renderDeck(calc()); }));
  $("#slideToggles").innerHTML = SLIDES.map((s) => `<label class="tog"><input type="checkbox" data-sl="${s.id}" ${S.deck.off[s.id] ? "" : "checked"} ${s.needPrev && !m.prevOn ? "disabled" : ""}> ${esc(s.nome)}${s.needPrev && !m.prevOn ? ' <span class="muted small">(sem previdência)</span>' : ""}</label>`).join("") + `<button class="ghost" style="color:var(--navy);border-color:#C9D6E0;margin-top:6px;font-size:12px" id="coverAuto">Capa automática pela profissão</button>`;
  $("#slideToggles").querySelectorAll("[data-sl]").forEach((c) => c.addEventListener("change", () => { S.deck.off[c.dataset.sl] = !c.checked; save(); renderDeck(calc()); }));
  $("#coverAuto").addEventListener("click", () => { S.deck.cover = "auto"; save(); renderDeck(calc()); });
}
$("#coverUpload").addEventListener("change", (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const img = new Image(); const url = URL.createObjectURL(f);
  img.onload = () => { const c = document.createElement("canvas"); const k = Math.min(1, 1600 / img.width); c.width = img.width * k; c.height = img.height * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); S.deck.custom = c.toDataURL("image/jpeg", 0.82); S.deck.cover = "custom"; save(); renderDeck(calc()); URL.revokeObjectURL(url); };
  img.src = url;
});

/* ---------- WhatsApp ---------- */
function waTexts(m) {
  const n = m.first || "Olá";
  const foco = S.wa.opcao === "completa" && m.prevOn ? "completa" : "essencial";
  const v = foco === "completa" ? m.completa : m.essencial;
  const risco = m.inss != null
    ? `Hoje, se você precisar parar de trabalhar, a sua renda cai de ${brl0(m.renda)} para cerca de ${brl0(m.inss)} (INSS). Em ${m.meses} meses, são ${brl0(m.perdaSem)} a menos.`
    : `Hoje, se você precisar parar de trabalhar, a renda deixa de entrar. Em ${m.meses} meses, são ${brl0(m.perdaSem)} a menos.`;
  const bens = [`✅ ${brl0(m.dit)} por mês se precisar se afastar (acidente desde o 1º dia; doença a partir do ${m.franquia + 1}º dia)`];
  if (m.dg) bens.push(`✅ ${brl0(m.dg)} de uma vez no diagnóstico de doença grave, para usar como quiser, inclusive no tratamento`);
  if (m.ipa) bens.push(`✅ ${brl0(m.ipa)} em caso de invalidez por acidente`);
  if (foco === "completa" && m.riscoCap) bens.push(`✅ ${brl0(m.riscoCap)} por mês, por toda a vida, se não puder mais trabalhar`);
  if (foco === "completa" && m.aporte) bens.push(`✅ ${brl(m.aporte)} por mês para a sua reserva de previdência`);
  const outra = m.prevOn ? (foco === "completa" ? `Se preferir começar só pelo seguro, a opção Essencial fica em ${brl(m.essencial)} por mês.` : `Se quiser incluir a previdência (reserva + renda vitalícia por invalidez), o plano Completo fica em ${brl(m.completa)} por mês.`) : "";
  const wa1 = [
    `${n}, preparei o seu estudo com os valores oficiais da ${m.seguradora}.`, "",
    risco, "",
    "Com a proteção que montei para você:", ...bens, "",
    `Investimento: ${brl(v)} por mês, cerca de ${brl(m.dia(v))} por dia.`,
    outra ? "\n" + outra : "", "",
    "Te mando o estudo completo em PDF logo abaixo.", "",
    `Uma pergunta: os ${brl0(m.dit)} por mês cobrem as suas contas, ou prefere que eu ajuste o valor?`
  ].join("\n").replace(/\n{3,}/g, "\n\n");
  const g1 = m.guardar[0];
  const wa2 = [
    `${n}, separei a parte do seu estudo que mais importa para a sua avaliação:`, "",
    `Se você guardasse os ${brl0(m.essencial)} por mês por conta própria, em 1 ano teria cerca de ${brl0(g1.v)}. Num afastamento de ${m.meses} meses por acidente, a proteção te pagaria ${brl0(m.pagoAcid)}.`, "",
    `Os valores do estudo valem até ${m.validadeCurta}. A proposta é digital e você assina pelo celular.`, "",
    `Posso te enviar a proposta da opção Essencial, de ${brl(m.essencial)} por mês?`
  ].join("\n");
  return { wa1, wa2 };
}
function waLib(m) {
  const n = m.first || "Olá", o = m.ela ? "a" : "o";
  const R = m.renda ? brl0(m.renda) : "[sua renda]";
  const D = m.dit ? brl0(m.dit) : "[valor]";
  const foco = S.wa.opcao === "completa" && m.prevOn ? "completa" : "essencial";
  const V = foco === "completa" ? m.completa : m.essencial;
  const rot = m.P.rot.charAt(0).toUpperCase() + m.P.rot.slice(1);
  const g1 = m.guardar[0];
  const perda = m.inss != null
    ? `Com o INSS pagando cerca de ${brl0(m.inss)}, num afastamento de ${m.meses} meses deixariam de entrar ${brl0(m.perdaSem)}.`
    : `Num afastamento de ${m.meses} meses, deixariam de entrar ${brl0(m.perdaSem)}, sem contar o que o INSS pagaria depois da perícia.`;
  const t = waTexts(m);
  return [
    { g: "Conduzir a conversa", id: "primeiro", t: "Primeiro contato", quando: "Lead que fez o estudo no site e ainda não falou com você. A segunda mensagem é o seu posicionamento (proposta de valor). Não mande preço aqui: o objetivo é ganhar permissão para perguntar.",
      b: [`Oi, ${n}, tudo bem? Aqui é o Edgar Torres, corretor da Setor Norte Seguros.`,
          `Eu trabalho com proteção de renda para profissionais da saúde: comparo seguradoras, monto o plano junto com você e acompanho até o pagamento, se um dia você precisar usar.`,
          `Vi que você fez o estudo de proteção de renda no nosso site. Para eu ajustar os valores à sua realidade, posso te fazer 3 perguntas rápidas?`] },
    { g: "Conduzir a conversa", id: "situacao", t: "Situação", quando: "<b>S do SPIN.</b> Entender o cenário. Mande uma pergunta por vez e espere a resposta antes da próxima.",
      b: [`Hoje você atende como autônom${o}, por pessoa jurídica ou com carteira assinada?`,
          m.prof ? `Há quanto tempo você atua como ${m.prof.toLowerCase()}?` : `Há quanto tempo você atua na sua área?`,
          `Você contribui para o INSS? Sabe mais ou menos sobre qual valor?`,
          `Já tem algum seguro que pague uma renda se você precisar se afastar?`,
          `Essa é uma decisão só sua ou você costuma decidir junto com alguém da família?`] },
    { g: "Conduzir a conversa", id: "problema", t: "Problema", quando: "<b>P do SPIN.</b> Fazer o cliente reconhecer o risco com as palavras dele. O objetivo é ouvir um \"sim, ficaria complicado\".",
      b: [`${rot}. Se você precisasse parar de trabalhar amanhã, por um acidente ou uma cirurgia, a sua renda continuaria entrando?`,
          `Você já precisou se afastar alguma vez, ou viu algum colega passar por isso? Como foi?`] },
    { g: "Conduzir a conversa", id: "implicacao", t: "Implicação", quando: "<b>I do SPIN.</b> A etapa que mais faz falta: dimensionar a perda <b>antes</b> de falar de preço. Escolha 2 ou 3 perguntas, conforme a conversa, e feche com a última (os números). Se ele responder quanto tempo aguenta, anote em \"Reserva do cliente\" na aba Dados.",
      b: [`Hoje, se isso acontecesse, por quanto tempo você conseguiria manter as contas sem trabalhar?`,
          `E depois desse tempo, como ficaria? Teria que mexer na reserva, pedir ajuda para a família ou voltar a trabalhar antes da hora?`,
          `Hoje você já tem alguma coisa pensada para o caso de precisar se afastar?`,
          `Se nada mudar, como você imagina o impacto disso lá na frente, para você e para a sua família?`,
          `Só para você ter uma ideia: hoje a sua renda é de ${R}. ${perda}`] },
    { g: "Conduzir a conversa", id: "necessidade", t: "Necessidade", quando: "<b>N do SPIN.</b> O cliente diz o que quer. É o \"sim\" que vem antes do preço.",
      b: [`Se você continuasse recebendo ${D} por mês enquanto se recupera, isso resolveria a sua preocupação?`,
          `Para você, o que pesa mais: garantir a renda do mês a mês ou ter um valor maior de uma vez numa doença grave?`,
          `Para decidir com segurança, o que você precisaria saber além do valor?`,
          `Como você se sentiria sabendo que, se precisar parar, a sua renda continua entrando?`] },
    { g: "Conduzir a conversa", id: "estudo", t: "Envio do estudo", quando: "Só depois que ele confirmar que o valor da proteção faz sentido. Mande esta mensagem e o PDF logo em seguida.",
      b: [t.wa1] },
    ...(m.prevOn ? [{ g: "Conduzir a conversa", id: "completa", t: "Apresentar a Completa", quando: "Quando ele mostrar interesse e perguntar pela previdência, ou para justificar a diferença de valor. Use o pilar \"planejamento financeiro\" da proposta de valor. <b>A última mensagem é opcional:</b> só vale para quem faz a declaração completa do IR e contrata o plano PGBL.",
      b: [`A opção Completa junta duas coisas: proteger a sua renda de hoje e construir a de amanhã.`,
          `Além do seguro, ${brl(m.aporte)} por mês vão para uma previdência no seu nome (estimativa de ${short(m.reserva)} aos ${m.idadeApos} anos)${m.riscoCap ? `, e você passa a ter ${brl0(m.riscoCap)} por mês, por toda a vida, se não puder mais trabalhar, por acidente ou doença` : ""}.`,
          `Se você nunca precisar usar o seguro, a reserva continua sua.`,
          `Um detalhe que pode valer para você: se você faz a declaração completa do Imposto de Renda e contribui para o INSS, no plano PGBL as contribuições podem ser deduzidas até 12% da sua renda tributável. Quer que eu veja se compensa no seu caso?`] }] : []),
    { g: "Conduzir a conversa", id: "fechamento", t: "Fechamento", quando: "Quando ele aprovar o estudo, disser que gostou ou perguntar como contratar.",
      b: [m.prevOn ? `Perfeito, ${n}! Para seguirmos: você prefere a opção Completa, de ${brl(m.completa)}, ou começar pela Essencial, de ${brl(m.essencial)}?` : `Perfeito, ${n}! Vamos garantir a sua proteção. Posso te mandar a lista do que preciso para a proposta?`,
          `Para a proposta, preciso de:\n• Nome completo, CPF, data de nascimento e estado civil\n• Peso e altura\n• Endereço com CEP, e-mail e telefone\n• Beneficiários: nome, parentesco, data de nascimento e %\n• Pagamento: débito em conta ou cartão de crédito`,
          `A proposta chega no seu celular e você assina por lá. A análise da seguradora leva até 15 dias úteis.`] },
    { g: "Conduzir a conversa", id: "retomada", t: "Retomada", quando: "<b>2 dias</b> depois de um \"vou avaliar\" ou de silêncio: a primeira mensagem. <b>7 dias</b> depois, se continuar sem resposta: a segunda, que encerra com uma pergunta.",
      b: [t.wa2,
          `${n}, vou encerrar o seu estudo por aqui para não ficar te mandando mensagem.\n\nAntes, só uma pergunta: o que pesou mais para não seguir agora: o valor, o momento ou alguma cobertura? Assim consigo te ajudar melhor quando for a hora.`] },
    { g: "Nutrição", id: "pas", t: "Lead que ainda não está pronto", quando: "<b>Roteiro PAS</b> (Problema, Agravamento, Solução). Para quem esfriou ou ainda não quis conversar. Envie uma mensagem a cada 2 ou 3 dias, entre a retomada de 2 dias e a de 7 dias.",
      b: [`${n}, uma reflexão rápida: ${m.P.rot}. Hoje, cerca de 8 em cada 10 famílias brasileiras têm alguma dívida em andamento (Peic/CNC, julho de 2026). Se a sua renda para, as parcelas continuam.`,
          `O mais difícil num afastamento nem sempre é a recuperação em si. É fazer o tratamento pensando nas contas e no padrão de vida da família, vendo a reserva de anos ir embora em poucos meses.`,
          `Foi para isso que montei o seu estudo: ${D} por mês se você precisar parar${m.dg ? `, e ${brl0(m.dg)} de uma vez numa doença grave, para usar como quiser, inclusive no tratamento` : ""}. Tudo por ${brl(m.dia(m.essencial))} por dia. Posso te mostrar em 10 minutos?`] },
    { g: "O cliente respondeu…", id: "avaliar", t: "\"Vou avaliar\"", quando: "Não insista no produto. Descubra o que ele vai avaliar.",
      b: [`Claro, ${n}, é uma decisão importante mesmo.`,
          `Para te ajudar nessa avaliação: o que pesa mais para você hoje? O valor, alguma das coberturas ou você precisa conversar com alguém antes de decidir?`] },
    { g: "O cliente respondeu…", id: "caro", t: "\"Está caro\"", quando: "Primeiro reposicione o valor por dia e contra o que ele perderia. Só depois ofereça ajuste.",
      b: [`Entendo. Vamos olhar por outro ângulo: são ${brl(m.dia(V))} por dia para garantir ${D} por mês se você precisar parar.`,
          `Se você guardasse esse valor por conta própria, em 1 ano teria cerca de ${brl0(foco === "completa" ? fv(m.completa, m.taxaGuardar, 12) : g1.v)}. Num afastamento de ${m.meses} meses por acidente, o seguro pagaria ${brl0(m.pagoAcid)}.`,
          foco === "completa" ? `Se preferir, começamos só pelo seguro, a opção Essencial, de ${brl(m.essencial)} por mês. A previdência pode entrar depois.` : `Também consigo ajustar o valor da renda para caber melhor no seu orçamento. Quanto ficaria confortável por mês?`] },
    { g: "O cliente respondeu…", id: "inss", t: "\"Já pago o INSS\"", quando: "Concorde e mostre a diferença de valor e de prazo.",
      b: [`Ótimo, o INSS é importante e continua valendo. A diferença está no valor e no prazo.`,
          `${m.inss != null ? `Ele pagaria cerca de ${brl0(m.inss)}` : "Ele paga um valor limitado ao teto"}, e só depois da perícia. A proteção soma ${D} por mês: por acidente desde o 1º dia, por doença a partir do ${m.franquia + 1}º dia.`,
          m.inss != null ? `Com os dois juntos, a sua renda durante o afastamento ficaria em ${brl0(m.rendaCom)} por mês, contra ${R} de hoje. Faz sentido para você?` : `Faz sentido para você somar as duas coisas?`] },
    { g: "O cliente respondeu…", id: "reserva", t: "\"Já tenho reserva\"", quando: "Valorize a reserva e mostre que o seguro existe para que ela não seja consumida.",
      b: [`Ótimo, ter reserva é o primeiro passo.`,
          `A pergunta é: você quer usar essa reserva para pagar as contas de um afastamento ou para os seus planos? O seguro existe para que ela fique intacta.`,
          `Por quanto tempo a sua reserva cobriria as suas contas hoje?`] },
    { g: "O cliente respondeu…", id: "conjuge", t: "\"Preciso falar com alguém\"", quando: "Traga a outra pessoa para a conversa, com duas opções de horário.",
      b: [`Faz todo sentido decidir junto.`,
          `Que tal uma chamada rápida de 15 minutos com vocês dois? Eu explico e vocês tiram as dúvidas na hora. Fica melhor [opção 1] ou [opção 2]?`] },
    { g: "O cliente respondeu…", id: "jovem", t: "\"Sou jovem e saudável\"", quando: "Use a idade a favor: preço menor e aprovação mais simples.",
      b: [`Justamente por isso este é o melhor momento.`,
          `Hoje o preço é menor e a aprovação é mais simples. Acidentes não escolhem idade, e o valor sobe a cada aniversário da apólice.`,
          `Quer garantir os valores do estudo, que valem até ${m.validadeCurta}?`] },
    { g: "O cliente respondeu…", id: "banco", t: "\"Meu banco já me ofereceu\"", quando: "Responda com a proposta de valor: comparação entre seguradoras, foco em saúde e apoio na indenização. Depois ofereça comparar lado a lado.",
      b: [`Que bom que você já está pensando nisso!`,
          `A diferença de fazer comigo: eu comparo seguradoras para achar o melhor custo para o seu perfil, monto um plano pensado para quem é da saúde, com renda se precisar se afastar, e acompanho você no pedido de indenização, se um dia precisar.`,
          `Se quiser, me manda a proposta do banco que eu comparo lado a lado com o seu estudo. Assim você decide com os números na mão.`] },
    { g: "O cliente respondeu…", id: "temseguro", t: "\"Já tenho seguro de vida\"", quando: "Descubra se o seguro dele paga renda num afastamento temporário. Muitos não pagam.",
      b: [`Ótimo! Você sabe se ele paga uma renda mensal se você precisar se afastar, ou só em caso de morte e invalidez?`,
          `Muitos seguros de vida pagam só em caso de morte ou invalidez, e nada num afastamento temporário, que é o caso mais comum. Se quiser, me manda a apólice que eu confiro para você.`] },
    { g: "O cliente respondeu…", id: "nuncausar", t: "\"E se eu nunca usar?\"", quando: m.prevOn ? "Mostre que a previdência fica no nome dele." : "Mostre que esse é o melhor cenário e ofereça a previdência como opção.",
      b: m.prevOn ? [`Essa é a melhor parte da opção Completa: a previdência fica no seu nome. A reserva estimada é de ${short(m.reserva)} aos ${m.idadeApos} anos.`,
          `E o seguro funciona como o cinto de segurança: o melhor cenário é você nunca precisar dele.`]
        : [`O melhor cenário é exatamente esse: você trabalhar tranquil${o} e nunca precisar usar.`,
          `Se preferir ter um valor que volta para você, posso incluir uma previdência no plano. Quer que eu simule?`] },
    { g: "O cliente respondeu…", id: "semtempo", t: "\"Agora não tenho tempo\"", quando: "Reduza o esforço: áudio curto ou ligação rápida, com horário.",
      b: [`Sem problema! Consigo te explicar tudo em 10 minutos.`,
          `Prefere que eu te mande um áudio curto ou marcamos uma ligação rápida? Que horário fica melhor para você?`] }
  ];
}
function renderWA(m) {
  $("#waOpt").innerHTML = [["essencial", "Essencial · " + (m.premio ? brl(m.essencial) : "")], ["completa", "Completa · " + (m.prevOn ? brl(m.completa) : "sem previdência")]].map(([k, t]) => `<button data-wo="${k}" class="${S.wa.opcao === k ? "on" : ""}" ${k === "completa" && !m.prevOn ? "disabled" : ""}>${t}</button>`).join("");
  $("#waOpt").querySelectorAll("[data-wo]").forEach((b) => b.addEventListener("click", () => { S.wa.opcao = b.dataset.wo; save(); renderWA(calc()); }));
  const lib = waLib(m);
  if (!lib.find((x) => x.id === S.wa.sel)) S.wa.sel = "estudo";
  let nav = "", g = "", k = 0;
  lib.forEach((x) => {
    if (x.g !== g) { g = x.g; k = 0; nav += `<h4>${g}</h4>`; }
    k++;
    nav += `<button class="it ${S.wa.sel === x.id ? "on" : ""}" data-wsel="${x.id}"><i>${g.startsWith("Conduzir") ? k : g === "Nutrição" ? "•" : "?"}</i><span>${x.t}</span></button>`;
  });
  $("#waNav").innerHTML = nav;
  $("#waNav").querySelectorAll("[data-wsel]").forEach((b) => b.addEventListener("click", () => { S.wa.sel = b.dataset.wsel; save(); renderWA(calc()); }));
  const it = lib.find((x) => x.id === S.wa.sel);
  const multi = it.b.length > 1;
  $("#waMain").innerHTML = `<div class="card"><div class="wa-head"><h3>${it.t}</h3>${multi ? `<button data-copyall>Copiar tudo</button>` : ""}</div>
    <div class="wa-when" style="margin-top:10px">${it.quando}</div></div>
    <div class="bubbles">${it.b.map((txt, i) => `<div class="bub"><textarea data-b="${i}" rows="2">${esc(txt)}</textarea><div class="bact"><span>${multi ? `Mensagem ${i + 1} de ${it.b.length}` : ""}</span><button class="primary" data-cb="${i}">Copiar</button></div></div>`).join("")}</div>
    <div class="wa-tip">Os textos são editáveis antes de copiar, e se ajustam sozinhos ao nome, à profissão e aos valores da aba Dados. ${multi ? "Envie uma mensagem de cada vez e espere a resposta antes da próxima." : ""}</div>`;
  const fit = (ta) => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  $("#waMain").querySelectorAll("textarea").forEach((ta) => { fit(ta); ta.addEventListener("input", () => fit(ta)); });
  const copy = async (txt, ta) => { try { await navigator.clipboard.writeText(txt); toast("Mensagem copiada"); emit("mensagem_copiada", it.t); } catch (e) { if (ta) { ta.focus(); ta.select(); } toast("Texto selecionado: use Ctrl+C"); } };
  $("#waMain").querySelectorAll("[data-cb]").forEach((b) => b.addEventListener("click", () => { const ta = $(`#waMain textarea[data-b="${b.dataset.cb}"]`); copy(ta.value, ta); }));
  const all = $("#waMain [data-copyall]"); if (all) all.addEventListener("click", () => copy([...$("#waMain").querySelectorAll("textarea")].map((t) => t.value).join("\n\n")));
}

/* ---------- abas ---------- */
function showTab(t) {
  curTab = t;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + t));
  if (t !== "dados") refresh(); else renderResumo(calc());
  try { history.replaceState(null, "", "#" + t); } catch (e) {}
  window.dispatchEvent(new CustomEvent("rp:tab", { detail: t }));
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
$("#btnReset").addEventListener("click", () => {
  const bar = $("#btnReset");
  if (bar.dataset.armed) { const keep = { custom: S.deck.custom }; S = DEF(); S.deck.custom = keep.custom; save(); renderForm(); showTab("dados"); bar.textContent = "Novo cliente"; delete bar.dataset.armed; toast("Dados limpos"); return; }
  bar.dataset.armed = 1; bar.textContent = "Confirmar limpeza?"; setTimeout(() => { bar.textContent = "Novo cliente"; delete bar.dataset.armed; }, 3000);
});
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (curTab !== "dados") refresh(); if (!$("#present").hidden) drawPresent(); }, 150); });

/* ---------- modo apresentação ---------- */
let pIdx = 0, pList = [];
function present(i) {
  const m = calc(); pList = activeSlides(m).map((s) => slideHtml(s.id, m)); pIdx = i || 0;
  const el = $("#present"); el.hidden = false; drawPresent();
  try { if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); } catch (e) {}
}
function drawPresent() {
  const W = window.innerWidth, H = window.innerHeight, k = Math.min(W / 1920, H / 1080);
  const st = $("#presentStage"); st.style.width = 1920 * k + "px"; st.style.height = 1080 * k + "px";
  st.innerHTML = pList[pIdx]; st.firstElementChild.style.transform = `scale(${k})`;
  $("#presentCount").textContent = (pIdx + 1) + " / " + pList.length;
}
function exitPresent() { $("#present").hidden = true; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} }
$("#btnPresent").addEventListener("click", () => present(0));
$("#presentExit").addEventListener("click", (e) => { e.stopPropagation(); exitPresent(); });
$("#present").addEventListener("click", (e) => { if (e.target.closest(".present-bar")) return; if (e.clientX < window.innerWidth / 3) pIdx = Math.max(0, pIdx - 1); else pIdx = Math.min(pList.length - 1, pIdx + 1); drawPresent(); });
document.addEventListener("keydown", (e) => {
  if ($("#present").hidden) return;
  if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { pIdx = Math.min(pList.length - 1, pIdx + 1); drawPresent(); e.preventDefault(); }
  else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { pIdx = Math.max(0, pIdx - 1); drawPresent(); e.preventDefault(); }
  else if (e.key === "Escape") exitPresent();
  else if (e.key === "Home") { pIdx = 0; drawPresent(); } else if (e.key === "End") { pIdx = pList.length - 1; drawPresent(); }
});
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && !$("#present").hidden) drawPresent(); });

/* ---------- exportação ---------- */
const libs = {};
function loadLib(src) { if (!libs[src]) libs[src] = new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("não carregou " + src)); document.head.appendChild(s); }); return libs[src]; }
async function capture(htmls, w, h, scale) {
  await loadLib("lib/html2canvas.min.js");
  try { await document.fonts.ready; } catch (e) {}
  const host = $("#capture"); host.style.width = w + "px"; const out = [];
  for (const html of htmls) {
    host.innerHTML = html; const el = host.firstElementChild;
    await Promise.all([...host.querySelectorAll("img")].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
    await preloadBg(host);
    const cv = await window.html2canvas(el, { scale, useCORS: true, backgroundColor: "#ffffff", width: w, height: h, windowWidth: w, logging: false });
    out.push(cv);
  }
  host.innerHTML = ""; return out;
}
function preloadBg(root) {
  const urls = []; root.querySelectorAll("[style*='background-image']").forEach((el) => { const m = el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/); if (m) urls.push(m[1]); });
  return Promise.all(urls.map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; })));
}
function emit(tipo, detalhe) { window.dispatchEvent(new CustomEvent("rp:evento", { detail: { tipo, detalhe } })); }
async function offer(filename, blob) {
  emit(/^Estudo/.test(filename) ? "pdf_gerado" : "apresentacao_gerada", filename);
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
let busy = false;
async function withBusy(btn, label, fn) {
  if (busy) return; busy = true; const t = btn.textContent; btn.textContent = label; btn.disabled = true;
  try { await fn(); } catch (e) { console.error(e); toast("Erro: " + e.message); }
  btn.textContent = t; btn.disabled = false; busy = false;
}
const fileBase = (m) => m.nome.replace(/[\\/:*?"<>|]/g, "").trim();
$("#btnPdfEstudo").addEventListener("click", (e) => withBusy(e.currentTarget, "Gerando PDF…", async () => {
  const m = calc(); await loadLib("lib/jspdf.umd.min.js");
  const cvs = await capture(studyPages(m), 794, 1123, 2);
  const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  cvs.forEach((cv, i) => { if (i) pdf.addPage(); pdf.addImage(cv.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, 210, 297); });
  await offer(`Estudo Renda Protegida - ${fileBase(m)}.pdf`, pdf.output("blob"));
}));
$("#btnPdfDeck").addEventListener("click", (e) => withBusy(e.currentTarget, "Gerando…", async () => {
  const m = calc(); await loadLib("lib/jspdf.umd.min.js");
  const cvs = await capture(activeSlides(m).map((s) => slideHtml(s.id, m)), 1920, 1080, 1);
  const pdf = new window.jspdf.jsPDF({ unit: "px", format: [1920, 1080], orientation: "landscape", compress: true, hotfixes: ["px_scaling"] });
  cvs.forEach((cv, i) => { if (i) pdf.addPage([1920, 1080], "landscape"); pdf.addImage(cv.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, 1920, 1080); });
  await offer(`Apresentação Renda Protegida - ${fileBase(m)}.pdf`, pdf.output("blob"));
}));
$("#btnPptx").addEventListener("click", (e) => withBusy(e.currentTarget, "Gerando…", async () => {
  const m = calc(); await loadLib("lib/pptxgen.bundle.js");
  const cvs = await capture(activeSlides(m).map((s) => slideHtml(s.id, m)), 1920, 1080, 1);
  const pptx = new window.PptxGenJS(); pptx.layout = "LAYOUT_WIDE";
  cvs.forEach((cv) => pptx.addSlide().addImage({ data: cv.toDataURL("image/jpeg", 0.9), x: 0, y: 0, w: 13.333, h: 7.5 }));
  const blob = await pptx.write({ outputType: "blob" });
  await offer(`Apresentação Renda Protegida - ${fileBase(m)}.pptx`, blob);
}));

/* ---------- início ---------- */
renderForm();
const h = (location.hash || "").replace("#", "");
showTab(["clientes", "dados", "estudo", "deck", "wa"].includes(h) ? h : "clientes");
window.__app = { get S() { return S; }, KEY, calc, save, showTab, toast, importPdf, studyPages, slideHtml, activeSlides, waTexts, waLib, setState: (o) => { S = deepMerge(DEF(), o); save(); renderForm(); refresh(); } };
})();
