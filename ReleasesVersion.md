# 乌木智书 版本发布教程

## 一、版本号说明

采用语义化版本 (SemVer)：`主版本.次版本.修订号`，例如 `1.2.3`

| 版本号 | 含义 | 何时递增 |
|--------|------|----------|
| 主版本 (Major) | 重大架构变更、不兼容改动 | 大规模重构、API 不兼容变更 |
| 次版本 (Minor) | 新功能、向后兼容更新 | 添加新功能、新步骤、新能力 |
| 修订号 (Patch) | Bug 修复、小优化 | 修复问题、性能优化、UI 微调 |

**当前阶段使用 `0.x.y`**，功能稳定后发布 `1.0.0`。

---

## 二、版本号定义位置

**只需修改一个文件：`version.json`**

```json
{
  "version": "0.2.0",
  "changelog": "新增全自动生成功能，修复定稿文本开头多余内容"
}
```

运行同步命令后，版本号会自动写入以下三个文件：

| 文件 | 用途 |
|------|------|
| `package.json` | 前端构建 |
| `src-tauri/tauri.conf.json` | Tauri 打包/安装程序 |
| `src-tauri/Cargo.toml` | Rust 编译 |

---

## 三、发布流程（完整步骤）

### 前提条件

- 已安装 Node.js 和 Rust
- 已登录 GitHub CLI（`gh auth login`）
- 所有代码改动已测试通过

### 步骤 1：修改版本号

编辑项目根目录的 `version.json`：

```json
{
  "version": "0.2.0",
  "changelog": "具体更新内容描述"
}
```

### 步骤 2：同步版本号

```bash
npm run version:sync
```

此命令会自动将版本号同步到 `package.json`、`tauri.conf.json`、`Cargo.toml`。

### 步骤 3：提交代码

```bash
git add .
git commit -m "release: v0.2.0"
```

### 步骤 4：创建 Git 标签

```bash
git tag v0.2.0
```

### 步骤 5：推送到 GitHub

```bash
git push origin main
git push origin v0.2.0
```

### 步骤 6：构建桌面版安装包

```bash
npm run tauri build
```

构建完成后，安装包在以下位置：

| 平台 | 文件路径 |
|------|----------|
| Windows | `src-tauri/target/release/bundle/msi/*.msi` |
| Windows | `src-tauri/target/release/bundle/nsis/*.exe` |
| macOS | `src-tauri/target/release/bundle/dmg/*.dmg` |

### 步骤 7：在 GitHub 创建 Release

**方式 A：使用 GitHub CLI（推荐）**

```bash
gh release create v0.2.0 \
  src-tauri/target/release/bundle/msi/*.msi \
  src-tauri/target/release/bundle/nsis/*.exe \
  --title "v0.2.0" \
  --notes "$(cat version.json | node -e \"process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')).changelog)\")"
```

**方式 B：在 GitHub 网页操作**

1. 打开 `https://github.com/你的用户名/Abook/releases`
2. 点击 "Draft a new release"
3. 选择标签 `v0.2.0`
4. 填写标题和更新说明
5. 上传构建好的安装包文件
6. 点击 "Publish release"

### 步骤 8：部署网页版（如适用）

```bash
npm run build
# 将 dist/ 目录部署到你的 Web 服务器
```

---

## 四、快速发布（一键脚本）

如果你想简化流程，可以按以下顺序执行：

```bash
# 1. 编辑 version.json 修改版本号
# 2. 执行以下命令：
npm run version:sync && \
git add -A && \
git commit -m "release: v$(node -p \"require('./version.json').version\")" && \
git tag "v$(node -p \"require('./version.json').version\")"
# 3. 推送：
git push origin main && git push origin "v$(node -p \"require('./version.json').version\")"
# 4. 构建并发布：
npm run tauri build
# 5. 上传到 GitHub Releases
```

---

## 五、版本检查工作原理

### 桌面版

- 应用启动时，Tauri 更新器检查 GitHub Releases
- 发现新版本 → 弹窗提示 → 用户点击更新 → 自动下载安装 → 重启
- 版本号显示在左上角 Logo 右侧

### 网页版

- 页面加载时，前端请求 GitHub API 获取最新版本号
- 与当前版本比对，有新版本 → 页面顶部显示蓝色横幅
- 横幅提供"刷新页面"和"下载桌面版"两个选项
- 每 30 分钟检查一次（避免频繁请求）

---

## 六、常见问题

### Q: 版本号忘记同步怎么办？

重新运行 `npm run version:sync` 即可，脚本会覆盖写入三个配置文件。

### Q: 如何撤销已发布的版本？

```bash
gh release delete v0.2.0
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0
```

### Q: 构建失败怎么办？

1. 检查 Rust 工具链是否最新：`rustup update`
2. 检查 Node 依赖：`npm install`
3. 清理后重试：删除 `src-tauri/target` 目录后重新构建

### Q: 网页版检测不到新版本？

- 确认 GitHub Release 已发布且为 latest（非 draft/prerelease）
- GitHub API 有缓存，可能需要几分钟生效
- 检查浏览器控制台网络请求是否正常

---

## 七、文件清单

| 文件 | 说明 |
|------|------|
| `version.json` | 版本号唯一来源（开发者只改这个） |
| `scripts/sync-version.js` | 版本同步脚本 |
| `src/vite-env.d.ts` | 版本号 TypeScript 声明 |
| `src/services/updateService.ts` | 网页版更新检测服务 |
| `src/components/shared/UpdateBanner.tsx` | 网页版更新提示横幅 |
| `src/components/layout/TitleBar.tsx` | 标题栏（显示版本号） |
