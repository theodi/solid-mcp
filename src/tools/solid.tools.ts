import { SolidCssMcpService, SolidToolError, AccessModes } from '../services/solid.service.js';
import logger from '../logger.js';

// --- HELPER FOR PARSING ERRORS ---
function handleSolidError(error: any): { content: [{ type: 'text', text: string }] } {
  logger.error({ err: error }, 'An error occurred while executing a Solid tool.');
  if (error instanceof SolidToolError) {
    return { content: [{ type: 'text', text: `❌ Error (${error.status}): ${error.message}` }] };
  }
  if (error.statusCode) {
    let message = `❌ A Solid error occurred (${error.statusCode}).`;
    if (error.statusCode === 401) message += " Unauthorized. The resource may be private, or your session may be invalid/expired.";
    if (error.statusCode === 403) message += " Forbidden. You may not have permission for this action.";
    if (error.statusCode === 404) message += " Resource not found.";
    return { content: [{ type: 'text', text: message }] };
  }
  return { content: [{ type: 'text', text: `❌ An unexpected error occurred: ${error.message}` }] };
}

// --- MCP TOOL REGISTRATION FUNCTIONS ---

export function registerSolidLoginTool(server: any, service: SolidCssMcpService) {
  server.tool(
    'solid_login',
    'Logs into a Solid Pod using credentials from secure environment config. Returns a sessionId.',
    {
        type: 'object',
        properties: {
            oidcIssuer: { type: 'string', description: "The OIDC Issuer URL (e.g., http://localhost:3000/)." }
        },
        required: ['oidcIssuer'],
    },
    async (args: any) => {
      try {
        const sessionId = await service.authenticate(args.oidcIssuer);
        return { content: [{ type: 'text', text: `✅ Login successful. Use this sessionId for other operations: ${sessionId}` }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerDiscoverPodTool(server: any, service: SolidCssMcpService) {
    server.tool(
      'discover_pod_storage',
      'Discovers the root storage URL of a Solid Pod from a given WebID. Can use a session to see private profiles.',
      {
          type: 'object',
          properties: {
              webId: { type: 'string', description: "The WebID of the user (e.g., https://pod.example.com/profile/card#me)." },
              // CHANGED: Added optional sessionId to the schema
              sessionId: { type: 'string', description: "Optional: The active session ID to discover from a private WebID profile." }
          },
          required: ['webId'],
      },
      // CHANGED: The handler now accepts sessionId and passes it to the service
      async ({ webId, sessionId }: any) => {
        try {
          const podUrl = await service.discoverPod(webId, sessionId);
          return { content: [{ type: 'text', text: `✅ Pod storage found: ${podUrl}` }] };
        } catch (error: any) {
          return handleSolidError(error);
        }
      }
    );
}

export function registerReadResourceTool(server: any, service: SolidCssMcpService) {
  server.tool(
    'read_resource',
    'Reads the content of a resource from the Solid Pod using an active session.',
    {
        type: 'object',
        properties: { 
            sessionId: { type: 'string', description: "The active session ID returned from the login tool." },
            resourceUrl: { type: 'string', description: "The full URL of the resource to read." } 
        },
        required: ['sessionId', 'resourceUrl'],
    },
    async ({ sessionId, resourceUrl }: any) => {
      try {
        const content = await service.readResource(sessionId, resourceUrl);
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
    'Writes or overwrites a text-based resource on the Solid Pod using an active session.',
    {
        type: 'object',
        properties: {
            sessionId: { type: 'string', description: "The active session ID returned from the login tool." },
            resourceUrl: { type: 'string', description: "The full URL of the resource to write." },
            content: { type: 'string', description: "The text content to write to the file." },
            contentType: { type: 'string', description: "The MIME type (e.g., text/plain)." }
        },
        required: ['sessionId', 'resourceUrl', 'content'],
    },
    async ({ sessionId, resourceUrl, content, contentType }: any) => {
      try {
        const result = await service.writeResource(sessionId, resourceUrl, content, contentType);
        return { content: [{ type: 'text', text: result }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerUpdateRdfResourceTool(server: any, service: SolidCssMcpService) {
  server.tool(
    'update_rdf_resource',
    'Updates a specific data property (predicate) for a specific entry (Thing) within an RDF resource.',
    {
        type: 'object',
        properties: {
            sessionId: { type: 'string', description: "The active session ID from the login tool." },
            resourceUrl: { type: 'string', description: "The URL of the RDF file (e.g., profile.ttl)." },
            thingUrl: { type: 'string', description: "The URL of the specific data entry to update (e.g., '.../profile.ttl#me')." },
            predicate: { type: 'string', description: "The data property to update (e.g., 'http://xmlns.com/foaf/0.1/name')." },
            value: { type: 'string', description: "The new string value for the property." }
        },
        required: ['sessionId', 'resourceUrl', 'thingUrl', 'predicate', 'value'],
    },
    async (args: any) => {
      try {
        const result = await service.updateRdfResource(args.sessionId, args.resourceUrl, args.thingUrl, args.predicate, args.value);
        return { content: [{ type: 'text', text: result }] };
      } catch (error: any) {
        return handleSolidError(error);
      }
    }
  );
}

export function registerGrantAccessTool(server: any, service: SolidCssMcpService) {
  server.tool(
    'grant_access',
    'Grants specific access permissions (read, write, append) for a resource to another person (agent).',
    {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: "The active session ID from the login tool." },
        resourceUrl: { type: 'string', description: "The URL of the resource to share." },
        agentWebId: { type: 'string', description: "The WebID of the person to grant access to." },
        access: {
          type: 'object',
          properties: {
            read: { type: 'boolean', description: "Allow read access." },
            write: { type: 'boolean', description: "Allow write access." },
            append: { type: 'boolean', description: "Allow append access." }
          },
          required: ['read', 'write', 'append']
        }
      },
      required: ['sessionId', 'resourceUrl', 'agentWebId', 'access']
    },
    async (args: { sessionId: string; resourceUrl: string; agentWebId: string; access: AccessModes }) => {
      try {
        const result = await service.grantAccess(args.sessionId, args.resourceUrl, args.agentWebId, args.access);
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
      'Lists all resources within a specified container on the Solid Pod using an active session.',
      {
          type: 'object',
          properties: { 
              sessionId: { type: 'string', description: "The active session ID returned from the login tool." },
              containerUrl: { type: 'string', description: "The URL of the container to list." } 
          },
          required: ['sessionId', 'containerUrl'],
      },
      async ({ sessionId, containerUrl }: any) => {
        try {
          const resourceUrls = await service.listContainer(sessionId, containerUrl);
          if (resourceUrls.length === 0) {
            return { content: [{ type: 'text', text: `The container ${containerUrl} is empty.`}] };
          }
          const formattedText = `Resources in ${containerUrl}:\n${resourceUrls.join('\n')}`;
          return { content: [{ type: 'text', text: formattedText }] };
        } catch (error: any) {
          return handleSolidError(error);
        }
      }
    );
}

export function registerDeleteResourceTool(server: any, service: SolidCssMcpService) {
    server.tool(
      'delete_resource',
      'Deletes a resource from the Solid Pod using an active session.',
      {
          type: 'object',
          properties: { 
              sessionId: { type: 'string', description: "The active session ID returned from the login tool." },
              resourceUrl: { type: 'string', description: "The full URL of the resource to delete." } 
          },
          required: ['sessionId', 'resourceUrl'],
      },
      async ({ sessionId, resourceUrl }: any) => {
        try {
          const result = await service.deleteResource(sessionId, resourceUrl);
          return { content: [{ type: 'text', text: result }] };
        } catch (error: any) {
          return handleSolidError(error);
        }
      }
    );
}