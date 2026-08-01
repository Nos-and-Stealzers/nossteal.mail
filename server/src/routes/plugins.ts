import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { fetchManifest, pluginManifestSchema, type PluginManifest } from "../services/pluginManifest.js";

export const pluginsRouter = Router();
pluginsRouter.use(requireAuth);

pluginsRouter.get("/", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, plugin_id, plugin_name, plugin_version, plugin_type, source, source_url,
            is_enabled, requested_permissions, plugin_configuration, last_used, installed_at
     FROM installed_plugins WHERE user_id = $1 ORDER BY installed_at ASC`,
    [req.userId]
  );
  res.json({ plugins: result.rows });
});

const installFromUrlSchema = z.object({ manifestUrl: z.string().url() });
const installFromManifestSchema = z.object({ manifest: z.unknown() });

pluginsRouter.post("/install", async (req: AuthedRequest, res) => {
  let manifest: PluginManifest;
  let source: "manifest_url" | "manual_json";
  let sourceUrl: string | null = null;

  const urlParsed = installFromUrlSchema.safeParse(req.body);
  if (urlParsed.success) {
    try {
      manifest = await fetchManifest(urlParsed.data.manifestUrl);
    } catch (err) {
      return res.status(400).json({ error: "Failed to fetch/validate manifest", detail: (err as Error).message });
    }
    source = "manifest_url";
    sourceUrl = urlParsed.data.manifestUrl;
  } else {
    const manualParsed = installFromManifestSchema.safeParse(req.body);
    if (!manualParsed.success) {
      return res.status(400).json({ error: "Provide either manifestUrl or manifest" });
    }
    const validation = pluginManifestSchema.safeParse(manualParsed.data.manifest);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid plugin manifest", detail: validation.error.flatten() });
    }
    manifest = validation.data;
    source = "manual_json";
  }

  const existing = await pool.query(
    "SELECT id FROM installed_plugins WHERE user_id = $1 AND plugin_id = $2",
    [req.userId, manifest.id]
  );
  if (existing.rowCount) {
    return res.status(409).json({ error: "This plugin is already installed" });
  }

  const result = await pool.query(
    `INSERT INTO installed_plugins (
       user_id, plugin_id, plugin_name, plugin_version, plugin_type,
       source, source_url, manifest, requested_permissions
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, plugin_id, plugin_name, plugin_version, plugin_type, is_enabled,
               requested_permissions, installed_at`,
    [
      req.userId,
      manifest.id,
      manifest.name,
      manifest.version,
      manifest.category,
      source,
      sourceUrl,
      JSON.stringify(manifest),
      manifest.permissions,
    ]
  );
  const installed = result.rows[0];

  for (const permission of manifest.permissions) {
    await pool.query(
      `INSERT INTO plugin_permissions (installed_plugin_id, permission, granted)
       VALUES ($1,$2,FALSE) ON CONFLICT DO NOTHING`,
      [installed.id, permission]
    );
  }

  await logPluginEvent(installed.id, "info", "Plugin installed", { source });

  res.status(201).json({ plugin: installed });
});

pluginsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await pool.query("DELETE FROM installed_plugins WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  res.status(204).send();
});

pluginsRouter.get("/:id/permissions", async (req: AuthedRequest, res) => {
  const plugin = await getOwnedPlugin(req.params.id, req.userId!);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const result = await pool.query(
    `SELECT permission, granted, granted_at FROM plugin_permissions
     WHERE installed_plugin_id = $1 ORDER BY permission ASC`,
    [plugin.id]
  );
  res.json({ permissions: result.rows });
});

pluginsRouter.post("/:id/permissions/:permission/grant", async (req: AuthedRequest, res) => {
  const plugin = await getOwnedPlugin(req.params.id, req.userId!);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const result = await pool.query(
    `UPDATE plugin_permissions SET granted = TRUE, granted_at = NOW(), granted_by_user_id = $1
     WHERE installed_plugin_id = $2 AND permission = $3
     RETURNING permission, granted, granted_at`,
    [req.userId, plugin.id, req.params.permission]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Permission not requested by this plugin" });

  await logPluginEvent(plugin.id, "info", `Permission granted: ${req.params.permission}`);
  res.json({ permission: result.rows[0] });
});

pluginsRouter.post("/:id/permissions/:permission/revoke", async (req: AuthedRequest, res) => {
  const plugin = await getOwnedPlugin(req.params.id, req.userId!);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const result = await pool.query(
    `UPDATE plugin_permissions SET granted = FALSE, granted_at = NULL, granted_by_user_id = NULL
     WHERE installed_plugin_id = $1 AND permission = $2
     RETURNING permission, granted`,
    [plugin.id, req.params.permission]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Permission not requested by this plugin" });

  // Revoking any permission disables the plugin — it must be re-enabled once permissions are re-confirmed.
  await pool.query("UPDATE installed_plugins SET is_enabled = FALSE, updated_at = NOW() WHERE id = $1", [
    plugin.id,
  ]);
  await logPluginEvent(plugin.id, "warn", `Permission revoked: ${req.params.permission} — plugin disabled`);
  res.json({ permission: result.rows[0] });
});

const setEnabledSchema = z.object({ isEnabled: z.boolean() });

pluginsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = setEnabledSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const plugin = await getOwnedPlugin(req.params.id, req.userId!);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  if (parsed.data.isEnabled) {
    const permsResult = await pool.query(
      "SELECT permission, granted FROM plugin_permissions WHERE installed_plugin_id = $1",
      [plugin.id]
    );
    const ungranted = permsResult.rows.filter((p) => !p.granted);
    if (ungranted.length) {
      return res.status(400).json({
        error: "Cannot enable: not all requested permissions are granted",
        ungranted: ungranted.map((p) => p.permission),
      });
    }
  }

  const result = await pool.query(
    `UPDATE installed_plugins SET is_enabled = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, is_enabled`,
    [parsed.data.isEnabled, plugin.id]
  );
  await logPluginEvent(plugin.id, "info", parsed.data.isEnabled ? "Plugin enabled" : "Plugin disabled");
  res.json({ plugin: result.rows[0] });
});

pluginsRouter.get("/:id/logs", async (req: AuthedRequest, res) => {
  const plugin = await getOwnedPlugin(req.params.id, req.userId!);
  if (!plugin) return res.status(404).json({ error: "Plugin not found" });

  const result = await pool.query(
    `SELECT log_level, message, context, created_at FROM plugin_logs
     WHERE installed_plugin_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [plugin.id]
  );
  res.json({ logs: result.rows });
});

async function getOwnedPlugin(id: string, userId: string) {
  const result = await pool.query("SELECT * FROM installed_plugins WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  return result.rows[0] ?? null;
}

async function logPluginEvent(
  installedPluginId: string,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: unknown
) {
  await pool.query(
    `INSERT INTO plugin_logs (installed_plugin_id, log_level, message, context) VALUES ($1,$2,$3,$4)`,
    [installedPluginId, level, message, context ? JSON.stringify(context) : null]
  );
}
