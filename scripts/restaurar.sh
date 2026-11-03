#!/bin/sh
# Restaura um backup: ./scripts/restaurar.sh backups/app-AAAA-MM-DD_HHMMSS.db.gz
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
ARQ="${1:-}"
[ -f "$ARQ" ] || { echo "Uso: $0 backups/app-....db.gz"; ls -1t backups/*.db.gz 2>/dev/null | head -5; exit 1; }
printf "Isso substitui o banco atual por %s. Continuar? [s/N] " "$ARQ"; read R; [ "$R" = "s" ] || exit 1
docker compose stop app
mkdir -p data
[ -f data/app.db ] && cp data/app.db "data/app.db.antes-restauracao-$(date +%Y%m%d%H%M%S)"
rm -f data/app.db-wal data/app.db-shm
gunzip -c "$ARQ" > data/app.db
docker compose start app
echo "Restaurado. A cópia do banco anterior ficou em data/app.db.antes-restauracao-*"
