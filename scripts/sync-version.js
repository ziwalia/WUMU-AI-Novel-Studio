#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// 读取 version.json 作为唯一版本源
const versionFile = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf-8'))
const version = versionFile.version

console.log(`同步版本号: ${version}`)

// 1. 更新 package.json
const pkgPath = resolve(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
pkg.version = version
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`  ✓ package.json`)

// 2. 更新 tauri.conf.json
const tauriPath = resolve(root, 'src-tauri', 'tauri.conf.json')
const tauri = JSON.parse(readFileSync(tauriPath, 'utf-8'))
tauri.version = version
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n')
console.log(`  ✓ tauri.conf.json`)

// 3. 更新 Cargo.toml
const cargoPath = resolve(root, 'src-tauri', 'Cargo.toml')
let cargo = readFileSync(cargoPath, 'utf-8')
cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`)
writeFileSync(cargoPath, cargo)
console.log(`  ✓ Cargo.toml`)

console.log(`\n版本同步完成: v${version}`)
