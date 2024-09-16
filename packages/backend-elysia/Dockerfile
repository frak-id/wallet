FROM oven/bun

WORKDIR /app

COPY package.json .
# We don't have bun.lock file here since we are inside a monorepo
# Waiting for bun to support monorepo symnlinks and stuff: https://github.com/oven-sh/bun/issues/4830
#COPY bun.lockb .

RUN bun install --production

COPY src src
COPY tsconfig.json .

ENV NODE_ENV=production
CMD ["bun", "src/index.ts"]

EXPOSE 3030