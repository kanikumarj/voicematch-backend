/**
 * generate-icons.js
 *
 * Generates PWA icons (192x192, 512x512) from the SVG favicon.
 * Run once before deploying:
 *   node scripts/generate-icons.js
 *
 * Requires: sharp
 *   npm install --save-dev sharp
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const SVG_PATH  = path.join(__dirname, '../public/favicon.svg');
const ICONS_DIR = path.join(__dirname, '../public/icons');

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

const SIZES = [192, 512];

(async () => {
  const svgBuffer = fs.readFileSync(SVG_PATH);
  for (const size of SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}.png`));
    console.log(`✓ Generated icon-${size}.png`);
  }
  console.log('PWA icons generated in public/icons/');
})();
