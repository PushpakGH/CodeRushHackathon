import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { createClient } from "@supabase/supabase-js";
import * as z from "zod/v4";

type AgentIdentity = { userId: string; workspaceId: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing server configuration");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, accept",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function authenticate(request: Request): Promise<AgentIdentity | null> {
  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer (vbc_live_[A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) return null;

  const tokenHash = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(match[1])));
  const { data: token, error } = await admin
    .from("agent_access_tokens")
    .select("user_id, workspace_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !token || token.revoked_at || new Date(token.expires_at).getTime() <= Date.now()) return null;

  const { data: membership, error: membershipError } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", token.workspace_id)
    .eq("user_id", token.user_id)
    .maybeSingle();
  if (membershipError || !membership) return null;

  return { userId: token.user_id, workspaceId: token.workspace_id };
}

function registerTools(identity: AgentIdentity) {
  const server = new McpServer({ name: "vibecrew", version: "1.0.0" });

  server.registerTool(
    "get_project_context",
    {
      description: "Read the current VibeCrew project objective, accepted decisions, task plan, team roles, release checks, and revision. Access is limited to the workspace this personal token was created for.",
      inputSchema: z.object({ projectId: z.string().uuid() }),
    },
    async ({ projectId }) => {
      try {
        const { data: project, error: projectError } = await admin
          .from("projects")
          .select("id, workspace_id, name, objective, repository_url, lifecycle_stage, context_revision, updated_at")
          .eq("id", projectId)
          .eq("workspace_id", identity.workspaceId)
          .maybeSingle();
        if (projectError) throw projectError;
        if (!project) return { content: [{ type: "text", text: "Project not found in this token's workspace." }], isError: true };

        const [membersResult, decisionsResult, tasksResult, checksResult, activityResult] = await Promise.all([
          admin.from("workspace_members").select("user_id, display_name, role").eq("workspace_id", identity.workspaceId),
          admin.from("architecture_decisions").select("decision_key, title, context, decision, consequence, version, created_at").eq("project_id", project.id).eq("status", "ACCEPTED").order("created_at", { ascending: true }),
          admin.from("tasks").select("task_key, title, description, status, priority, owner_id, dependencies, acceptance, test_plan, scope, branch, pr_url, context_revision_seen, updated_at").eq("project_id", project.id).order("created_at", { ascending: true }).limit(100),
          admin.from("release_checks").select("check_key, title, status, evidence, updated_at").eq("project_id", project.id).order("updated_at", { ascending: true }),
          admin.from("activity_events").select("event_type, summary, created_at").eq("project_id", project.id).order("created_at", { ascending: false }).limit(15),
        ]);
        for (const result of [membersResult, decisionsResult, tasksResult, checksResult, activityResult]) {
          if (result.error) throw result.error;
        }

        const names = new Map((membersResult.data || []).map((member) => [member.user_id, member.display_name]));
        const context = {
          generatedAt: new Date().toISOString(),
          source: "VibeCrew shared workspace",
          project: {
            name: project.name,
            objective: project.objective,
            repositoryUrl: project.repository_url,
            lifecycleStage: project.lifecycle_stage,
            contextRevision: project.context_revision,
            updatedAt: project.updated_at,
          },
          acceptedDecisions: decisionsResult.data || [],
          tasks: (tasksResult.data || []).map((task) => ({
            ...task,
            owner: task.owner_id ? (names.get(task.owner_id) || "Former member") : "Unassigned",
            owner_id: undefined,
          })),
          team: (membersResult.data || []).map(({ display_name, role }) => ({ name: display_name, role })),
          releaseChecks: checksResult.data || [],
          recentActivity: activityResult.data || [],
          boundary: "VibeCrew shares coordination context only. Code and agents remain on each contributor's machine; GitHub remains the code source of truth.",
        };

        return { content: [{ type: "text", text: JSON.stringify(context, null, 2) }] };
      } catch {
        return { content: [{ type: "text", text: "Could not load project context. Retry after checking VibeCrew connectivity." }], isError: true };
      }
    },
  );

  server.registerTool(
    "get_my_tasks",
    {
      description: "List tasks assigned to the signed-in teammate in this token's VibeCrew workspace, including status, dependencies, file scope, acceptance checks, and branch metadata.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const { data: projects, error: projectError } = await admin
          .from("projects")
          .select("id, name")
          .eq("workspace_id", identity.workspaceId);
        if (projectError) throw projectError;
        if (!projects?.length) return { content: [{ type: "text", text: "No projects are available in this workspace yet." }] };

        const projectNames = new Map(projects.map((project) => [project.id, project.name]));
        const { data: tasks, error } = await admin
          .from("tasks")
          .select("project_id, task_key, title, description, status, priority, dependencies, acceptance, test_plan, scope, branch, pr_url, context_revision_seen, updated_at")
          .in("project_id", projects.map((project) => project.id))
          .eq("owner_id", identity.userId)
          .order("updated_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        const result = (tasks || []).map((task) => ({ ...task, project: projectNames.get(task.project_id) || "Project", project_id: undefined }));
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch {
        return { content: [{ type: "text", text: "Could not load your tasks. Retry after checking VibeCrew connectivity." }], isError: true };
      }
    },
  );

  return server;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (new URL(request.url).pathname.endsWith("/health")) {
    return jsonResponse({ ok: true, service: "vibecrew-mcp", authenticationRequired: true, tools: ["get_project_context", "get_my_tasks"] });
  }

  try {
    const identity = await authenticate(request);
    if (!identity) {
      return jsonResponse({ error: "Unauthorized", message: "Create or refresh your personal VibeCrew agent token." }, 401, { "www-authenticate": "Bearer" });
    }
    const handler = createMcpHandler(() => registerTools(identity));
    const response = await handler.fetch(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return jsonResponse({ error: "Service unavailable", message: "VibeCrew MCP could not process this request." }, 503);
  }
});
