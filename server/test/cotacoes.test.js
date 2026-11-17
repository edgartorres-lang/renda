/* Leitura das cotações de seguro (Icatu, MAG e Azos) pelo public/parser.js.
   As linhas imitam o texto que o site extrai de cada PDF, com dados fictícios. Rode: node server/test/cotacoes.test.js */
const assert = require("assert");
const P = require("../../public/parser.js");
let ok = 0;
function t(nome, fn) { try { fn(); ok++; console.log("  ✔", nome); } catch (e) { console.error("  ✘", nome, "\n    ", e.message); process.exitCode = 1; } }
const nomes = (r) => r.coberturas.map((c) => c.nome);
const soma = (r) => Math.round(r.coberturas.reduce((a, c) => a + c.premio, 0) * 100) / 100;

const MAG = [
  "VIDA TODA 10/11/2026", "Oi Ana Paula testePreparamos um estudo exclusivo para você!", "Estudo",
  "Realizado em 10 de novembro de 2026. Esta simulação possui validade de 30 dias. Nesse", "Dados do Segurado", "Nome completo", "ana paula teste",
  "Data de nascimento Sexo biológico Renda mensal", "15/12/1990 Feminino R$ 12.000,00", "www.mag.com.br",
  "Produtos do Plano", "Produtos de Risco",
  "Cobertura até a idade Benefício Contribuição", "IPA COM MAJORAÇÃO (2278)", "Vitalício R$ 200.000,00 R$ 15,00", "Código SUSEP: 1",
  "Cobertura até a idade Benefício Contribuição", "DIÁRIA DE INCAPACIDADE", "70 anos R$ 8.000,00 R$ 150,00", "TEMPORÁRIA (2397)", "Código SUSEP: 2",
  "Cobertura até a idade Benefício Contribuição", "MORTE (2397)", "Vitalício R$ 100.000,00 R$ 20,00", "Código SUSEP: 3",
  "Cobertura até a idade Benefício Contribuição", "SAF ESSENCIAL INDIVIDUAL (3057)", "Vitalício R$ 5.500,00 R$ 1,00", "Código SUSEP: 4",
  "Cobertura até a idade Benefício Contribuição", "INCLUSÃO DA COBERTURA DE", "80 anos R$ 50.000,00 R$ 30,00", "FRATURAS E RUPTURAS QUE FARÁ", "PARTE DA LINHA INVIDA (3522)", "Código SUSEP: 5",
  "Cobertura até a idade Benefício Contribuição", "PROTEÇÃO ODONTOLÓGICA (9999)", "Vitalício R$ 1.000,00 R$ 4,00", "Código SUSEP: 6",
  "Economize!", "Valor total mensal Valor total anual de risco", "R$ 220,00/mês R$ 2.500,00/ano",
  "impossibilitado você receberá, a partir do 8º dia, até 365 diárias. O valor"
];

const AZOS = [
  "Olá, Ana", "Nome", "Ana Paula", "Primeiramente, gostaríamos de", "Teste", "preocupação com os imprevistos que Idade Sexo",
  "podem afetar a sua segurança 36 anos Feminino", "Renda mensal declarada", "R$ 12.000,00",
  "Corretor: Torres Norte SUSEP: 1 Data: 10/11/2026 01",
  "além disso, a pessoa segurada conta com o pagamento retroativo do período de franquia de 10",
  "dias.Carência:180 dias em caso de LER, DORT, LTC, hérnia, diálise ou hemodiálise e cirrose",
  "A Renda por Incapacidade Temporária com Retroativo de doenças ou acidentes, cobre até 120",
  "diárias para eventos de LER, DORT, LTC, hérnia; e até 730 diárias para demais casos",
  "hepática e 60 para outros eventos de doenças. Para acidentes, não há carência.",
  "AZOS", "Estudo personalizado", "Cobertura Capital Segurado Mensalidade",
  "Invalidez Permanente Total por", "R$ 200.000,00 R$ 14,00", "Acidente (majorada)",
  "Assistência Funeral Individual Até R$ 15.000,00 R$ 2,00",
  "Seguro de Vida R$ 100.000,00 R$ 10,00",
  "Renda por Incapacidade Temporária", "R$ 200,00/dia R$ 160,00", "com Retroativo",
  "Rupturas e Fraturas (REF) Até R$ 50.000,00 R$ 40,00",
  "Doenças Graves 30 Até R$ 80.000,00 R$ 30,00",
  "Mensalidade R$ 256,00/mês", "estimada (prêmio) ou R$ 2.900,00/ano (à vista) Economize 5%",
  "A validade desta cotação é de até 7 dias corridos."
];
AZOS.colunaDireita = ["Nome", "Ana Paula", "Teste", "Idade Sexo", "36 anos Feminino", "Profissão", "Fisioterapeuta", "Renda mensal declarada", "R$ 12.000,00"];

const ICATU = [
  "SUA SIMULAÇÃO", "NOME: MARIA TESTE", "IDADE: 40",
  "COBERTURA CAPITAL PRÊMIO INDENIZAÇÃO",
  "Morte 300.000,00 30,00 -",
  "Diária de Incapacidade Temporária com LER/DORT/LTC 10.000,00 200,00 -",
  "Cobertura Nova da Icatu 5.000,00 7,50 -",
  "PAGAMENTO TOTAL 237,50",
  "a partir do 16º dia"
];

console.log("MAG (Vida Toda)");
t("reconhece a MAG, os dados do cliente e as coberturas, inclusive uma que o site não conhece", () => {
  const r = P.parse(MAG);
  assert.strictEqual(r.seguradora, "MAG Seguros"); assert.strictEqual(r.nome, "Ana Paula Teste");
  assert.strictEqual(r.idade, 35); assert.strictEqual(r.sexo, "F"); assert.strictEqual(r.renda, 12000); assert.strictEqual(r.validadeDias, 30);
  assert.deepStrictEqual(nomes(r), ["Invalidez Permanente por Acidente (majorada)", "Diária de Incapacidade Temporária", "Morte", "Assistência Funeral (SAF Essencial Individual)", "Fraturas e Rupturas", "Proteção Odontológica"]);
  assert.strictEqual(r.coberturas[1].capital, 8000);
  assert.strictEqual(r.premio, 220); assert.strictEqual(soma(r), 220);
});
t("regras da renda por afastamento da MAG: 8º dia, 12 meses, LER 150/90, sem o limite de 10% da morte", () => {
  const r = P.parse(MAG);
  assert.strictEqual(r.ditFranquiaDias, 7); assert.strictEqual(r.ditFranquiaAcidDias, 7); assert.ok(!r.ditRetroativo);
  assert.strictEqual(r.ditMeses, 12); assert.strictEqual(r.ditCarenciaDias, 60); assert.strictEqual(r.lerCarenciaDias, 150); assert.strictEqual(r.lerMaxDias, 90);
  assert.strictEqual(r.ditLimitePctMorte, 0);
});

console.log("Azos");
t("reconhece a Azos, o quadro do cliente e a tabela com nomes quebrados em duas linhas", () => {
  const r = P.parse(AZOS);
  assert.strictEqual(r.seguradora, "Azos"); assert.strictEqual(r.nome, "Ana Paula Teste"); assert.strictEqual(r.idade, 36);
  assert.strictEqual(r.sexo, "F"); assert.strictEqual(r.profissao, "Fisioterapeuta"); assert.strictEqual(r.renda, 12000); assert.strictEqual(r.validadeDias, 7);
  assert.deepStrictEqual(nomes(r), ["Invalidez Permanente Total por Acidente (majorada)", "Assistência Funeral Individual", "Morte (Seguro de Vida)", "Renda por Incapacidade Temporária com Retroativo", "Rupturas e Fraturas", "Doenças Graves 30"]);
  assert.strictEqual(r.premio, 256); assert.strictEqual(soma(r), 256);
});
t("renda por dia vira renda por mês (×30) e as regras do retroativo são lidas", () => {
  const r = P.parse(AZOS);
  const dit = r.coberturas[3]; assert.strictEqual(dit.capital, 6000); assert.strictEqual(dit.diaria, 200);
  assert.strictEqual(r.ditFranquiaDias, 10); assert.ok(r.ditRetroativo); assert.strictEqual(r.ditMeses, 24);
  assert.strictEqual(r.lerMaxDias, 120); assert.strictEqual(r.lerCarenciaDias, 180); assert.strictEqual(r.ditCarenciaDias, 60);
});

console.log("Icatu (continua igual)");
t("seguro Icatu: lê todas as linhas da tabela, inclusive uma cobertura nova", () => {
  const r = P.parse(ICATU);
  assert.strictEqual(r.seguradora, "Icatu Seguros"); assert.strictEqual(r.nome, "Maria Teste");
  assert.deepStrictEqual(nomes(r), ["Morte", "Diária de Incapacidade Temporária com LER/DORT/LTC", "Cobertura Nova da Icatu"]);
  assert.strictEqual(r.premio, 237.5); assert.strictEqual(r.ditFranquiaDias, 15); assert.strictEqual(r.ditFranquiaAcidDias, undefined);
});
t("PDF desconhecido → null", () => assert.strictEqual(P.parse(["qualquer coisa", "sem tabela"]), null));

console.log(`\n${ok} testes passaram${process.exitCode ? ", HOUVE FALHAS" : ""}.`);
