/* Backup diário automático do banco, feito pelo próprio servidor.
   Útil no EasyPanel, onde não há cron no servidor. Grava em data/backups (mesmo volume do banco),
   comprimido, e guarda os últimos BACKUP_DIAS dias. */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream/promises");
const { db, DB_PATH } = require("./db");

const DIR = process.env.BACKUP_DIR || path.join(path.dirname(DB_PATH), "backups");
const DIAS = +process.env.BACKUP_DIAS || 30;
const HORA = process.env.BACKUP_HORA || "02:30"; // horário local (TZ)

const p2 = (n) => String(n).padStart(2, "0");
const carimbo = (d = new Date()) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;

/* Cópia consistente (API de backup do SQLite) num arquivo temporário. */
async function copiaTemporaria() {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = path.join(DIR, `.tmp-${process.pid}-${Date.now()}.db`);
  await db.backup(tmp);
  return tmp;
}

async function fazerBackup() {
  const tmp = await copiaTemporaria();
  const destino = path.join(DIR, `app-${carimbo()}.db.gz`);
  try {
    await pipeline(fs.createReadStream(tmp), zlib.createGzip(), fs.createWriteStream(destino));
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  limparAntigos();
  return destino;
}

function limparAntigos() {
  const limite = Date.now() - DIAS * 86400 * 1000;
  for (const f of fs.readdirSync(DIR)) {
    if (!/^app-.*\.db\.gz$/.test(f)) continue;
    const arq = path.join(DIR, f);
    if (fs.statSync(arq).mtimeMs < limite) fs.rmSync(arq, { force: true });
  }
}

function backupDeHojeExiste() {
  const hoje = carimbo().slice(0, 10);
  return fs.existsSync(DIR) && fs.readdirSync(DIR).some((f) => f.startsWith(`app-${hoje}`));
}

/* Agenda o backup diário no horário HORA; se o servidor subir depois do horário e ainda
   não houver backup do dia, faz um logo na partida. */
function agendarBackup() {
  const [h, m] = HORA.split(":").map(Number);
  const rodar = () =>
    fazerBackup()
      .then((f) => console.log(`Backup gravado: ${path.basename(f)}`))
      .catch((e) => console.error("Falha no backup:", e.message));
  const proximo = () => {
    const agora = new Date();
    const alvo = new Date(agora);
    alvo.setHours(h, m, 0, 0);
    if (alvo <= agora) alvo.setDate(alvo.getDate() + 1);
    const t = setTimeout(() => { rodar(); proximo(); }, alvo - agora);
    t.unref();
  };
  const agora = new Date();
  if (!backupDeHojeExiste() && (agora.getHours() > h || (agora.getHours() === h && agora.getMinutes() >= m))) rodar();
  proximo();
}

/* Envia ao admin um backup feito na hora (para guardar uma cópia fora do servidor). */
async function enviarBackup(res) {
  const tmp = await copiaTemporaria();
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", `attachment; filename="renda-protegida-${carimbo()}.db.gz"`);
  try {
    await pipeline(fs.createReadStream(tmp), zlib.createGzip(), res);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

module.exports = { agendarBackup, fazerBackup, enviarBackup, DIR };
