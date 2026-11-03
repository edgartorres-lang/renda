# Renda Protegida · Setor Norte Seguros
# Node 24: o SQLite já vem embutido (node:sqlite), então não há nada para compilar no build.
FROM node:24-alpine

# tzdata: "hoje" no horário de Macapá · sqlite: backup com .backup pelo terminal · su-exec: rodar como usuário node
RUN apk add --no-cache tzdata sqlite su-exec
ENV TZ=America/Belem NODE_ENV=production PORT=3000 NODE_OPTIONS=--disable-warning=ExperimentalWarning

WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server ./server
COPY public ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:3000/login.html || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
