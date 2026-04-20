/**
 * generate-icons.cjs
 *
 * Creates placeholder PWA icons so the build never fails
 * due to missing /public/icons/icon-*.png files.
 *
 * Run automatically via the `prebuild` npm script.
 * Replace these with real icons before public launch:
 *   https://realfavicongenerator.net
 */

const fs   = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Minimal valid 1×1 purple PNG (base64-encoded)
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ' +
  'AAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const targets = ['icon-192.png', 'icon-512.png'];

targets.forEach((filename) => {
  const dest = path.join(dir, filename);
  // Skip if a real icon already exists (avoids overwriting on re-runs)
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, PNG_1X1);
    console.log(`✓ Placeholder created: public/icons/${filename}`);
  } else {
    console.log(`✓ Icon exists (skipped):  public/icons/${filename}`);
  }
});

console.log('PWA icons ready.');
