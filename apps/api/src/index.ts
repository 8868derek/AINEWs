import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { closePool, migrate } from "./db";
import { ensureActor } from "./aihot";
import { runDigest } from "./digest";
import {
  digestNews,
  entriesForNews,
  getDigest,
  getGlossary,
  latestCorpusDoc,
  latestDigest,
  listDigests,
  listGlossary,
  listHotTopics,
  listStoredNews,
  newsForEntry,
  runtimeStatus,
  storedNewsCount,
} from "./queries";
import { startScheduler } from "./scheduler";

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";
let digestRunning = false;

function send(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function authorized(request: IncomingMessage) {
  const expected = process.env.API_TOKEN?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.authorization === `Bearer ${expected}`;
}

async function entryObject(ids: string[]) {
  return Object.fromEntries(await entriesForNews(ids));
}

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url || "/", "http://localhost");
  if (request.method === "GET" && url.pathname === "/health") {
    send(response, 200, { ok: true });
    return;
  }
  if (!authorized(request)) {
    send(response, 401, { error: "未授权" });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/home") {
    const digest = await latestDigest();
    send(response, 200, { digest: digest ?? null, newsCount: await storedNewsCount() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/library") {
    const category = url.searchParams.get("category") || "";
    const selectedOnly = url.searchParams.get("mode") === "selected";
    const items = await listStoredNews(category, selectedOnly);
    send(response, 200, {
      items,
      entries: await entryObject(items.map((item) => item.id)),
      newsCount: await storedNewsCount(),
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/hot") {
    send(response, 200, { topics: await listHotTopics() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/corpus/daily") {
    send(response, 200, { doc: (await latestCorpusDoc("daily")) ?? null });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/corpus/codex") {
    send(response, 200, { doc: (await latestCorpusDoc("codex")) ?? null });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/digests") {
    send(response, 200, { digests: await listDigests() });
    return;
  }
  const digestMatch = url.pathname.match(/^\/v1\/digests\/(\d+)$/);
  if (request.method === "GET" && digestMatch) {
    const digest = await getDigest(Number(digestMatch[1]));
    if (!digest) {
      send(response, 404, { error: "没有这一期" });
      return;
    }
    const items = await digestNews(digest.id);
    send(response, 200, { digest, items, entries: await entryObject(items.map((item) => item.id)) });
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/digests/run") {
    if (digestRunning) {
      send(response, 409, { ok: false, error: "已有一次更新在进行" });
      return;
    }
    digestRunning = true;
    void runDigest("manual")
      .catch((error: unknown) => {
        console.error("[ainews] 手动更新失败", error);
      })
      .finally(() => {
        digestRunning = false;
      });
    send(response, 202, { ok: true, accepted: true });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/glossary") {
    send(response, 200, {
      entries: await listGlossary(url.searchParams.get("kind") || "", url.searchParams.get("q") || ""),
    });
    return;
  }
  const glossaryMatch = url.pathname.match(/^\/v1\/glossary\/([^/]+)$/);
  if (request.method === "GET" && glossaryMatch) {
    const entry = await getGlossary(decodeURIComponent(glossaryMatch[1]));
    if (!entry) {
      send(response, 404, { error: "没有这个词条" });
      return;
    }
    send(response, 200, { entry, news: await newsForEntry(entry.id) });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/status") {
    send(response, 200, await runtimeStatus());
    return;
  }
  send(response, 404, { error: "没有这个接口" });
}

async function main() {
  await migrate();
  await ensureActor();
  await startScheduler();
  const server = createServer((request, response) => {
    const started = Date.now();
    route(request, response)
      .catch((error: unknown) => {
        console.error("[ainews] 请求失败", error);
        if (!response.headersSent) send(response, 500, { error: "服务器错误" });
      })
      .finally(() => {
        console.log(`${request.method} ${request.url} ${response.statusCode} ${Date.now() - started}ms`);
      });
  });
  server.requestTimeout = 30_000;
  const shutdown = async () => {
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
  server.listen(port, host, () => {
    console.log(`[ainews] API http://${host}:${port}`);
  });
}

void main().catch((error: unknown) => {
  console.error("[ainews] 启动失败", error);
  process.exit(1);
});
