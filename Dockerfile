# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN npm run build

FROM deps AS worker
WORKDIR /app
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads
COPY --from=builder /app/package.json /app/tsconfig.json /app/drizzle.config.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/drizzle ./drizzle
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
CMD ["node", "--import", "./scripts/load-env.mjs", "--import", "tsx", "scripts/scheduler.ts"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "server.js"]
