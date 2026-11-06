/* Leitura do webhook do RD Station. Rode com: node server/test/rd.test.js */
const assert = require("assert");
const { lerLeads, parseRenda, parseIdade, origemDe } = require("../rd");

let ok = 0;
function t(nome, fn) { try { fn(); ok++; console.log("  ✔", nome); } catch (e) { console.error("  ✘", nome, "\n    ", e.message); process.exitCode = 1; } }

console.log("Renda");
t("valor digitado", () => { assert.strictEqual(parseRenda("R$ 12.000,00"), 12000); assert.strictEqual(parseRenda("12000"), 12000); assert.strictEqual(parseRenda(8500), 8500); });
t("em mil", () => { assert.strictEqual(parseRenda("12 mil"), 12000); assert.strictEqual(parseRenda("15k"), 15000); });
t("faixa vira o meio", () => { assert.strictEqual(parseRenda("De R$ 5.000 a R$ 10.000"), 7500); assert.strictEqual(parseRenda("Entre 10 e 15 mil"), 12500); });
t("acima de / até", () => { assert.strictEqual(parseRenda("Acima de R$ 20.000"), 20000); assert.strictEqual(parseRenda("Até 5 mil"), 5000); });
t("texto sem número → vazio", () => { assert.strictEqual(parseRenda("Prefiro não informar"), null); assert.strictEqual(parseRenda(""), null); });

console.log("Idade");
const ref = new Date(2026, 10, 6);
t("idade direta", () => assert.strictEqual(parseIdade("34 anos"), 34));
t("data de nascimento dd/mm/aaaa e aaaa-mm-dd", () => { assert.strictEqual(parseIdade("", "07/11/1990", ref), 35); assert.strictEqual(parseIdade("", "1990-11-06", ref), 36); });

console.log("Origem");
t("tag Agendou + Instagram", () => assert.deepStrictEqual(origemDe(["Agendou", "lead-instagram"]), { origem: "instagram", agendou: true }));
t("conversão do Calendly", () => assert.deepStrictEqual(origemDe(["calendly-conversa-com-corretor"]), { origem: "", agendou: true }));
t("Facebook, Google, site, indicação", () => {
  assert.strictEqual(origemDe(["facebook ads"]).origem, "facebook");
  assert.strictEqual(origemDe(["google / cpc"]).origem, "google");
  assert.strictEqual(origemDe(["estudo-renda-protegida"]).origem, "site");
  assert.strictEqual(origemDe(["indicacao"]).origem, "indicacao");
});

console.log("Envio do webhook");
t("formato antigo (custom_fields com o nome do campo)", () => {
  const [L] = lerLeads({ leads: [{ id: "1", email: "Ana@Teste.com", name: "Ana Souza", job_title: "Fisioterapeuta", mobile_phone: "(96) 99999-0000",
    tags: ["agendou", "instagram"], custom_fields: { "Renda mensal": "De R$ 8.000 a R$ 12.000", "Data de nascimento": "10/03/1992" },
    last_conversion: { content: { identificador: "agendou" }, conversion_origin: { source: "instagram", medium: "paid" } } }] });
  assert.strictEqual(L.email, "ana@teste.com"); assert.strictEqual(L.nome, "Ana Souza"); assert.strictEqual(L.profissao, "Fisioterapeuta");
  assert.strictEqual(L.renda, 10000); assert.ok(L.idade >= 33 && L.idade <= 34); assert.strictEqual(L.telefone, "(96) 99999-0000");
  assert.strictEqual(L.origem, "instagram"); assert.strictEqual(L.agendou, 1); assert.match(L.tags, /agendou/);
});
t("formato novo (cf_ no mesmo nível)", () => {
  const [L] = lerLeads({ leads: [{ email: "b@teste.com", name: "Bruno", cf_cargo: "Cirurgião-dentista", cf_renda: "15 mil", cf_idade: "41", tags: "facebook" }] });
  assert.strictEqual(L.profissao, "Cirurgião-dentista"); assert.strictEqual(L.renda, 15000); assert.strictEqual(L.idade, 41);
  assert.strictEqual(L.origem, "facebook"); assert.strictEqual(L.agendou, 0);
});
t("envio sem leads ou lead sem nome e e-mail → nada", () => { assert.deepStrictEqual(lerLeads({}), []); assert.deepStrictEqual(lerLeads({ leads: [{ tags: ["x"] }] }), []); });

console.log(`\n${ok} testes passaram${process.exitCode ? ", HOUVE FALHAS" : ""}.`);
