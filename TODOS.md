# Design TODOs

## 1. 建立 DESIGN.md
**What:** 创建正式设计系统文档，集中管理色彩、字体、组件、间距规范
**Why:** 当前设计规范分散在设计文档中，新组件设计时缺少统一参考
**Pros:** 统一设计语言，减少组件设计决策时间，新开发者快速理解设计规范
**Cons:** 需要从设计文档和 cc-haha globals.css 中提取整理
**Context:** 从 cc-haha globals.css 提取 CSS 变量，结合本项目的字体层级和组件规范
**Depends on:** 无

## 2. 无障碍测试计划
**What:** 制定 WCAG AA 合规性测试计划，包括 axe-core 自动测试和手动测试清单
**Why:** 已定义 ARIA 规范和键盘快捷键，但需要在实现后验证合规性
**Pros:** 确保所有用户可用，符合无障碍法规要求
**Cons:** 需要额外测试时间，可能发现需要修改的组件
**Context:** 键盘导航（12个快捷键）、ARIA 地标、流式输出 aria-live、颜色对比度验证
**Depends on:** UI 实现完成
