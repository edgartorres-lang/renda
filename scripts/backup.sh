#!/bin/sh
# Backup diário do banco (SQLite .backup), compactado em ./backups, mantendo 30 dias.
# Uso: ./scripts/backup.sh        (agende com ./scripts/instalar-cron.sh)
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
mkdir -p backups
STAMP=$(date +%Y-%m-%d_%H%M%S)
NOME=".backup-$STAMP.db"

if docker compose ps --status running --services 2>/dev/null | grep -qx app; then
  # usa o sqlite3 de dentro do container (não precisa instalar nada no host)
  docker compose exec -T app sqlite3 /app/data/app.db ".backup '/app/data/$NOME'"
elif command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 data/app.db ".backup 'data/$NOME'"
else
  echo "ERRO: container parado e sqlite3 não instalado no host (apt install sqlite3)." >&2
  exit 1
fi

gzip -c "data/$NOME" > "backups/app-$STAMP.db.gz"
rm -f "data/$NOME"
find backups -name 'app-*.db.gz' -type f -mtime +30 -delete
echo "$(date '+%F %T') backup ok: backups/app-$STAMP.db.gz ($(du -h "backups/app-$STAMP.db.gz" | cut -f1))"
