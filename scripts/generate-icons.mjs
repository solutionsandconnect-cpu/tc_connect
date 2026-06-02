import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = join(root, 'public', 'logo.png')

async function generate() {
  // apple-touch-icon : 180x180, fond blanc, logo avec 10px de marge
  await sharp({
    create: { width: 180, height: 180, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{
      input: await sharp(src).resize(160, 160, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer(),
      gravity: 'centre',
    }])
    .png({ quality: 100 })
    .toFile(join(root, 'public', 'apple-touch-icon.png'))

  console.log('apple-touch-icon.png (180x180) ✓')

  // manifest 192x192
  await sharp({
    create: { width: 192, height: 192, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{
      input: await sharp(src).resize(172, 172, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer(),
      gravity: 'centre',
    }])
    .png({ quality: 100 })
    .toFile(join(root, 'public', 'web-app-manifest-192x192.png'))

  console.log('web-app-manifest-192x192.png ✓')

  // manifest 512x512
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{
      input: await sharp(src).resize(460, 460, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer(),
      gravity: 'centre',
    }])
    .png({ quality: 100 })
    .toFile(join(root, 'public', 'web-app-manifest-512x512.png'))

  console.log('web-app-manifest-512x512.png ✓')
}

generate().catch(console.error)
