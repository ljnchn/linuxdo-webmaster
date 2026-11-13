# 我要当站长

Linux.do 主题的像素社区经营微应用，当前版本 **0.9.2**。从零佬友开始经营社区，处理人物事件、开展建筑活动、续租与升级服务器，并解锁跨局成就。

全站排行榜按社区规模或运营天数展示每位玩家的最佳成绩。后端使用 **Node.js 24 + SQLite**，通过 Linux.do 官方签名验证身份。沙箱与正式版使用同一运行包、同一后端及同一份玩家进度。

## 本地开发

需要 Node.js 24+，微应用打包需要 Bun。项目无须安装运行依赖。

```sh
bun run dev -- --port 4173
bun run check
bun run test
```

访问 `http://127.0.0.1:4173`。本机网页预览使用浏览器存档，不上传为全站成绩。测试脚本在 `tests/` 目录执行，覆盖游戏规则、存档迁移、平台身份、接口、并发、排行榜和成就。

## 打包与部署

```sh
bun run pack
```

上传生成的 `dist/mapp-package/app.zip`。应用 ID 为 `01a1c987-3436-75a8-8864-052fdcd1959a`，后端默认地址为 `https://linux-do-webmaster.rmb.run`。

- [微应用打包与平台验收](mapp/README.md)
- [Node.js 后端部署与接口说明](server/DEPLOYMENT.md)

后端直接运行源码，无需构建。真实平台联网行为需在部署后验收。

## 配置位置

| 内容 | 文件 |
| --- | --- |
| 人物冒泡台词、间隔 | `src/ambient-chat.mjs` 中的 `CHAT_LINES`、`CHAT_TIMING` |
| 事件、结果文案、经济规则、建筑活动 | `src/engine.mjs` |
| 成就条件 | `src/achievements.mjs` |
| 场景人物与建筑位置 | `src/world.mjs` |
| 界面与交互 | `src/app.mjs`、`app.css` |
| 平台权限、后端端点 | `mapp/manifest.template.json`、`mapp/config.mjs` |
| 后端环境变量示例 | `server/.env.example` |
| 数据库迁移 | `drizzle/*.sql`，由 Node 服务启动时自动执行 |

旧存档迁移与原操作重试记录继续保留，防止升级丢失进度或重复扣费。测试中的旧版本数据用于验证兼容性。

本作是 Linux.do 主题的非官方同人作品。[素材来源](public/assets/ASSETS.md)。
