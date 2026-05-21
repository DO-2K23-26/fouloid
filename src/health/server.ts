import { createServer, type Server } from "node:http";

export interface HealthInfo {
  agentName: string;
  startedAt: number;
}

export function startHealthServer(
  port: number,
  info: HealthInfo
): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.method === "GET" && req.url === "/health") {
        const body = JSON.stringify({
          status: "ok",
          agent: info.agentName,
          uptimeMs: Date.now() - info.startedAt
        });
        res.writeHead(200, {
          "Content-Type": "application/json"
        });
        res.end(body);
        return;
      }

      res.writeHead(404).end();
    });

    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      console.log(
        `[app] health endpoint listening on http://localhost:${port}/health`
      );
      resolve(server);
    });
  });
}
