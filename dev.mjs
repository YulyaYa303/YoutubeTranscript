import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { handle } from './api/transcript.js';

try {
  process.loadEnvFile(new URL('./.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const files = {
  '/': ['index.html', 'text/html'],
  '/styles.css': ['styles.css', 'text/css'],
  '/app.js': ['app.js', 'text/javascript'],
};

const port = Number(process.env.PORT || 3000);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/transcript') {
      const response = await handle(new Request(url, {
        method: req.method,
        headers: { accept: req.headers.accept || 'application/json' },
        body: req.method === 'POST' ? Readable.toWeb(req) : undefined,
        duplex: 'half',
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res);
      return;
    }
    if (!Object.hasOwn(files, url.pathname)) {
      res.writeHead(404).end();
      return;
    }
    const [file, type] = files[url.pathname];
    const data = await readFile(new URL('./public/' + file, import.meta.url));
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }).end(data);
  } catch {
    res.writeHead(500).end();
  }
}).listen(port, '0.0.0.0', () => console.log('Listening on port ' + port));
