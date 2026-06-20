# 构建阶段：安装依赖（含 devDeps）、生成 Prisma Client、编译 TypeScript
FROM node:18-slim AS builder

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

# 确保 HTTPS/CA 证书、curl 可用（部分环境 node fetch 需要）
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends ca-certificates curl openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# 运行阶段：只保留运行时依赖 + 编译产物
FROM node:18-slim AS runner

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production

# 运行时基础库：Prisma Engine + bcrypt + HTTPS 请求均需要
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends ca-certificates curl openssl libssl-dev \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# 只安装生产依赖（prisma/ts-node/typescript 已在 dependencies 中，供 migrate/seed 使用）
RUN npm ci --omit=dev

# prisma 目录必须完整：schema.prisma、migrations、seed.ts
COPY --from=builder /app/prisma ./prisma
# tsconfig.json 供 ts-node 运行 seed 时读取
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# TypeScript 编译产物
COPY --from=builder /app/dist ./dist
# Prisma Client 生成目录（.prisma 下的 query engine）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3001

# 默认启动命令（docker-compose 中会覆盖为 migrate + seed + start）
CMD ["node", "dist/index.js"]
