# 统一运行包

0.8.5 修复无 allow-forms 时开站无响应，以及 style-src-attr 'none' 下动态布局丢失。
开站使用普通按钮及显式字段校验，回车操作避开中文输入法组合阶段；样式通过 CSSOM 设置。
界面不使用 innerHTML 写入或放宽 CSP。浏览器回归页 tests/fixtures/sandbox.html
同时覆盖禁用表单、Trusted Types 和禁止内联样式，正常应得到 body[data-result="PASS"]。
tests/fixtures/trusted-types.html?baseline 可复现旧字符串写入错误。

2026-11-11 对照官方开发指南、SDK 与提审说明核查：ZIP、权限、素材、存储、
生命周期和原生 Web Audio 的调用边界。最终 ZIP 在不透明来源 iframe（仅 allow-scripts）
配合 SDK 测试替身通过开站、回车保存、导出、重开备份与恢复；未代替真实平台验收。

- 应用：我要当站长，版本 0.9.2
- 应用 ID：`01a1c987-3436-75a8-8864-052fdcd1959a`
- 默认构建联网版，后端为 `https://linux-do-webmaster.rmb.run`。使用平台签名身份连接后端，全站榜由后端可信成绩生成。
- 游戏进度、成就和排行榜由同一后端保存，同账号在沙箱与正式版之间共用。旧本机备份和设置仍使用 SDK 存储，平台自身的存储隔离规则不变。
- 权限：storage.read、storage.write、audio.webAudio、files.save、user.read、network.request。

在项目目录使用 Bun 构建：

```sh
bun run pack
```

默认域名已配置，直接构建即可。需要覆盖后端地址时，在 PowerShell 构建：

```powershell
$env:PUBLIC_ORIGIN = 'https://linux-do-webmaster.rmb.run'
bun run pack
```

`PUBLIC_ORIGIN` 不能包含路径、查询或凭据。无沙箱/正式构建开关；旧命令 `build:sandbox` 仅为 `pack` 的兼容别名，生成同一个包。运行包需后端已部署、平台权限与端点获批才能运行。本机网页预览使用 `bun run dev`。

联网清单固定声明三个 `auth: platform` 端点：GET `/api/state`（getState）、POST `/api/actions`（sendAction）、GET `/api/leaderboard`（getLeaderboard，仅允许动态 query `sort`）。客户端只通过 `sdk.http.request` 发送命名端点和动作，不提交身份、存档或成绩；SDK 添加平台凭据，服务端验证身份并计算成绩。网络或权限失败会显示错误，不切换到本机成绩冒充全站榜。

后端部署、JWT 信任根、应用 ID、CORS 和数据库配置见 `server/DEPLOYMENT.md`。平台需批准新增权限和实际端点后才可验收联网版。

上传 `dist/mapp-package/app.zip` 验证后，用同一构建提交正式发布。
`dist/mapp-package/package.json` 包含清单、大小与 SHA-256。
ZIP 只含清单、HTML、JS、CSS、strings.json 及街景 PNG。
未包含后端、开发文档、测试、源码 ZIP、密钥或玩家存档。

本地构建与测试不能替代实际沙箱验收。上传后检查首次开站、关闭重开后
恢复进度、重开备份与恢复、导出存档、街景、音乐及手机横向滚动。
已知边界：本地进度不用于可信成绩。联网版还需检查跨设备同一账号恢复、两账号共享榜、动作重试、成就恢复及断网提示。
