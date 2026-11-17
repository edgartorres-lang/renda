/* Leitor dos orçamentos Icatu (Seguro Essencial e Previdência Atitude+Simples), MAG (Vida Toda) e Azos.
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
    if (/mag\.com\.br/i.test(t) && /Produtos de Risco/i.test(t)) return "mag";
    if (/AZOS/i.test(t) && /Cobertura Capital Segurado Mensalidade/i.test(t)) return "azos";
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
    if (k === "mag") return parseMag(lines);
    if (k === "azos") return parseAzos(lines);
    return null;
  }

  /* Agrupa os itens de texto do pdf.js em linhas (mesmo y), em ordem de x. */
  async function linesFromPdf(pdf) {
    const all = [];
    const juntar = (rows) => rows.sort((a, b) => b.y - a.y).map((r) => {
      r.items.sort((a, b) => a.x - b.x);
      let s = "", end = null;
      r.items.forEach((i) => {
        const gap = end == null ? 0 : i.x - end;
        if (s && (gap > i.h * 0.25 || /\s$/.test(s) || /^\s/.test(i.s))) s += " ";
        s += i.s.trim(); end = i.x + i.w;
      });
      return s.replace(/\s+/g, " ").trim();
    });
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const meio = p === 1 && page.getViewport ? page.getViewport({ scale: 1 }).width / 2 : 0;
      const rows = [], dir = [];
      tc.items.forEach((it) => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4], y = it.transform[5];
        const item = { x, w: it.width || 0, s: it.str, h: Math.abs(it.transform[0]) || 8 };
        let r = rows.find((r) => Math.abs(r.y - y) < 3);
        if (!r) { r = { y, items: [] }; rows.push(r); }
        r.items.push(item);
        // 1ª página: a coluna da direita em separado (o quadro de dados do cliente da Azos fica ao lado de um texto)
        if (meio && x >= meio) { let d = dir.find((r) => Math.abs(r.y - y) < 3); if (!d) { d = { y, items: [] }; dir.push(d); } d.items.push(item); }
      });
      all.push(...juntar(rows));
      if (p === 1) all.colunaDireita = juntar(dir);
    }
    return all;
  }

  /* ---------- MAG (Vida Toda) e Azos ----------
     A tabela é lida linha a linha: qualquer cobertura que estiver nela entra, mesmo uma que o site ainda não conhece.
     Os nomes das coberturas que o site usa nas contas (renda por afastamento, morte, invalidez, doenças graves) são padronizados. */
  const DIACOS = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  function nomeCobertura(bruto) {
    const n = String(bruto || "").replace(/\(\d{3,5}\)/g, "").replace(/\s+/g, " ").trim();
    const u = DIACOS(n).toUpperCase();
    if (/^IPA\b|INVALIDEZ PERMANENTE/.test(u)) return (/TOTAL/.test(u) ? "Invalidez Permanente Total por Acidente" : "Invalidez Permanente por Acidente") + (/MAJORA/.test(u) ? " (majorada)" : "");
    if (/DIARIA DE INCAPACIDADE/.test(u)) return "Diária de Incapacidade Temporária";
    if (/^SEGURO DE VIDA$/.test(u)) return "Morte (Seguro de Vida)";
    if (/^MORTE\b/.test(u)) return /ACIDENT/.test(u) ? "Morte Acidental" : "Morte";
    if (/^SAF\b/.test(u)) return "Assistência Funeral (" + titleCase(n.replace(/^SAF\s*/i, "SAF ")).replace(/^Saf/, "SAF") + ")";
    if (/FRATURAS? E RUPTURAS?/.test(u)) return "Fraturas e Rupturas";
    if (/RUPTURAS? E FRATURAS?/.test(u)) return "Rupturas e Fraturas";
    return n === n.toUpperCase() ? titleCase(n) : n;
  }
  const idadeEm = (nasc, ref) => {
    const [d, m, a] = nasc.split("/").map(Number); const [D, M, A] = ref.split("/").map(Number);
    return A - a - (M < m || (M === m && D < d) ? 1 : 0);
  };
  const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

  function parseMag(lines) {
    const out = { tipo: "seguro", seguradora: "MAG Seguros", produto: "Vida Toda", coberturas: [], projecao: [] };
    const t = lines.join("\n");
    let m;
    const iN = lines.findIndex((l) => /^Nome completo$/i.test(l)); if (iN >= 0) out.nome = titleCase(lines[iN + 1]);
    m = t.match(/Realizado em (\d{1,2}) de (\w+) de (\d{4})/i);
    if (m) out.data = `${m[1].padStart(2, "0")}/${String(MESES[DIACOS(m[2]).toLowerCase()] || 1).padStart(2, "0")}/${m[3]}`;
    else if ((m = t.match(/VIDA TODA (\d{2}\/\d{2}\/\d{4})/i))) out.data = m[1];
    const iD = lines.findIndex((l) => /^Data de nascimento/i.test(l));
    if (iD >= 0) {
      const d = lines[iD + 1] || "";
      m = d.match(/(\d{2}\/\d{2}\/\d{4})/); if (m) { out.nascimento = m[1]; if (out.data) out.idade = idadeEm(m[1], out.data); }
      if (/feminino/i.test(d)) out.sexo = "F"; else if (/masculino/i.test(d)) out.sexo = "M";
      m = d.match(/R\$\s*([\d.]+,\d{2})/); if (m) out.renda = num(m[1]);
    }
    m = t.match(/validade de (\d+) dias/i); if (m) out.validadeDias = +m[1];
    // blocos "Cobertura até a idade Benefício Contribuição" … "Código SUSEP"
    let bloco = null;
    lines.forEach((l) => {
      if (/^Cobertura até a idade Benef[íi]cio Contribui[çc][ãa]o/i.test(l)) { bloco = { nome: [], v: null }; return; }
      if (!bloco) return;
      if (/^C[óo]digo SUSEP/i.test(l) || /^Economize|^Valor total mensal/i.test(l)) {
        if (bloco.v) out.coberturas.push({ nome: nomeCobertura(bloco.nome.join(" ")), capital: bloco.v[0], premio: bloco.v[1], ate: bloco.ate });
        bloco = null; return;
      }
      const v = l.match(/^(Vital[íi]cio|\d+ anos)\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})$/i);
      if (v) { bloco.v = [num(v[2]), num(v[3])]; bloco.ate = v[1]; } else bloco.nome.push(l);
    });
    m = t.match(/R\$\s*([\d.]+,\d{2})\/m[êe]s/i); out.premio = m ? num(m[1]) : 0;
    // renda por afastamento: "a partir do 8º dia, até 365 diárias"; carência e LER/DORT pelo descritivo da MAG
    m = t.match(/a partir do\s*(\d+)[ºo°]\s*dia,?\s*at[ée]\s*(\d+)\s*di[áa]rias/i);
    out.ditFranquiaDias = m ? +m[1] - 1 : 7; out.ditFranquiaAcidDias = out.ditFranquiaDias;
    out.ditMeses = m ? Math.round(+m[2] / 30) : 12;
    out.ditCarenciaDias = 60; out.lerCarenciaDias = 150; out.lerMaxDias = 90; out.ditLer = true;
    out.ditLimitePctMorte = 0; // a regra de 10% da morte é da Icatu
    out.somaCoberturas = Math.round(out.coberturas.reduce((a, c) => a + c.premio, 0) * 100) / 100;
    return out;
  }

  function parseAzos(lines) {
    const out = { tipo: "seguro", seguradora: "Azos", produto: "Seguro de Vida Azos", coberturas: [], projecao: [] };
    const t = lines.join("\n");
    let m;
    // quadro de dados do cliente (coluna da direita da 1ª página)
    const d = lines.colunaDireita || [];
    const depois = (re) => { const i = d.findIndex((l) => re.test(l)); return i >= 0 ? d[i + 1] || "" : ""; };
    const iN = d.findIndex((l) => /^Nome$/i.test(l));
    if (iN >= 0) { const p = []; for (let i = iN + 1; i < d.length && !/^Idade\b/i.test(d[i]); i++) p.push(d[i]); out.nome = titleCase(p.join(" ")); }
    m = t.match(/(\d+)\s*anos\s+(Masculino|Feminino)/i); if (m) { out.idade = +m[1]; out.sexo = /^f/i.test(m[2]) ? "F" : "M"; }
    const prof = depois(/^Profiss[ãa]o$/i); if (prof) out.profissao = prof;
    m = (depois(/^Renda mensal declarada$/i) || "").match(/R\$\s*([\d.]+,\d{2})/); if (m) out.renda = num(m[1]);
    m = t.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/); if (m) out.data = m[1];
    m = t.match(/validade desta cota[çc][ãa]o [ée] de at[ée]\s*(\d+)\s*dias/i); if (m) out.validadeDias = +m[1];
    // tabela "Cobertura Capital Segurado Mensalidade": nomes longos quebram em volta da linha dos valores
    const i0 = lines.findIndex((l) => /^Cobertura Capital Segurado Mensalidade/i.test(l));
    const i1 = lines.findIndex((l, i) => i > i0 && /^Mensalidade\b/i.test(l));
    if (i0 >= 0 && i1 > i0) {
      let pend = [], ultima = null;
      for (let i = i0 + 1; i < i1; i++) {
        const l = lines[i];
        const v = l.match(/^(.*?)\s*(At[ée]\s+)?R\$\s*([\d.]+,\d{2})(\/dia)?\s+R\$\s*([\d.]+,\d{2})$/i);
        if (v) {
          const porDia = !!v[4];
          ultima = { nomeP: [...pend, v[1]].filter(Boolean), aberta: !v[1], capital: num(v[3]) * (porDia ? 30 : 1), premio: num(v[5]), porDia, diaria: porDia ? num(v[3]) : 0 };
          out.coberturas.push(ultima); pend = [];
        } else if (ultima && ultima.aberta) { ultima.nomeP.push(l); ultima.aberta = false; }
        else pend.push(l);
      }
      out.coberturas = out.coberturas.map((c) => ({ nome: nomeCobertura(c.nomeP.join(" ")), capital: c.capital, premio: c.premio, ...(c.porDia ? { diaria: c.diaria } : {}) }));
      m = lines[i1].match(/R\$\s*([\d.]+,\d{2})\/m[êe]s/i); out.premio = m ? num(m[1]) : 0;
    }
    // renda por afastamento com retroativo: franquia de 10 dias, paga desde o 1º dia; até 730 diárias (120 para LER/DORT)
    m = t.match(/franquia de\s*(\d+)\s*dias/i); out.ditFranquiaDias = m ? +m[1] : 10; out.ditFranquiaAcidDias = out.ditFranquiaDias;
    out.ditRetroativo = /retroativo/i.test(t);
    m = t.match(/at[ée]\s*(\d+)\s*di[áa]rias para demais/i); out.ditMeses = m ? Math.round(+m[1] / 30) : 24;
    m = t.match(/cobre at[ée]\s*(\d+)\s*di[áa]rias para eventos de LER/i); out.lerMaxDias = m ? +m[1] : 120;
    m = t.match(/Car[êe]ncia:\s*(\d+)\s*dias em caso de LER/i); out.lerCarenciaDias = m ? +m[1] : 180;
    m = t.match(/e\s*(\d+)\s*para outros eventos de doen[çc]as/i); out.ditCarenciaDias = m ? +m[1] : 60;
    out.ditLer = true; out.ditLimitePctMorte = 0;
    out.somaCoberturas = Math.round(out.coberturas.reduce((a, c) => a + c.premio, 0) * 100) / 100;
    return out;
  }

  root.IcatuParser = { parse, linesFromPdf, num, titleCase, nomeCobertura };
  if (typeof module !== "undefined") module.exports = root.IcatuParser;
})(typeof window !== "undefined" ? window : globalThis);
