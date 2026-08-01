import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { emailAccountsRouter } from "./routes/emailAccounts.js";
import { messagesRouter } from "./routes/messages.js";
import { aiProvidersRouter } from "./routes/aiProviders.js";
import { workspacesRouter, conversationsRouter } from "./routes/workspaces.js";
import { mcpServersRouter } from "./routes/mcpServers.js";
import { pluginsRouter } from "./routes/plugins.js";
import { notesRouter } from "./routes/notes.js";
import { tasksRouter } from "./routes/tasks.js";
import { workflowsRouter } from "./routes/workflows.js";
import { billingRouter } from "./routes/billing.js";
import { billingWebhookRouter } from "./routes/billingWebhook.js";
import { domainsRouter } from "./routes/domains.js";
import { adminRouter } from "./routes/admin.js";

const app = express();

app.use(helmet());
app.use(cors());

// Mounted before express.json() — Stripe webhook signature verification needs the raw body.
app.use("/api/billing/webhook", billingWebhookRouter);

app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/billing", billingRouter);
app.use("/api/domains", domainsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/email-accounts", emailAccountsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/ai-providers", aiProvidersRouter);
app.use("/api/workspaces", workspacesRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/mcp-servers", mcpServersRouter);
app.use("/api/plugins", pluginsRouter);
app.use("/api/notes", notesRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/workflows", workflowsRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`nossteal.mail server listening on port ${port}`);
});
