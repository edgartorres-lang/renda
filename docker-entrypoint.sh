#!/bin/sh
# Garante que a pasta do banco (volume ./data) pertence ao usuário node e roda o app sem root.
set -e
mkdir -p /app/data
chown -R node:node /app/data
exec su-exec node "$@"
