import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Blob } from 'node-fetch';
import * as solidClient from '@inrupt/solid-client';
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


// --- MCP TOOL DEFINITIONS ---

export function registerSolidLoginTool(server: McpServer, service: SolidCssMcpService) {
  server.tool(
    'solid_login',
    'Logs into a Solid Pod to establish an authenticated session for other tools.',
    z.object({
      email: z.string().email().describe("The account email for the Solid Pod."),
      password: z.string().describe("The account password for the Solid Pod."),
      oidcIssuer: z.string().url().describe("The OIDC Issuer URL (e.g., http://localhost:3000/)."),
    }).strip().shape,
    async (args) => {
      try {
        await service.authenticate(args.email, args.password, args.oidcIssuer);
        return { content: [{ type: 'text', text: '✅ Login successful. Session is active.' }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerReadResourceTool(server: McpServer, service: SolidCssMcpService) {
  server.tool(
    'read_resource',
    'Reads the content of a resource from the Solid Pod.',
    z.object({
      resourceUrl: z.string().url().describe("The full URL of the resource to read."),
    }).strip().shape,
    async ({ resourceUrl }) => {
      try {
        const authFetch = service.getAuthFetch();
        const file = await solidClient.getFile(resourceUrl, { fetch: authFetch });
        const content = await file.text();
        return { content: [{ type: 'text', text: content }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerWriteTextResourceTool(server: McpServer, service: SolidCssMcpService) {
  server.tool(
    'write_text_resource',
    'Writes or overwrites a text-based resource on the Solid Pod.',
    z.object({
      resourceUrl: z.string().url().describe("The full URL of the resource to write."),
      content: z.string().describe("The text content to write to the file."),
      contentType: z.string().optional().default('text/plain').describe("The MIME type of the content (e.g., text/plain, application/json)."),
    }).strip().shape,
    async ({ resourceUrl, content, contentType }) => {
      try {
        const authFetch = service.getAuthFetch();
        await solidClient.overwriteFile(
          resourceUrl,
          new Blob([content], { type: contentType }),
          { fetch: authFetch }
        );
        return { content: [{ type: 'text', text: `✅ Successfully wrote to ${resourceUrl}` }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerListContainerTool(server: McpServer, service: SolidCssMcpService) {
    server.tool(
      'list_container',
      'Lists all resources within a specified container on the Solid Pod.',
      z.object({
        containerUrl: z.string().url().describe("The URL of the container to list."),
      }).strip().shape,
      async ({ containerUrl }) => {
        try {
          const authFetch = service.getAuthFetch();
          const containerDataset = await solidClient.getSolidDataset(containerUrl, { fetch: authFetch });
          const containedResources = solidClient.getContainedResourceUrlAll(containerDataset);
          const resourceList = containedResources.join('\n');
          return { content: [{ type: 'text', text: `Resources in ${containerUrl}:\n${resourceList}` }] };
        } catch (error: any) {
          return handleSolidError(error);
        }
      }
    );
}

export function registerDeleteResourceTool(server: McpServer, service: SolidCssMcpService) {
    server.tool(
      'delete_resource',
      'Deletes a resource from the Solid Pod.',
      z.object({
        resourceUrl: z.string().url().describe("The full URL of the resource to delete."),
      }).strip().shape,
      async ({ resourceUrl }) => {
        try {
          const authFetch = service.getAuthFetch();
          await solidClient.deleteFile(resourceUrl, { fetch: authFetch });
          return { content: [{ type: 'text', text: `✅ Successfully deleted ${resourceUrl}` }] };
        } catch (error: any) {
          return handleSolidError(error);
        }
      }
    );
}
