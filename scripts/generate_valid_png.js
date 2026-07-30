const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makeCompliantPNG(width, height, bgR, bgG, bgB, fgR, fgG, fgB) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk (13 bytes)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type 6 (RGBA)
  ihdrData[10] = 0; // Compression method 0
  ihdrData[11] = 0; // Filter method 0
  ihdrData[12] = 0; // Interlace method 0
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk data
  const scanlineSize = 1 + width * 4;
  const rawScanlines = Buffer.alloc(height * scanlineSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineSize;
    rawScanlines[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const isInnerSquare =
        x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75;

      if (isInnerSquare) {
        rawScanlines[pixelOffset] = fgR;
        rawScanlines[pixelOffset + 1] = fgG;
        rawScanlines[pixelOffset + 2] = fgB;
        rawScanlines[pixelOffset + 3] = 255; // Alpha
      } else {
        rawScanlines[pixelOffset] = bgR;
        rawScanlines[pixelOffset + 1] = bgG;
        rawScanlines[pixelOffset + 2] = bgB;
        rawScanlines[pixelOffset + 3] = 255; // Alpha
      }
    }
  }

  const compressedIDAT = zlib.deflateSync(rawScanlines);
  const idatChunk = makeChunk('IDAT', compressedIDAT);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 8) : c >>> 8;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Background #0b1c30 (11, 28, 48), Foreground #6366f1 (99, 102, 241)
fs.writeFileSync(path.join(iconsDir, 'icon-96.png'), makeCompliantPNG(96, 96, 11, 28, 48, 99, 102, 241));
fs.writeFileSync(path.join(iconsDir, 'icon-144.png'), makeCompliantPNG(144, 144, 11, 28, 48, 99, 102, 241));
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), makeCompliantPNG(192, 192, 11, 28, 48, 99, 102, 241));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), makeCompliantPNG(512, 512, 11, 28, 48, 99, 102, 241));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), makeCompliantPNG(192, 192, 11, 28, 48, 99, 102, 241));
fs.writeFileSync(path.join(iconsDir, 'screenshot-wide.png'), makeCompliantPNG(1280, 720, 11, 28, 48, 99, 102, 241));
fs.writeFileSync(path.join(iconsDir, 'screenshot-mobile.png'), makeCompliantPNG(750, 1334, 11, 28, 48, 99, 102, 241));

console.log('Flawlessly generated RGBA PNG icon suite and screenshots.');
