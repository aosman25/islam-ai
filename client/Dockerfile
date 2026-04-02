FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .

# NEXT_PUBLIC_* vars must be available at build time
# Pass them as build args: docker build --build-arg NEXT_PUBLIC_API_BASE_URL=...
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_MASTER_BASE_URL
ARG NEON_AUTH_BASE_URL
ARG NEON_AUTH_COOKIE_SECRET
ARG GATEWAY_INTERNAL_URL
ARG MASTER_INTERNAL_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MASTER_BASE_URL=$NEXT_PUBLIC_MASTER_BASE_URL
ENV NEON_AUTH_BASE_URL=$NEON_AUTH_BASE_URL
ENV NEON_AUTH_COOKIE_SECRET=$NEON_AUTH_COOKIE_SECRET
ENV GATEWAY_INTERNAL_URL=$GATEWAY_INTERNAL_URL
ENV MASTER_INTERNAL_URL=$MASTER_INTERNAL_URL

RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next/cache

USER nextjs

ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
