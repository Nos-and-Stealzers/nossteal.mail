import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { discoverMcpServer } from "../services/mcpClient.js";

export const mcpServersRouter = Router();
mcpServersRouter.use(requireAuth);

const createServerSchema = z.object({
  name: z.string().min(1),
  connectionUrl: z.string().url(),
});

mcpServersRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, name, connection_url, is_connected, last_connected_at, connection_error,
            server_version, tools_count, created_at
     FROM mcp_servers WHERE user_id = $1 ORDER BY created_at ASC`,
    [req.userId]
  );
  res.json({ servers: result.rows });
});

mcpServersRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createServerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const s = parsed.data;

  const result = await pool.query(
    `INSERT INTO mcp_servers (user_id, name, connection_url) VALUES ($1,$2,$3)
     RETURNING id, name, connection_url, is_connected, created_at`,
    [req.userId, s.name, s.connectionUrl]
  );
  res.status(201).json({ server: result.rows[0] });
});

mcpServersRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query("DELETE FROM mcp_servers WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  res.status(204).send();
});

// Connects to the configured MCP endpoint over Streamable HTTP, discovers its tool
// list, and caches both the tools and the connection status. Manual mode means this
// only ever runs when the user explicitly clicks "Connect" — never automatically.
mcpServersRouter.post("/:id/connect", async (req: AuthedRequest, res) => {
  const serverResult = await pool.query("SELECT * FROM mcp_servers WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  const server = serverResult.rows[0];
  if (!server) return res.status(404).json({ error: "MCP server not found" });

  try {
    const discovery = await discoverMcpServer(server.connection_url);

    await pool.query(
      `UPDATE mcp_servers SET is_connected = TRUE, last_connected_at = NOW(), connection_error = NULL,
              server_version = $1, tools_count = $2, updated_at = NOW()
       WHERE id = $3`,
      [discovery.serverVersion, discovery.tools.length, server.id]
    );

    for (const tool of discovery.tools) {
      await pool.query(
        `INSERT INTO mcp_tools (mcp_server_id, name, description, input_schema)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (mcp_server_id, name)
         DO UPDATE SET description = EXCLUDED.description, input_schema = EXCLUDED.input_schema`,
        [server.id, tool.name, tool.description ?? null, JSON.stringify(tool.inputSchema ?? {})]
      );
    }

    res.json({ connected: true, tools: discovery.tools });
  } catch (err) {
    await pool.query(
      `UPDATE mcp_servers SET is_connected = FALSE, connection_error = $1, updated_at = NOW() WHERE id = $2`,
      [(err as Error).message, server.id]
    );
    res.status(502).json({ error: "Failed to connect to MCP server", detail: (err as Error).message });
  }
});

mcpServersRouter.get("/:id/tools", async (req: AuthedRequest, res) => {
  const serverResult = await pool.query("SELECT id FROM mcp_servers WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  if (!serverResult.rowCount) return res.status(404).json({ error: "MCP server not found" });

  const result = await pool.query(
    `SELECT id, name, description, input_schema, is_enabled, usage_count, last_used_at
     FROM mcp_tools WHERE mcp_server_id = $1 ORDER BY name ASC`,
    [req.params.id]
  );
  res.json({ tools: result.rows });
});
