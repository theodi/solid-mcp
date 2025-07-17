import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SolidCssMcpService } from './services/solid.service.js';
import {
  registerSolidLoginTool,
  registerReadResourceTool,
  registerWriteTextResourceTool,
  registerListContainerTool,
  registerDeleteResourceTool,
} from './tools/solid.tools.js';

// Adapter class to bridge between your existing tool registration and new MCP SDK
class McpServerAdapter {
  private tools: Map<string, any> = new Map();
  private solidService: SolidCssMcpService;

  constructor(solidService: SolidCssMcpService) {
    this.solidService = solidService;
  }

  // Mock the old McpServer.tool method to collect tool definitions
  tool(name: string, description: string, inputSchema: any, handler: Function): void {
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      handler: async (args: any) => {
        const result = await handler(args);
        // Ensure proper response format
        if (result && typeof result === 'object' && result.content) {
          return result;
        }
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        };
      }
    });
  }

  getTools(): any[] {
    return Array.from(this.tools.values());
  }

  async callTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool || !tool.handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return await tool.handler(args);
  }
}

class SolidMcpServer {
  private server: Server;
  private adapter: McpServerAdapter;
  private solidService: SolidCssMcpService;

  constructor() {
    this.solidService = new SolidCssMcpService();
    this.adapter = new McpServerAdapter(this.solidService);
    
    this.server = new Server(
      {
        name: 'solid-pod-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.registerTools();
  }

  private setupHandlers(): void {
    // Handle list_tools requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.adapter.getTools(),
      };
    });

    // Handle call_tool requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        return await this.adapter.callTool(name, args || {});
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Tool execution failed: ${errorMessage}`);
      }
    });

    // Error handling
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error);
    };
  }

  private registerTools(): void {
    console.error('🔷 Registering Solid Pod tools...');
    
    // Use your existing tool registration functions
    // They will call adapter.tool() instead of mcpServer.tool()
    registerSolidLoginTool(this.adapter as any, this.solidService);
    registerReadResourceTool(this.adapter as any, this.solidService);
    registerWriteTextResourceTool(this.adapter as any, this.solidService);
    registerListContainerTool(this.adapter as any, this.solidService);
    registerDeleteResourceTool(this.adapter as any, this.solidService);
    
    // Add ping tool for testing
    this.adapter.tool('ping', 'Test connectivity', {
      type: 'object',
      properties: {}
    }, async () => {
      return { content: [{ type: 'text', text: 'pong' }] };
    });
    
    console.error('✅ All Solid Pod tools registered.');
  }

  public async start(): Promise<void> {
    try {
      // Create stdio transport for communication with Claude
      const transport = new StdioServerTransport();
      
      // Connect the server to the transport
      await this.server.connect(transport);
      
      console.error('✅ MCP Server with Solid Tools started and connected successfully');
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      throw error;
    }
  }
}

// --- Application Entry Point ---
async function main() {
  try {
    const mcpServer = new SolidMcpServer();
    await mcpServer.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});