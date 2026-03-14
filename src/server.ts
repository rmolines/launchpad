import type { ServerWebSocket } from "bun";
import path from "path";
import {
  handleList,
  handleGetStatus,
  handleGetDocument,
  handleGetStage,
  handleGetStatus3,
  handleGetDocument3,
} from "./api/initiatives.js";
import {
  handleListMissions,
  handleListStages,
  handleListModules,
  handleGetMissionModuleStatus,
  handleGetMissionDocument,
} from "./api/missions.js";
import { handleGetPlan } from "./api/plans.js";
import { handleCockpitManual } from "./api/cockpit-manual.js";
import { startWatcher } from "./watcher.js";

const startTime = Date.now();
const clients = new Set<ServerWebSocket<unknown>>();

// Project root is one level up from src/
const projectRoot = path.resolve(import.meta.dir, "..");

export function broadcast(data: object): void {
  const payload = JSON.stringify(data);
  for (const ws of clients) {
    ws.send(payload);
  }
}

export function startHttpServer(port: number): ReturnType<typeof Bun.serve> {
  const httpServer = Bun.serve({
    port,
    fetch(req, server) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // WebSocket upgrade
      if (pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (upgraded) return undefined as unknown as Response;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // API: GET /api/missions
      if (req.method === "GET" && pathname === "/api/missions") {
        return handleListMissions();
      }

      // API: GET /api/cockpit-manual
      if (req.method === "GET" && pathname === "/api/cockpit-manual") {
        return handleCockpitManual();
      }

      // API: GET /api/missions/:mission/stages
      // API: GET /api/missions/:mission/:stage/modules
      // API: GET /api/missions/:mission/:stage/:module/status
      // API: GET /api/missions/:mission/:stage/:module/:docType
      if (req.method === "GET" && pathname.startsWith("/api/missions/")) {
        const segments = pathname.slice("/api/missions/".length).split("/");
        if (segments.length === 2 && segments[1] === "stages") {
          // /api/missions/:mission/stages
          return handleListStages(segments[0]!);
        }
        if (segments.length === 3 && segments[2] === "modules") {
          // /api/missions/:mission/:stage/modules
          return handleListModules(segments[0]!, segments[1]!);
        }
        if (segments.length === 4 && segments[3] === "status") {
          // /api/missions/:mission/:stage/:module/status
          return handleGetMissionModuleStatus(segments[0]!, segments[1]!, segments[2]!);
        }
        if (segments.length === 4) {
          // 3-segment path: mission/stage/module — return module status
          return handleGetMissionModuleStatus(segments[0]!, segments[1]!, segments[2]!);
        }
        if (segments.length === 5) {
          // /api/missions/:mission/:stage/:module/:docType
          return handleGetMissionDocument(segments[0]!, segments[1]!, segments[2]!, segments[3]!);
        }
        return new Response("Not Found", { status: 404 });
      }

      // API: GET /api/plans/:mission/:stage/:module (3-level)
      // API: GET /api/plans/:mission/:module (2-level, backward compat)
      if (req.method === "GET" && pathname.startsWith("/api/plans/")) {
        const segments = pathname.slice("/api/plans/".length).split("/");
        if (segments.length === 3) {
          // 3-level: /api/plans/:mission/:stage/:module
          return handleGetPlan(segments[0]!, segments[2]!, segments[1]!);
        }
        if (segments.length === 2) {
          // 2-level: /api/plans/:mission/:module
          return handleGetPlan(segments[0]!, segments[1]!);
        }
        return new Response("Not Found", { status: 404 });
      }

      // API: GET /api/initiatives (with optional ?type=&mission= params)
      if (req.method === "GET" && pathname === "/api/initiatives") {
        const typeParam = url.searchParams.get("type");
        const missionParam = url.searchParams.get("mission");
        const params: { type?: string; mission?: string } = {};
        if (typeParam !== null) params.type = typeParam;
        if (missionParam !== null) params.mission = missionParam;
        return handleList(params);
      }

      // API: GET /api/initiatives/:mission/:slug/status
      // API: GET /api/initiatives/:mission/:slug/:docType
      if (req.method === "GET" && pathname.startsWith("/api/initiatives/")) {
        const segments = pathname.slice("/api/initiatives/".length).split("/");
        if (segments.length === 3) {
          const mission = segments[0]!;
          const slug = segments[1]!;
          const last = segments[2]!;
          if (last === "status") {
            return handleGetStatus(mission, slug);
          }
          // docType like "draft.md", "prd.md", etc.
          return handleGetDocument(mission, slug, last);
        }
        return new Response("Not Found", { status: 404 });
      }

      // Health endpoint
      if (req.method === "GET" && pathname === "/api/health") {
        return new Response(
          JSON.stringify({ status: "ok", uptime_ms: Date.now() - startTime }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // Static files under /views/shared/
      if (req.method === "GET" && pathname.startsWith("/views/shared/")) {
        const relativePath = pathname.slice("/views/shared/".length);
        const filePath = path.join(projectRoot, "views", "shared", relativePath);
        const file = Bun.file(filePath);
        return file.exists().then((exists) => {
          if (!exists) return new Response("Not Found", { status: 404 });
          return new Response(file);
        });
      }

      // File-based routing: GET /<name> → views/<name>.html
      if (req.method === "GET") {
        const name = pathname.slice(1); // strip leading /
        if (name && !name.includes("/")) {
          const filePath = path.join(projectRoot, "views", `${name}.html`);
          const file = Bun.file(filePath);
          return file.exists().then((exists) => {
            if (!exists) return new Response("Not Found", { status: 404 });
            return new Response(file, {
              headers: { "Content-Type": "text/html" },
            });
          });
        }
      }

      return new Response("Not Found", { status: 404 });
    },

    websocket: {
      open(ws) {
        clients.add(ws);
        process.stderr.write(`[workspace] WS client connected (total: ${clients.size})\n`);
      },
      close(ws) {
        clients.delete(ws);
        process.stderr.write(`[workspace] WS client disconnected (total: ${clients.size})\n`);
      },
      message(ws, message) {
        process.stderr.write(`[workspace] WS message: ${message}\n`);
      },
    },
  });

  process.stderr.write(`[workspace] HTTP server on http://localhost:${port}\n`);

  startWatcher((changedPath) => broadcast({ type: "refresh", path: changedPath }));

  return httpServer;
}
