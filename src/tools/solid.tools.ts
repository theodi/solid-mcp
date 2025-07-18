import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SolidCssMcpService, SolidToolError } from '../services/solid.service.js';

// --- HELPER FOR PARSING ERRORS ---
function handleSolidError(error: any): { content: [{ type: 'text', text: string }] } {
  if (error instanceof SolidToolError) {
    return { content: [{ type: 'text', text: `❌ Error (${error.status}): ${error.message}` }] };
  }
  if (error.statusCode) {
    let message = `❌ A Solid error occurred (${error.statusCode}).`;
    if (error.statusCode === 401) message += " Unauthorized. Your session may have expired.";
    if (error.statusCode === 403) message += " Forbidden. You may not have permission for this action.";
    if (error.statusCode === 404) message += " Resource not found.";
    return { content: [{ type: 'text', text: message }] };
  }
  return { content: [{ type: 'text', text: `❌ An unexpected error occurred: ${error.message}` }] };
}

// --- MCP TOOL REGISTRATION FUNCTIONS ---
// Each function is now correctly exported.

export function registerSolidLoginTool(server: any, service: SolidCssMcpService) {
  server.tool(
    'solid_login',
    'Logs into a Solid Pod to establish an authenticated session for other tools.',
    {
        type: 'object',
        properties: {
            email: { type: 'string', description: "The account email for the Solid Pod." },
            password: { type: 'string', description: "The account password for the Solid Pod." },
            oidcIssuer: { type: 'string', description: "The OIDC Issuer URL (e.g., http://localhost:3000/)." }
        },
        required: ['email', 'password', 'oidcIssuer'],
    },
    async (args: any) => {
      try {
        await service.authenticate(args.email, args.password, args.oidcIssuer);
        return { content: [{ type: 'text', text: '✅ Login successful. Session is active.' }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerReadResourceTool(server: any, service: SolidCssMcpService) {
  server.tool(
    'read_resource',
    'Reads the content of a resource from the Solid Pod.',
    {
        type: 'object',
        properties: { resourceUrl: { type: 'string', description: "The full URL of the resource to read." } },
        required: ['resourceUrl'],
    },
    async ({ resourceUrl }: any) => {
      try {
        const content = await service.readResource(resourceUrl);
        return { content: [{ type: 'text', text: content }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerWriteTextResourceTool(server: any, service: SolidCssMcpService) {
  server.tool(
    'write_text_resource',
    'Writes or overwrites a text-based resource on the Solid Pod.',
    {
        type: 'object',
        properties: {
            resourceUrl: { type: 'string', description: "The full URL of the resource to write." },
            content: { type: 'string', description: "The text content to write to the file." },
            contentType: { type: 'string', description: "The MIME type (e.g., text/plain)." }
        },
        required: ['resourceUrl', 'content'],
    },
    async ({ resourceUrl, content, contentType }: any) => {
      try {
        const result = await service.writeResource(resourceUrl, content, contentType);
        return { content: [{ type: 'text', text: result }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerListContainerTool(server: any, service: SolidCssMcpService) {
    server.tool(
      'list_container',
      'Lists all resources within a specified container on the Solid Pod.',
      {
          type: 'object',
          properties: { containerUrl: { type: 'string', description: "The URL of the container to list." } },
          required: ['containerUrl'],
      },
      async ({ containerUrl }: any) => {
        try {
          const result = await service.listContainer(containerUrl);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return handleSolidError(error);
        }
      }
    );
}

export function registerDeleteResourceTool(server: any, service: SolidCssMcpService) {
    server.tool(
      'delete_resource',
      'Deletes a resource from the Solid Pod.',
      {
          type: 'object',
          properties: { resourceUrl: { type: 'string', description: "The full URL of the resource to delete." } },
          required: ['resourceUrl'],
      },
      async ({ resourceUrl }: any) => {
        try {
          const result = await service.deleteResource(resourceUrl);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return handleSolidError(error);
        }
      }
    );
}
