#!/bin/sh
# Mostra o que já roda no VPS antes de configurar o HTTPS (rode no VPS).
echo "== Containers =="; docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || echo "docker não encontrado"
echo; echo "== Quem escuta nas portas 80 e 443 =="
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':(80|443)\s' || echo "nada nas portas 80/443"
echo; echo "== Serviços de proxy no host =="
for s in nginx caddy traefik apache2 httpd; do
  st=$(systemctl is-active "$s" 2>/dev/null || true); [ "$st" = "active" ] && echo "$s: ATIVO"
done
echo; echo "== Proxies em container =="
docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | grep -Ei 'nginx|traefik|caddy|proxy' || echo "nenhum"
echo; echo "Porta 3000 em uso?"; (ss -ltn 2>/dev/null | grep -q ':3000 ' && echo "SIM: defina APP_PORT=3001 no .env") || echo "livre"
echo
echo "Se nada usa 80/443:  docker compose --profile caddy up -d --build"
echo "Se já há nginx/traefik/caddy: docker compose up -d --build  e siga o README (seção Proxy existente)"
