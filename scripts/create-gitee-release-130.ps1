# 创建 Gitee Release：v0.1.0-test.130
# 用法（PowerShell）：
#   $env:GITEE_TOKEN = "你的私人令牌"
#   powershell -ExecutionPolicy Bypass -File .\scripts\create-gitee-release-130.ps1
#
# 私人令牌权限需要：projects（仓库）读写
# 申请：https://gitee.com/profile/personal_access_tokens

$ErrorActionPreference = "Stop"

$owner = "ysjugg"
$repo = "lifelog"
$tag = "v0.1.0-test.130"
$version = "0.1.0-test.130"
$apkName = "lifelog-v$version.apk"

$token = $env:GITEE_TOKEN
if (-not $token) {
  throw "缺少环境变量 GITEE_TOKEN。请先设置：`$env:GITEE_TOKEN = '你的私人令牌'"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repoRoot "downloads\$apkName"))) {
  # 允许脚本放在 react-app/scripts 或 repo/scripts
  $repoRoot = Split-Path -Parent $repoRoot
}
$apkPath = Join-Path $repoRoot "downloads\$apkName"
if (-not (Test-Path $apkPath)) {
  throw "找不到 APK：$apkPath"
}

$bodyText = @"
## 工程可维护性、暗色主题与冷启动体验

### 工程
- 首页拆为 Home.tsx + homeHelpers.tsx，降低单文件改动成本
- 页面样式巨石 07-pages.css 按域拆到 styles/pages/07a–07f
- LifeLogContext 抽出类型定义与 Notion/合并辅助函数
- 钉死 lucide-react@1.14.0，避免 latest 导致发版不可复现
- 本地数据启动增加 8 秒超时兜底；字体改为非阻塞加载

### 界面
- 冷启动与路由懒加载改用卡片骨架屏
- 顶栏改为 sticky 浮层材质（blur + 渐隐底边），支持 reduced-transparency
- 暗色模式为 classic / cream / mint / mist 补齐独立 token
- 人物 / 地点 / 回忆列表在条目较多时启用窗口渲染

### 校验
- APK：$apkName
- 大小：4108085 bytes
- SHA256：c7b0f30f3690fbbd398556544e73bbc1e2106234bdf21e57608103c315d48589

下载（仓库 raw 镜像）：
https://gitee.com/$owner/$repo/raw/main/downloads/$apkName
"@

$createUri = "https://gitee.com/api/v5/repos/$owner/$repo/releases"
$createBody = @{
  access_token = $token
  tag_name = $tag
  name = $tag
  body = $bodyText
  target_commitish = "main"
  prerelease = $false
}

Write-Host "==> 创建 Gitee Release $tag"
$createResponse = Invoke-RestMethod -Method Post -Uri $createUri -Body $createBody -ContentType "application/x-www-form-urlencoded"
$releaseId = $createResponse.id
if (-not $releaseId) {
  throw "创建 Release 失败：未返回 id。响应：$(($createResponse | ConvertTo-Json -Depth 6))"
}
Write-Host "Release id: $releaseId"
Write-Host "Release url: $($createResponse.html_url)"

$uploadUri = "https://gitee.com/api/v5/repos/$owner/$repo/releases/$releaseId/attach_files?access_token=$token"
Write-Host "==> 上传附件 $apkName"
# multipart upload
$form = @{
  file = Get-Item -LiteralPath $apkPath
}
$uploadResponse = Invoke-RestMethod -Method Post -Uri $uploadUri -Form $form
Write-Host "附件上传完成"
Write-Host (($uploadResponse | ConvertTo-Json -Depth 6))

Write-Host ""
Write-Host "Gitee Release 已就绪："
Write-Host "https://gitee.com/$owner/$repo/releases/tag/$tag"
Write-Host "APK raw："
Write-Host "https://gitee.com/$owner/$repo/raw/main/downloads/$apkName"
