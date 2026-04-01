const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const pkg = require('../package.json')
const version = pkg.version
const releaseDir = path.join(__dirname, '..', 'release')

function sha256(filePath) {
  const data = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(data).digest('hex')
}

function fileSize(filePath) {
  return fs.statSync(filePath).size
}

function findFile(pattern) {
  const files = fs.readdirSync(releaseDir)
  return files.find(f => f.match(pattern))
}

const artifacts = {
  'mac-arm64': findFile(new RegExp(`Aurum-${version.replace(/\./g, '\\.')}-arm64\\.dmg$`)),
  'mac-arm64-zip': findFile(new RegExp(`Aurum-${version.replace(/\./g, '\\.')}-arm64-mac\\.zip$`)),
  'mac': findFile(new RegExp(`Aurum-${version.replace(/\./g, '\\.')}(?!.*arm64)\\.dmg$`)),
  'mac-zip': findFile(new RegExp(`Aurum-${version.replace(/\./g, '\\.')}(?!.*arm64).*-mac\\.zip$`)),
}

const platforms = {}
const hashLines = []

for (const [key, filename] of Object.entries(artifacts)) {
  if (!filename) continue
  const filePath = path.join(releaseDir, filename)
  const hash = sha256(filePath)
  const size = fileSize(filePath)
  platforms[key] = { sha256: hash, size }
  hashLines.push(`${hash}  ${filename}`)
}

const latestJson = {
  version,
  releaseDate: new Date().toISOString(),
  releaseNotes: 'Bug fixes and improvements.',
  platforms,
}

fs.writeFileSync(path.join(releaseDir, 'latest.json'), JSON.stringify(latestJson, null, 2))
fs.writeFileSync(path.join(releaseDir, 'hashes.txt'), hashLines.join('\n') + '\n')

console.log(`Generated latest.json and hashes.txt for v${version}`)
console.log(JSON.stringify(latestJson, null, 2))
