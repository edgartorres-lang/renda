/* Previdência Icatu: regras dos produtos, preço das coberturas de risco e projeção da acumulação.
   Fórmulas iguais às da planilha "Gerador_estudo_previdencia" (conferidas com 7 estudos reais).
   Regras e limites: Guia Rápido de Vendas Previdência Icatu (dez/2025). */
(function (root) {
  const T = root.PrevTabelas || (typeof require !== "undefined" ? require("./prev-tabelas.js") : null);

  /* ---------- coberturas de risco ---------- */
  const COBS = {
    rendaInv: { nome: "Renda Vitalícia por Invalidez", idx: 0, mensal: true, quem: "voce",
      desc: "Renda mensal por toda a vida em caso de invalidez total e permanente, por acidente ou doença.",
      curto: (v) => `${brl0(v)}/mês vitalício por invalidez` },
    pecInv: { nome: "Pecúlio por Invalidez", idx: 1, mensal: false, quem: "voce",
      desc: "Pagamento único em caso de invalidez total e permanente, por acidente ou doença, livre de Imposto de Renda.",
      curto: (v) => `${short(v)} de uma vez por invalidez` },
    pecMorte: { nome: "Pecúlio por Morte", idx: 2, mensal: false, quem: "familia",
      desc: "Pagamento único aos beneficiários em caso de morte por acidente ou doença, livre de Imposto de Renda.",
      curto: (v) => `${short(v)} de uma vez para a família` },
    pc1: pc(1, 3), pc5: pc(5, 4), pc10: pc(10, 5), pc15: pc(15, 6), pc20: pc(20, 7)
  };
  function pc(anos, idx) {
    const t = anos === 1 ? "1 ano" : anos + " anos";
    return { nome: `Pensão por Prazo Certo (${t})`, idx, mensal: true, anos, quem: "familia",
      desc: `Renda mensal aos beneficiários durante ${t}, em caso de morte por acidente ou doença.`,
      curto: (v) => `${brl0(v)}/mês para a família por ${t}` };
  }
  const ORDEM = ["rendaInv", "pecInv", "pecMorte", "pc1", "pc5", "pc10", "pc15", "pc20"];

  /* ---------- produtos (limites de valor por cobertura: [mínimo, máximo]) ---------- */
  const PENS = (min, max) => ({ pc5: [min, max], pc10: [min, max], pc15: [min, max], pc20: [min, max] });
  const PRODUTOS = {
    simples: {
      nome: "Atitude+Simples", minContrib: 85, minPorCob: 15, exigeAcum: true, dps: false, carenciaMeses: 12, exames: false,
      limites: { rendaInv: [500, 5000], pecInv: [30000, 200000], pecMorte: [30000, 200000], ...PENS(500, 5000) },
      info: [
        "Aceitação automática: não exige Declaração Pessoal de Saúde (DPS).",
        "Carência de 12 meses para as coberturas de proteção, contados do início da vigência.",
        "Acumulação em fundo de previdência (PGBL ou VGBL), com a reserva no seu nome."
      ]
    },
    atitude: {
      nome: "Atitude", minContrib: 100, minPorCob: 30, exigeAcum: true, dps: true, carenciaMeses: 0, exames: true,
      limites: { rendaInv: [5000.01, 30000], pecInv: [200000.01, 1000000], pecMorte: [200000.01, 1000000], pc1: [500, 75000], ...PENS(5000.01, 30000) },
      info: [
        "Contratação com Declaração Pessoal de Saúde (DPS), preenchida e assinada por você.",
        "Sem carência para as coberturas de proteção.",
        "Acumulação em fundo de previdência (PGBL ou VGBL), com a reserva no seu nome."
      ]
    },
    icatuprev: {
      nome: "Icatu Prev", minContrib: 100, minAporte: 1000, minPorCob: 0, exigeAcum: false, dps: true, carenciaMeses: 0, exames: true,
      limites: { rendaInv: [500, 30000], pecInv: [100000, 1000000], pecMorte: [100000, 1000000], pc1: [500, 75000], ...PENS(500, 30000) },
      info: [
        "Plano de acumulação em fundo de previdência (PGBL ou VGBL), com a reserva no seu nome.",
        "As coberturas de proteção são opcionais: exigem Declaração Pessoal de Saúde (DPS) e não têm carência."
      ]
    }
  };
  const INFO_GERAL = [
    "As contribuições das coberturas são reajustadas todo ano conforme a idade, e os valores são atualizados pelo IPCA.",
    "Início de vigência: na aceitação da proposta pela Icatu ou no 15º dia após o recebimento dela."
  ];

  /* ---------- utilidades ---------- */
  function fmt(v, dec) { return (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }); }
  function brl(v) { return "R$ " + fmt(v, true); }
  function brl0(v) { return "R$ " + fmt(Math.round(v || 0), false); }
  function short(v) { return v >= 1e6 ? "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : v >= 1e4 ? "R$ " + Math.round(v / 1e3) + " mil" : brl0(v); }
  const r2 = (v) => Math.round(v * 100) / 100;

  /* ---------- preço das coberturas ---------- */
  /* contribuição mensal = valor do benefício ÷ 1.000 × taxa da idade */
  function premio(tipo, valor, idade) {
    const c = COBS[tipo], t = T.TAXAS_RISCO[idade];
    if (!c || !t || !(valor > 0)) return null;
    return r2(valor / 1000 * t[c.idx]);
  }

  /* ---------- acumulação ---------- */
  function reservaFV(contrib, inicial, taxaAA, meses) {
    const i = Math.pow(1 + taxaAA / 100, 1 / 12) - 1;
    if (!(meses > 0)) return inicial || 0;
    const f = Math.pow(1 + i, meses);
    return (i ? contrib * (f - 1) / i : contrib * meses) + (inicial || 0) * f;
  }
  /* fatores de renda (tábua BR-EMS2021, juros de 0% a.a. após a concessão, como nos estudos da Icatu) */
  function fatores(sexo, juros) {
    const q = T.TABUA_BR_EMS2021[sexo === "F" ? "F" : "M"], v = 1 / (1 + (juros || 0));
    const l = [1000]; for (let x = 1; x < q.length; x++) l[x] = l[x - 1] * (1 - q[x - 1]);
    const D = l.map((lx, x) => lx * Math.pow(v, x));
    const N = []; for (let x = D.length - 1, s = 0; x >= 0; x--) { s += D[x]; N[x] = s; }
    const Dd = (x) => (x < D.length ? D[x] : 0), Nn = (x) => (x < N.length ? N[x] : 0);
    const jm = Math.pow(1 + (juros || 0), 1 / 12) - 1;
    return {
      vitalicia: (x) => 12 * (Nn(x + 1) / Dd(x) + 11 / 24),
      temporaria: (x, t) => 12 * ((Nn(x + 1) - Nn(x + t + 1)) / Dd(x) + 11 / 24 * ((Dd(x) - Dd(x + t)) / Dd(x))),
      pmg: (x, t) => 12 * (Nn(x + t + 1) / Dd(x) + 11 / 24 * (Dd(x + t) / Dd(x))) + (jm ? (1 - Math.pow(1 + jm, -12 * t)) / jm : 12 * t),
      certo: (t) => (juros ? (1 - Math.pow(1 / (1 + juros), t)) / (Math.pow(1 + juros, 1 / 12) - 1) : 12 * t)
    };
  }
  const PRAZOS = [5, 10, 20, 30];
  function rendas(reserva, idadeApos, sexo) {
    if (!(reserva > 0) || !idadeApos) return null;
    const f = fatores(sexo, 0), x = idadeApos;
    return {
      vitalicia: reserva / f.vitalicia(x),
      temporaria: PRAZOS.map((t) => ({ t, v: reserva / f.temporaria(x, t) })),
      pmg: PRAZOS.map((t) => ({ t, v: reserva / f.pmg(x, t) })),
      certo: PRAZOS.map((t) => ({ t, v: reserva / f.certo(t) }))
    };
  }

  /* ---------- cálculo completo do bloco ---------- */
  /* entrada: { produto, contrib, inicial, taxa, idadeApos, idade, sexo, cobs: [{ tipo, valor }] } */
  function calcular(e) {
    const p = PRODUTOS[e.produto] || PRODUTOS.simples;
    const idade = Math.round(e.idade || 0), idadeApos = Math.round(e.idadeApos || 65), taxa = e.taxa > 0 ? e.taxa : 10;
    const anos = Math.max(0, idadeApos - idade), meses = anos * 12;
    const cobs = (e.cobs || []).filter((c) => COBS[c.tipo]).map((c) => {
      const valor = +c.valor || 0;
      return { tipo: c.tipo, nome: COBS[c.tipo].nome, desc: COBS[c.tipo].desc, mensal: COBS[c.tipo].mensal, quem: COBS[c.tipo].quem, valor, premio: idade ? premio(c.tipo, valor, idade) : null, curto: valor ? COBS[c.tipo].curto(valor) : "" };
    });
    const risco = r2(cobs.reduce((s, c) => s + (c.premio || 0), 0));
    const contrib = +e.contrib || 0, inicial = +e.inicial || 0;
    const reserva = idade && anos ? reservaFV(contrib, inicial, taxa, meses) : 0;
    return {
      produto: e.produto in PRODUTOS ? e.produto : "simples", P: p, nomeProduto: p.nome,
      idade, idadeApos, anos, taxa, contrib, inicial, cobs, risco, total: r2(contrib + risco),
      reserva, rendas: rendas(reserva, idadeApos, e.sexo),
      info: p.info.concat(INFO_GERAL),
      avisos: validar(p, { idade, contrib, inicial, cobs, sexo: e.sexo, idadeApos, anos })
    };
  }

  /* ---------- conferência (regras do guia) ---------- */
  function validar(p, d) {
    const a = [], add = (t, x) => a.push({ t, x });
    if (!d.idade) add("err", "Informe a idade do cliente para calcular a previdência.");
    else if (d.idade < 18 || d.idade > 64) add("err", `Idade de ${d.idade} anos: a contratação é de 18 a 64 anos.`);
    if (!d.sexo) add("warn", "Informe o sexo do cliente: a renda de aposentadoria usa tábua por sexo.");
    if (d.idade && d.idadeApos <= d.idade) add("err", "A idade de aposentadoria precisa ser maior que a idade atual.");
    if (p.exigeAcum && d.contrib < p.minContrib) add("err", `No ${p.nome}, a contribuição mínima para a acumulação é de ${brl(p.minContrib)} por mês.`);
    if (!p.exigeAcum && (d.contrib || d.inicial) && d.contrib < p.minContrib && d.inicial < p.minAporte)
      add("err", `No ${p.nome}, o mínimo é ${brl(p.minContrib)} por mês ou ${brl(p.minAporte)} de aporte inicial.`);
    if (!p.exigeAcum && !d.contrib && !d.inicial && !d.cobs.length) add("warn", "Informe a contribuição da acumulação ou inclua uma cobertura.");
    const vistos = {};
    d.cobs.forEach((c) => {
      if (vistos[c.tipo]) add("err", `${c.nome} aparece duas vezes. Deixe uma só.`);
      vistos[c.tipo] = 1;
      const lim = p.limites[c.tipo];
      if (!lim) { add("err", `${c.nome} não está disponível no ${p.nome}.`); return; }
      if (!c.valor) { add("warn", `Informe o valor da cobertura ${c.nome}.`); return; }
      if (c.valor < lim[0] || c.valor > lim[1]) add("err", `${c.nome}: no ${p.nome}, o valor vai de ${brl(lim[0])} a ${brl(lim[1])}${c.mensal ? " por mês" : ""}.`);
      if (c.premio != null && p.minPorCob && c.premio < p.minPorCob) add("err", `${c.nome}: a contribuição de ${brl(c.premio)} está abaixo do mínimo de ${brl(p.minPorCob)} por cobertura no ${p.nome}. Aumente o valor.`);
      if (p.exames && c.mensal && c.valor > 15000) add("warn", `${c.nome} acima de R$ 15 mil por mês: a Icatu pede exames (${examesTxt(c.valor, d.idade)}).`);
    });
    if (p.carenciaMeses && d.cobs.length) add("info", `${p.nome}: as coberturas têm carência de ${p.carenciaMeses} meses e não exigem DPS. O estudo informa isso ao cliente.`);
    return a;
  }
  function examesTxt(valor, idade) {
    if (valor > 25000) return "urina, sangue, ECG de esforço ou ProBNP, PSA para homens acima de 50, teste de nicotina, ficha financeira e IR dos últimos 2 anos";
    return "urina, sangue e ficha financeira" + (idade >= 40 ? ", mais ECG e PSA para homens acima de 50" : "");
  }

  const api = { COBS, ORDEM, PRODUTOS, INFO_GERAL, premio, reservaFV, rendas, calcular };
  root.Prev = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
