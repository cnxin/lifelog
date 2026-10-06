# 日子：Android 测试与升级验收

## alpha.10 / 阶段 I 周年数字与农历录入 — 作者真机验收通过，2026-10-06

- `0.2.0-alpha.10-preview`，versionCode 145，包名 `com.cnxin.lifelog.preview`，沿用测试签名。不新增权限，不改备份 / 存储格式，不动 legacy，不改变日历页。
- I1 `b365a6a`：`years` 为派生字段，原始与下次日期用各自历法的年份相减；农历两端均取库的农历年。生日 / 纪念日 / 年度倒数日的文案集中生成，卡片、hero、详情与小组件共用；旧 widget 快照缺字段时隐藏新行。
- I2 `472b4e8`：独立农历网格，1901–2099 年、库生成闰月与 29/30 日、六列五行、roving tabindex 与方向键；换算超出存储范围的月 / 日禁用。公历与农历模式共用年份输入；选农历日自动设为年度农历重复，勾选框仍可手动取消。
- 仅修改作者点名许可的旧断言：非重复 `dayStatus` 完整对象增加 `years: null`；其余旧断言保持原样。公历测试在打开农历记录的日期面板后显式切回公历，测试 setup 改变而非断言放宽；axe、触控阈值与真实动画时长未删改。
- 单套基准：I1/I2/I3 中途对 alpha.9 阶段末尾的基准 verify，预期差异如实记为失败；只审查允许范围内的 diff，不修改比较器或归一化、不加排除属性。阶段末已在生产预览下 capture 替换同一套 14 份原文件，独立 verify 通过，刷新后 diff 为 0；单独提交 `chore(baseline): refresh after I`。J 浅色零差异以此更新后的基准为准。完整 diff 随各提交消息保存，不保留额外 H0 基准副本。完整门禁的功能检查与耗时检查分别如实记录，所有复测轮次保存在 APK 报告中。
- 本机命令、门禁 exit 状态、耗时、APK 身份 / 权限 / 签名、lint 和 JVM 缓存 / 实际执行区别，记录在 `downloads/lifelog-days-0.2.0-alpha.10-preview.apk.json`。I1/I2 原有八项检查通过；中途 baseline 仍失败，历史 H0 半时门槛在这些轮次未达到，不把耗时达标作为结论。
- 调整前，刷新基准后的三轮完整检查均为：Node 77/77、原有六组浏览器用例、构建、离线、14 份基准及 CSS 测量全部通过；但耗时分别为 46.269 / 46.899 / 51.078 秒，超过误用的历史 45 秒门槛，故当时 `gates` 返回 1。这些历史记录保留，不改写成通过。原并发配置分别用默认 3 / 4 / 默认 3，不改行为断言或时钟。`android:preview` 通过，lint 0 error / 27 warning，JVM 与 lint analysis 为 UP-TO-DATE，不写成新执行。
- 作者已明确修正 H3 目标值的用途：耗时只报告、不判定，删除 45 秒失败条件；超过 180 秒仅 warning，不影响退出码。保留总耗时、各套用例耗时、历史参考比率；真实失败、单套防卡死超时、axe、行为断言与基准比较不变。新增耗时边界与 warning 单测；调整后的实际门禁结果附入 APK 验证报告，旧失败轮次保留。此项不是行为断言放宽；提交 `0ddcdea` 后门禁通过、exit 0、46.607 秒。
- **alpha.10 真机验收由作者完成并在本线程确认通过**（2026-10-06），不是本机安装 / 设备测试。阶段 I 清单保留供复测，不把总体通过扩大为未提供的逐项设备测量或长期后台行为结论。
- 验收机型、Android 版本、Android System WebView 提供方与版本：**作者尚未提供，待补充**。本次消息仍为 `<你补>` 占位；`adb devices -l` 无连接设备，已有记录无法可靠确定，不能代填或猜测。
- 发布作者验收的原 APK：SHA-256 `e7e1d90e1297da2f5b57553d85cc28795407f5cce8d1206d20a8cf7056d4b268`，4,444,937 bytes；同名 `.apk.sha256` 与 `.apk.json` 在 `downloads/`。发布前重建只作门禁与 Web 资产核对，不替换已验收文件。
- 分支 `codex/anniversary-lite`，标签 `v0.2.0-alpha.10-preview`，独立 pre-release，正文沿用 alpha.9 的章节格式。alpha.9 及更早 Release 不改不删；确认 alpha.10 发布成功后才开始 J1 → J4。J 浅色零差异以 `3c89d2b` 刷新后的唯一浅色基准为准。更新前先导出备份，不卸载原版。

### 作者真机验收清单（I，作者已确认通过，保留供复测）

1. 新建农历生日：选农历、八月十五，核对对应公历、保存后的农历标签与下一次中秋；每年重复自动勾选，也可手动取消。
2. 核对闰六月、小月廿九、腊月跨公历年及 1901 / 2099 边界；年份输入、月份 / 日期选择、返回键与键盘可正常操作。
3. 一条 2020 年的纪念日按**下一次发生日期**核对周年：例如在 2026-10-06 查看 2020-05-20，每年公历重复的下次为 2027-05-20，故显示「即将 7 周年」，不是写死「6 周年」。发生当天显示已完成的周年 / 年龄。
4. 置顶后小组件显示与首页相同的标签，旧数据导入与 widget 无标签快照兼容；同时核对 2×2 启动器上的实际排版。浏览器 / JVM 测试不代替这项真机结果。

## alpha.9 / 阶段 H 结构整理 — 作者真机回归通过

- `0.2.0-alpha.9-preview`，versionCode 144，包名 `com.cnxin.lifelog.preview`，沿用原测试签名；不新增权限、不改数据或备份格式、不动 legacy。
- 本次更新只有：**内部结构整理，无行为变化**。H0 `d5e804b` 固定 14 份浅色基准；H1 `aa8058e` 将 App 拆为 87 行装配层与显式 props 的组件/hooks；H2 `8eb68ad` 按原级联顺序搬运全部 557 条规则和 42 个媒体条件，保留所有不满足删除条件的规则；H3 `20732a8` 合并门禁并复用一个 Chromium。CSS 续段按原相对顺序导入，不为凑文件名顺序而改变级联。
- **既有断言未改**。H1/H2 仅调整作者许可的源码定位：SystemBars 读取 `src/hooks/useNativeShell.ts`；安全区断言读取按 `src/styles/index.css` 的 `@import` 顺序递归拼接的完整文本，不只读 tokens。提交消息包含旧路径引用清单、路径行 diff、改动前后相同的正则 SHA-256。
- H3 完整门禁实测 43.554 秒，原 H0 串行八项 90 秒，48.39%，达到不超过 50% 的目标；这是本机测量，不承诺其它硬件同速。现有八项全部通过，另含离线、14 份不可变基准和 CSS 只测量巡检；全部 365 个静态断言调用、29 个正则、8 处 axe.run（含选项）与 H2 字节一致。axe 每次扫描保留，只避免在同一 document 中重复加载同版本库；时钟、真实动画时长、触控阈值和截图用例均未削减。
- H4 已执行 `npm run gates` 与 `npm run android:preview`：原有八项及新增门禁全部通过，最终总耗时 41.437 秒（原串行的 46.04%），lint 0 error / 27 warning。先前三次复测功能/axe/基准检查同样通过，但耗时约 54 秒，未通过附加性能门槛；原记录保留，不放宽门槛。> Task :app:testDebugUnitTest UP-TO-DATE；XML 8 项、0 failure/error，不将 UP-TO-DATE / 缓存写成新的执行。APK 的 20 个 dist Web 文件逐字节一致，另外两个 Capacitor 生成的 Cordova 空 stub 单独核对。
- 本地交付：`react-app/.artifacts/lifelog-days-0.2.0-alpha.9-preview.apk`，同名 `.apk.sha256` / `.apk.json`；SHA-256：`a44bead9595ac96068911a6b381e80ba93918ebfccbc0542b825b29baf3ab343`。报告包含最终及先前三次 H4 门禁结果、APK 身份/权限/签名、lint、JVM 状态和未验证范围。
- H2 删除统计：**0 条规则**；styles 总行数 **3,088 → 3,186**（包括 27 行 index.css；模块合计 3,159 行）。拆分说明与空行造成行数增加，不宣称减少行数。原 557 条规则与 42 个媒体条件保留；6 条零覆盖候选的类名仍在 TSX 使用，不满足全部删除条件。测量输出为 `react-app/.artifacts/css-unused.json`，H2 实测报告存于 `react-app/.artifacts/h2/css-unused-before.json`，并附入发布验证报告。
- **alpha.9 真机回归由作者完成并确认通过**：作者在本线程确认首页、新增、编辑、日历、详情、提醒、置顶、小组件刷新的阶段 H 快速回归通过。本机没有安装 alpha.9，不将作者结论描述成本机测试，也不扩展为通知准点送达、重启恢复、小组件长期后台周期或原版签名覆盖升级通过。
- 验收机型：**作者尚未提供，待补充**。Android System WebView 提供方与版本：**作者尚未提供，待补充**。作者消息仍使用 `<你补>` 占位；本轮 `adb devices -l` 无连接设备，历史记录也没有可靠型号/版本，因此无法代填，不猜测。
- 发布使用作者验收的原 APK，SHA-256 与前次交付一致；发布前重建仅用于门禁、身份/签名和资产核对，不替换已验收文件。交付保存为 `downloads/lifelog-days-0.2.0-alpha.9-preview.apk` 及同名 `.apk.sha256` / `.apk.json`。
- 分支 `codex/anniversary-lite`，标签 `v0.2.0-alpha.9-preview`，独立 GitHub pre-release，正文格式沿用 alpha.8；旧 Release 不改不删。确认 H 发布成功后才开始 I1 → I2 → I3；本轮不开始 J。

### 作者快速回归（alpha.9 已确认通过）

以下清单保留供复测；作者确认的是阶段 H 回归结论，没有逐项设备测量记录可报告。安装前先导出备份，不卸载旧 LifeLog。快速检查：首页、新增、编辑、日历、详情、提醒、置顶、小组件刷新。任何与 alpha.8 不同的表现都算失败；记录具体步骤、机型及 WebView 版本，不以自动门禁替代此回归。

## alpha.8 / 阶段 G 当天庆祝发布 — 2026-10-04

- 基于 alpha.7 发布提交 `d6bf6f3`，G1 feature 提交 `2f84123`，G2 发布准备提交 `b1b4a34`；本次仅追加作者验收／发布记录，不改产品代码或重写上述提交。版本 `0.2.0-alpha.8-preview`，versionCode 143，包名与测试签名不变。不新增权限，不修改数据／备份格式。
- 本次更新：日子当天打开应用时，首页会有一次轻柔的庆祝动效，每天一次，可点数字重放。只看首页 featured 的当天状态；本机 `lifelog-days:celebrated` 存 `featured.id:today`，不进 JSON 备份或 widget payload。
- hero 内的画布默认 2600ms，90–120 个半透明粒子，前 500ms 分批出现；DPR 适配，结束／取消后移除，页面隐藏时暂停，恢复继续。原有 hero-orbit 装饰保留；当天的计数区域为可键盘操作、触控至少 44px 的重放按钮。
- 减少动态效果时不播放粒子，但首次仍写入当天标记并调用成功震动；点击重放调用轻震动，不绕过减少动态效果。Web 无原生震动；本机的浏览器震动验证使用 mock，不冒充 Android 实测。
- **真机验收由作者完成**：作者于 2026-10-04 在本线程确认 alpha.8 阶段 G 当天庆祝验收通过。本机未执行设备安装测试；不据此扩大为通知送达／重启恢复、小组件后台行为或原版同签名覆盖升级已验收，亦无逐项设备测量数据可报告。
- 验收机型：**作者尚未提供，待补充**。Android System WebView 提供方及版本：**作者尚未提供，待补充**。本次 `adb devices -l` 无连接设备，已有验收记录也无可靠型号／版本，因此不猜填。
- 全部 8 项门禁及 `npm run android:preview` 在 G1、G2 和本次验收记录提交前分别执行；实际结果记录在 `downloads/lifelog-days-0.2.0-alpha.8-preview.apk.json`。浏览器 Canvas／时钟／震动 mock 和可见性模拟不等于手机验收。
- 测试包、校验值与验证报告：`downloads/lifelog-days-0.2.0-alpha.8-preview.apk`、同名 `.apk.sha256`、`.apk.json`。可在 `downloads/` 执行 `shasum -a 256 -c lifelog-days-0.2.0-alpha.8-preview.apk.sha256`。
- 发布保留作者验收的原 APK，SHA-256 为 `1b88df8506c74fd6bd4c3965ccf6281d30e26804ac360f3a91213db58a44f549`；发布前重建仅用于门禁与 Web 资产一致性核对，不用新构建覆盖已验收文件。
- 分支 `codex/anniversary-lite`，标签 `v0.2.0-alpha.8-preview`；单独 GitHub pre-release，附 APK、SHA-256 与验证报告。alpha.7 及更早的 Release 不改不删。安装前导出备份，不卸载原版。

### 庆祝真机验收清单（作者已确认阶段 G 通过）

下列清单保留供复测；作者确认的是本阶段验收结论，不将缺少逐项记录的设备细节表述为本机实测结果。

1. 更新测试包前导出备份；创建／置顶当天记录，再打开应用，确认仅首页这条有轻柔粒子和成功震动，约 2.6 秒后画布消失，不妨碍查看详情等操作。
2. 同一天退出／重开，无第二次自动播放；同一天有多条记录也不逐卡庆祝。点当天计数区域可重放，快速连点不叠加多层画布，伴轻震动。
3. 开启系统减少动态效果，首次仍记下当天状态及震动，不出现粒子；重放亦不出现。切换减少动态效果时，正在播放的画布应移除。
4. 播放中切后台，再返回，确认正常继续／收尾；测试公历／农历年度重复当天、非当天不出现重放按钮、长标题、大字号与不同屏幕方向。
5. 记录实际机型、WebView 提供方／版本、动画流畅程度及震动。当前这些设备信息未知，不填猜测值。

## alpha.7 / 提醒选择修复发布 — 2026-10-01

- 基于 `a3a3b75`，本轮只有一个发布准备提交：`0.2.0-alpha.7-preview`，versionCode 142，独立包名仍为 `com.cnxin.lifelog.preview`，沿用测试签名。
- 本次更新：触屏不再残留 hover 态；提醒开关与提前天数解耦，可全部取消。未引入其它功能、权限或数据格式变更。
- **真机验收由作者完成**：作者在本线程确认上述两项修复通过，不表述为本机安装测试，也不将其扩展为通知送达／重启或小组件后台行为已验证。
- 验收机型：**作者尚未提供，待补充**。Android System WebView 提供方及版本：**作者尚未提供，待补充**。本次 `adb devices -l` 未发现连接设备，已有验收记录亦无可靠型号／版本信息，因此不推测填写。
- 全部 8 项门禁及 `npm run android:preview` 是本轮发布门禁；实际结果、APK 权限／签名／大小／SHA-256、Web 文件一致性及 JVM 报告记录在 `downloads/lifelog-days-0.2.0-alpha.7-preview.apk.json`，不以作者反馈替代构建验证。
- 交付文件：`downloads/lifelog-days-0.2.0-alpha.7-preview.apk`、同名 `.apk.sha256` 和 `.apk.json`。校验文件内使用 APK 文件名，可在 `downloads/` 中执行 `shasum -a 256 -c lifelog-days-0.2.0-alpha.7-preview.apk.sha256`。
- 分支仍为 `codex/anniversary-lite`，标签 `v0.2.0-alpha.7-preview`；单独 GitHub pre-release。alpha.6 的 Release、正文与资产不修改、不删除。原 LifeLog 的同签名正式覆盖升级仍另行验收；安装前先备份，不卸载原版。

## alpha.6 / 阶段 F 小组件 — 2026-09-30

- `0.2.0-alpha.6-preview`，versionCode 141，独立包名仍为 `com.cnxin.lifelog.preview`。阶段 F 在 alpha.5 已发布后才开始；保留提醒版，alpha.6 单独预发布，不替换旧版 LifeLog。
- Android 2×2 单条小组件显示与首页 hero 相同的置顶／临近记录，包含分类底色、标题、天数与日期；点整块进入该记录详情，空列表显示「记下第一个日子」。不存在 iOS 或 Web 实现。
- `WidgetBridge` 写入本应用私有 SharedPreferences 快照并刷新全部实例；应用启动／恢复、记录重载完成后与提醒共用 500ms 防抖。点击 ID 只消费一次，记录已删除则忽略。
- 原生只对缓存 `nextDate` 计算公历日差，不计算农历或重新排序。跨周年后需要打开应用更新下一次日期；长期不打开时不保证推荐记录仍与当日重新计算的首页一致。快照的 `updatedAt` 是输入日期对应的确定性 ISO 日期戳，不是桥调用的墙上时钟时间。
- 非精确闹钟请求每天本地 00:05 更新，最后一个实例移除后取消；重启、时间与时区变化后刷新并重新注册。宿主更新周期请求为 30 分钟，系统休眠／省电可延后，均不保证准点或最长延迟。
- 不新增权限；实际权限保持 alpha.5 的六项，不含 `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`。provider 与开机 receiver 均非导出，点击 `PendingIntent` 使用 `FLAG_IMMUTABLE`。
- `android:preview` 包含 `:app:testDebugUnitTest`；8 项 JVM 用例覆盖今天／未来／过去／空与非法快照、严格日期、夏令时及闰年／跨年。此处的 JVM 和浏览器检查不是桌面宿主或真机通知验收。

### 小组件验收（由作者执行，未真机验证）

1. 先从测试版导出备份，再更新 alpha.6；保留旧 LifeLog。长按桌面添加「日子」2×2 小组件，核对与应用 hero 相同的记录、天数、日期及分类色；同时试窄尺寸、大字体与长标题。
2. 在应用里置顶另一条记录，回桌面观察是否在 3 秒内切换；编辑标题／日期、取消置顶与删除后亦核对。记录实际延迟，不将浏览器桥测试视为宿主通过。
3. 删除所有记录，确认提示「记下第一个日子」，点击能打开应用；重新添加后恢复显示。
4. 点小组件，分别测试应用关闭、后台与前台时直达正确详情；删除记录后旧点击不得进入错误详情。多个实例均应更新。
5. 设备日期 +1 天，观察天数减 1；分别记录 30 分钟观察与重启后的结果。周期为非精确请求，省电／休眠下不承诺 30 分钟内；调整时区后也需核对本地日期。
6. 重启后确认仍显示，次日检查非精确刷新；最后一个小组件移除再添加，核对闹钟重新注册。
7. 公历与农历年度重复分别在日期跨过后打开应用，确认快照刷新到下一次日期。长期未打开时的缓存不是无限续算能力。

## alpha.5 / 阶段 E 提醒 — 2026-09-30

- `0.2.0-alpha.5-preview`，versionCode 140，独立包名不变。alpha.4 已先行发布，alpha.5 单独预发布；未真机验证通知。
- 权限清单：INTERNET、VIBRATE、POST_NOTIFICATIONS、RECEIVE_BOOT_COMPLETED、插件自身的 WAKE_LOCK，以及本应用签名级 DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION。
- 插件默认声明 SCHEDULE_EXACT_ALARM，应用用 `tools:node="remove"` 移除，并防御性移除 USE_EXACT_ALARM；最终 APK 必须不含两者。排程显式 `isExactNotification:false`、`allowWhileIdle:false`，不设 repeats，也不调用精确闹钟设置 API。
- 单应用仅本地通知，最多 64 条；年度重复只排下一次，启动／恢复应用时补排。系统休眠、省电与非精确批处理可能延迟，不能把“一分钟内送达”当作硬性通过标准。
- 提醒提前天数保存在日子／JSON v1；旧记录缺省 []。统一时间保存在 localStorage，不进备份。Web/PWA 无提醒 UI。

### 提醒真机验收（由作者执行，尚未执行）

1. 新建明天的记录，勾当天＋提前 1 天，统一时间选 09:00。设备时间设为 08:59；记录通知实际送达时刻，不保证 1 分钟内。调时间后重新打开应用使下一次按当前设备时钟重排。
2. 点击通知直达记录详情；删除该记录后点击残留通知不打开错误详情。
3. 重启后检查后续通知是否恢复，并分别测试前台、关闭应用与休眠／省电。必要的 getPending 诊断仅用于本地测试，不在发布 UI 留诊断行。
4. 拒绝权限后仍能保存选项，编辑器显示提示；到系统设置授权，再打开应用检查补排。不会自动打开精确闹钟授权页面。
5. Web 开发版／PWA 的编辑器、备份面板、卡片和详情都不出现提醒 UI。
6. APK 必须检查 POST_NOTIFICATIONS / RECEIVE_BOOT_COMPLETED 存在、两种精确权限不存在；原版签名覆盖升级仍另行验证。

## alpha.4 / 阶段 A–D — 2026-09-30

- `0.2.0-alpha.4-preview`，versionCode 139，包名 `com.cnxin.lifelog.preview`。
- 作者在本线程确认 A–D 真机验收通过；本机没有设备安装记录，不将作者验收描述成本机测试。
- 按既有预发布流程发布 `v0.2.0-alpha.4-preview`，不合并主分支、不替换旧版 LifeLog Release。
- 权限为 INTERNET、VIBRATE 与本应用签名级 DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION；不含通知或精确闹钟权限。

## 两种安装用途，不能混用

| | 独立测试版（debug） | 原应用升级版（release） |
| --- | --- | --- |
| 包名 | `com.cnxin.lifelog.preview` | `com.cnxin.lifelog` |
| 桌面名称 | 日子 · 测试版 | LifeLog · 日子 |
| 签名 | 本机 debug 签名 | 必须使用原版签名 |
| 原版数据 | 不可直接读取，导入旧版 JSON 测试 | 同签名覆盖安装后验收本机迁移 |
| 用途 | 测布局、增删改、导入导出、返回键 | 测真实升级与数据保留 |

测试版没有在原版数据库旁运行，它是另一套应用沙箱。**独立测试版通过，不等于原版覆盖升级通过。** 不要为安装新版而卸载原版、清除原版数据或临时更改正式包名。

## 本地构建入口

在 `react-app` 目录运行：

```sh
npm ci
npm run android:doctor
npm run android:preview
```

- `android:doctor` 只读检查 JDK 21、编译器、Android SDK API 36、Build Tools 35.0.0、platform-tools、Gradle wrapper 和磁盘空间，不读取签名密码。非默认 SDK 路径请设置 `ANDROID_HOME`，JDK 路径请设置 `JAVA_HOME`。
- 脚本要求项目和用户缓存所在磁盘各有至少 6 GiB 可用空间。这是保守的本地检查门槛，不是官方最低要求，也不是空间一定够用的保证。
- `android:preview` 在环境检查通过后运行 Node 单元测试、Web 生产构建、Capacitor 同步、Gradle `:app:testDebugUnitTest`、`assembleDebug` 和 `lintDebug`，再用 SDK 工具校验 APK 的包名、桌面名称、版本、合并权限和签名。校验失败不会产生新的交付副本。不自动安装到设备，不构建或发布正式版。
- 首次 Gradle 构建需要联网下载依赖；本脚本不自动安装 SDK 或代为接受 SDK 许可。
- 原始输出：`react-app/android/app/build/outputs/apk/debug/app-debug.apk`。校验后的交付副本按当前版本命名，本版为 `react-app/.artifacts/lifelog-days-0.2.0-alpha.8-preview.apk`；旁边的 `.apk.json` 记录实际包名、权限、签名验证结果、大小与 SHA-256。alpha.7 起将 APK、SHA-256 与扩展验证报告另放在仓库 `downloads/` 并随发布准备提交保留；此前的 `react-app/apk-test/` 本地副本不提交 Git。alpha.8 本地构建不代表已经推送或发布。
- Gradle 使用固定的 8.14.3 `bin` 分发包，已配置官方 SHA-256 校验，避免下载不需要的源码/文档。
- 若手工跳过脚本在 Android Studio 构建，请先完成 Web 构建和 `npx cap sync android`，避免把旧资源打进 APK。

## 覆盖升级前的硬性条件

1. 在旧版先导出**完整备份**，保留照片与回忆，不以新版「仅日子」备份代替。
2. 找到原版使用的签名密钥，安全地在本地配置已被 Git 忽略的 `android/keystore.properties`。不要生成新密钥冒充旧签名，不要在聊天中发送密钥或密码。
3. 只有这些条件满足后才构建 release。现有 Gradle 在未配置签名时可生成 unsigned APK，**构建成功本身不证明已签名**。
4. 使用 Android SDK 的 `apksigner verify --verbose --print-certs` 分别检查原版 APK 与候选 APK，验证候选签名有效，并核对原版签名证书 SHA-256；本次不涉及签名轮换。
5. 用 `apkanalyzer manifest application-id` 和 `apkanalyzer manifest version-code` 检查候选包：正式包名不变、versionCode 高于设备上已安装版本。目前源码配置为 143；仍须读取实际安装版本确认。
6. 在有备份的测试设备上执行同签名覆盖升级。签名不一致时停止，**不要通过卸载原应用来绕过**。

## 真机验收单（仍待执行）

- [ ] 测试版可与旧版并存，名称能区分，旧版仍可正常打开。
- [ ] 旧版 JSON 导入预览准确；重复导入不覆盖编辑，失败导入不写入。
- [ ] 同签名 release 覆盖升级后，本机旧人物生日和纪念日可识别；确认前不写入新版库。
- [ ] 核对原数据库的照片、回忆等旧内容仍完整；新版没有这些内容的浏览入口。
- [ ] 原生文件保存成功、取消、拒绝访问；保存的文件可再次导入。
- [ ] 返回键优先关闭弹窗，主页返回进入后台；重新进入日期和数据正常。
- [ ] 软键盘、状态栏、安全区域、大字号和深色系统设置下可操作。
- [ ] 断网冷启动和持久化；首次升级后退出并重新打开，确认没有旧 service worker 页面回退。
- [ ] 用 APK 分析工具核对合并后的实际权限；确认旧系统提醒不再触发或残留。

Android 12+ 显式通过 `dataExtractionRules` 排除云备份和自动设备迁移，较早系统也禁用自动备份。用户换机需手动导出和导入 JSON，卸载前尤其要保存备份。

旧版曾注册 `/sw.js`。新版 Android 启动时会注销自己的 worker，并只清理 `lifelog-static-*` / `lifelog-runtime-*` 缓存，不触碰 IndexedDB 或 localStorage，不强制刷新未保存编辑。已受控的页面需要关闭后才完全脱离 worker；仍需真机冷启动验证。浏览器测试只能模拟该清理过程，不能代替 Android WebView 测试。

## alpha.4 的触觉反馈权限（历史记录）

- 从 alpha.4 起，原生置顶、分段选择、日期点选、保存和确认删除提供轻微震动反馈；新增 `android.permission.VIBRATE`，由 `@capacitor/haptics` 的 Manifest 合并，不重复手写权限。
- 当时合并权限为 `INTERNET`、`VIBRATE` 和本应用签名级 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`；不包含通知、相机、存储或安装权限。alpha.5／alpha.6 的当前权限见本文顶部，不使用本节历史清单判断新包。
- `android:preview` 的 APK 权限校验仅新增允许 `VIBRATE`，其它非预期权限仍会阻止交付。
- 以下 alpha.1 / alpha.2 / alpha.3 构建记录描述旧 APK；不代表当前包的构建结果。A–D 已由作者验收；本机未执行设备验收，新增提醒与小组件仍待复测。

## 回退与提交策略

旧版本已有 Git 标签 `v0.1.0-test.135`，指向：

```text
d3b4cb73fa80463cefb57edacea39a5cc59def4c
```

已核对与重构前 HEAD 相同，无需再建重复标签。之后把重构提交到 `codex/anniversary-lite`，经审查和升级验收后再合并主分支；不需要另建 GitHub 仓库。

该标签是**源码回退点**，不意味着 Android 允许直接安装低版本 APK。不要在当前有未提交修改的工作区强行切回旧版本，也不要以卸载重装作为数据回退方案。

## 2026-09-29 本机构建环境

之前的磁盘不足问题已解除。本次在用户目录内配置工具链，没有改动全局 shell 配置，也没有安装完整 Android Studio。

- JDK：Temurin 21.0.12.1，Apple Silicon 版本；下载包已按官方 API 提供的 SHA-256 校验。
- SDK：API 36、Build Tools 35.0.0、platform-tools，安装在 `~/Library/Android/sdk`。
- 新终端运行以下命令后即可复用本机环境（此文件不在 Git 仓库中）：

```sh
source "$HOME/.local/share/lifelog-android/env.sh"
cd /path/to/lifelog/react-app
npm run android:doctor
npm run android:preview
```

其他机器需自行安装工具并设置 `JAVA_HOME` / `ANDROID_HOME`，不要复制这台机器的绝对路径。

原版签名文件仍未配置。独立测试 APK 使用自动生成的本机 debug 签名，不是正式升级包。仅通过 `v0.2.0-alpha.1-preview` 预发布版分发独立测试 APK，不合并主分支、不替换旧版发布。

### alpha.1 历史验证结果

- `npm run android:preview` 完整通过，包括 27 项 Node 测试、Web 构建、Capacitor 同步、真实 Gradle `assembleDebug` 和 `lintDebug`。
- APK：`react-app/.artifacts/lifelog-days-0.2.0-alpha.1-preview.apk`，4,651,929 字节。
- SHA-256：`1a321165ce9ac8523a8fd3e510fa3b729b44f9dda7469595330bfbccc71a337c`（此本地构建；之后重新构建请以同名 JSON 报告为准）。
- SDK `apksigner verify` 成功：本机 Android Debug 证书，APK v2 签名。它不是原应用的正式签名。
- 实际合并权限只有 `INTERNET` 及 AndroidX 使用的本应用签名级 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`；无通知、相机、存储或应用安装权限。
- 17 个打包的 Web 文件与本轮生产构建逐字节一致；打包的 Capacitor 配置也一致。
- Android lint：**0 错误、26 条警告**。已修复 Manifest 顺序与显式数据备份策略提示；剩余为旧图标/启动图、静态扫描认为未使用的资源以及依赖更新提示等，未通过全局屏蔽来隐藏。报告在 `react-app/android/app/build/reports/lint-results-debug.html`。
- 生产预览浏览器回归、无障碍扫描和离线/旧缓存清理测试重新通过。
- `adb devices -l` 未发现连接设备。**没有安装到手机，也没有运行真机或模拟器验收；原签名覆盖升级仍待验证。**
- 已删除本次下载的 JDK、命令行工具和 Gradle 临时压缩包，保留已安装工具链、Gradle 构建缓存及下载校验信息。

### 手机测试顺序

1. 把上述 APK 传到 Android 手机，安装「日子 · 测试版」，保留旧 LifeLog，不卸载、不清数据。
2. 在旧版导出完整备份，再在测试版「数据与备份 → 导入备份」中选择 JSON，查看预览后确认。独立测试版的「从本机旧版迁移」无法跨应用沙箱读取原版，这是预期行为。
3. 试用新增/编辑/删除、公历/农历年度重复、置顶、搜索，退出后重开核对持久化。
4. 测试原生文件保存成功和取消、再导入、返回键、软键盘和断网冷启动。
5. 测试结果确认后，再准备原签名 release 覆盖升级；不把此 preview 包当作正式版替代品。

## alpha.3 预发布验收（2026-09-30）

- 版本：`0.2.0-alpha.3-preview`，Android `versionCode 138`；独立包名仍为 `com.cnxin.lifelog.preview`。
- 新增带农历、节日和节气的月历，以及编辑器内联日期选择器；统一分类单选控件，每年重复和置顶仍为勾选框。修正移动端排序、长标题、桌面卡片对齐、大字号及弹窗按钮布局。
- `android:doctor` 与 `android:preview` 通过：36 项 Node 测试、Web 生产构建、Capacitor 同步、Gradle `assembleDebug` 和 `lintDebug`。Android lint 为 **0 错误、26 条警告**。
- APK：`react-app/.artifacts/lifelog-days-0.2.0-alpha.3-preview.apk`，4,363,446 字节。
- SHA-256：`50ebfa12309b3c127bfafd81edb2596035af0221e3bad9322b8aedbfc5436b2f`。重新构建时请以实际生成的 JSON 验证报告为准。
- APK 签名验证成功，证书 SHA-256 与 GitHub 已发布的 alpha.2 APK 一致（`421f87cd5fd65111cf35b7a63e31300aa14d8a9c3e39103b9b5a28c82f11eb52`）。包名不变且版本号递增，支持更新现有测试版，无需卸载；更新前仍应导出备份。
- APK 内 16 个 Web 文件与本轮生产构建逐字节一致。合并权限仍只有 `INTERNET` 和本应用签名级 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`。
- 浏览器回归覆盖控件、农历月历、日期选择器、全局 UI、顶部栏、数据增删改与备份、离线持久化及旧缓存清理。
- **未进行真机或模拟器安装验收**。本版仍使用 debug 签名，不是原 LifeLog 正式升级包，不能跨沙箱直接读取旧版数据。保留旧 LifeLog，先备份再导入；不要卸载原版或清除数据。
- 在 `codex/anniversary-lite` 分支通过 `v0.2.0-alpha.3-preview` 预发布分发，不合并主分支，不替换旧版发布。
