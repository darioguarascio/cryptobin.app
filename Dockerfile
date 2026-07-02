FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
ARG APP_VERSION=dev
ARG APP_COMMIT=unknown
ENV APP_VERSION=${APP_VERSION}
ENV APP_COMMIT=${APP_COMMIT}
ENV PATH=/app/apps/web/node_modules/.bin:/app/node_modules/.bin:$PATH
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/drizzle ./apps/web/drizzle
COPY --from=build /app/apps/web/scripts/migrate.mjs ./apps/web/scripts/migrate.mjs

RUN chown -R nodejs:nodejs /app
USER nodejs
WORKDIR /app/apps/web

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4321/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node scripts/migrate.mjs && node dist/server/entry.mjs"]
