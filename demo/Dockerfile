# ============================================
# Stage 1: Build gateway + web
# ============================================
FROM node:20-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy workspace root (for npm workspaces)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/gateway/package.json packages/gateway/

RUN npm ci

COPY packages/shared/ packages/shared/
COPY packages/gateway/ packages/gateway/

RUN npm run build:gateway

# ============================================
# Stage 2: Sandbox runtime
# ============================================
FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      tmux \
      vim-tiny \
      python3 \
      procps \
      less \
      tree \
      git \
      nano \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /usr/bin/apt* /usr/bin/dpkg* /usr/sbin/apt* /usr/sbin/dpkg*

# Demo user (no sudo)
RUN useradd -m -s /bin/bash demo

# Gateway runtime
WORKDIR /opt/zenterm
COPY --from=builder /build/packages/gateway/dist ./dist
COPY --from=builder /build/packages/gateway/public ./public
COPY --from=builder /build/packages/gateway/package.json ./
COPY --from=builder /build/node_modules ./node_modules

# Sample files + entrypoint
COPY demo/sample-files/ /home/demo/
COPY demo/entrypoint.sh /opt/zenterm/entrypoint.sh
RUN chown -R demo:demo /home/demo

# Environment (AUTH_TOKEN is overridden at runtime)
ENV AUTH_TOKEN=demo \
    PORT=18765 \
    HOST=0.0.0.0 \
    SESSION_PREFIX=zen_ \
    LOG_LEVEL=info \
    HOME=/home/demo

USER demo
WORKDIR /home/demo
EXPOSE 18765

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:18765/health').then(r=>{if(!r.ok)throw 1})" || exit 1

CMD ["/opt/zenterm/entrypoint.sh"]
