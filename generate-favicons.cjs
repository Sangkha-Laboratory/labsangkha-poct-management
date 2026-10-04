const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generate() {
  const svgBuffer = fs.readFileSync(path.join(__dirname, 'public/favicon.svg'));

  // Generate 64x64 PNG
  await sharp(svgBuffer, { density: 300 })
    .resize(64, 64)
    .png()
    .toFile(path.join(__dirname, 'public/favicon.png'));

  // Generate 32x32 PNG
  await sharp(svgBuffer, { density: 300 })
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, 'public/favicon-32x32.png'));

  // Generate 16x16 PNG
  await sharp(svgBuffer, { density: 300 })
    .resize(16, 16)
    .png()
    .toFile(path.join(__dirname, 'public/favicon-16x16.png'));

  // Generate 192x192 Apple Touch Icon
  await sharp(svgBuffer, { density: 300 })
    .resize(192, 192)
    .png()
    .toFile(path.join(__dirname, 'public/apple-touch-icon.png'));

  // Copy 32x32 to favicon.ico (modern browsers accept PNG formatted favicon.ico directly or 32x32 png)
  fs.copyFileSync(path.join(__dirname, 'public/favicon.png'), path.join(__dirname, 'public/favicon.ico'));

  console.log('All favicons generated successfully!');
}

generate().catch(console.error);
