FROM node:22-alpine

RUN apk add --no-cache openssl libc6-compat \
  && corepack enable

WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/
COPY infra/cdk/package.json infra/cdk/

# postinstall (prisma generate) needs the schema; skip scripts until sources are in.
RUN pnpm install --frozen-lockfile --prod=false --filter @checkout/api... --ignore-scripts

COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN pnpm exec prisma generate && pnpm exec nest build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "docker-entrypoint.cjs"]
