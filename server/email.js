/* Envio do estudo por e-mail pela caixa do corretor (Google Workspace, por SMTP com senha de app).
   Variáveis: SMTP_USER (o e-mail), SMTP_PASS (a senha de app do Google), opcionais SMTP_HOST e SMTP_PORT.
   EMAIL_TESTE=1 (só nos testes): não envia nada, só monta a mensagem. */
const nodemailer = require("nodemailer");

const USER = (process.env.SMTP_USER || "").trim();
const PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, ""); // o Google mostra a senha de app em blocos com espaço
const TESTE = process.env.EMAIL_TESTE === "1";

let transporte = null;
function pegarTransporte() {
  if (transporte) return transporte;
  if (TESTE) transporte = nodemailer.createTransport({ jsonTransport: true });
  else {
    const port = +process.env.SMTP_PORT || 465;
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465,
      auth: { user: USER, pass: PASS }
    });
  }
  return transporte;
}

const configurado = () => TESTE || !!(USER && PASS);
const remetente = () => (TESTE && !USER ? "teste@exemplo.com" : USER);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* o texto segue a formatação do WhatsApp: *negrito* e _itálico_ */
function paraHtml(t) {
  const corpo = esc(t)
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/(^|[\s(>])_([^_\n]+)_(?=[\s.,!?)<]|$)/gm, "$1<i>$2</i>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2933">${corpo}</div>`;
}
const paraTexto = (t) => String(t).replace(/\*([^*\n]+)\*/g, "$1").replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,!?)]|$)/gm, "$1$2");

/* envia e devolve o id da mensagem */
async function enviarEstudo({ nomeRemetente, responderPara, para, assunto, texto, pdf, arquivo }) {
  const de = remetente();
  const info = await pegarTransporte().sendMail({
    from: { name: nomeRemetente || de, address: de },
    replyTo: responderPara && responderPara !== de ? responderPara : undefined,
    to: para, subject: assunto,
    text: paraTexto(texto), html: paraHtml(texto),
    attachments: [{ filename: arquivo, content: pdf, contentType: "application/pdf" }]
  });
  return info.messageId || "";
}

module.exports = { configurado, remetente, enviarEstudo, paraHtml, paraTexto };
