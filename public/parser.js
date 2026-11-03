/* Leitor dos orçamentos Icatu (Seguro Essencial e Previdência Atitude+Simples).
   Recebe as linhas de texto do PDF (cada linha = itens com o mesmo y, em ordem de x)
   e devolve um objeto com os dados. Sem IA: regras fixas sobre o layout da Icatu. */
(function (root) {
  const num = (s) => {
    if (s == null) return 0;
    s = String(s).replace(/[R$\s]/g, "");
    if (s === "-" || s === "") return 0;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    const v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  };
  const MONEY = /-|\d{1,3}(?:\.\d{3})*,\d{2}/g;

  function detect(lines) {
    const t = lines.join("\n");
    if (/SUA SIMULA[ÇC][ÃA]O/i.test(t) && /PAGAMENTO TOTAL/i.test(t)) return "seguro";
    if (/Estudo de Previd[êe]ncia/i.test(t) || /Contribui[çc][ãa]o Mensal Aposentadoria/i.test(t)) return "prev";
    return null;
  }

  function titleCase(s) {
    const low = ["da", "de", "do", "das", "dos", "e"];
    return String(s || "").toLowerCase().split(/\s+/).filter(Boolean)
      .map((w, i) => (i && low.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
  }

  function parseSeguro(lines) {
    const out = { tipo: "seguro", seguradora: "Icatu Seguros", produto: "Seguro Essencial", coberturas: [], projecao: [] };
    const t = lines.join("\n");
    let m = t.match(/NOME:\s*(.+)/); if (m) out.nome = titleCase(m[1].trim());
    m = t.match(/IDADE:\s*(\d+)/); if (m) out.idade = +m[1];
    m = t.match(/N[ºo°]\s*ESTUDO:\s*(\d+)/i); if (m) out.estudo = m[1];
    m = t.match(/DATA DE ELABORA[ÇC][ÃA]O:\s*(\d{2}\/\d{2}\/\d{4})/i); if (m) out.data = m[1];
    const i0 = lines.findIndex((l) => /^COBERTURA\b.*INDENIZA/i.test(l));
    const i1 = lines.findIndex((l) => /^PAGAMENTO TOTAL/i.test(l));
    if (i0 >= 0 && i1 > i0) {
      let pend = "";
      for (let i = i0 + 1; i < i1; i++) {
        const l = lines[i].trim(); if (!l) continue;
        const toks = l.split(" "), vals = [];
        while (toks.length && vals.length < 3 && /^(-|\d{1,3}(?:\.\d{3})*,\d{2})$/.test(toks[toks.length - 1])) vals.unshift(toks.pop());
        const name = toks.join(" ").replace(/\s+/g, " ").trim();
        if (vals.length >= 3) {
          const nome = (pend ? pend + " " : "") + name;
          out.coberturas.push({ nome: nome.trim(), capital: num(vals[0]), premio: num(vals[1]) });
          pend = "";
        } else if (vals.length === 0 && name) {
          // continuação de nome (quebra de linha) — anexa à anterior ou guarda para a próxima
          const last = out.coberturas[out.coberturas.length - 1];
          if (last && /com$|\/$|-$/i.test(last.nome)) last.nome += " " + name;
          else if (last && i > 0 && !(lines[i + 1] || "").match(MONEY)) last.nome += " " + name;
          else pend = (pend ? pend + " " : "") + name;
        }
      }
      const tot = (lines[i1].match(MONEY) || []);
      out.premio = num(tot[0]);
    }
    // limpa nomes "Diária ... com" + "LER/DORT/LTC"
    out.coberturas.forEach((c) => { c.nome = c.nome.replace(/\s+/g, " ").trim(); });
    // franquia / carência da DIT
    out.ditFranquiaDias = /a partir do\s*16[ºo°]\s*dia/i.test(t) ? 15 : (/(\d+)\s*dias a contar do evento/i.test(t) ? +RegExp.$1 : 15);
    out.ditCarenciaDias = /car[êe]ncia de\s*(\d+)\s*dias e tempo m[íi]nimo/i.test(t) ? +RegExp.$1 : 60;
    m = t.match(/esfor[çc]o repetitivo[\s\S]{0,80}?car[êe]ncia de\s*(\d+)\s*dias e a indeniza[çc][ãa]o ser[áa] paga por at[ée]\s*(\d+)\s*dias/i);
    if (m) { out.lerCarenciaDias = +m[1]; out.lerMaxDias = +m[2]; }
    // reenquadramento etário
    const ir = lines.findIndex((l) => /REENQUADRAMENTO ET[ÁA]RIO/i.test(l));
    if (ir >= 0) {
      for (let i = ir + 1; i < lines.length; i++) {
        const mm = lines[i].trim().match(/^(\d{1,2})\s+(\d{2,3})\s+R\$\s*([\d.]+,\d{2})$/);
        if (mm) out.projecao.push({ ano: +mm[1], idade: +mm[2], premio: num(mm[3]) });
        if (/OBSERVA[ÇC][ÕO]ES GERAIS/i.test(lines[i])) break;
      }
    }
    m = t.match(/limitada a\s*(\d+)%\s*do valor da cobertura de Morte\.?\s*\n?/i);
    const dl = t.match(/Incapacidade Tempor[áa]ria, a indeniza[çc][ãa]o m[íi]nima[\s\S]{0,120}?limitada a\s*(\d+)%/i);
    out.ditLimitePctMorte = dl ? +dl[1] : 10;
    out.somaCoberturas = Math.round(out.coberturas.reduce((a, c) => a + c.premio, 0) * 100) / 100;
    return out;
  }

  function parsePrev(lines) {
    const out = { tipo: "prev", seguradora: "Icatu Seguros", produto: "Atitude + Simples" };
    const t = lines.join("\n");
    const g = (re) => { const m = t.match(re); return m ? m[1] : null; };
    const nome = g(/Estudo de Previd[êe]ncia Individual\s*\n?\s*para\s+(.+)/i); if (nome) out.nome = titleCase(nome.trim());
    const id = g(/Idade Atual:\s*(\d+)/i); if (id) out.idade = +id;
    const ia = g(/Idade de Aposentadoria:\s*(\d+)/i); if (ia) out.idadeApos = +ia;
    const tc = g(/Tempo de Contribui[çc][ãa]o \(anos\):\s*(\d+)/i); if (tc) out.anos = +tc;
    const sx = g(/Sexo:\s*([MF])\b/i); if (sx) out.sexo = sx.toUpperCase();
    const rt = g(/Rentabilidade Real Estimada:\s*([\d,.]+)\s*%/i); if (rt) out.taxa = num(rt);
    out.aporte = num(g(/Contribui[çc][ãa]o Mensal Aposentadoria:\s*R\$\s*([\d.,]+)/i));
    out.risco = num(g(/Contribui[çc][ãa]o Mensal das Coberturas de Risco:\s*R\$\s*([\d.,]+)/i));
    out.total = num(g(/Contribui[çc][ãa]o Mensal Total:\s*R\$\s*([\d.,]+)/i));
    out.reserva = num(g(/Reserva Estimada:\s*([\d.,]+)/i));
    out.rendaVitalicia = num(g(/Vital[íi]cia:\s*([\d.,]+)/i));
    out.riscos = [];
    lines.forEach((l) => {
      const m = l.match(/^\s*(Pens[ãa]o por Prazo Certo.*?|Pec[úu]lio por Morte|Pec[úu]lio por Invalidez|Renda por Invalidez):\s*(.*)$/i);
      if (!m) return;
      const vals = m[2].match(/R\$\s*[\d.]+,\d{2}/g) || [];
      if (vals.length === 2) out.riscos.push({ nome: m[1].trim(), capital: num(vals[0]), premio: num(vals[1]) });
      else if (vals.length === 1 && num(vals[0]) > 0) out.riscos.push({ nome: m[1].trim(), capital: 0, premio: num(vals[0]) });
    });
    return out;
  }

  function parse(lines) {
    const k = detect(lines);
    if (k === "seguro") return parseSeguro(lines);
    if (k === "prev") return parsePrev(lines);
    return null;
  }

  /* Agrupa os itens de texto do pdf.js em linhas (mesmo y), em ordem de x. */
  async function linesFromPdf(pdf) {
    const all = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      tc.items.forEach((it) => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4], y = it.transform[5];
        let r = rows.find((r) => Math.abs(r.y - y) < 3);
        if (!r) { r = { y, items: [] }; rows.push(r); }
        r.items.push({ x, w: it.width || 0, s: it.str, h: Math.abs(it.transform[0]) || 8 });
      });
      rows.sort((a, b) => b.y - a.y);
      rows.forEach((r) => {
        r.items.sort((a, b) => a.x - b.x);
        let s = "", end = null;
        r.items.forEach((i) => {
          const gap = end == null ? 0 : i.x - end;
          if (s && (gap > i.h * 0.25 || /\s$/.test(s) || /^\s/.test(i.s))) s += " ";
          s += i.s.trim(); end = i.x + i.w;
        });
        all.push(s.replace(/\s+/g, " ").trim());
      });
    }
    return all;
  }

  root.IcatuParser = { parse, linesFromPdf, num, titleCase };
  if (typeof module !== "undefined") module.exports = root.IcatuParser;
})(typeof window !== "undefined" ? window : globalThis);
