# Cloudflare 部署说明

这份模板仓库已经整理成“上传后只改占位即可部署”的状态。

## 1. 创建 Pages 项目

推荐使用 Git 集成部署。

构建参数这样填：

- 框架预设：`Vite` 或 `无`
- 构建命令：`npm run build`
- 构建输出目录：`dist`

注意：

- 不要用拖拽静态文件上传
- 这个项目依赖 `functions/`，必须让 Cloudflare 构建 Pages Functions

## 2. 创建并绑定 D1

先创建一个 D1 数据库。

建议数据库名：

- `lottery-db`

然后在 Pages 项目里绑定：

- `Settings -> Bindings`
- 添加一个 D1 Binding
- 变量名必须填：`DB`

代码里读取的是 `env.DB`，所以这个名字不能改。

## 3. 修改 wrangler.jsonc

在 [wrangler.jsonc](./wrangler.jsonc) 里至少改这几项：

- `name`
- `d1_databases[0].database_name`
- `d1_databases[0].database_id`
- `d1_databases[0].preview_database_id`

模板里现在放的是占位值，公开分享时不会带真实库 ID。

## 4. 配置 Variables 和 Secrets

进入：

- `Workers & Pages -> 你的项目 -> Settings -> Variables and Secrets`

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

## 5. 初始化数据库

全新部署：

```bash
npx wrangler d1 execute lottery-db --remote --file migrations/0001_init.sql
```

如果你是从旧版本升级到当前版本，还要补执行：

```bash
npx wrangler d1 execute lottery-db --remote --file migrations/0002_soft_delete_prizes.sql
npx wrangler d1 execute lottery-db --remote --file migrations/0003_lottery_automation_and_email.sql
```

如果你的数据库名字不是 `lottery-db`，把命令里的名字换成你自己的。

## 6. 重新部署

绑定、变量、Secrets 和迁移都处理完后，重新部署一次 Pages。

## 7. 上线后最小验收

1. 打开首页 `/`
2. 打开 `/admin`
3. 用管理员账号登录
4. 首次登录后修改管理员密码
5. 创建一个奖项
6. 上传一条测试卡密
7. 开启抽奖
8. 前台填写邮箱并测试一次抽奖
9. 确认后台记录和邮件发送状态是否正常

## 8. 自动开启的真实行为

当前模板的自动开启是“请求触发式”的：

- 到达设定时间
- 首次访问前台、后台或抽奖接口
- 系统自动开启新一轮抽奖

如果你需要严格的后台定时任务，请单独加 Cloudflare Worker Cron Trigger。

## 9. 公开分享前建议再检查一遍

- [wrangler.jsonc](./wrangler.jsonc) 是否仍有真实 D1 UUID
- `.dev.vars` 是否没有被提交
- 邮件配置是否都在 Secrets 中
- README 是否已经改成你自己的项目名称
