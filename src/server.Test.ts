import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SolidCssMcpService } from './services/solid.service.js'; // Import your service

class SolidPodMcpServer {
  private server: Server;
  private solidService: SolidCssMcpService; // Add an instance of your service

  constructor() {
    this.solidService = new SolidCssMcpService(); // Initialize the service
    this.server = new Server(
      {
        name: 'solid-pod-tools-test',
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
          // Add the solid_login tool to the list
          {
            name: 'solid_login',
            description: 'Logs into a Solid Pod to establish an authenticated session.',
            // FIX: Use a plain JSON Schema object instead of a Zod object for maximum compatibility.
            inputSchema: {
                type: 'object',
                properties: {
                    email: { type: 'string', description: "The account email for the Solid Pod." },
                    password: { type: 'string', description: "The account password for the Solid Pod." },
                    oidcIssuer: { type: 'string', description: "The OIDC Issuer URL (e.g., http://localhost:3000/)." }
                },
                required: ['email', 'password', 'oidcIssuer'],
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
            content: [{ type: 'text', text: 'pong' }],
          };

        // Add a case to handle the solid_login tool call
        case 'solid_login':
          try {
            // Type assertion to help TypeScript understand the arguments
            const loginArgs = args as { email: string; password: string; oidcIssuer: string };
            await this.solidService.authenticate(loginArgs.oidcIssuer);
            return {
              content: [{ type: 'text', text: '✅ Login successful. Session is active.' }],
            };
          } catch (error: any) {
            // FIX: Add more detailed error logging to see the exact cause of failure.
            console.error('--- ERROR DURING solid_login TOOL EXECUTION ---');
            console.error(error);
            console.error('---------------------------------------------');
            return {
              content: [{ type: 'text', text: `❌ Login failed: ${error.message}` }],
            };
          }

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
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('✅ Test MCP Server with Login Tool started and connected successfully');
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
