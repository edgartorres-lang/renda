/* Utilitário de linha de comando para usuários.
   Uso (dentro do container):  docker compose exec app node server/cli.js <comando> ...
     listar
     criar "Nome Completo" email senha [corretor|admin]
     senha email novaSenha          (senha provisória: troca obrigatória no próximo login)
     ativar email | desativar email                                                     */
const bcrypt = require("bcryptjs");
const { db } = require("./db");

const [cmd, ...a] = process.argv.slice(2);
const sair = (msg, code = 0) => { console.log(msg); process.exit(code); };
const user = (email) => db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").toLowerCase());
const derrubar = (id) => db.prepare("DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?").run(id);

switch (cmd) {
  case "listar": {
    const rows = db.prepare("SELECT id, nome, email, papel, ativo, trocar_senha, criado_em FROM users ORDER BY id").all();
    console.table(rows);
    break;
  }
  case "criar": {
    const [nome, email, senha, papel = "corretor"] = a;
    if (!nome || !email || !senha) sair('Uso: criar "Nome" email senha [corretor|admin]', 1);
    if (senha.length < 8) sair("A senha precisa ter pelo menos 8 caracteres.", 1);
    if (user(email)) sair("Já existe um usuário com esse e-mail.", 1);
    db.prepare("INSERT INTO users (nome, email, senha_hash, papel, trocar_senha) VALUES (?, ?, ?, ?, 1)")
      .run(nome, email.toLowerCase(), bcrypt.hashSync(senha, 12), papel === "admin" ? "admin" : "corretor");
    sair(`Usuário criado: ${email} (${papel}). Ele vai trocar a senha no primeiro login.`);
    break;
  }
  case "senha": {
    const [email, nova] = a;
    const u = user(email);
    if (!u || !nova) sair("Uso: senha email novaSenha (usuário precisa existir)", 1);
    if (nova.length < 8) sair("A senha precisa ter pelo menos 8 caracteres.", 1);
    db.prepare("UPDATE users SET senha_hash = ?, trocar_senha = 1 WHERE id = ?").run(bcrypt.hashSync(nova, 12), u.id);
    derrubar(u.id);
    sair(`Senha provisória definida para ${email}.`);
    break;
  }
  case "ativar":
  case "desativar": {
    const u = user(a[0]);
    if (!u) sair("Usuário não encontrado.", 1);
    db.prepare("UPDATE users SET ativo = ? WHERE id = ?").run(cmd === "ativar" ? 1 : 0, u.id);
    if (cmd === "desativar") derrubar(u.id);
    sair(`${u.email}: ${cmd === "ativar" ? "ativado" : "desativado"}.`);
    break;
  }
  default:
    sair('Comandos: listar | criar "Nome" email senha [corretor|admin] | senha email nova | ativar email | desativar email', cmd ? 1 : 0);
}
