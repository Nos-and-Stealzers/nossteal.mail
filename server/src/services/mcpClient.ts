import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface DiscoveredTool {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface DiscoveryResult {
  serverVersion: string | null;
  tools: DiscoveredTool[];
}

async function withClient<T>(connectionUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(connectionUrl));
  const client = new Client({ name: "nossteal-mail", version: "0.1.0" });
  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export async function discoverMcpServer(connectionUrl: string): Promise<DiscoveryResult> {
  return withClient(connectionUrl, async (client) => {
    const version = client.getServerVersion();
    const toolsResult = await client.listTools();
    return {
      serverVersion: version ? `${version.name ?? "unknown"}@${version.version ?? "0"}` : null,
      tools: toolsResult.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });
}

export async function invokeMcpTool(
  connectionUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return withClient(connectionUrl, async (client) => {
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  });
}
