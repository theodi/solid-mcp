import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

class SolidPodMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'solid-pod-tools',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    // Register list_tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'ping',
            description: 'A simple tool that responds with "pong". Used to test server connectivity.',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ],
      };
    });

    // Register call_tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'ping':
          return {
            content: [
              {
                type: 'text',
                text: 'pong',
              },
            ],
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error);
    };
  }

  public async start(): Promise<void> {
    // Create stdio transport
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await this.server.connect(transport);
    
    console.error('🔷 Registering dummy "ping" tool...');
    console.error('✅ "ping" tool registered.');
    console.error('✅ MCP Server started and connected successfully');
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

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});