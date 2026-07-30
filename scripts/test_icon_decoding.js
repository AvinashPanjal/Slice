const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const filePath = path.join(__dirname, '..', 'public', 'icons', 'icon-96.png');
const buf = fs.readFileSync(filePath);

console.log('PNG Header:', buf.subarray(0, 8));

let offset = 8;
while (offset < buf.length) {
  const length = buf.readUInt32BE(offset);
  const type = buf.toString('ascii', offset + 4, offset + 8);
  const data = buf.subarray(offset + 8, offset + 8 + length);
  const crc = buf.readUInt32BE(offset + 8 + length);
  console.log(`Chunk: ${type}, length: ${length}, crc: 0x${crc.toString(16)}`);
  offset += 12 + length;
}
