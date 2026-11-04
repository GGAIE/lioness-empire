// Local verification of the same static artifact at both domain-root and project paths.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
const rootEntry = process.argv.includes('--root-entry');
const root = resolve(rootEntry ? '.' : 'github-pages');
const port = rootEntry ? 4183 : 4182;
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};
createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/lioness-empire') {
      res.writeHead(301, { Location: '/lioness-empire/' });
      res.end();
      return;
    }
    if (path.startsWith('/lioness-empire/')) path = path.slice('/lioness-empire'.length);
    if (rootEntry && !['/', '/index.html'].includes(path) && !path.startsWith('/github-pages/'))
      throw Error('Excluded source file');
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (relative(root, file).startsWith('..')) throw Error('Invalid path');
    const info = await stat(file);
    if (!info.isFile()) throw Error('Not a file');
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Pages package: http://127.0.0.1:${port}/lioness-empire/`)
);
