// Sizes of the built JavaScript and CSS (raw, gzip -9, brotli), from dist/ or the folder given.
//   node qa/tools/chunk-size.mjs [dist folder]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const assets = join(process.argv[2] ?? new URL('../../dist', import.meta.url).pathname, 'assets');
for (const file of readdirSync(assets).filter((name) => /\.(js|css)$/.test(name))) {
  const data = readFileSync(join(assets, file));
  const kb = (n) => (n / 1000).toFixed(2);
  console.log(`${file}\traw ${kb(data.length)} kB\tgzip ${kb(gzipSync(data, { level: 9 }).length)} kB\tbrotli ${kb(brotliCompressSync(data).length)} kB`);
}
