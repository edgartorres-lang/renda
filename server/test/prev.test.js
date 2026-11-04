/* Confere o cálculo da previdência (public/prev.js) com estudos reais gerados pela planilha da Icatu. */
const assert = require("assert");
const path = require("path");
const Prev = require(path.join(__dirname, "..", "..", "public", "prev.js"));
let ok = 0;
const perto = (a, b, nome) => { assert.ok(Math.abs(a - b) < 0.006, `${nome}: calculado ${a.toFixed(2)}, esperado ${b.toFixed(2)}`); ok++; };
// [nome, idade, sexo, produto, contribuição, reserva, vitalícia, [[cobertura, valor, prêmio]]]  (rentabilidade 10%, aposentadoria 65)
const CASOS = [
  ["Fabio", 43, "M", "atitude", 100, 89542.88, 364.52, [["pc10", 5000, 195.38]]],
  ["Ingrid", 27, "F", "atitude", 100, 456530.00, 1552.29, [["rendaInv", 5000, 107.66]]],
  ["Lorane", 44, "M", "atitude", 100, 80262.57, 326.74, [["pc5", 10000, 231.47]]],
  ["Lucas", 35, "M", "atitude", 100, 206284.33, 839.77, [["rendaInv", 5000, 113.90]]],
  ["Priscilla", 44, "F", "simples", 85, 68223.18, 231.97, [["rendaInv", 3000, 94.90]]],
  ["Vanessa", 42, "M", "simples", 85, 84788.54, 345.17, [["rendaInv", 3000, 85.64]]],
  ["Victor", 35, "M", "simples", 85, 175341.68, 713.81, [["pc5", 5000, 49.85], ["pecMorte", 200000, 34.93], ["pecInv", 200000, 32.46]]]
];
for (const [nome, idade, sexo, produto, contrib, res, vit, cobs] of CASOS) {
  const r = Prev.calcular({ produto, contrib, taxa: 10, idadeApos: 65, idade, sexo, cobs: cobs.map(([tipo, valor]) => ({ tipo, valor })) });
  perto(r.reserva, res, nome + " reserva");
  perto(r.rendas.vitalicia, vit, nome + " vitalícia");
  cobs.forEach(([tipo, , p], i) => perto(r.cobs[i].premio, p, `${nome} ${tipo}`));
  perto(r.risco, cobs.reduce((s, c) => s + c[2], 0), nome + " total risco");
}
// exemplo salvo na planilha: 44 anos, M, R$ 100/mês, 12% a.a., aposentadoria aos 65
const ex = Prev.calcular({ produto: "atitude", contrib: 100, taxa: 12, idadeApos: 65, idade: 44, sexo: "M", cobs: [] });
perto(ex.reserva, 103320.28880867362, "exemplo reserva");
perto(ex.rendas.vitalicia, 420.61109638532946, "exemplo vitalícia");
[1774.3969628245266, 923.651889604151, 525.1625531421712, 433.0775510373139].forEach((v, i) => perto(ex.rendas.temporaria[i].v, v, "exemplo temporária " + ex.rendas.temporaria[i].t));
[417.5993278918635, 407.1211810001538, 357.6288873037722, 281.47220204920376].forEach((v, i) => perto(ex.rendas.pmg[i].v, v, "exemplo PMG " + ex.rendas.pmg[i].t));
[1722.0048134778938, 861.0024067389469].forEach((v, i) => perto(ex.rendas.certo[i].v, v, "exemplo prazo certo " + ex.rendas.certo[i].t));
// exemplo do guia (45 anos): Pecúlio por Invalidez 100 mil = 27,94 · Pecúlio por Morte 100 mil = 45,70 · Pensão 10 anos 1 mil = 49,71
perto(Prev.premio("pecInv", 100000, 45), 27.94, "guia pecúlio invalidez");
perto(Prev.premio("pecMorte", 100000, 45), 45.70, "guia pecúlio morte");
perto(Prev.premio("pc10", 1000, 45), 49.71, "guia pensão 10 anos");
// regras do guia
const av = (e) => Prev.calcular({ taxa: 10, idadeApos: 65, idade: 40, sexo: "F", ...e }).avisos.filter((a) => a.t === "err").map((a) => a.x).join(" | ");
assert.match(av({ produto: "simples", contrib: 80, cobs: [] }), /mínima.*85/); ok++;
assert.match(av({ produto: "simples", contrib: 85, cobs: [{ tipo: "rendaInv", valor: 6000 }] }), /500,00 a R\$ 5\.000,00/); ok++;
assert.match(av({ produto: "simples", contrib: 85, cobs: [{ tipo: "pc1", valor: 1000 }] }), /não está disponível/); ok++;
assert.match(av({ produto: "atitude", contrib: 100, cobs: [{ tipo: "rendaInv", valor: 5000 }] }), /5\.000,01/); ok++;
assert.match(av({ produto: "atitude", contrib: 100, cobs: [{ tipo: "pc1", valor: 500 }] }), /abaixo do mínimo de R\$ 30/); ok++;
assert.strictEqual(av({ produto: "icatuprev", contrib: 0, inicial: 5000, cobs: [] }), ""); ok++;
assert.strictEqual(av({ produto: "simples", contrib: 85, cobs: [{ tipo: "rendaInv", valor: 3000 }, { tipo: "pecMorte", valor: 100000 }] }), ""); ok++;
assert.match(av({ produto: "atitude", contrib: 100, idade: 66, cobs: [] }), /18 a 64/); ok++;
console.log(`${ok} verificações da previdência passaram.`);
