ARG NODE_IMAGE=node@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
ARG CADDY_IMAGE=caddy@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
RUN mkdir -p /etc/ssl/certs \
    && node -e "require('node:fs').writeFileSync('/etc/ssl/certs/ca-certificates.crt', require('node:tls').rootCertificates.join('\n'))" \
    && sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN NODE_OPTIONS=--max-old-space-size=384 MAKEFLAGS=-j1 npm_config_jobs=1 \
    npm_config_build_from_source=true npm_config_nodedir=/usr/local \
    npm ci --omit=dev --no-audit --no-fund \
    && node -e "require('sqlite3'); require('sharp')"

FROM ${NODE_IMAGE} AS app
WORKDIR /app
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=384
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./package.json
COPY server ./server
COPY dist/index.html ./dist/index.html
RUN mkdir -p /data/server/uploads && chown -R node:node /data
WORKDIR /data
USER node
CMD ["node", "/app/server/index.js"]

FROM ${CADDY_IMAGE} AS web
RUN setcap -r /usr/bin/caddy
COPY dist /srv
COPY deploy/hongkong/Caddyfile deploy/hongkong/Caddyfile.staging deploy/hongkong/routes.caddy /etc/caddy/
