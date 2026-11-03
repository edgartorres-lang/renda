# Renda Protegida · Setor Norte Seguros

Ferramenta de estudo, apresentação e mensagens de WhatsApp, com login, usuários e histórico de clientes num banco SQLite.

```
public/      ferramenta (index.html, app.js, parser.js, clientes.js, login.html, fontes, imagens)
server/      servidor Node.js 24 (Express + SQLite embutido do Node, sem compilação)
data/        banco app.db (volume Docker; NÃO apague)
backups/     cópias diárias do banco (30 dias)
scripts/     backup, restauração, cron e verificação do VPS
```

## 0. Instalação pelo EasyPanel (o jeito usado hoje)

O código fica no GitHub (`https://github.com/edgartorres-lang/renda.git`, branch `main`). O EasyPanel monta a imagem pelo `Dockerfile` e cuida do domínio e do HTTPS. O Caddy e o `docker-compose.yml` **não** são usados aqui.

1. No EasyPanel, abra um projeto (ou crie um, ex.: `setornorte`) → **+ Serviço → App**, nome `renda`.
2. **Fonte (Source)** → **Git**: URL `https://github.com/edgartorres-lang/renda.git`, branch `main`, caminho `/`.
3. **Build** → **Dockerfile** (arquivo `Dockerfile`).
4. **Ambiente (Environment)**: cole as linhas do `.env` (`ADMIN_EMAIL`, `ADMIN_SENHA`, `SESSION_SECRET`). `DOMINIO` e `APP_PORT` não são necessários.
5. **Montagens (Mounts)** → **Volume**: nome `renda-data`, caminho de montagem `/app/data`. É onde ficam o banco e os backups. **Sem isso, os dados somem a cada deploy.**
6. **Domínios**: `renda.setornorteseguros.com.br`, HTTPS ligado, porta do container `3000`.
7. Clique em **Implantar (Deploy)**. Depois, acesse `https://renda.setornorteseguros.com.br` e entre com o admin.

**Atualizar:** envie as mudanças para o GitHub (`git push`) e clique em **Implantar** no app.

**Backup no EasyPanel:** o próprio servidor faz um backup por dia às 02:30, em `/app/data/backups` (dentro do volume), e guarda 30 dias. O admin baixa uma cópia na hora pelo botão **Baixar backup agora**, na aba Clientes. Guarde essas cópias fora do servidor. Para restaurar, abra o **Console** do app no EasyPanel:
```bash
ls -1t /app/data/backups
gunzip -c /app/data/backups/ARQUIVO.db.gz > /app/data/restaurar.db
```
Depois clique em **Reiniciar** no app. Na partida, o servidor troca o banco pelo `restaurar.db` e guarda o anterior como `app.db.antes-DATA`.

Usuários pelo Console do app: `node server/cli.js listar` (os demais comandos estão na seção 3, sem o `docker compose exec app`).

## 1. Primeira instalação num VPS sem painel (Docker Compose)

Pré-requisitos: Docker com o plugin `docker compose`, e um registro DNS **A** do domínio apontando para o IP do VPS.

1. Copie a pasta inteira para o VPS (exemplo: `/opt/renda-protegida`):
   ```bash
   scp -r renda-protegida usuario@IP_DO_VPS:/opt/
   ```
2. No VPS, entre na pasta e confira o arquivo `.env`:
   ```bash
   cd /opt/renda-protegida && nano .env
   ```
   - `DOMINIO`: o endereço da ferramenta (ex.: `renda.setornorteseguros.com.br`).
   - `ADMIN_EMAIL` / `ADMIN_SENHA`: o admin criado no primeiro start. A senha é provisória: no primeiro login, o sistema obriga a troca.
   - `SESSION_SECRET`: já vem gerado. Para gerar outro: `openssl rand -hex 48`.
3. Veja o que já roda no VPS (proxy nas portas 80/443):
   ```bash
   sh scripts/verificar-vps.sh
   ```
4. Suba conforme o resultado:
   - **Nada nas portas 80/443** → use o Caddy do compose, que emite o HTTPS sozinho:
     ```bash
     docker compose --profile caddy up -d --build
     ```
   - **Já existe nginx, Traefik ou Caddy** → suba só o app e aponte o proxy para `127.0.0.1:3000` (veja a seção 2):
     ```bash
     docker compose up -d --build
     ```
5. Agende o backup diário (02:30):
   ```bash
   sh scripts/instalar-cron.sh
   ```
6. Acesse `https://SEU_DOMINIO`, entre com o admin e troque a senha.

Logs: `docker compose logs -f app`

## 2. Proxy já existente no VPS

O app escuta só em `127.0.0.1:3000` (não fica exposto na internet). Se a porta 3000 estiver ocupada, coloque `APP_PORT=3001` no `.env`.

**nginx** (`/etc/nginx/sites-available/renda-protegida`, depois `certbot --nginx -d SEU_DOMINIO`):
```nginx
server {
    server_name SEU_DOMINIO;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Caddy do host** (`/etc/caddy/Caddyfile`):
```
SEU_DOMINIO {
    reverse_proxy 127.0.0.1:3000
}
```

**Traefik em container**: acrescente ao serviço `app` do `docker-compose.yml` a rede do Traefik e os labels:
```yaml
    labels:
      - traefik.enable=true
      - traefik.http.routers.renda.rule=Host(`SEU_DOMINIO`)
      - traefik.http.routers.renda.entrypoints=websecure
      - traefik.http.routers.renda.tls.certresolver=letsencrypt   # nome do resolver do seu Traefik
      - traefik.http.services.renda.loadbalancer.server.port=3000
    networks: [traefik]     # nome da rede do Traefik
networks:
  traefik:
    external: true
```

O cookie de sessão é `secure`: a ferramenta **só funciona por HTTPS**. Por http, o login não se mantém.

## 3. Usuários

**Pela ferramenta (recomendado):** entre como admin. A aba **0 · Clientes** mostra o bloco **Usuários**. Preencha nome, e-mail e uma senha provisória, e escolha o papel. A pessoa troca a senha no primeiro login. No mesmo bloco você pode desativar alguém (as sessões abertas caem na hora) ou definir uma nova senha provisória.

- **Corretor** vê e edita só os próprios clientes.
- **Admin** vê os clientes de todos e gerencia os usuários.

**Pelo terminal do VPS** (útil se ninguém conseguir entrar):
```bash
docker compose exec app node server/cli.js listar
docker compose exec app node server/cli.js criar "Nome Completo" email@dominio.com senhaProvisoria corretor
docker compose exec app node server/cli.js senha email@dominio.com novaSenhaProvisoria
docker compose exec app node server/cli.js desativar email@dominio.com
```

## 4. Como usar

- **0 · Clientes** abre primeiro: as retomadas de hoje, a busca por nome, o filtro de status e a lista com a última versão e os valores.
- Clique no nome (ou em **Abrir**) para carregar o estudo e ir para a aba Dados. **Versões** mostra as versões anteriores e o histórico (status, mensagens copiadas, PDFs gerados).
- **Salvar** (no cabeçalho) grava uma **nova versão** do estudo do cliente atual. Na primeira vez, cria o cliente.
- **Novo cliente** limpa o formulário. O navegador guarda só um rascunho local, que é apagado ao clicar em **Sair**.
- Status: ao marcar **Vou avaliar**, a retomada fica para hoje + 2 dias. Ao marcar **Retomada**, para hoje + 5 dias. **Fechado** e **Perdido** saem das retomadas.
- **Abrir mensagem** (nas retomadas) carrega o cliente e abre o WhatsApp no item certo: "Vou avaliar" para quem está em *Vou avaliar*, "Retomada" para quem está em *Retomada*.
- **Excluir** apaga o cliente com todas as versões e o histórico (pedido de exclusão da LGPD). Não tem volta, exceto pelo backup.

## 5. Backup e restauração

O backup diário fica em `backups/app-AAAA-MM-DD_HHMMSS.db.gz`, com 30 dias guardados. O log fica em `backups/backup.log`.

Backup manual: `sh scripts/backup.sh`

Restaurar (o script para o app, guarda uma cópia do banco atual e sobe de novo):
```bash
ls -1t backups/
sh scripts/restaurar.sh backups/app-2026-11-03_023000.db.gz
```

Restauração manual, se preferir:
```bash
docker compose stop app
rm -f data/app.db-wal data/app.db-shm
gunzip -c backups/ARQUIVO.db.gz > data/app.db
docker compose start app
```

Dica: copie a pasta `backups/` para fora do VPS de vez em quando (Google Drive, outro servidor).

## 6. Atualizar a ferramenta

1. Substitua os arquivos de `public/` (ou de `server/`) no VPS. **Não** substitua `data/`, `backups/` nem `.env`.
2. Reconstrua e suba:
   ```bash
   sh scripts/backup.sh
   docker compose up -d --build          # ou: docker compose --profile caddy up -d --build
   ```
3. Os usuários só precisam recarregar a página.

## 7. Segurança

- As senhas são guardadas com bcrypt (custo 12). O login aceita no máximo 5 tentativas erradas a cada 15 minutos por IP.
- A sessão é guardada no SQLite, com cookie `httpOnly`, `secure` e `sameSite=strict`, e expira em 12 horas.
- Todas as páginas e arquivos exigem login, exceto a tela de login, o logo e as fontes. A API responde `401` quando não há login, e as páginas redirecionam para `/login.html`.
- Cabeçalhos de segurança via helmet (CSP sem scripts externos). As fontes Montserrat e Nunito são servidas pelo próprio servidor.
- O fuso é `America/Belem` (horário de Macapá), para que "hoje" bata com o seu dia.

## 8. Testes

Teste da API (27 verificações: login, bloqueio, isolamento entre corretores, versões, status, retomadas, exclusão e acesso sem login). Rode com o servidor num banco **de teste** vazio:
```bash
cd server && npm install
SESSION_SECRET=$(openssl rand -hex 48) ADMIN_EMAIL=admin@teste.local ADMIN_SENHA=senha-admin-teste-1 \
  COOKIE_SECURE=false DB_PATH=/tmp/teste.db PORT=3001 node index.js &
BASE=http://localhost:3001 DB_PATH=/tmp/teste.db node test/api.test.js
```
