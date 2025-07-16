import 'dotenv/config'; // Loads environment variables from a .env file into process.env
import * as http from 'http'; // Import the standard Node.js HTTP module
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SolidCssMcpService } from './services/solid.service.js';
import {
  registerSolidLoginTool,
  registerReadResourceTool,
  registerWriteTextResourceTool,
  registerListContainerTool,
  registerDeleteResourceTool,
} from './tools/solid.tools.js';

// --- Server Class for Better Organization ---

class SolidMcpServer {
  private mcpServer: McpServer;
  private httpServer: http.Server;
  private solidService: SolidCssMcpService;
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.solidService = new SolidCssMcpService();
    
    this.mcpServer = new McpServer({
      name: 'solid-pod-mcp-server',
      version: '0.0.0-development',
      
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
      },
    });

    // The MCP Server request handler is likely called 'listener' or needs to be adapted
    // to the http.createServer signature. We'll use a wrapper for compatibility.
    this.httpServer = http.createServer((req, res) => {
        (this.mcpServer as any).listener(req, res);
    });

    this.registerTools();
  }

  private registerTools(): void {
    console.log('🔷 Registering Solid Pod tools...');
    
    registerSolidLoginTool(this.mcpServer, this.solidService);
    registerReadResourceTool(this.mcpServer, this.solidService);
    registerWriteTextResourceTool(this.mcpServer, this.solidService);
    registerListContainerTool(this.mcpServer, this.solidService);
    registerDeleteResourceTool(this.mcpServer, this.solidService);
    
    console.log('✅ All Solid Pod tools registered.');
  }

  public start(): void {
    this.httpServer.listen(this.port, () => {
        console.log(`✅ MCP Server with Solid Tools is running and listening on http://localhost:${this.port}`);
    });
  }
}

// --- Application Entry Point ---

function main() {
  const PORT = 3030;
  const mcpServer = new SolidMcpServer(PORT);
  mcpServer.start();
}

// Run the main function to start the server
main();
