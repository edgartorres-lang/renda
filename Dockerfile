# Renda Protegida · Setor Norte Seguros
FROM node:20-alpine

# tzdata: "hoje" no horário de Macapá · sqlite: backup com .backup · su-exec: rodar como usuário node
RUN apk add --no-cache tzdata sqlite su-exec
ENV TZ=America/Belem NODE_ENV=production PORT=3000

WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN apk add --no-cache --virtual .build python3 make g++ \
 && cd server && npm ci --omit=dev \
 && npm cache clean --force \
 && apk del .build

COPY server ./server
COPY public ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:3000/login.html || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
