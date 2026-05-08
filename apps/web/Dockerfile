FROM node:24.15.0-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.33.1 --activate

WORKDIR /workspace

FROM base AS build

ARG API_BASE_PATH=/api
ARG API_PROXY_TARGET=http://localhost:3001
ARG NEXT_PUBLIC_API_BASE_PATH=/api
ENV API_BASE_PATH=$API_BASE_PATH
ENV API_PROXY_TARGET=$API_PROXY_TARGET
ENV NEXT_PUBLIC_API_BASE_PATH=$NEXT_PUBLIC_API_BASE_PATH

COPY . .

RUN pnpm install --frozen-lockfile
RUN API_BASE_PATH=$API_BASE_PATH NEXT_PUBLIC_API_BASE_PATH=$NEXT_PUBLIC_API_BASE_PATH API_PROXY_TARGET=$API_PROXY_TARGET pnpm --filter @balance/web build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build /workspace /workspace

EXPOSE 3000

CMD ["pnpm", "--filter", "@balance/web", "start"]
