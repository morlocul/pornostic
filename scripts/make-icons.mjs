import sharp from 'sharp';
const src = 'public/icon.svg';
await sharp(src).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(src).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(src).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons generated');
