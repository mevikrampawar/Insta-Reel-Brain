// Generate simple PNG icons for PWA
// Run: node scripts/generate-icons.js

const fs = require('fs')
const path = require('path')

// Minimal PNG encoder (no dependencies)
function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8  // bit depth
  ihdrData[9] = 2  // color type (RGB)
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace
  const ihdr = createChunk('IHDR', ihdrData)

  // IDAT chunk (raw image data with zlib)
  const rawData = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 3 + 1)] = 0 // filter byte (none)
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 3 + 1) + 1 + x * 3
      // Create a rounded rectangle pattern
      const cx = width / 2
      const cy = height / 2
      const cornerR = width * 0.15
      const dx = Math.abs(x - cx)
      const dy = Math.abs(y - cy)
      const inRect = dx <= cx - cornerR || dy <= cy - cornerR ||
        (dx - (cx - cornerR)) ** 2 + (dy - (cy - cornerR)) ** 2 <= cornerR ** 2
      if (inRect) {
        rawData[offset] = r
        rawData[offset + 1] = g
        rawData[offset + 2] = b
      } else {
        rawData[offset] = 9   // #09090b background
        rawData[offset + 1] = 9
        rawData[offset + 2] = 11
      }
    }
  }
  const zlib = require('zlib')
  const compressed = zlib.deflateSync(rawData)
  const idat = createChunk('IDAT', compressed)

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

function createChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeBuffer, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcData), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

const outDir = path.join(__dirname, '..', 'public')

// Generate icons at different sizes
// Indigo gradient: #6366f1 = (99, 102, 241)
const icons = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
]

for (const { name, size } of icons) {
  const png = createPNG(size, size, 99, 102, 241)
  const outPath = path.join(outDir, name)
  fs.writeFileSync(outPath, png)
  console.log(`Created ${name} (${png.length} bytes)`)
}

console.log('Done! Icons created in public/')
