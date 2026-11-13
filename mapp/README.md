# 微应用打包

- 版本：0.10.0
- 应用 ID：`01a1c987-3436-75a8-8864-052fdcd1959a`
- 后端：`https://linux-do-webmaster.rmb.run`

在项目根目录执行：

```sh
bun run pack
```

上传 `dist/mapp-package/app.zip`，沙箱与正式版使用同一文件。`dist/mapp-package/package.json` 记录清单、大小和 SHA-256。ZIP 仅含清单、HTML、JS、CSS、strings.json 与当前街景 PNG。

需更换后端地址时，在构建进程设置 `PUBLIC_ORIGIN`；只接受 HTTPS origin，不允许路径、query 或凭据。服务端配置必须一致，见 [后端部署](../server/DEPLOYMENT.md)。

## 权限与身份

清单声明 `storage.read`、`storage.write`、`audio.webAudio`、`files.save`、`user.read`、`user.lookup`、`network.request`。

排行榜由后端返回已验证账号的用户 ID，客户端通过 `sdk.user.getById` 显示 Linux.do 名称、用户名与头像。头像 Blob URL 仅在当前会话使用，不写入存档。需更新后端并批准 `user.lookup` 权限；读取失败时仍显示社区成绩。

三个签名端点为 `getState`（GET `/api/state`）、`sendAction`（POST `/api/actions`）、`getLeaderboard`（GET `/api/leaderboard`，动态 query 仅允许 `sort`）。后端部署并获平台批准后才能联网运行。

客户端只提交操作，不提交身份或成绩；网络失败时显示错误并保留已有进度。SDK 存储用于设置与本机备份，服务端保存可信进度、成就与共享排行榜。

## 沙箱兼容性与验收

开站按钮使用显式事件与校验，不依赖原生表单提交；界面通过 DOM 和 CSSOM 渲染，适配 Trusted Types 与禁止内联样式的 CSP。

运行本地预览后，`tests/fixtures/sandbox.html` 可检查禁用表单、Trusted Types 与样式约束，成功时页面标记 `body[data-result="PASS"]`。该页是本地回归工具，不能替代真实平台沙箱。

上传后检查首次开站、回车确认、关闭重开后恢复、前局备份、导出、音乐、手机横向滚动；联网后还须检查两种平台环境共享进度、不同账号排行榜、动作重试、跨局成就和断网提示。0.10.0 还需检查活动跨日自动完成、故事分支、社区特色与月度荣誉；先更新后端再上传新版运行包，旧存档无需重开。
