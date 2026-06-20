# 🏘️ 小区议事厅 · 线上表决系统

面向业委会的规范化线上表决平台。每个议题严格经历 **公示期 → 讨论期 → 表决期 → 归档** 四个阶段，系统自动校验前置条件与计票规则。

---

## ✨ 核心规则

| 规则 | 说明 |
|------|------|
| 实名投票 | 每位住户对每个议题只能投一次，选项：同意 / 反对 / 弃权 |
| 通过条件（同时满足） | ① 参与率 ≥ 登记住户的 **50%**；② 同意票占有效票（同意+反对）≥ **66.7%** |
| 弃权票处理 | 不计入有效票的分子或分母，但计入参与率的分母 |
| 观察状态 | 连续 **2 次**未参与表决，第 3 次起自动进入观察状态，仍可浏览但不能投票，需物业人工解除 |
| 归档不可改 | 表决结果归档后不可修改，每次阶段变更保留操作人、时间、备注 |

---

## 🛠 技术栈

- **后端**：Node.js + Express + TypeScript + Prisma ORM
- **数据库**：PostgreSQL 15
- **前端**：React 18 + TypeScript + Vite + 原生 CSS（零 UI 库依赖）
- **认证**：JWT (7d)
- **部署**：Docker + docker-compose（一条命令起全家桶）

---

## 🚀 快速启动（Docker）

### 前置要求
- Docker 20+ / Docker Compose v2

### 启动全部服务（PostgreSQL + 后端 + 前端）
```bash
cd project/zbx-090-1
docker compose up -d --build
```

首次启动约需 2~5 分钟（拉镜像 + 安装依赖 + 构建 + 数据库迁移 + 种子数据）。

查看日志：
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

停止服务：
```bash
docker compose down
# 如需清除数据
docker compose down -v
```

---

## 🌐 本地访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 Web | http://localhost:3000 | 住户端与管理端统一入口，按登录账号角色自动跳转 |
| 后端 API | http://localhost:3001/api | 健康检查：http://localhost:3001/api/health |
| PostgreSQL | localhost:5432 | DB: `yishiting`，User: `yishiting`，Pass: `yishiting123` |

---

## 👤 默认账号（种子数据自动初始化）

### 管理员账号
```
用户名：admin
密码：admin123
```

可通过环境变量修改：
```yaml
# docker-compose.yml -> backend.environment
ADMIN_DEFAULT_USERNAME: "admin"
ADMIN_DEFAULT_PASSWORD: "admin123"
```

### 示范住户账号（密码均为 `123456`）
| 用户名 | 姓名 | 房号 |
|--------|------|------|
| user001 | 张三 | 1-101 |
| user002 | 李四 | 1-102 |
| user003 | 王五 | 1-201 |
| user004 | 赵六 | 1-202 |
| user005 | 钱七 | 2-101 |

管理员也可在「住户管理」Tab 动态新增住户。

---

## 🖥 本地开发模式（无 Docker）

如需本地热开发调试，按以下步骤启动：

### 1. 先启动 PostgreSQL
```bash
# 方法一：Docker 单独起数据库
docker run -d \
  --name yishiting-pg \
  -e POSTGRES_DB=yishiting \
  -e POSTGRES_USER=yishiting \
  -e POSTGRES_PASSWORD=yishiting123 \
  -p 5432:5432 \
  postgres:15-alpine

# 方法二：本地已有 pg，创建对应库即可
```

### 2. 启动后端
```bash
cd backend
cp .env.example .env    # 如无 example 文件，直接写 .env：
# DATABASE_URL="postgresql://yishiting:yishiting123@localhost:5432/yishiting?schema=public"
# JWT_SECRET="dev-secret"
# ADMIN_DEFAULT_USERNAME="admin"
# ADMIN_DEFAULT_PASSWORD="admin123"

npm install
npx prisma migrate dev   # 创建表结构
npm run seed             # 写入默认账号
npm run dev              # http://localhost:3001
```

### 3. 启动前端
```bash
cd frontend
npm install
npm run dev              # http://localhost:3000
# 前端 dev 默认会把 /api/* 代理到 VITE_API_BASE_URL，
# 可用环境变量显式指定：VITE_API_BASE_URL=http://localhost:3001/api npm run dev
```

---

## 📐 功能模块

### 住户端（登录后角色为 RESIDENT）
1. **进行中议题**：浏览当前处于公示/讨论/表决期的议题
2. **历史归档**：查看所有已归档的议题及最终结果
3. **议题详情**：
   - 阶段流转时间轴 + 每次阶段变更的操作人/备注
   - 实时计票统计（参与率、各票种占比、是否满足通过阈值）
   - **表决期**显示投票按钮（三选一，提交后不可修改）
4. **我的参与记录**：已参与的表决、未参与的归档表决（连续未参与计数显示）

### 管理端（登录后角色为 ADMIN）
1. **议题管理**：
   - 创建议题（自动进入公示期，写入阶段日志）
   - 推进阶段：系统校验前置条件（如公示满 7 天）
   - 实时统计看板
   - 归档议题导出 CSV 摘要
2. **住户管理**：
   - 列表展示所有住户（状态、连续未参与次数）
   - 新增住户账号
   - **解除观察状态**（一键恢复 + 清零连续未参与计数）

---

## 🧪 验收步骤（必走场景）

以下步骤使用 Docker 启动的环境，使用默认账号即可完成。

---

### ✅ 场景 1：阶段非法跳转被拒绝

**目标：** 验证系统严格执行阶段流转规则，不允许跳过步骤或绕过前置条件。

1. 登录管理员账号：`admin / admin123`
2. 进入「议题管理」→ 点击 **＋ 创建议题**
   - 标题：`测试议题：是否更换小区大门门禁系统`
   - 描述：`方案详情……（略）`
3. 创建成功，议题状态为 **公示期**
4. 点击进入议题详情，点击右上 **推进阶段 → 讨论期** 按钮
5. 系统应 **弹出错误提示**：
   ```
   公示期不满 7 天（当前 0.0 天），不能进入讨论期
   ```
6. ✅ 验证通过：系统正确拦截了非法跳转。

> **提示**：若要在测试环境跳过 7 天限制，可直接在数据库将 `publicNoticeAt` 设为 7 天前：
> ```sql
> UPDATE "Topic" SET "publicNoticeAt" = NOW() - INTERVAL '8 days' WHERE title LIKE '%大门门禁%';
> ```
> 然后重新尝试推进即可成功。

---

### ✅ 场景 2：通过的计票场景（满足双阈值）

**目标**：5 户中至少 3 户参与（≥50%），且有效票中同意票 ≥66.7%，最终结果为 **通过**。

> 前置准备：先按场景 1 的说明，准备一个已经合法推进到 **表决期** 的议题（共 5 个住户）。

1. 依次用不同浏览器窗口 / 隐身窗口登录以下 3 个住户投 **同意**：
   - user001 / 123456 → 同意
   - user002 / 123456 → 同意
   - user003 / 123456 → 弃权（测试弃权不计入有效票）
2. 登录管理员，查看该议题详情页：
   - 参与率：**3 / 5 = 60%（≥50% ✅）**
   - 有效票：同意 2 + 反对 0 = 2，弃权 1 不计入
   - 同意率：2 / 2 = 100%（≥66.7% ✅）
3. 管理员点击 **推进阶段 → 归档**
4. 结果应为：**✅ 表决结果：通过**
5. ✅ 验证点：
   - 页面显示「通过」徽章
   - 阶段日志新增一条（原阶段：表决期 → 归档，操作人 admin）
   - 可点击 **📥 导出归档 CSV** 下载摘要文件，内容包含统计 + 日志 + 投票明细

---

### ✅ 场景 3：未通过的计票场景（双阈值未同时满足）

**目标**：验证任一阈值未达成，结果即为 **未通过**。

1. 管理员再创建一个新议题，并合法推进到 **表决期**（可用 SQL 修改时间快速通过公示期和讨论期）
2. 5 户中用以下方式投票：
   - user001 → 同意
   - user002 → 同意
   - user003 → 反对
   - user004 → 反对
   - （user005 不投票）
3. 管理员查看统计：
   - 参与率：**4 / 5 = 80%（≥50% ✅）**
   - 有效票：2 同意 + 2 反对 = 4
   - 同意率：**2 / 4 = 50%（<66.7% ❌）**
4. 管理员推进到归档，结果应为：**❌ 表决结果：未通过**
5. ✅ 验证通过：即使参与率达标，同意率不足仍然未通过。

> 另一个子场景可自行验证：只让 user001、user002 共 2 户参与（40% < 50%），即使全同意，参与率不足 → **未通过**。

---

### ✅ 场景 4：观察状态在第 3 次表决期自动生效 + 人工解除

**目标**：
1. 前两次归档表决 user005 都未参与 → `consecutiveMiss` 累计到 2（仍是正常状态）
2. 第 3 个议题**推进到表决期的瞬间**，服务端立刻把 user005 升级为观察状态
3. user005 **本次**表决期就无法投票（而非等到归档后才生效）
4. 管理员人工解除后状态回到正常

> 说明：
> - 观察状态只在「**进入新议题的表决期**」时自动升级，避免了投票后才发现不能投的糟糕体验
> - 归档时只更新 `consecutiveMiss` 计数器，不直接升级/降级状态
> - 观察状态必须人工解除，不会自动恢复（即使后续又参与了投票）

1. **准备 3 个独立议题**（用管理员账号创建，SQL 修改 `publicNoticeAt` / `discussionAt` 来合法跳过公示期/讨论期时长校验）：
   ```sql
   -- 创建议题 A / B / C 后，执行：
   UPDATE "Topic" SET "publicNoticeAt" = NOW() - INTERVAL '8 days' WHERE title IN ('议题A','议题B','议题C');
   UPDATE "Topic" SET "discussionAt" = NOW() - INTERVAL '1 days' WHERE title IN ('议题A','议题B','议题C');
   ```

2. **议题 A（第 1 次）**：user001~user004 投票，user005 **不投**
   - 管理员将 A 推进至归档
   - 此时 user005 的 `consecutiveMiss = 1`，状态仍为 **NORMAL**

3. **议题 B（第 2 次）**：再次让 user001~user004 投票，user005 **不投**
   - 管理员将 B 推进至归档
   - 此时 user005 的 `consecutiveMiss = 2`，状态仍为 **NORMAL**（第 3 次表决期才触发）

4. **议题 C（第 3 次表决期）**：
   - **管理员把 C 推进到表决期**：这一瞬间，系统扫描所有 NORMAL 且 `consecutiveMiss >= 2` 的住户 → **user005 被自动置为 OBSERVATION**
   - 切换回 **user005** 账号：
     - ✅ 从议题详情页返回首页（或重新进入任何首页视图）时，**自动刷新用户状态**（BUG⑤已修复），顶部出现 **⚠️ 观察状态** 橙色标识
     - ✅ 进入议题 C，看不到投票按钮，显示 *"您的账号处于观察状态，无法投票，请联系物业人工解除"*
     - ✅ 直接调 API：`POST /api/topics/{C的id}/vote` 返回 HTTP 400，错误信息一致（前端仅为提示，绕过前端也会被服务端拒绝）

5. ✅ 验证观察状态在第 3 次表决期已生效：user005 完全无法参与议题 C

6. **人工解除观察状态**：
   - 管理员账号 → 「住户管理」Tab → 找到 user005（状态显示 **观察状态**，连续未参与计数仍在）
   - 点击 **解除观察** 按钮并确认 → 服务端同时把 `status` 恢复到 NORMAL、清零 `consecutiveMiss`
   - 切回 user005 页面 → 观察状态标识消失，用户信息为正常状态（BUG⑤首页自动刷新）
   - 后续新议题 user005 又可正常参与投票

7. ✅ 人工解除验证通过。

---

## 🔌 API 概览（方便二次开发 / 联调）

| Method | Path | 权限 | 说明 |
|--------|------|------|------|
| POST | `/api/auth/login` | 公开 | 登录，返回 JWT + 用户信息 |
| GET  | `/api/auth/me` | 登录用户 | 获取当前登录者信息 |
| GET  | `/api/topics` | 登录用户 | 议题列表（含每个议题的投票计数） |
| GET  | `/api/topics/:id` | 登录用户 | 议题详情 + 阶段日志 + 实时统计 + 当前用户投票 |
| POST | `/api/topics` | ADMIN | 创建议题（自动进入公示期） |
| POST | `/api/topics/:id/advance` | ADMIN | 推进阶段（校验前置条件，归档时结算结果 + 更新观察状态） |
| POST | `/api/topics/:id/vote` | RESIDENT（非观察） | 投票（表决期内、未投过、非观察） |
| GET  | `/api/topics/:id/export/csv` | ADMIN | 导出归档摘要 CSV（UTF-8 BOM，Excel 直接打开） |
| GET  | `/api/users/my/records` | RESIDENT | 我的参与记录 + 未参与的归档议题 |
| GET  | `/api/users` | ADMIN | 住户列表 |
| POST | `/api/users` | ADMIN | 新增住户 |
| POST | `/api/users/:id/lift-observation` | ADMIN | 解除观察状态 + 清零连续未参与计数 |

所有受保护接口需要在 Header 中带：
```
Authorization: Bearer <jwt_token>
```

---

## 📁 目录结构

```
zbx-090-1/
├── docker-compose.yml          # 一键全家桶
├── README.md                   # 本文档
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma       # 数据库模型（User/Topic/Vote/StageLog）
│   │   └── seed.ts             # 种子数据（admin + 5 住户）
│   └── src/
│       ├── index.ts            # Express 入口
│       ├── prisma.ts
│       ├── utils/jwt.ts
│       ├── middleware/
│       │   ├── auth.ts         # 登录 / 管理员 / 住户 三层中间件
│       │   └── validate.ts     # Zod 参数校验
│       └── routes/
│           ├── auth.ts
│           ├── topics.ts       # 核心：阶段推进、计票逻辑、观察状态结算、CSV 导出
│           └── users.ts
└── frontend/
    ├── Dockerfile
    ├── nginx.conf              # 生产镜像的 /api 反代规则
    ├── vite.config.ts
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx             # 路由分发（登录/住户/管理/议题详情）
        ├── api.ts              # fetch 封装
        ├── types.ts            # 类型与枚举翻译
        ├── styles.css
        └── pages/
            ├── LoginPage.tsx
            ├── ResidentHome.tsx
            ├── AdminHome.tsx
            └── TopicDetailPage.tsx
```

---

## 🔐 生产环境建议

1. 修改 `docker-compose.yml` 中的以下环境变量：
   - `POSTGRES_PASSWORD`、`DATABASE_URL` 中的密码
   - `JWT_SECRET`（使用高强度随机字符串）
   - `ADMIN_DEFAULT_PASSWORD`
2. 为前端配置 HTTPS / 反向代理（Nginx / Caddy）
3. 定期备份 PostgreSQL 数据卷
4. 种子数据 `npm run seed` 为幂等：已有管理员/住户不会重复插入

---

*📌 本项目为小区业委会日常表决设计，界面简洁、流程严谨，核心业务规则均在服务端校验，前端校验仅作为提示，不依赖前端绕过可获取正确结果。*
