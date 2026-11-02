import sharp from 'sharp';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'fs';

const FAVICON_FILES = [
  'favicon-48.png',
  'favicon-192.png',
  'favicon-512.png',
];

function isWhite(r, g, b) {
  return r > 210 && g > 210 && b > 210;
}

function isDarkTextPixel(r, g, b) {
  return r < 90 && g < 90 && b < 90;
}

function isOrange(r, g, b) {
  return r > 180 && g > 40 && g < 180 && b < 130 && r > g + 40;
}

async function updateLogo(inputFile) {
  const pngBuffer = await sharp(inputFile).png().toBuffer();
  const image = await loadImage(pngBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let orange = null;
  const y0 = Math.floor(height * 0.42);
  const y1 = Math.floor(height * 0.62);

  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isWhite(r, g, b)) continue;
      if (isDarkTextPixel(r, g, b) || isOrange(r, g, b)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (!orange && isOrange(r, g, b)) orange = [r, g, b];
      }
    }
  }

  if (maxX <= minX) {
    throw new Error(`No wordmark pixels found in ${inputFile}`);
  }

  const textMinX = minX;
  const textMinY = minY;
  const textMaxX = maxX;
  const textMaxY = maxY;
  const padX = 14;
  const padY = 16;
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(width - 1, maxX + padX);
  maxY = Math.min(height - 1, maxY + padY);

  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxRadius = Math.ceil(Math.hypot(cx, cy));
  const buckets = Array.from({ length: maxRadius + 1 }, () => [0, 0, 0, 0]);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) continue;
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isWhite(r, g, b) || isDarkTextPixel(r, g, b) || isOrange(r, g, b)) continue;
      const radius = Math.round(Math.hypot(x - cx, y - cy));
      const bucket = buckets[radius];
      bucket[0] += r;
      bucket[1] += g;
      bucket[2] += b;
      bucket[3] += 1;
    }
  }

  for (let radius = 0; radius <= maxRadius; radius++) {
    if (buckets[radius][3] > 0) continue;
    let left = radius - 1;
    let right = radius + 1;
    while (left >= 0 && buckets[left][3] === 0) left -= 1;
    while (right <= maxRadius && buckets[right][3] === 0) right += 1;
    const source = left >= 0 ? buckets[left] : buckets[right];
    if (source && source[3] > 0) buckets[radius] = source;
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = (y * width + x) * 4;
      if (isWhite(data[i], data[i + 1], data[i + 2])) continue;
      const radius = Math.min(maxRadius, Math.round(Math.hypot(x - cx, y - cy)));
      const bucket = buckets[radius];
      const count = Math.max(1, bucket[3]);
      data[i] = Math.round(bucket[0] / count);
      data[i + 1] = Math.round(bucket[1] / count);
      data[i + 2] = Math.round(bucket[2] / count);
      data[i + 3] = 255;
    }
  }

  const boxWidth = textMaxX - textMinX;
  const centerX = (textMinX + textMaxX) / 2;
  const centerY = (textMinY + textMaxY) / 2;

  ctx.putImageData(imageData, 0, 0);

  const orangeCss = orange
    ? `rgb(${orange[0]},${orange[1]},${orange[2]})`
    : '#f15a24';

  let fontSize = Math.round((textMaxY - textMinY) * 0.92);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const label = 'LipaHub.online';
  let nameWidth = 0;
  while (fontSize > 20) {
    ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
    nameWidth = ctx.measureText(label).width;
    if (nameWidth <= boxWidth) break;
    fontSize -= 1;
  }

  const startX = centerX - nameWidth / 2;
  const name = 'LipaHub';
  ctx.fillStyle = '#000000';
  ctx.fillText(name, startX, centerY);
  ctx.fillStyle = orangeCss;
  ctx.fillText('.online', startX + ctx.measureText(name).width, centerY);

  return canvas.toBuffer('image/png');
}

const outDir = 'scripts/logo-out';
mkdirSync(outDir, { recursive: true });

const masterPng = await updateLogo('denichat-logo.webp');
const webp = await sharp(masterPng).webp({ quality: 92 }).toBuffer();
writeFileSync(`${outDir}/denichat-logo.webp`, webp);
console.log(`Wrote ${outDir}/denichat-logo.webp`);

for (const favicon of FAVICON_FILES) {
  const size = Number(favicon.match(/(\d+)/)[1]);
  const out = await sharp(masterPng).resize(size, size).png().toBuffer();
  writeFileSync(`${outDir}/${favicon}`, out);
  console.log(`Wrote ${outDir}/${favicon}`);
}

const png48 = await sharp(masterPng).resize(48, 48).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 48;
header[7] = 48;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png48.length, 14);
header.writeUInt32LE(22, 18);
writeFileSync(`${outDir}/favicon.ico`, Buffer.concat([header, png48]));
console.log(`Wrote ${outDir}/favicon.ico`);
