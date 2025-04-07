# syntax=docker/dockerfile:1
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY . /app

FROM base AS web
RUN --mount=type=cache,id=pnpm,target=/pnpm/store cd nostrudel && pnpm install
RUN cd nostrudel && pnpm build

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
RUN pnpm run build

FROM base
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod
COPY --from=build /app/dist /app/dist
COPY --from=web /app/nostrudel/dist /app/public

VOLUME [ "/app/data" ]
EXPOSE 3000

ENV PORT="3000"

CMD [ "node", "." ]
