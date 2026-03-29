# Cloudflare 抽奖站模板

一个基于 Cloudflare Pages、Pages Functions、D1 和 Turnstile 的抽奖网站模板。

这个模板适合直接二次开发，或者拿去作为完整项目骨架使用。

## 功能概览

- 前台匿名抽奖，每轮每人限一次
- 前台显示各奖项中奖人数
- 中奖卡密通过邮箱发送，不在前台直接暴露
- `/admin` 管理后台登录
- 开关抽奖系统
- 设置奖项概率
- 上传、查看、删除未使用卡密
- 设置抽奖人数上限
- 设置自动开启时间
- 开启新一轮抽奖时自动清空上一轮抽奖记录，并重置卡密状态
- 卡密全部抽完后自动关闭抽奖
- 后台查看抽奖记录、邮箱、邮件发送状态、各奖项中奖人数

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1
- 人机校验：Cloudflare Turnstile
- 邮件：SMTP（通过 Cloudflare Runtime Socket 发送）

## 目录说明

- [src/site/LotteryPage.tsx](./src/site/LotteryPage.tsx)：前台抽奖页
- [src/admin/AdminPage.tsx](./src/admin/AdminPage.tsx)：管理后台
- [functions/api](./functions/api)：Pages Functions 接口
- [functions/_lib](./functions/_lib)：抽奖、鉴权、邮件、数据库等核心逻辑
- [migrations](./migrations)：D1 数据库迁移文件
- [wrangler.jsonc](./wrangler.jsonc)：Cloudflare 配置模板

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板

```bash
copy .dev.vars.example .dev.vars
```

3. 按需修改以下配置

- [wrangler.jsonc](./wrangler.jsonc) 里的 `name`
- [wrangler.jsonc](./wrangler.jsonc) 里的 D1 `database_name`
- Cloudflare Pages 里的 Variables / Secrets

4. 初始化数据库

全新部署：

```bash
npx wrangler d1 execute lottery-db --local --file migrations/0001_init.sql
```

如果你是在旧版本基础上升级，还要继续执行：

```bash
npx wrangler d1 execute lottery-db --local --file migrations/0002_soft_delete_prizes.sql
npx wrangler d1 execute lottery-db --local --file migrations/0003_lottery_automation_and_email.sql
```

5. 本地预览

```bash
npm run preview:pages
```

## Cloudflare 需要配置的内容

### D1 Binding

- 名称：`DB`

### Variables

- `ADMIN_USERNAME=admin`
- `TURNSTILE_SITE_KEY=你的 Turnstile Site Key`

### Secrets

- `ADMIN_PASSWORD=你的后台初始密码`
- `SESSION_SECRET=至少 32 位随机字符串`
- `TURNSTILE_SECRET_KEY=你的 Turnstile Secret Key`
- `SMTP_HOST=你的 SMTP 主机`
- `SMTP_PORT=465`
- `SMTP_USERNAME=你的 SMTP 登录账号`
- `SMTP_PASSWORD=你的 SMTP 密码或授权码`
- `SMTP_FROM_EMAIL=发件邮箱`
- `SMTP_FROM_NAME=发件人名称`

更详细的部署步骤见 [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)。

## 自动开启机制说明

当前模板运行在 Cloudflare Pages Functions 上。

现在这版“自动开启抽奖”的行为是：

- 后台设置开启时间
- 到时间后，首次访问前台、后台或抽奖接口时
- 系统自动开启新一轮抽奖，并清空上一轮记录

这是一种“请求触发式自动开启”。

如果你需要“无人访问也必须准点开启”，建议额外加一个独立 Worker 的 Cron Trigger。

## 二次开发建议

- 改站点名称：前台标题、后台标题、README
- 改默认邮件标题和发件人名称
- 改抽奖文案和界面风格
- 改数据库名、项目名、管理员账号名
- 如果面向公开用户，建议把邮件发送失败告警接到日志或通知系统

## 验证命令

```bash
npm run check
npm run lint
npm run build
```
