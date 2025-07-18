import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { SolidCssMcpService } from './services/solid.service.js';
import {
  registerSolidLoginTool,
  registerReadResourceTool,
  registerWriteTextResourceTool,
  registerListContainerTool,
  registerDeleteResourceTool,
} from './tools/solid.tools.js';

// --- Adapter to bridge old tool registration with new server ---
class McpToolRegistry {
  private tools: Map<string, any> = new Map();

  tool(name: string, description: string, inputSchema: any, handler: (args: any) => Promise<CallToolResult>): void {
    this.tools.set(name, { name, description, inputSchema, handler });
  }

  getTool(name: string): any {
    return this.tools.get(name);
  }

  listTools(): any[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }
}

// --- Main Server Implementation ---
class SolidPodMcpServer {
  private server: Server;
  private solidService: SolidCssMcpService;
  private toolRegistry: McpToolRegistry;

  constructor() {
    this.solidService = new SolidCssMcpService();
    this.toolRegistry = new McpToolRegistry();

    this.server = new Server(
      {
        name: 'solid-pod-tools-server',
        version: '1.0.1',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerAllTools();
    this.setupRequestHandlers();
    this.setupErrorHandling();
  }

  private registerAllTools(): void {
    console.error('🔷 Registering Solid Pod tools...');
    registerSolidLoginTool(this.toolRegistry, this.solidService);
    registerReadResourceTool(this.toolRegistry, this.solidService);
    registerWriteTextResourceTool(this.toolRegistry, this.solidService);
    registerListContainerTool(this.toolRegistry, this.solidService);
    registerDeleteResourceTool(this.toolRegistry, this.solidService);
    console.error('✅ All Solid Pod tools registered.');
  }

  private setupRequestHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolRegistry.listTools(),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.toolRegistry.getTool(name);

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      console.error(`--> Received call for tool: ${name}`);
      return tool.handler(args || {});
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error);
    };
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('✅ MCP Server started and connected successfully via Stdio.');
  }
}

// --- Application Entry Point ---
async function main() {
  try {
    const server = new SolidPodMcpServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
