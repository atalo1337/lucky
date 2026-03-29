# 星火抽奖站

一个为 Cloudflare Pages 设计的全栈抽奖网站。

## 已实现功能

- 普通用户在首页匿名参与一次抽奖，并即时查看中奖信息
- 管理员通过 `/admin` 登录后台
- 管理员可开启或关闭抽奖系统
- 管理员可新增和编辑奖项、设置中奖概率和中奖文案
- 管理员可上传 `txt/csv` 格式的中奖卡密
- 管理员可查看真实参与人数、中奖人数和最新抽奖记录
- 默认管理员账号通过环境变量初始化，首次登录后强制改密

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1
- 人机校验：Cloudflare Turnstile

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 复制变量模板并填写

```bash
copy .dev.vars.example .dev.vars
```

3. 创建 D1 数据库，并把 [wrangler.jsonc](./wrangler.jsonc) 里的 `database_id` 和 `preview_database_id` 改成真实值

4. 初始化本地数据库

```bash
npx wrangler d1 execute spark-lottery-db --local --file migrations/0001_init.sql
```

5. 本地运行 Pages 模式

```bash
npm run preview:pages
```

## Cloudflare Pages 部署

请直接看 [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)。

这份项目已经整理成上线时只需要：

- 绑定一个名字为 `DB` 的 D1 数据库
- 配置几个 Variables / Secrets
- 重新部署一次

即可直接使用。

## 重要说明

- 这个项目使用了 `functions/` 目录，所以不能用 Cloudflare 控制台里的拖拽上传静态文件方式部署
- 需要使用 Git 集成部署，或者使用 `wrangler pages deploy` / `wrangler deploy`
- 绑定和变量修改后，需要重新部署，Pages Functions 才会拿到最新配置
