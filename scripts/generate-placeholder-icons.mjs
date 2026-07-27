import { PNG } from 'pngjs';
import fs from 'node:fs';

function createSolidIcon(size, outPath) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = 0xb8;
      png.data[idx + 1] = 0xd8;
      png.data[idx + 2] = 0xe8;
      png.data[idx + 3] = 0xff;
    }
  }
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

createSolidIcon(192, 'public/pwa-192x192.png');
createSolidIcon(512, 'public/pwa-512x512.png');
console.log('Placeholder icons generated at public/pwa-192x192.png and public/pwa-512x512.png');
