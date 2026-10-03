# Use the bundled Dockerfile frontend; do not require another registry download.
ARG NODE_IMAGE=node:24-bookworm-slim
ARG CADDY_IMAGE=caddy:2-alpine
FROM ${NODE_IMAGE} AS dependencies
ARG DEBIAN_MIRROR=deb.debian.org
WORKDIR /app
# Bootstrap HTTPS with Node's bundled public roots; never disable TLS verification.
# SQLite may need to compile a native module when a prebuilt binary is unavailable.
RUN mkdir -p /etc/ssl/certs \
    && node -e "require('node:fs').writeFileSync('/etc/ssl/certs/ca-certificates.crt', require('node:tls').rootCertificates.join('\n'))" \
    && sed -i "s|http://deb.debian.org|https://${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::Retries=2 -o Acquire::https::Timeout=30 update \
    && apt-get -o Acquire::Retries=2 -o Acquire::https::Timeout=30 install -y --no-install-recommends ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS frontend-build
COPY index.html vite.config.ts tsconfig.json ./
COPY config ./config
COPY src ./src
COPY public ./public
COPY noob.glb ./noob.glb
COPY professional.glb ./professional.glb
COPY funny.glb ./funny.glb
COPY flower.glb ./flower.glb
ENV VITE_API_BASE_URL="" \
    VITE_MULTIPLAYER_URL=https://localhost:8443 \
    VITE_GOOGLE_CLIENT_ID=""
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev
# Rebuild SQLite against the runtime libc and bundled Node headers, then verify it loads.
RUN cd node_modules/sqlite3 \
    && ../.bin/node-gyp rebuild --nodedir=/usr/local \
    && node -e "require('./')"

FROM ${NODE_IMAGE} AS app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json ./package.json
COPY server ./server
# Keep the source read-only and all SQLite/upload paths on their own volume.
RUN mkdir -p /data/server/uploads && chown -R node:node /data
WORKDIR /data
USER node
CMD ["node", "/app/server/index.js"]

FROM ${CADDY_IMAGE} AS web
# Port 8443 needs no low-port capability; avoid file-capability exec failure with cap_drop: ALL.
RUN setcap -r /usr/bin/caddy
COPY --from=frontend-build /app/dist /srv
COPY deploy/private/Caddyfile /etc/caddy/Caddyfile
