import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const projectId = "dce46114-5362-42eb-9518-7c8cbb8e9460";
const expectedToken = "vbc_live_test-token-not-for-production";
const observedAuthorization = [];

function buildTestServer() {
  const server = new McpServer({ name: "vibecrew-test", version: "1.0.0" });
  server.registerTool("get_project_context", { inputSchema: z.object({ projectId: z.string().uuid() }) }, async ({ projectId: id }) => ({
    content: [{ type: "text", text: JSON.stringify({ projectId: id, source: "test" }) }],
  }));
  server.registerTool("get_my_tasks", { inputSchema: z.object({}) }, async () => ({
    content: [{ type: "text", text: JSON.stringify([{ task_key: "VBC-001", title: "Test bridge" }]) }],
  }));
  return server;
}

const handler = createMcpHandler(buildTestServer);
const httpServer = createServer(async (incoming, outgoing) => {
  observedAuthorization.push(incoming.headers.authorization || "");
  if (incoming.headers.authorization !== `Bearer ${expectedToken}`) {
    outgoing.writeHead(401, { "www-authenticate": "Bearer" }).end();
    return;
  }

  const chunks = [];
  for await (const chunk of incoming) chunks.push(chunk);
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
  const method = incoming.method || "GET";
  const request = new Request(`http://127.0.0.1${incoming.url || "/mcp"}`, {
    method,
    headers,
    ...(chunks.length ? { body: Buffer.concat(chunks), duplex: "half" } : {}),
  });
  const response = await handler.fetch(request);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});

await new Promise((resolve, reject) => {
  httpServer.once("error", reject);
  httpServer.listen(0, "127.0.0.1", resolve);
});
const address = httpServer.address();
const endpoint = `http://127.0.0.1:${address.port}/mcp`;

after(async () => {
  await Promise.allSettled([new Promise((resolve) => httpServer.close(resolve)), handler.close()]);
});

test("stdio bridge exposes only its read-only VibeCrew tools and forwards authenticated calls", async () => {
  const client = new Client({ name: "vibecrew-bridge-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../server.mjs", import.meta.url))],
    stderr: "pipe",
    env: { ...process.env, VIBECREW_MCP_URL: endpoint, VIBECREW_MCP_TOKEN: expectedToken },
  });
  const stderr = [];
  transport.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));

  try {
    try {
      await client.connect(transport);
    } catch (error) {
      const detail = Buffer.concat(stderr).toString("utf8").trim();
      throw new Error(`${detail || "Bridge process exited during MCP initialization"} (remote requests observed: ${observedAuthorization.length})`, { cause: error });
    }
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["get_my_tasks", "get_project_context"]);

    const taskResult = await client.callTool({ name: "get_my_tasks", arguments: {} });
    assert.deepEqual(JSON.parse(taskResult.content[0].text), [{ task_key: "VBC-001", title: "Test bridge" }]);

    const contextResult = await client.callTool({ name: "get_project_context", arguments: { projectId } });
    assert.deepEqual(JSON.parse(contextResult.content[0].text), { projectId, source: "test" });
    assert.ok(observedAuthorization.length >= 3);
    assert.ok(observedAuthorization.every((header) => header === `Bearer ${expectedToken}`));

    const invalid = await client.callTool({ name: "get_project_context", arguments: { projectId: "not-a-uuid" } });
    assert.equal(invalid.isError, true);
  } finally {
    await client.close();
  }
});
