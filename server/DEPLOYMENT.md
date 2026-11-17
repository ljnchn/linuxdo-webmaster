# Node.js 后端部署

后端仅使用 Node.js 24+ 内置模块与 SQLite，无需安装运行依赖或执行构建。

## 启动

在仓库根目录，将 `server/.env.example` 复制为 `.env`。默认配置：

```dotenv
PLATFORM_ISSUER=https://linux.do
PUBLIC_ORIGIN=https://linux-do-webmaster.rmb.run
MINI_APP_ID=01a1c987-3436-75a8-8864-052fdcd1959a
HOST=127.0.0.1
PORT=8787
DATA_DIR=./data
```

```sh
node --env-file=.env server/index.mjs
```

进程需要 `server/`、`src/`、`drizzle/` 中的文件。使用进程管理器保持运行，HTTPS 反向代理转发至 `127.0.0.1:8787`，保留 `Authorization`、原始路径及 query。后端必须能访问 `https://linux.do/mini-app-api/jwks`；无可信公钥时启动失败，不启用匿名玩家。

`GET /health` 应返回 `ok: true` 与 `channel: "shared"`。业务接口没有有效平台签名时返回 401。健康检查成功不代表真实平台联调已通过。

沙箱和正式版 JWT 均经过官方 SDK 完整验证，再归入相同玩家身份。无需环境开关，不接受客户端自行提交身份、存档或分数。不得在线上设置 `DEV_MODE=enabled`；该模式仅供本机测试，并使用独立数据库。

## 数据持久化与升级

`DATA_DIR` 必须位于持久化目录，并定期备份。默认数据库为 `webmaster.sqlite`。服务启动时自动在事务中执行需要的迁移，无需手工重复执行 SQL。

- 升级前停服备份数据库；SQLite 使用 WAL，运行中的备份需包含未检查点的数据或使用 SQLite 备份工具。
- 若目录只有一个旧 `sandbox-v3.sqlite` 或 `production-v3.sqlite`，自动沿用该文件。存在多个旧库时，用 `DATABASE_PATH` 明确选择，不自动合并或丢弃。
- 同一库内若同一账号存在两份环境进度，迁移停止，原数据保留；维护者须先确认要保留的进度。
- v3 游戏存档按日租规则升级，不重置金币、天数、修订号、成就、历史成绩或操作响应。旧 v1/v2 服务端数据库需要单独迁移，不自动导入可信榜。

## 平台接入

运行 `bun run pack` 生成微应用 ZIP，在 Linux.do 批准清单中的权限和三个 `auth: platform` 端点。`PUBLIC_ORIGIN` 必须与清单中的 HTTPS origin 完全一致，不能带路径、query 或凭据。

客户端通过 `sdk.http.request` 调用命名端点。沙箱与正式版共用存档、跨局成就和排行榜，本机试玩存档不上传为可信成绩。

## 接口约定

| 接口 | 用途 |
| --- | --- |
| `GET /health` | 无敏感数据的健康检查 |
| `GET /api/state` | 获取当前进度、修订号、计时、开站状态、成就和前局备份 |
| `POST /api/actions` | 提交 `{revision, idempotencyKey, action}`，JSON 不超过 8 KiB |
| `GET /api/leaderboard?sort=members\|days` | 每位玩家最佳记录，最多 100 条，默认按规模排序 |

动作包括 `rename`、`restart`、`rent`、`renew`、`registration`、`strategy`、`resolve`、`claim`、`tick`、`heartbeat`、`speed`，具体字段与取值以 `server/protocol.mjs` 为准。

并发操作通过修订号与事务校验；同一个幂等键重试返回原响应，改变负载会被拒绝。超时后保留原请求重试，不重新生成幂等键。重开在同一事务中保存前局备份，成就和历史最佳成绩跨局保留。

服务器计时每时段 20 秒、每天 3 时段。运行时每 10 秒检查心跳，最近 10 秒已有成功操作请求则跳过；超过 20 秒的请求空档不累计进度。隐藏页面、打开管理弹窗时发送一次暂停状态，停止定时心跳；恢复时重新报告在线状态。客户端不能直接提交天数或余额。

心跳间隔和后端在线窗口需要一起部署：先更新后端，再上传新版小程序包。网络请求及进度恢复均失败，或收到明确的平台限流错误时，客户端暂停并显示重连弹窗；不会循环重试。手动重连先读取可信进度，不重放普通操作；尚未确认的重开仍使用原幂等键。平台检查若返回 Cloudflare 验证页，需等待限制解除或返回论坛完成验证，客户端不能代为解除。

## 验证

运行 `bun run check`、`bun run test`、`bun run pack`。自动测试使用临时密钥和本地数据库，不能替代真实平台验收。

自行部署后检查首次开站、两个环境的同账号恢复、不同账号排行榜、成就恢复、并发重试、断网提示与重开备份。部署方负责 HTTPS、数据备份、进程监控及必要的请求频控。
