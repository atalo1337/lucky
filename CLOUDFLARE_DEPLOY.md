# Cloudflare 部署清单

这个项目已经按 Cloudflare Pages 的方式整理好了。

上传到 GitHub 并接入 Cloudflare Pages 后，只要完成下面这些配置，就可以直接使用。

## 1. 创建 Pages 项目

推荐使用 Git 集成。

Cloudflare 面板里这样填：

- 框架预设：`Vite` 或 `无`
- 构建命令：`npm run build`
- 构建输出目录：`dist`

注意：

- 不要把输出目录填成 `/`
- 不要使用控制台拖拽静态文件上传，因为这个项目依赖 `functions/`

## 2. 绑定 D1

进入：

- `Workers & Pages`
- 选择你的 Pages 项目
- `Settings -> Bindings`

添加一个 D1 绑定：

- 变量名称：`DB`
- D1 数据库：选择你实际创建的数据库

`DB` 这个名字不能改，代码里就是按 `env.DB` 读取的。

## 3. 配置 Variables 和 Secrets

进入：

- `Settings -> Variables and Secrets`

### Variables

- `ADMIN_USERNAME=admin`
- `TURNSTILE_SITE_KEY=你的 Turnstile Site Key`

### Secrets

- `ADMIN_PASSWORD=你的后台初始密码`
- `SESSION_SECRET=至少 32 位随机字符串`
- `TURNSTILE_SECRET_KEY=你的 Turnstile Secret Key`
- `SMTP_USERNAME=你的 SMTP 登录账号`
- `SMTP_PASSWORD=你的 SMTP 授权码或密码`
- `SMTP_FROM_EMAIL=发件邮箱，可选`
- `SMTP_FROM_NAME=发件人名称，可选`
- `SMTP_HOST=smtp.qq.com` 可选
- `SMTP_PORT=465` 可选

## 4. 初始化数据库

全新部署执行：

```bash
npx wrangler d1 execute spark-lottery-db --remote --file migrations/0001_init.sql
```

如果你之前已经部署过旧版本，还要补执行：

```bash
npx wrangler d1 execute spark-lottery-db --remote --file migrations/0002_soft_delete_prizes.sql
npx wrangler d1 execute spark-lottery-db --remote --file migrations/0003_lottery_automation_and_email.sql
```

如果你的数据库名字不是 `spark-lottery-db`，把命令里的名字换成你自己的。

## 5. 重新部署

配置完 D1、变量和机密后，重新部署一次 Pages。

## 6. 首次上线后的最小验收

1. 打开首页 `/`
2. 打开 `/admin`
3. 用 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录
4. 第一次登录后修改管理员密码
5. 新建至少一个奖项
6. 上传至少一条卡密
7. 开启抽奖系统
8. 前台填写邮箱并完成一次抽奖
9. 确认中奖邮件是否送达

## 7. 关于自动开启抽奖

当前项目运行在 Pages Functions 上。

现在这版的自动开启逻辑是：

- 后台设置一个自动开启时间
- 到时间后，首次访问首页、抽奖接口或后台时
- 系统自动清空上一轮记录并开启新一轮抽奖

这意味着它是“请求触发式自动开启”，不是后台常驻定时任务。

如果你后面需要“即使没有人访问，到点也必须自动开启”，建议再加一个独立 Worker 的 Cron Trigger。

## 8. 关于 SMTP

- 中奖卡密会通过 SMTP 邮件发送
- 普通用户前台不会直接看到卡密
- SMTP 凭据应始终放在 Cloudflare Secrets 中，不要提交到仓库
