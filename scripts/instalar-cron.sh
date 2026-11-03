#!/bin/sh
# Agenda o backup diário às 02:30 no cron do usuário atual (rode no VPS, na pasta do projeto).
set -eu
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LINHA="30 2 * * * cd $DIR && sh ./scripts/backup.sh >> $DIR/backups/backup.log 2>&1"
chmod +x "$DIR/scripts/backup.sh"
mkdir -p "$DIR/backups"
( crontab -l 2>/dev/null | grep -v 'scripts/backup.sh' ; echo "$LINHA" ) | crontab -
echo "Cron instalado:"; crontab -l | grep 'scripts/backup.sh'
