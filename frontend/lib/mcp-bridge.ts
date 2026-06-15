import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

const MCP_SERVERS: Record<string, { url: string; description: string }> = {
  library: {
    url: process.env.MCP_LIBRARY_URL || "http://127.0.0.1:4001",
    description: "Library catalog, book search, availability, stats",
  },
  cafeteria: {
    url: process.env.MCP_CAFETERIA_URL || "http://127.0.0.1:4002",
    description: "Cafeteria menus, daily specials, meal information, nutrition",
  },
  events: {
    url: process.env.MCP_EVENTS_URL || "http://127.0.0.1:4003",
    description: "Campus events, activities, workshops, concerts, competitions",
  },
  academics: {
    url: process.env.MCP_ACADEMICS_URL || "http://127.0.0.1:4004",
    description: "Course information, class schedules, student enrollment, grades",
  },
  notifications: {
    url: process.env.MCP_NOTIFICATIONS_URL || "http://127.0.0.1:4005",
    description: "Campus announcements, alerts, deadlines, reminders",
  },
};

// Cache MCP clients to avoid reconnecting on every request
const clientCache: Map<string, { client: Client; tools: Tool[]; expiry: number }> = new Map();
const serverQueues: Map<string, Promise<unknown>> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function invalidateClient(serverName: string) {
  const cached = clientCache.get(serverName);
  clientCache.delete(serverName);
  if (cached) {
    try {
      await cached.client.close();
    } catch {}
  }
}

async function runQueued<T>(serverName: string, operation: () => Promise<T>): Promise<T> {
  const previous = serverQueues.get(serverName) || Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  serverQueues.set(serverName, next);

  try {
    return await next;
  } finally {
    if (serverQueues.get(serverName) === next) {
      serverQueues.delete(serverName);
    }
  }
}

async function getOrCreateClient(serverName: string): Promise<{ client: Client; tools: Tool[] }> {
  const cached = clientCache.get(serverName);
  if (cached && cached.expiry > Date.now()) {
    return { client: cached.client, tools: cached.tools };
  }
  if (cached) {
    await invalidateClient(serverName);
  }

  const serverConfig = MCP_SERVERS[serverName];
  if (!serverConfig) throw new Error(`Unknown MCP server: ${serverName}`);

  const transport = new SSEClientTransport(new URL(`${serverConfig.url}/sse`));
  const client = new Client({ name: "campus-hub-gateway", version: "1.0.0" }, { capabilities: {} });

  await client.connect(transport);
  const toolsResult = await client.listTools();

  clientCache.set(serverName, {
    client,
    tools: toolsResult.tools,
    expiry: Date.now() + CACHE_TTL,
  });

  return { client, tools: toolsResult.tools };
}

/**
 * Call a specific tool on a specific MCP server
 */
export async function callMcp(
  serverName: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<CallToolResult["content"]> {
  return runQueued<CallToolResult["content"]>(serverName, async () => {
    try {
      const { client } = await getOrCreateClient(serverName);
      const result = (await client.callTool({ name: toolName, arguments: args })) as CallToolResult;
      return result.content;
    } catch {
      console.log(`[MCP Bridge] Connection to ${serverName} failed. Reconnecting...`);
      await invalidateClient(serverName);
      const { client } = await getOrCreateClient(serverName);
      const result = (await client.callTool({ name: toolName, arguments: args })) as CallToolResult;
      return result.content;
    }
  });
}

/**
 * Call a tool and parse the JSON response
 */
export async function callMcpJson(serverName: string, toolName: string, args: Record<string, unknown> = {}) {
  const content = await callMcp(serverName, toolName, args);
  if (Array.isArray(content) && content.length > 0 && content[0].type === "text") {
    try {
      return JSON.parse(content[0].text as string);
    } catch {
      return content[0].text;
    }
  }
  return content;
}

/**
 * Get all available tools across all MCP servers (for AI function calling)
 */
export async function getAllTools(): Promise<
  Array<{ server: string; name: string; description: string; inputSchema: Tool["inputSchema"] }>
> {
  const allTools: Array<{ server: string; name: string; description: string; inputSchema: Tool["inputSchema"] }> = [];

  for (const serverName of Object.keys(MCP_SERVERS)) {
    try {
      const { tools } = await getOrCreateClient(serverName);
      for (const tool of tools) {
        allTools.push({
          server: serverName,
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema,
        });
      }
    } catch (error) {
      console.error(`Failed to connect to ${serverName} MCP server:`, error);
    }
  }

  return allTools;
}

/**
 * Get server descriptions for AI system prompt
 */
export function getServerDescriptions(): string {
  return Object.entries(MCP_SERVERS)
    .map(([name, config]) => `- ${name}: ${config.description}`)
    .join("\n");
}

/**
 * Check health of all MCP servers
 */
export async function checkHealth(): Promise<Record<string, boolean>> {
  const health: Record<string, boolean> = {};
  for (const serverName of Object.keys(MCP_SERVERS)) {
    try {
      await getOrCreateClient(serverName);
      health[serverName] = true;
    } catch {
      health[serverName] = false;
    }
  }
  return health;
}

/**
 * Clear cached connections (useful when servers restart)
 */
export async function clearCache() {
  for (const serverName of clientCache.keys()) {
    await invalidateClient(serverName);
  }
}
