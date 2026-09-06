import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";

type FetchHandler = (request: Request) => Promise<Response>;
type FetchExport = FetchHandler | { fetch: FetchHandler };

let _handler: FetchHandler | undefined;

async function getHandler(): Promise<FetchHandler> {
  if (!_handler) {
    // dist/server/server.js is created by `vite build` before Vercel builds this function
    // @ts-expect-error – no types for the esbuild bundle output
    const mod = (await import("../dist/server/bundle.js")) as { default: FetchExport };
    const raw = mod.default;
    // Support both plain function export and Cloudflare Workers { fetch: fn } format
    _handler = typeof raw === "function" ? raw : raw.fetch;
  }
  return _handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const handle = await getHandler();

  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    (req.headers["host"] as string | undefined) ??
    "localhost";

  const url = new URL(req.url!, `${proto}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method ?? "GET";
  const chunks: Buffer[] = [];
  if (method !== "GET" && method !== "HEAD") {
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  }

  const request = new Request(url.toString(), {
    method,
    headers,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });

  const response = await handle(request);

  res.statusCode = response.status;

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "transfer-encoding") {
      res.setHeader(key, value);
    }
  });

  if (response.body) {
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } else {
    res.end();
  }
}
