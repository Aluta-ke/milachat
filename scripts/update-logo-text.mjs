import sharp from 'sharp';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';

const LOGO_FILES = [
  'denichat-logo.webp',
  'assets/denichat-logo-CnMczFfq.webp',
];

const FAVICON_FILES = [
  'favicon-48.png',
  'favicon-192.png',
  'favicon-512.png',
];

function isOrange(r, g, b) {
  return r > 180 && g > 50 && g < 170 && b < 120;
}

function isWhite(r, g, b) {
  return r > 210 && g > 210 && b > 210;
}

function isDarkTextPixel(r, g, b) {
  return r < 130 && g < 130 && b < 130;
}

function sampleBackground(data, width, x, y) {
  for (const offset of [22, 20, 18, 24, 16, 26]) {
    const sy = y - offset;
    if (sy < 0) continue;
    const i = (sy * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (g > 130 && r < 160 && !isWhite(r, g, b)) return [r, g, b];
  }
  return [85, 219, 123];
}

async function updateLogo(inputFile, outputFile) {
  const pngBuffer = await sharp(inputFile).png().toBuffer();
  const image = await loadImage(pngBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const { data, width } = imageData;

  const erase = () => {
    for (let y = 516; y <= 552; y++) {
      for (let x = 378; x <= 558; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (isOrange(r, g, b) || isWhite(r, g, b) || !isDarkTextPixel(r, g, b)) {
          continue;
        }

        const [br, bg, bb] = sampleBackground(data, width, x, y);
        data[i] = br;
        data[i + 1] = bg;
        data[i + 2] = bb;
        data[i + 3] = 255;
      }
    }
  };

  erase();
  erase();

  ctx.putImageData(imageData, 0, 0);

  ctx.font = 'bold 94px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('MilaChat', 384, 536);

  const output = canvas.toBuffer('image/png');
  const webp = await sharp(output).webp({ quality: 92 }).toBuffer();
  writeFileSync(outputFile, webp);
  console.log(`Wrote ${outputFile}`);
}

const sourceLogo = 'denichat-logo-source.webp';
await sharp('https://denichat.site/denichat-logo.webp').toFile(sourceLogo).catch(async () => {
  writeFileSync(sourceLogo, await sharp('denichat-logo.webp').toBuffer());
});

for (const file of LOGO_FILES) {
  await updateLogo(sourceLogo, `${file}.new`);
}

const masterPng = await sharp('denichat-logo.webp.new').png().toBuffer();
for (const favicon of FAVICON_FILES) {
  const size = Number(favicon.match(/(\d+)/)[1]);
  const out = await sharp(masterPng).resize(size, size).png().toBuffer();
  writeFileSync(`${favicon}.new`, out);
  console.log(`Wrote ${favicon}.new`);
}
