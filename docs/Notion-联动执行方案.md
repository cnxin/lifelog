# LifeLog Notion 联动执行方案

## 目标

用 Notion 作为 LifeLog 的在线镜像和轻量备份，让本地记录可以无痛同步到 Notion 中查看、搜索和分享。第一阶段只做单向同步，不把 Notion 当主数据库，避免双向冲突和误覆盖。

## 产品原则

- 本地优先：LifeLog 本地数据仍是主数据源，离线可用不受 Notion 影响。
- 本地功能免费：Notion 同步可作为未来云端高级能力的一部分，但不限制已有本地功能。
- 先单向后双向：先把 LifeLog 写入 Notion；从 Notion 拉回和双向合并放到后续阶段。
- 失败可恢复：同步失败不影响本地保存，所有失败记录进入重试队列。
- 可解释：每次同步要显示新增、更新、跳过、失败数量。

## Notion 数据模型

### LifeLog 人物数据库

字段：
- `Name`：标题，人物姓名。
- `LifeLog ID`：文本，本地人物 ID。
- `Relationship`：选择，关系。
- `Birthday`：日期，生日。
- `Favorite`：复选框，是否收藏。
- `Preferences`：富文本，喜好档案。
- `Dislikes`：富文本，禁忌雷区。
- `Notes`：富文本，备注。
- `Updated At`：日期，本地更新时间或同步时间。

### LifeLog 地点数据库

字段：
- `Name`：标题，地点显示名。
- `LifeLog ID`：文本，本地地点 ID。
- `Category`：选择，分类。
- `City`：文本，城市。
- `Area`：文本，区域。
- `Mall`：文本，商场。
- `Store Name`：文本，店铺名。
- `Rating`：数字，评分。
- `Address`：富文本，地址。
- `Map URL`：URL，高德或地图链接。
- `Tags`：多选，标签。
- `Favorite`：复选框，是否收藏。
- `Updated At`：日期，本地更新时间或同步时间。

### LifeLog 回忆数据库

字段：
- `Name`：标题，回忆标题。
- `LifeLog ID`：文本，本地回忆 ID。
- `Date`：日期，发生日期。
- `Mood`：选择，心情。
- `Content`：富文本，正文。
- `People`：Relation，关联人物数据库。
- `Places`：Relation，关联地点数据库。
- `Tags`：多选，标签。
- `Photo Count`：数字，照片数量。
- `Updated At`：日期，本地更新时间或同步时间。

### LifeLog 纪念日安排数据库

字段：
- `Name`：标题，安排标题。
- `LifeLog ID`：文本，本地安排 ID。
- `Person`：Relation，关联人物数据库。
- `Anniversary Title`：文本，纪念日名称。
- `Target Date`：日期，目标日期。
- `Status`：选择，todo / doing / done / skipped。
- `Budget`：文本，预算。
- `Checklist`：富文本，待办清单。
- `Places`：Relation，关联地点数据库。
- `Memory`：Relation，关联回忆数据库。
- `Notes`：富文本，备注。
- `Updated At`：日期，本地更新时间或同步时间。

## 技术方案

### 认证方案

MVP 使用 Notion Internal Integration：
- 用户在 Notion 创建 Internal Integration。
- 用户复制 Notion Secret 到 LifeLog。
- 用户把目标页面或数据库分享给该 Integration。
- LifeLog 在设置页保存 Secret 和数据库 ID。

后续公共版本使用 OAuth：
- App 打开 Notion OAuth 授权页。
- 回调到 LifeLog 云端代理。
- 云端保存 refresh/access token。
- App 只保存 LifeLog 侧同步凭证，不保存 Notion client secret。

### 网络调用边界

MVP 可直接从 WebView 调 Notion API，但需要真机验证 CORS 和网络稳定性。如果浏览器环境阻止请求，则加入轻量代理服务。

轻量代理服务职责：
- 保存 Notion OAuth client secret。
- 转发 Notion API 请求。
- 做基础限流和失败重试。
- 不保存 LifeLog 全量数据，只处理同步请求。

### 同步策略

第一阶段为单向 upsert：
- 本地记录没有 `notionPageId`：按 `LifeLog ID` 查询 Notion，找不到则创建页面。
- 本地记录已有 `notionPageId`：直接更新对应页面。
- Notion 页面不存在或已删除：重新创建并更新映射。
- 本地删除暂不自动删除 Notion 页面，先标记为 `Archived` 或跳过。

### 同步顺序

1. 同步人物。
2. 同步地点。
3. 同步回忆，并关联人物、地点页面。
4. 同步纪念日安排，并关联人物、地点、回忆页面。

### 图片策略

MVP 不上传图片，只同步 `Photo Count`。

第二阶段可选：
- 如果照片是本地 Blob，需要先转成 Notion 文件上传。
- 图片上传失败不影响文字同步。
- Notion 图片上传会明显增加请求数，必须走队列。

### 限流和队列

Notion API 平均限制约 3 请求/秒。LifeLog 需要本地同步队列：
- 每次只并发 1 个请求。
- 请求间隔默认 400ms。
- 429 或网络失败时指数退避。
- 每条任务最多重试 3 次。
- 失败任务保留错误原因，可手动重试。

### 本地存储

新增本地配置：
- `notion.enabled`
- `notion.mode`: `manual-token` / `oauth`
- `notion.token`
- `notion.workspaceName`
- `notion.peopleDatabaseId`
- `notion.placesDatabaseId`
- `notion.memoriesDatabaseId`
- `notion.plansDatabaseId`
- `notion.lastFullSyncAt`

新增本地映射：
- `entityType`
- `entityId`
- `notionPageId`
- `lastSyncedAt`
- `lastSyncHash`
- `lastError`

新增同步队列：
- `id`
- `entityType`
- `entityId`
- `operation`: `upsert`
- `status`: `pending` / `running` / `done` / `failed`
- `attempts`
- `lastError`
- `createdAt`
- `updatedAt`

## UI 方案

### 设置页入口

在设置或账号页新增 `Notion 同步` 入口。

页面结构：
- 连接状态：未连接 / 已连接 / 连接失败。
- Token 输入。
- 数据库 ID 输入或自动创建按钮。
- 测试连接按钮。
- 同步范围：人物、地点、回忆、纪念日安排。
- 同步操作：同步全部、同步待同步、重试失败。
- 同步状态：已同步、待同步、失败数量。

### 详情页入口

人物、地点、回忆详情页增加轻量状态：
- 已同步到 Notion。
- 待同步。
- 同步失败，点击重试。
- 打开 Notion 页面。

### 数据管理页

分享记录附近增加 Notion 同步记录：
- 最近同步时间。
- 最近失败原因。
- 队列数量。
- 清空失败记录。

## 执行清单

### 阶段 0：方案确认

- [x] 确认 MVP 只做单向同步，不做 Notion 到 LifeLog 的双向导入。
- [x] 确认 MVP 不上传图片，只同步照片数量。
- [x] 确认 MVP 使用 Notion Internal Integration Token。
- [x] 确认 Notion 同步是否归入未来云端高级能力。

### 阶段 1：基础配置和连接测试

- [x] 新增 Notion 配置类型和默认值。
- [x] 新增 Notion 配置持久化读写。
- [x] 新增设置页 `Notion 同步` 入口。
- [x] 实现 Token 和数据库 ID 输入表单。
- [x] 实现 `测试连接`，调用 Notion users/me 或数据库读取接口。
- [x] 显示连接成功、权限不足、数据库不存在、网络失败等状态。
- [x] 增加连接测试回归脚本。

### 阶段 2：Notion API 封装

- [x] 新增 `notionClient` 工具模块。
- [x] 实现 Notion 请求基础封装，包括 headers、版本号、错误解析。
- [ ] 实现查询数据库页面方法。
- [x] 实现创建页面方法。
- [x] 实现更新页面方法。
- [ ] 实现分页读取方法。
- [ ] 实现 429 限流错误识别。
- [x] 增加 Notion API mock 测试。

### 阶段 3：字段映射

- [x] 实现人物到 Notion properties 的映射。
- [x] 实现地点到 Notion properties 的映射。
- [x] 实现回忆到 Notion properties 的映射。
- [x] 实现纪念日安排到 Notion properties 的映射。
- [x] 实现富文本截断，避免超过 Notion 字段长度限制。
- [x] 实现多选标签规范化，避免空标签和过长标签。
- [x] 增加字段映射回归测试。

### 阶段 4：页面映射和 upsert

- [x] 新增本地 Notion 页面映射存储。
- [ ] 按 `LifeLog ID` 查询已有 Notion 页面。
- [x] 人物 upsert。
- [x] 地点 upsert。
- [x] 回忆 upsert。
- [x] 纪念日安排 upsert。
- [x] 页面被 Notion 删除时自动重新创建。
- [x] 保存 `notionPageId`、`lastSyncedAt`、`lastSyncHash`。
- [x] 增加重复同步不重复创建页面的测试。

### 阶段 5：关系同步

- [ ] 人物同步完成后建立人物 ID 到 Notion Page ID 的映射。
- [ ] 地点同步完成后建立地点 ID 到 Notion Page ID 的映射。
- [ ] 回忆同步时写入 People relation。
- [ ] 回忆同步时写入 Places relation。
- [ ] 安排同步时写入 Person relation。
- [ ] 安排同步时写入 Places relation。
- [ ] 安排同步时写入 Memory relation。
- [ ] 关系目标缺失时先同步目标，再同步当前记录。

### 阶段 6：同步队列

- [ ] 新增同步队列类型和 IndexedDB 表。
- [ ] 新增入队方法。
- [ ] 新增队列执行器。
- [ ] 实现单请求串行执行和 400ms 间隔。
- [ ] 实现失败重试和指数退避。
- [ ] 实现失败原因持久化。
- [ ] 实现手动重试失败任务。
- [ ] 实现清空已完成任务。
- [ ] 增加队列状态测试。

### 阶段 7：手动同步 UI

- [x] 设置页显示同步总览。
- [x] 实现同步全部。
- [ ] 实现只同步人物。
- [ ] 实现只同步地点。
- [ ] 实现只同步回忆。
- [ ] 实现只同步纪念日安排。
- [ ] 同步过程中显示进度。
- [x] 同步完成显示新增、更新、跳过、失败数量。
- [ ] 同步失败显示可执行的重试入口。

### 阶段 8：详情页同步状态

- [ ] 人物详情显示 Notion 同步状态。
- [ ] 地点详情显示 Notion 同步状态。
- [ ] 回忆详情显示 Notion 同步状态。
- [ ] 纪念日安排详情显示 Notion 同步状态。
- [ ] 已同步时可打开 Notion 页面。
- [ ] 同步失败时可单条重试。

### 阶段 9：自动入队

- [ ] 新增人物保存后自动入队。
- [ ] 新增地点保存后自动入队。
- [ ] 新增回忆保存后自动入队。
- [ ] 新增纪念日安排保存后自动入队。
- [ ] 编辑人物后自动入队。
- [ ] 编辑地点后自动入队。
- [ ] 编辑回忆后自动入队。
- [ ] 编辑纪念日安排后自动入队。
- [ ] 自动入队默认可关闭。

### 阶段 10：数据库自动创建

- [x] 调研 Notion API 创建数据库所需父页面权限。
- [x] 设置页增加父页面 ID 输入。
- [x] 自动创建人物数据库。
- [x] 自动创建地点数据库。
- [x] 自动创建回忆数据库。
- [x] 自动创建纪念日安排数据库。
- [x] 创建后自动保存数据库 ID。
- [x] 创建失败时给出可操作提示。

### 阶段 11：发布验证

- [x] Web 构建通过。
- [x] Notion API mock 测试通过。
- [ ] 设置页连接测试通过。
- [ ] 首次同步 10 条以内数据通过。
- [ ] 重复同步不会重复创建页面。
- [ ] 删除 Notion 页面后再次同步可恢复。
- [ ] Notion 限流时队列会等待并重试。
- [ ] Android 真机测试 Token 保存、连接测试、同步和打开 Notion 页面。
- [x] README 更新 Notion 同步说明。
- [x] CHANGELOG 更新 Notion 同步说明。

## 风险和处理

### CORS 或 WebView 网络限制

风险：Notion API 可能不允许直接从 WebView 调用，或在国内网络不稳定。

处理：
- MVP 先做能力探测。
- 如果直连失败，加入轻量代理服务。
- UI 明确显示“直连失败，可使用代理同步”。

### Token 安全

风险：Internal Integration Token 存在本地，设备被其他人操作时可能泄露。

处理：
- 本地加隐私提示。
- 支持一键清除 Token。
- 后续用 OAuth + 云端代理替代手动 Token。

### 双向冲突

风险：用户同时在 LifeLog 和 Notion 修改同一条数据。

处理：
- MVP 不做双向。
- Notion 只作为在线镜像。
- 后续如果做导入，先做预览和手动选择覆盖方向。

### 图片同步成本

风险：图片上传慢、请求多、失败率高。

处理：
- MVP 不传图片。
- 后续图片单独开关。
- 图片失败不阻塞文字同步。

## 建议实施顺序

1. 先完成阶段 0 到阶段 4，实现可手动同步人物、地点、回忆。
2. 再做阶段 5，补关系字段。
3. 再做阶段 6 到阶段 7，完善队列和同步 UI。
4. 真机稳定后再做阶段 8 到阶段 9。
5. 阶段 10 和 OAuth 作为后续高级能力。

## 完成标准

MVP 完成时应满足：
- 用户能在 LifeLog 中配置 Notion Token 和数据库 ID。
- 用户能点击同步全部，把人物、地点、回忆写入 Notion。
- 再次同步不会重复创建页面。
- 同步失败不会影响本地数据。
- 设置页能看到同步结果和失败原因。
- Android 真机上至少完成一次成功同步。
