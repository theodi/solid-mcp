import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { SolidCssMcpService } from './services/solid.service.js';
import {
  registerSolidLoginTool,
  registerReadResourceTool,
  registerWriteTextResourceTool,
  registerListContainerTool,
  registerDeleteResourceTool,
} from './tools/solid.tools.js';

// Define types for better type safety
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<CallToolResult>;
}

interface ToolResponse {
  content: TextContent[];
}

// Adapter class to bridge between your existing tool registration and new MCP SDK
class McpServerAdapter {
  private tools: Map<string, ToolDefinition> = new Map();

  // Mock the old McpServer.tool method to collect tool definitions
  tool(name: string, description: string, inputSchema: any, handler: (args: any) => Promise<any>): void {
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      handler: async (args: any): Promise<CallToolResult> => {
        try {
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
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Tool execution failed: ${errorMessage}`);
        }
      }
    });
  }

  getTools(): Array<{ name: string; description: string; inputSchema: any }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async callTool(name: string, args: any): Promise<CallToolResult> {
    const tool = this.tools.get(name);
    if (!tool || !tool.handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    try {
      return await tool.handler(args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool execution failed: ${errorMessage}`);
    }
  }
}

class SolidMcpServer {
  private server: Server;
  private adapter: McpServerAdapter;
  private solidService: SolidCssMcpService;

  constructor() {
    this.solidService = new SolidCssMcpService();
    this.adapter = new McpServerAdapter();
    
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
      properties: {},
      required: []
    }, async (_args: any): Promise<CallToolResult> => {
      return { 
        content: [{ 
          type: 'text', 
          text: 'pong' 
        }] 
      };
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to start MCP server:', errorMessage);
      throw error;
    }
  }
}

// --- Application Entry Point ---
async function main(): Promise<void> {
  try {
    const mcpServer = new SolidMcpServer();
    await mcpServer.start();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to start server:', errorMessage);
    process.exit(1);
  }
}

main().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Unhandled error:', errorMessage);
  process.exit(1);
});