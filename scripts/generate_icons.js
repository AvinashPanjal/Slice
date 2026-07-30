const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makePNG(width, height, r, g, b) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 2; // Color type 2 (RGB)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      const isInnerSquare =
        x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75;
      if (isInnerSquare) {
        rawData[pixelOffset] = 99;   // R
        rawData[pixelOffset + 1] = 102; // G
        rawData[pixelOffset + 2] = 241; // B
      } else {
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const crc = crc32(chunk.slice(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return ~c;
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 8) : c >>> 8;
  }
  crcTable[n] = c;
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-96.png'), makePNG(96, 96, 11, 28, 48));
fs.writeFileSync(path.join(iconsDir, 'icon-144.png'), makePNG(144, 144, 11, 28, 48));
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), makePNG(192, 192, 11, 28, 48));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), makePNG(512, 512, 11, 28, 48));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), makePNG(192, 192, 11, 28, 48));
fs.writeFileSync(path.join(iconsDir, 'screenshot-wide.png'), makePNG(1280, 720, 11, 28, 48));
fs.writeFileSync(path.join(iconsDir, 'screenshot-mobile.png'), makePNG(750, 1334, 11, 28, 48));

console.log('Successfully generated full PWA icon suite & screenshots in public/icons/');
