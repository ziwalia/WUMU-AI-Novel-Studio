#!/usr/bin/env node
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// 读取版本号
const versionFile = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf-8'))
const version = versionFile.version
const changelog = versionFile.changelog
const tag = `v${version}`

console.log('========================================')
console.log(`  乌木智书 发布脚本`)
console.log(`  版本: ${tag}`)
console.log(`  说明: ${changelog}`)
console.log('========================================')
console.log()

// 检查是否有未提交的改动
const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' })
if (!status.trim()) {
  console.log('⚠ 没有检测到文件改动，请先修改代码或 version.json')
  process.exit(1)
}

// 显示将要提交的文件
console.log('📋 将要提交的文件：')
console.log(status.trim())
console.log()

// 步骤 1：同步版本号
console.log('📌 步骤 1/5：同步版本号...')
execSync('node scripts/sync-version.js', { cwd: root, stdio: 'inherit' })

// 步骤 2：添加所有改动到暂存区
console.log('\n📌 步骤 2/5：添加文件到暂存区 (git add .)...')
execSync('git add .', { cwd: root, stdio: 'inherit' })

// 步骤 3：提交到本地仓库
console.log('\n📌 步骤 3/5：提交到本地仓库...')
execSync(`git commit -m "release: ${tag}"`, { cwd: root, stdio: 'inherit' })

// 步骤 4：打版本标签
console.log('\n📌 步骤 4/5：打版本标签...')
try {
  execSync(`git tag ${tag}`, { cwd: root, stdio: 'inherit' })
  console.log(`  ✓ 标签 ${tag} 创建成功`)
} catch {
  console.log(`  ⚠ 标签 ${tag} 可能已存在，跳过`)
}

// 步骤 5：推送到 GitHub
console.log('\n📌 步骤 5/5：推送到 GitHub...')
console.log('  推送代码...')
execSync('git push origin main', { cwd: root, stdio: 'inherit' })
console.log('  推送标签...')
execSync(`git push origin ${tag}`, { cwd: root, stdio: 'inherit' })

console.log('\n========================================')
console.log(`  ✓ 发布完成！`)
console.log(`  版本: ${tag}`)
console.log(`  下一步：`)
console.log(`  1. 运行 npm run tauri build 构建安装包`)
console.log(`  2. 到 GitHub Releases 页面上传安装包`)
console.log('========================================')
