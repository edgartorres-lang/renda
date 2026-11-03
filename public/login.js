/* Login e troca obrigatória de senha */
(function () {
  const $ = (s) => document.querySelector(s);
  const msg = (t, ok) => { const m = $("#msg"); m.textContent = t || ""; m.classList.toggle("ok", !!ok); };
  async function post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.erro || "Erro " + r.status);
    return j;
  }
  const modoSenha = () => { $("#fLogin").hidden = true; $("#fSenha").hidden = false; $("#fSenha [name=atual]").focus(); };
  const entrar = () => location.replace("/");

  // já logado? vai direto (ou para a troca de senha)
  fetch("/api/me", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j) return;
    if (j.user.trocarSenha) modoSenha(); else entrar();
  }).catch(() => {});

  $("#fLogin").addEventListener("submit", async (e) => {
    e.preventDefault(); const b = e.target.querySelector("button"); b.disabled = true; msg("");
    const f = new FormData(e.target);
    try {
      const { user } = await post("/api/login", { email: f.get("email"), senha: f.get("senha") });
      if (user.trocarSenha) { $("#fSenha [name=atual]").value = f.get("senha"); modoSenha(); $("#fSenha [name=nova]").focus(); msg(""); }
      else entrar();
    } catch (er) { msg(er.message); }
    b.disabled = false;
  });

  $("#fSenha").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    if (f.get("nova") !== f.get("nova2")) return msg("As duas senhas novas não são iguais.");
    const b = e.target.querySelector("button"); b.disabled = true;
    try { await post("/api/senha", { atual: f.get("atual"), nova: f.get("nova") }); msg("Senha alterada. Entrando…", true); setTimeout(entrar, 600); }
    catch (er) { msg(er.message); b.disabled = false; }
  });
})();
