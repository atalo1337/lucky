# Cloudflare Pages 部署清单

这套项目已经按 Cloudflare Pages 的方式写好。  
你把仓库上传到 Cloudflare 后，只要按下面配置完成，就可以直接使用。

## 一、正确的部署方式

这个项目用了 `functions/` 目录，因此：

- 可以用 `Git 集成` 部署
- 可以用 `Wrangler` 部署
- 不要用 Cloudflare 控制台里的拖拽上传静态文件

原因：Cloudflare 官方文档说明，带 `functions/` 的 Pages 项目，控制台拖拽上传不会编译 Pages Functions。

## 二、创建 Pages 项目

推荐方式：Git 集成

1. 把当前项目推到 GitHub / GitLab
2. Cloudflare Dashboard -> `Workers & Pages`
3. 选择 `Create application`
4. 选择 `Pages`
5. 选择 `Import an existing Git repository`
6. 选择你的仓库

构建配置填写：

- Build command：`npm run build`
- Build output directory：`dist`

## 三、创建并绑定 D1

先创建一个 D1 数据库，然后把它绑定到 Pages 项目。

Cloudflare Dashboard 操作：

1. 进入 `Workers & Pages`
2. 打开你的 Pages 项目
3. 进入 `Settings -> Bindings`
4. 点击 `Add`
5. 选择 `D1 database bindings`
6. Variable name 必须填写：`DB`
7. 选择你创建好的 D1 数据库
8. 保存后重新部署一次

注意：

- 代码里固定读取的绑定名就是 `DB`
- 如果你在面板里填成别的名字，网站会无法访问数据库

## 四、添加 Variables 和 Secrets

进入：

- `Workers & Pages -> 你的项目 -> Settings -> Variables and Secrets`

然后添加以下配置。

### 普通变量

- `ADMIN_USERNAME`
  - 推荐值：`admin`

### 机密

- `ADMIN_PASSWORD`
  - 默认管理员初始密码
  - 首次登录 `/admin` 后系统会要求立即改密

- `SESSION_SECRET`
  - 用于管理员会话签名和参与者 Cookie 签名
  - 必须是一段足够长的随机字符串
  - 建议至少 32 位

- `TURNSTILE_SITE_KEY`
  - Cloudflare Turnstile 的 Site Key

- `TURNSTILE_SECRET_KEY`
  - Cloudflare Turnstile 的 Secret Key

## 五、Turnstile 配置

你需要在 Cloudflare Turnstile 后台创建一个站点，并把 Pages 域名加入允许域名。

至少要包含：

- 你的 `*.pages.dev` 域名
- 如果后续绑定了自定义域名，也要把自定义域名加进去

然后把拿到的：

- `Site Key` 填到 `TURNSTILE_SITE_KEY`
- `Secret Key` 填到 `TURNSTILE_SECRET_KEY`

## 六、数据库初始化

线上第一次使用前，需要执行一次数据库初始化 SQL：

```bash
npx wrangler d1 execute spark-lottery-db --remote --file migrations/0001_init.sql
```

如果你的数据库名字不是 `spark-lottery-db`，把命令里的名字换成你实际创建的 D1 名称。

## 七、第一次上线后会发生什么

只要你已经：

- 正确绑定了 `DB`
- 配好了上面的变量和机密
- 执行了初始化 SQL
- 重新部署了一次

那么系统就会这样工作：

1. 普通用户访问首页 `/`
2. 管理员访问 `/admin`
3. 第一次登录 `/admin` 时，如果数据库里还没有管理员账号，系统会自动用 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 创建默认管理员
4. 登录成功后，系统强制要求修改默认密码
5. 修改完成后即可进入后台管理奖项、卡密、概率和开关

## 八、上线后最少需要检查的 6 项

1. 首页能正常打开
2. `/admin` 能正常打开
3. 默认管理员能登录
4. 首次登录后会强制改密
5. 后台能新增奖项
6. 后台上传卡密后，前台能正常抽奖

## 九、你真正需要在 Cloudflare 填的内容

为了方便你直接照着做，这里只保留最终必填项：

- D1 Binding Name：`DB`
- Variable：`ADMIN_USERNAME=admin`
- Secret：`ADMIN_PASSWORD=你自己的后台初始密码`
- Secret：`SESSION_SECRET=至少32位随机字符串`
- Secret：`TURNSTILE_SITE_KEY=你的SiteKey`
- Secret：`TURNSTILE_SECRET_KEY=你的SecretKey`

完成这些后，再重新部署一次，就可以直接用。

## 官方依据

- Cloudflare Pages Functions Get started: https://developers.cloudflare.com/pages/functions/get-started/
- Cloudflare Pages Functions Bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Pages Direct Upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages Vite guide: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
