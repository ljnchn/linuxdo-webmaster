# v4 daily-lease backend deployment and API contract

## 自行部署

应用维护者自行部署后端，项目不依赖托管平台的项目配置。

### Node.js 24 + SQLite

解压后端包，将 `server/.env.example` 复制为根目录 `.env`，其中 `PUBLIC_ORIGIN`
已设为 `https://linux-do-webmaster.rmb.run`。应用 ID 已填好；同一服务器同时接受沙箱与正式版请求，无需配置 `PLATFORM_CHANNEL`。
无需安装运行依赖，在包根目录执行：

```sh
node --env-file=.env server/index.mjs
```

用 HTTPS 反向代理转发到 `127.0.0.1:8787`，保留 `Authorization`、原始路径和 query。
`GET /health` 应返回 `ok: true`；业务接口没有平台签名时返回 401 是正常行为。
运行环境必须能访问 `${PLATFORM_ISSUER}/mini-app-api/jwks`。
将 `DATA_DIR` 指向持久化目录并保留备份；不要在对外部署中设置 `DEV_MODE=enabled`。
Node 开库会为本项目既有 v3/v4 数据库应用成就及统一玩家迁移，迁移前先备份数据库。
新安装使用 `DATA_DIR/webmaster.sqlite`；只有一个旧 `sandbox-v3.sqlite` 或 `production-v3.sqlite`
时沿用原文件。存在多个数据库时须用 `DATABASE_PATH` 明确选用，不自动丢弃或合并文件。
同一库中若同账号存在两种环境的身份记录，迁移会停止，需维护者先选择权威进度；原数据保留。

### Cloudflare Worker + D1

部署后端包中的 `worker/index.js`（完整项目构建产物为 `dist/server/index.js`），
绑定 D1 为 `DB`，设置与示例文件一致的三个变量：`PLATFORM_ISSUER`、`PUBLIC_ORIGIN`、
`MINI_APP_ID`。新数据库依次应用 `drizzle/0000`、`0001`、`0002`、`0003` SQL；
旧数据库只应用未执行的迁移，`0002` 包含加列语句，不能重复执行。健康接口为 `/api/health`。
完整项目构建也会将迁移复制到 `dist/drizzle/`。

### 联网客户端

在完整项目根目录的 PowerShell 执行（默认构建已经采用此域名）：

```powershell
$env:PUBLIC_ORIGIN = 'https://linux-do-webmaster.rmb.run'
bun run pack
```

上传 `dist/mapp-package/app.zip`，在 Linux.do 批准新增 `user.read`、`network.request`
和清单中的三个签名端点。后端与清单 origin 必须完全一致。沙箱与正式版使用同一运行包，
服务器分别验证两种平台签名后映射到统一玩家，存档、成就和排行榜共用。本机存档不会上传为全站成绩。

## Delivered, and what is not claimed

`npm run build` creates a dependency-free Cloudflare Worker at `dist/server/index.js` with the static preview embedded. The self-hosted Worker requires a D1 binding named `DB` and the SQL migrations in `dist/drizzle/`.

The app ID and `https://linux-do-webmaster.rmb.run` backend origin are confirmed; deployment is owned by the maintainer and has not been performed or verified here. An unconfigured Worker reports `status: "unconfigured"`, `trustedLeaderboard: false`, `mode: "local-preview-only"`; every business API fails closed with HTTP 503 `PLATFORM_UNCONFIGURED`. Browser identity headers, cookies and user IDs submitted in JSON do not substitute for mapp JWT verification. No development bypass exists in the Worker.

To activate after platform endpoint approval, configure these backend runtime keys:

- `PLATFORM_ISSUER`: exact trusted HTTPS community issuer, no trailing slash.
- `PUBLIC_ORIGIN`: exact HTTPS backend origin, no trailing slash.
- `MINI_APP_ID`: the actual platform-assigned UUIDv7.

No channel configuration is required. Both `sandbox` and `production` tokens pass complete SDK verification before mapping to the internal `shared` storage identity. Unknown channels and invalid signatures remain rejected.

The shared client must use the platform SDK's signed HTTP requests for the state/actions/leaderboard endpoints and obtain the platform's network permission and endpoint approval. It does not create a second user account system. The Worker uses the official verifier's checks adapted to WebCrypto and fetches only the configured issuer's public JWKS. No private signing key is required or accepted. A missing, malformed or unavailable trusted JWKS never enables anonymous requests. Successful local generated-token tests are **not** platform sandbox acceptance. `platformVerified:false` in health explicitly preserves that distinction.

## HTTP

- GET `/api/state` returns `{state,revision,timing,started,achievements,backup}` and creates only a server-seeded v4 save for the verified `[shared,iss,sub]` identity, independent of the platform run channel.
- POST `/api/actions` accepts exactly `{revision,idempotencyKey,action}`. JSON limit 8 KiB. Keys are 16–96 ASCII letters/digits/underscore/hyphen. No posted state, balance, identity or score is accepted.
- GET `/api/leaderboard?sort=members|days` returns `{channel:'shared',trusted,entries}`. One best active/completed run per verified identity, up to 100 rows, stable secondary ordering. Rank exposes the player-chosen station name, not forum identity. Local development records remain separate from shared player data.
- GET `/api/health` is a non-sensitive configuration report. Configured does not mean platform integration was tested.

Allowed actions: `tick {periods:1}`, `rent {serverId,months:1|2|3}`, `renew {months:1|2|3}`, `registration {value}`, `strategy {strategy}`, `resolve {eventId,optionId}`, `claim {id}`, `rename {name}`, `restart {}`, plus the clock actions below. Engine validation narrows enum values. The old client-controlled advance-day/month APIs are rejected.

## Authoritative online clock

`timing` is `{speed,active,creditMs,periodMs:20000,heartbeatTimeoutMs:4000}`. Start/resume with `{type:'heartbeat',active:true}`; send another at least every 2 seconds while visible and playing. Pause/hide with `{type:'heartbeat',active:false}`. Select speed using `{type:'speed',value:1|2|4}`. All of these go through the same revision and idempotency envelope and increment revision; serialize them with gameplay actions.

A tick spends 20000 ms of server-measured credit. Credit grows by elapsed server time × the previously selected speed and is capped at one tick. More than 4000 ms without a valid successful request discards the unobserved elapsed time but preserves already earned credit. An inactive session accrues nothing and keeps earned partial progress; resume never counts paused time. Speed changes first account for visible elapsed time using the old speed, then apply the new speed. No elapsed timestamp is trusted from the client; no off-line catch-up or day jump exists. An immediate tick returns 429 `TICK_TOO_EARLY`. A malicious client can maintain its own online heartbeat, so this is clock integrity, not a claim of human-attention proof or complete bot prevention.

One game day has three periods: 60 active real seconds at 1×, 30 seconds at 2× and 15 seconds at 4×. `RULES.secondsPerPeriod` is the shared timing source. Lease time is the integer `state.serverDaysRemaining`; it decreases once at the night-to-morning boundary, before rewards. The compatibility field `serverPeriodsRemaining` is always days × 3, not a partially consumed lease. Monthly packages, prices and the 30-day upgrade-credit denominator are unchanged.

## Save compatibility

Existing v3 state is upgraded in place on state reads or new actions. Remaining periods are rounded up to whole days once, all gameplay progress and assets are preserved, and ended saves remain ended. The update compares both revision and the exact source state blob, so concurrent upgrades cannot overwrite gameplay. No schema change or database rename is required. Migration does not increment revision or change run IDs, audit rows, completed snapshots or past idempotency responses. Exact retries still return the originally recorded response (which can contain v3 state); clients should migrate such a response locally or read current state. Existing earned clock credit is retained in milliseconds.

## Transactions and finished runs

D1's atomic `batch()` uses compare-and-swap on revision, a fresh commit token, and commit-token-guarded writes for idempotency/audit/completed-run rows. Two concurrent distinct operations at one revision have one winner. Exact retries return the original response, and reused keys with changed payloads return 409. Preserve the complete original envelope after a timeout. Do not invent a fresh key until the prior outcome is known.

Finished runs cannot be renamed, renewed, claimed or advanced. Their final snapshot is stored in `completed_runs` once. Restart creates a new run ID and increases revision without modifying old snapshots; leaderboards can retain the earlier best score. The achievement table and setup column require the explicit migration; only the existing backup-table compatibility path retains its idempotent DDL.

Apply migration `0002_player_achievements` before deploying this version of the Worker. It adds the account achievement ledger and the `players.started` setup flag; existing players default to started, new players and restarted runs are unstarted until a successful rename. This flag only controls setup presentation. Node's reference adapter applies the same schema migration when opening an older database. The v4 engine save format is unchanged.

State and new action responses include the full `achievements:[{id,unlockedAt}]` list. Unlocks are calculated only from trusted server state, persist across restarts, and follow the same shared issuer/subject identity as saves. Eight thresholds cover 1/10/100/1000 current members, 7/30/100 operating days and 10000 current coins. New action unlocks are inserted in the same compare-and-swap batch as state, audit and the exact idempotency response. Reads backfill eligible existing snapshots without changing revision; backfilled timestamps use that snapshot's last trusted write time, not a reconstructed historical crossing date. Truncated logs and history are not used. Legacy stored idempotency responses remain unchanged and may omit achievements or started. Local browser saves are not imported into trusted scores or achievements.

Apply `0003_shared_players.sql` before deploying the unified Worker. It normalizes old identity keys and channel columns across all six durable tables, preserving snapshots, revisions and exact operation responses. Conflicting identities across old channels cause the initial guard to fail with `malformed JSON` before updates; do not skip that guard or choose a save silently. Apply the migration atomically while the old API is stopped.

The local Node 24 reference server uses exactly the same storage logic with SQLite. Its startup applies migrations in a transaction and retains a single legacy database filename when found. Only explicit `DEV_MODE=enabled` and loopback allow the fixed tester, using a separate `development-v3.sqlite`. Legacy v1/v2 backend databases require a separately reviewed migration and are not silently reclassified as trusted scores.

## Validation and limits

From `tests/`, run `node --test *.test.mjs`; from the project root, run `bun run check`, `bun run build`, and `node --check dist/server/index.js`. Tests cover generated valid and invalid signatures against both the unmodified official verifier and WebCrypto adaptation, unconfigured fail-closed Worker routes, signed Worker requests backed by SQLite emulating D1 statements/batches, concurrency, clock limits, isolation, immutable final scores, retries and JSON/CORS boundaries. Version 0.9.0 passed 242 tests, compiled Worker tests, and desktop/390px opaque-iframe checks against the actual shared store with a test SDK boundary. This is not a real platform network acceptance test.

No real platform credential or production player data was used. Hosted D1 and platform sandbox behavior still need actual deployment verification. Before a public competition, add operator-controlled moderation, request-rate controls, audit/idempotency retention, backups/recovery, observability and platform sandbox acceptance. The current private prototype does not claim these production operations are complete.
