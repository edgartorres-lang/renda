/* RD Station Marketing: lê o envio do webhook (gatilho Oportunidade) e devolve os leads já no formato da plataforma.
   Aceita os dois formatos do RD: o antigo (campos personalizados dentro de custom_fields, com o nome do campo)
   e o novo (campos personalizados no mesmo nível do lead, com o prefixo cf_). */
const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const txt = (v, max = 200) => (v == null ? "" : String(Array.isArray(v) ? v.join(", ") : v)).trim().slice(0, max);

/* todos os campos do lead como pares [nome normalizado, valor], incluindo os personalizados */
function campos(lead) {
  const out = [];
  const add = (k, v) => { if (v != null && v !== "" && typeof v !== "object") out.push([norm(k).replace(/^cf_/, "").replace(/[_-]+/g, " "), v]); else if (Array.isArray(v)) out.push([norm(k).replace(/^cf_/, "").replace(/[_-]+/g, " "), v.join(", ")]); };
  for (const [k, v] of Object.entries(lead || {})) add(k, v);
  const cf = lead && lead.custom_fields;
  if (cf && typeof cf === "object") for (const [k, v] of Object.entries(cf)) add(k, v);
  return out;
}
const achar = (cs, re, excluir) => { const c = cs.find(([k, v]) => re.test(k) && !(excluir && excluir.test(k)) && String(v).trim()); return c ? c[1] : null; };

/* "R$ 12.000", "12 mil", "De R$ 5.000 a R$ 10.000", "Acima de 20 mil" → número (faixa vira o meio) */
function parseRenda(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v >= 300 && v <= 1e6 ? v : null;
  const t = norm(v).replace(/r\$/g, " ");
  const nums = [];
  const re = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil\b|k\b)?/g;
  let m, temMil = false;
  while ((m = re.exec(t))) {
    let n = parseInt(m[1].replace(/\./g, ""), 10) + (m[2] ? +("0." + m[2]) : 0);
    if (m[3]) { n *= 1000; temMil = true; }
    nums.push(n);
  }
  if (!nums.length) return null;
  const vals = nums.map((n) => (temMil && n < 1000 ? n * 1000 : n)).filter((n) => n >= 300 && n <= 1e6);
  if (!vals.length) return null;
  const r = vals.length >= 2 ? (vals[0] + vals[1]) / 2 : vals[0];
  return Math.round(r);
}

/* idade direta ou a partir da data de nascimento (dd/mm/aaaa ou aaaa-mm-dd) */
function parseIdade(idade, nasc, agora = new Date()) {
  const n = parseInt(String(idade || "").replace(/\D/g, ""), 10);
  if (n >= 16 && n <= 90) return n;
  const s = String(nasc || "").trim();
  let d = null, m;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) d = new Date(+m[3], +m[2] - 1, +m[1]);
  else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (!d || isNaN(d)) return null;
  let a = agora.getFullYear() - d.getFullYear();
  if (agora.getMonth() < d.getMonth() || (agora.getMonth() === d.getMonth() && agora.getDate() < d.getDate())) a--;
  return a >= 16 && a <= 90 ? a : null;
}

/* textos de conversão: identificador, fonte, campanha (do último e do primeiro contato, quando vierem) */
function conversoes(lead) {
  const out = [];
  const pega = (c) => {
    if (!c || typeof c !== "object") return;
    const ct = c.content || {};
    for (const v of [ct.identificador, ct.conversion_identifier, c.conversion_identifier, c.identifier, c.event_identifier, c.source, c.name]) if (v && typeof v === "string") out.push(v);
    const o = c.conversion_origin || {};
    for (const v of [o.source, o.medium, o.campaign, o.channel, o.value]) if (v && typeof v === "string") out.push(v);
  };
  pega(lead.last_conversion); pega(lead.first_conversion);
  for (const k of ["conversion_identifier", "last_conversion_identifier", "first_conversion_identifier", "traffic_source", "traffic_medium", "traffic_campaign", "utm_source", "utm_medium", "utm_campaign"]) if (typeof lead[k] === "string" && lead[k]) out.push(lead[k]);
  return [...new Set(out.map((s) => s.trim()).filter((s) => s && !/^\(?(unknown|other|none|null)\)?$/i.test(s)))];
}

/* o RD costuma mandar só o primeiro nome em "name"; o nome completo vem no campo Nome das conversões */
function nomeCompleto(lead, cs) {
  const base = txt(lead.name || lead.nome || achar(cs, /^nome( completo)?$/), 200);
  const primeiro = norm(base).split(" ")[0];
  let melhor = base;
  for (const c of [lead.first_conversion, lead.last_conversion]) {
    const n = txt(c && c.content && (c.content.Nome || c.content.nome || c.content.name), 200);
    if (n.length > melhor.length && (!primeiro || norm(n).split(" ")[0] === primeiro)) melhor = n;
  }
  return melhor;
}

/* origem pelo texto das tags e das conversões. "Agendou" é guardado à parte: o lead pode ter vindo do Instagram E agendado. */
function origemDe(textos) {
  const t = " " + norm(textos.join(" | ")) + " ";
  const agendou = /agend|calendly|reuniao|agenda realizada/.test(t);
  let origem = "";
  if (/indica/.test(t)) origem = "indicacao";
  else if (/insta|\big\b/.test(t)) origem = "instagram";
  else if (/facebook|\bfb\b|meta ads|\bmeta\b/.test(t)) origem = "facebook";
  else if (/google|adwords|gads|\bcpc\b/.test(t)) origem = "google";
  else if (/\bsite\b|estudo|simulad|landing|\blp\b|organic|blog|whatsapp/.test(t)) origem = "site";
  return { origem, agendou };
}

function lerLead(lead) {
  if (!lead || typeof lead !== "object") return null;
  const cs = campos(lead);
  const email = txt(lead.email || achar(cs, /^e ?mail$/), 200).toLowerCase();
  const nome = nomeCompleto(lead, cs);
  if (!email && !nome) return null;
  const tags = (Array.isArray(lead.tags) ? lead.tags : String(lead.tags || "").split(",")).map((x) => txt(x, 80)).filter(Boolean);
  const conv = conversoes(lead);
  const { origem, agendou } = origemDe([...tags, ...conv]);
  const tel = lead.mobile_phone || lead.personal_phone || lead.phone || achar(cs, /whats|celular|telefone|fone/);
  return {
    nome, email,
    telefone: txt(tel, 40) || null,
    profissao: txt(lead.job_title || lead.cargo || achar(cs, /cargo|profiss|area de atuacao|ocupacao/), 120) || null,
    renda: parseRenda(achar(cs, /renda|faturamento|ganho|salario|remuneracao/, /renda protegida/)),
    idade: parseIdade(achar(cs, /^idade|sua idade/), lead.birthdate || achar(cs, /nascimento|birth/)),
    origem: origem || null, agendou: agendou ? 1 : 0,
    tags: tags.join(", ").slice(0, 500) || null,
    conversao: conv.join(" · ").slice(0, 500) || null
  };
}

/* o corpo do webhook traz { leads: [...] }; aceita também um lead solto */
function lerLeads(body) {
  if (!body || typeof body !== "object") return [];
  const lista = Array.isArray(body.leads) ? body.leads : Array.isArray(body) ? body : body.email || body.name ? [body] : body.lead ? [body.lead] : [];
  return lista.map(lerLead).filter(Boolean);
}

module.exports = { lerLeads, lerLead, parseRenda, parseIdade, origemDe };
