<div align="center">

<img src="assets/banner.svg" alt="乌木智书" width="800"/>

# 乌木智书 · WUMU AI Novel Studio

**AI 驱动的智能小说创作工作室**

[![版本](https://img.shields.io/badge/version-0.1.0-667eea?style=flat-square)](https://github.com/ziwalia/WUMU-AI-Novel-Studio/releases)
[![平台](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Web-764ba2?style=flat-square)]()
[![许可](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24243e?style=flat-square&logo=tauri)](https://tauri.app)

[功能特性](#-功能特性) · [安装](#-安装) · [使用指南](#-使用指南) · [技术栈](#-技术栈) · [开发](#-开发)

</div>

---

## 📖 项目简介

乌木智书是一款 AI 驱动的小说创作工具，帮助作者从构思到成稿完成一整部小说的创作。通过智能化的向导流程，你可以专注于创意和故事本身，让 AI 协助你完成从大纲到定稿的全过程。

## ✨ 功能特性

### 🎯 智能创作向导

从零开始，逐步引导完成一部完整的小说创作：

```
项目信息 → 角色设定 → 世界观构建 → 卷章架构 → 章节蓝图
    → 初稿生成 → 审校改写 → 定稿 → 导出
```

### 🤖 AI 全自动生成

设置好小说名称和类型后，一键启动全自动生成：
- 自动完成全部章节的初稿、审校、定稿
- 支持设置 1-5 轮审校改写
- 全自动执行全局审核并打分

### 👥 角色与世界管理

- 多角色创建与管理（性格、外貌、能力、关系网）
- 世界观设定（地理、历史、规则体系）
- 角色能力自动追踪

### 📝 章节审校与改写

- AI 智能审校，输出详细审校意见
- 根据审校意见逐项改写优化
- 支持多轮迭代打磨

### 📤 多格式导出

- 支持 TXT 纯文本导出
- 按章节结构化输出
- 一键下载完整小说

### 🎨 更多特性

- 🌗 亮色 / 暗色主题切换
- 🔌 支持多种 LLM 接入（OpenAI 兼容接口）
- 💾 项目本地存储，数据安全
- 🖥️ 桌面端 + 网页端双模式运行

---

## 📥 安装

### 桌面版（推荐）

前往 [Releases 页面](https://github.com/ziwalia/WUMU-AI-Novel-Studio/releases/latest) 下载最新安装包：

| 文件 | 适用系统 | 说明 |
|------|----------|------|
| `WUMU AI Novel_x64-setup.exe` | Windows | NSIS 安装包，双击安装 |
| `WUMU AI Novel_x64_en-US.msi` | Windows | MSI 安装包，适合企业部署 |

### 网页版

无需安装，直接在浏览器中访问即可使用。

---

## 📚 使用指南

### 1. 配置 AI 模型

首次使用需要配置 LLM 接口：

1. 点击右上角 ⚙️ **设置** 按钮
2. 选择 LLM 提供商（支持 OpenAI 兼容接口）
3. 填入 API 地址和密钥
4. 选择模型
5. 点击 **测试连接** 确认可用

### 2. 创建新项目

1. 点击左侧 **新建项目**
2. 填写小说名称和类型
3. 系统自动创建项目并进入创作向导

### 3. 手动创作流程

按左侧步骤栏依次进行：

| 步骤 | 说明 |
|------|------|
| **项目信息** | 填写小说名称、类型、简介、风格偏好 |
| **角色设定** | 创建角色，定义性格、外貌、能力、人际关系 |
| **世界观** | 构建故事背景、地理、历史、规则体系 |
| **卷章架构** | 规划分卷和章节，设定每章字数目标 |
| **章节蓝图** | 为每章生成详细大纲和关键情节点 |
| **初稿生成** | AI 根据蓝图生成章节初稿 |
| **审校改写** | AI 审校并输出意见，支持多轮改写 |
| **定稿** | 确认最终文本 |
| **导出** | 下载完成的小说文件 |

### 4. 全自动生成

填写完小说名称和类型后，点击项目信息页底部的 **全自动生成** 按钮：

1. 设置审校改写轮数（1-5 轮，默认 1 轮）
2. 点击开始，系统自动完成全部章节的生成、审校、定稿
3. 自动执行全局审核并打分

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript |
| **构建工具** | Vite 6 |
| **CSS 框架** | Tailwind CSS 4 |
| **状态管理** | Zustand 5 |
| **桌面框架** | Tauri v2 (Rust) |
| **测试** | Vitest |

---

## 💻 开发

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) (桌面版开发)
- [Tauri CLI](https://tauri.app/guides/prerequisites/)

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/ziwalia/WUMU-AI-Novel-Studio.git
cd WUMU-AI-Novel-Studio

# 安装依赖
npm install

# 网页版开发模式
npm run dev

# 桌面版开发模式
npm run tauri dev
```

### 构建

```bash
# 构建前端
npm run build

# 构建桌面安装包
npm run tauri build
```

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<div align="center">

**乌木智书** — 让 AI 成为你的创作伙伴

⭐ 如果这个项目对你有帮助，欢迎 Star 支持

</div>
