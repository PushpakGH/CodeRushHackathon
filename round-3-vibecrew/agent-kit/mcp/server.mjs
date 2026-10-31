import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const endpoint = process.env.VIBECREW_MCP_URL;
const token = process.env.VIBECREW_MCP_TOKEN;

if (!endpoint || !token) {
  console.error("VibeCrew MCP needs VIBECREW_MCP_URL and VIBECREW_MCP_TOKEN in this process environment.");
  process.exit(1);
}

let parsedEndpoint;
try {
  parsedEndpoint = new URL(endpoint);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsedEndpoint.hostname);
  if (parsedEndpoint.protocol !== "https:" && !(parsedEndpoint.protocol === "http:" && loopback)) throw new Error("HTTPS required");
} catch {
  console.error("VIBECREW_MCP_URL must use HTTPS (HTTP is allowed only for local loopback tests).");
  process.exit(1);
}

const remote = new Client({ name: "vibecrew-ide-bridge", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(parsedEndpoint, {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});

const local = new McpServer({ name: "vibecrew", version: "1.0.0" });

local.registerTool(
  "get_project_context",
  {
    description: "Read the shared VibeCrew project objective, accepted decisions, work plan, team roles, and release checks. This tool cannot modify code or workspace data.",
    inputSchema: z.object({ projectId: z.string().uuid() }),
  },
  async ({ projectId }) => remote.callTool({ name: "get_project_context", arguments: { projectId } }),
);

local.registerTool(
  "get_my_tasks",
  {
    description: "Read tasks assigned to the teammate represented by this personal VibeCrew token. This tool cannot modify code or workspace data.",
    inputSchema: z.object({}),
  },
  async () => remote.callTool({ name: "get_my_tasks", arguments: {} }),
);

try {
  await remote.connect(transport);
  await local.connect(new StdioServerTransport());
} catch (error) {
  const causes = [];
  for (let current = error; current && causes.length < 4; current = current.cause) {
    if (current instanceof Error && current.message) causes.push(current.message.replaceAll(token, "[redacted]"));
  }
  const detail = causes.join(" <- ") || "unknown transport error";
  console.error(`VibeCrew MCP could not connect: ${detail}`);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await Promise.allSettled([local.close(), remote.close()]);
    process.exit(0);
  });
}
