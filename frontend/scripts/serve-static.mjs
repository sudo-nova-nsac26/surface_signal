// Local preview only. Production serves these same files directly from Pages.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "out");
const port = Number(process.env.PORT ?? "3000");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json", ".png": "image/png", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain" };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    let filename = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (filename !== root && !filename.startsWith(root + path.sep)) throw new Error("Invalid path");
    if ((await stat(filename)).isDirectory()) {
      if (!url.pathname.endsWith("/")) { response.writeHead(308, { Location: url.pathname + "/" + url.search }); response.end(); return; }
      filename = path.join(filename, "index.html");
    }
    const body = await readFile(filename);
    response.writeHead(200, { "Content-Type": mime[path.extname(filename)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(await readFile(path.join(root, "404.html")).catch(() => "Not found"));
  }
}).listen(port, "127.0.0.1", () => console.log(`Static preview http://127.0.0.1:${port}`));
