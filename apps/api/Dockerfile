FROM node:24.15.0-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.33.1 --activate

WORKDIR /workspace

FROM base AS build

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@balance/api

FROM base AS runner

ENV NODE_ENV=production

COPY --from=build /workspace /workspace

EXPOSE 3001

CMD ["pnpm", "--filter", "@balance/api", "start"]
