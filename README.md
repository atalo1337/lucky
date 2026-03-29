# 星火抽奖站

一个为 Cloudflare Pages 设计的全栈抽奖网站。

## 已实现功能

- 普通用户在前台匿名参与抽奖，每轮每人限一次
- 前台展示各奖项当前中奖人数
- 中奖后不在页面直接展示卡密，而是发送到用户填写的邮箱
- 管理员通过 `/admin` 登录后台
- 管理员可开启或关闭抽奖系统
- 管理员可设置抽奖人数上限
- 管理员可设置自动开启时间
- 管理员可新增、编辑、删除奖项
- 管理员可上传、查看、删除未使用卡密
- 开启新一轮抽奖前，系统会清空上一轮抽奖记录，并把未删除奖项的已用卡密重置回未使用
- 当人数达到上限或所有可抽卡密耗尽时，系统会自动关闭抽奖
- 后台可查看抽奖记录、中奖邮箱、邮件发送状态和各奖项中奖人数
- 默认管理员账号通过环境变量初始化，首次登录强制改密

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1
- 人机校验：Cloudflare Turnstile
- 邮件发送：Cloudflare Runtime TCP Socket + SMTP

## 重要说明

- 这个项目使用了 `functions/`，不能用 Cloudflare 控制台的静态文件拖拽上传方式部署，必须使用 Git 集成或 Wrangler 部署。
- 当前“自动开启抽奖”是 Pages 版本的实现：到达设定时间后，首次访问前台或后台时会自动开启新一轮抽奖。它不是后台常驻定时器。
- 如果你需要“精确到点、无人访问也自动开启”，建议后续再加一个独立 Worker 的 Cron Trigger。
- SMTP 密钥不要写死到代码里，应该配置在 Cloudflare Secrets。

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 复制变量模板

```bash
copy .dev.vars.example .dev.vars
```

3. 创建 D1 数据库，并把 [wrangler.jsonc](./wrangler.jsonc) 里的 `database_id` 和 `preview_database_id` 改成真实值

4. 初始化数据库

```bash
npx wrangler d1 execute spark-lottery-db --local --file migrations/0001_init.sql
```

如果你是从旧版本升级，还要继续执行：

```bash
npx wrangler d1 execute spark-lottery-db --local --file migrations/0002_soft_delete_prizes.sql
npx wrangler d1 execute spark-lottery-db --local --file migrations/0003_lottery_automation_and_email.sql
```

5. 本地运行 Pages 模式

```bash
npm run preview:pages
```

## Cloudflare 部署

请直接查看 [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)。

## 当前需要的环境变量和机密

### Variables

- `ADMIN_USERNAME=admin`
- `TURNSTILE_SITE_KEY=你的 Turnstile Site Key`

### Secrets

- `ADMIN_PASSWORD=你的后台初始密码`
- `SESSION_SECRET=至少 32 位随机字符串`
- `TURNSTILE_SECRET_KEY=你的 Turnstile Secret Key`
- `SMTP_USERNAME=你的 SMTP 登录账号`
- `SMTP_PASSWORD=你的 SMTP 授权码或密码`
- `SMTP_FROM_EMAIL=发件邮箱，可选，默认等于 SMTP_USERNAME`
- `SMTP_FROM_NAME=发件人名称，可选`
- `SMTP_HOST=smtp.qq.com` 可选
- `SMTP_PORT=465` 可选

## 数据库迁移

全新部署：

```bash
npx wrangler d1 execute spark-lottery-db --remote --file migrations/0001_init.sql
```

旧版本升级到当前版本：

```bash
npx wrangler d1 execute spark-lottery-db --remote --file migrations/0002_soft_delete_prizes.sql
npx wrangler d1 execute spark-lottery-db --remote --file migrations/0003_lottery_automation_and_email.sql
```

## 我实际跑过的检查

```bash
npm run check
npm run lint
npm run build
```
