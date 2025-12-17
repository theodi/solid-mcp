# Solid Pod MCP Service

> ⚠️ **Warning:** This project is currently for demonstrative purposes only. It is not intended for production use.

## Overview
This service acts as a secure bridge between a large language model (LLM), such as Claude, and a personal Solid Pod. It exposes a set of callable tools over the Model Context Protocol (MCP), allowing an AI agent to perform complex operations on a Solid Pod—such as authentication, reading data, writing files, managing permissions, and updating structured data—through simple, natural language commands.

The core architecture separates the client (the Claude AI Desktop app) from the secure data store (the Solid Pod). The MCP server is the trusted backend that manages the authenticated session and handles all direct communication with the pod, ensuring that no sensitive credentials are ever exposed to the front-end or the AI model itself.

## server.ts – Main Server Entry Point

The `server.ts` file is the main entry point for the Solid Pod MCP service. It is responsible for:

- Loading environment variables (including credentials and API keys) using `dotenv`.
- Initialising the Solid service and tool registry.
- Registering all available Solid Pod tools (such as login, read, write, update, grant access, etc.) with the MCP server.
- Setting up request handlers for tool listing and tool invocation, routing requests to the correct tool handler.
- Handling errors and logging using the provided logger.
- Starting the MCP server using the Model Context Protocol SDK and connecting via the Stdio transport, which allows integration with the Claude AI Desktop application or other MCP-compatible clients.

The server is designed for extensibility and security, ensuring that all tool calls are properly routed and that sensitive operations are handled on the backend. If you wish to customise the server (for example, to add new tools or change logging behaviour), you can do so by editing `src/server.ts` and the relevant tool registration files.

To run the server, simply execute:
```
npm start
```
or, if running directly:
```
node dist/server.js
```

The server will automatically load environment variables from your `.env` file and begin listening for MCP tool requests via standard input/output.

## Prerequisites & Setup

Before running this service, ensure the following are in place:
- **Community Solid Server (CSS):** You must have a running instance of the CSS. The default configuration assumes it is running at http://localhost:3000/.
- **Node.js Environment:** The MCP server is a Node.js application and requires Node.js and npm to be installed.
- **Dependencies:** Navigate to your project directory (e.g., `/Users/kwaku/solid-mcp-latest`) in the terminal and run `npm install` to install all required packages.
- **Environment Variables:**
  - Create a `.env` file in the root of your project directory to store API keys for the AI models.
  - **Solid Pod credentials** must be set as environment variables:
    - `SOLID_EMAIL="your-solid-email@example.com"`
    - `SOLID_PASSWORD="your-solid-password"`

### Example .env
```
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
OPENAI_API_KEY="your-openai-api-key-here"
SOLID_EMAIL="your-solid-email@example.com"
SOLID_PASSWORD="your-solid-password"
```

## How to Use with Claude AI Desktop
To have the Claude AI Desktop application launch and use this custom tool server, you must update its configuration file. The following JSON tells the app how to start your compiled server script.

### claude_desktop_config.json:
```json
{
  "mcpServers": {
    "solid_pod_tools": {
      "command": "node",
      "args": [
        "/Users/kwaku/solid-mcp-latest/dist/server.js"
      ],
      "options": {
        "cwd": "/Users/kwaku/solid-mcp-latest"
      }
    }
  }
}
```

## Session Management
- When you log in, you receive a `sessionId` that is required for all subsequent tool calls.
- Sessions expire automatically after 1 hour for security.
- If your session expires, simply log in again to receive a new `sessionId`.

## Tool Reference & Usage Examples
The service exposes a suite of tools for interacting with a Solid Pod. The standard workflow is to first call `solid_login` to create an authenticated session. The AI will then automatically use the `sessionId` from that login for all subsequent tool calls within the same conversation.

### solid_login
**Description:** Logs into a Solid Pod using credentials from environment variables. Returns a `sessionId` for use in all other tools.
- `oidcIssuer` (string): The OIDC Issuer URL (e.g., http://localhost:3000/).

**Example Command in Claude Desktop:**
```
Log me into my Solid Pod at http://localhost:3000/.
```

### discover_pod_storage
**Description:** Discovers the root storage URL of a Solid Pod from a given WebID. Can use a session to see private profiles.
- `webId` (string): The WebID of the user (e.g., https://pod.example.com/profile/card#me).
- `sessionId` (string, optional): The active session ID to discover from a private WebID profile.

**Example:**
```
Find the storage root for my WebID https://localhost:3000/kwaku/profile/card#me using my current session.
```

### read_resource
**Description:** Reads the content of a resource from the Solid Pod using an active session.
- `sessionId` (string): The active session ID returned from the login tool.
- `resourceUrl` (string): The full URL of the resource to read.

**Example:**
```
Read the contents of http://localhost:3000/kwaku/private/ai-note.txt using my session.
```

### write_text_resource
**Description:** Writes or overwrites a text-based resource on the Solid Pod using an active session.
- `sessionId` (string): The active session ID returned from the login tool.
- `resourceUrl` (string): The full URL of the resource to write.
- `content` (string): The text content to write to the file.
- `contentType` (string, optional): The MIME type (e.g., text/plain). Defaults to text/plain if not specified.

**Example:**
```
Write "This note was written by Claude." to http://localhost:3000/kwaku/private/ai-note.txt as plain text using my session.
```

### update_rdf_resource
**Description:** Updates a specific data property (predicate) for a specific entry (Thing) within an RDF resource.
- `sessionId` (string): The active session ID from the login tool.
- `resourceUrl` (string): The URL of the RDF file (e.g., .../profile.ttl).
- `thingUrl` (string): The URL of the specific data entry to update (e.g., .../profile.ttl#me).
- `predicate` (string): The data property to update (e.g., http://xmlns.com/foaf/0.1/name).
- `value` (string): The new string value for the property.

**Example:**
```
Update my profile at http://localhost:3000/kwaku/private/profile.ttl. For the entry http://localhost:3000/kwaku/private/profile.ttl#me, set the http://xmlns.com/foaf/0.1/name property to "Kwaku A."
```

### grant_access
**Description:** Grants specific access permissions (read, write, append) for a resource to another person (agent).
- `sessionId` (string): The active session ID from the login tool.
- `resourceUrl` (string): The URL of the resource to share.
- `agentWebId` (string): The WebID of the person to grant access to.
- `access` (object): An object specifying `read`, `write`, and `append` permissions as booleans.

**Example:**
```
Grant read access (but not write or append) to http://localhost:3000/kwaku/private/ai-note.txt for WebID http://localhost:3000/friend/profile/card#me.
```

### list_container
**Description:** Lists all resources within a specified container on the Solid Pod using an active session.
- `sessionId` (string): The active session ID returned from the login tool.
- `containerUrl` (string): The URL of the container to list.

**Example:**
```
Show me all the files in my private container at http://localhost:3000/kwaku/private/.
```

### delete_resource
**Description:** Deletes a resource from the Solid Pod using an active session.
- `sessionId` (string): The active session ID returned from the login tool.
- `resourceUrl` (string): The full URL of the resource to delete.

**Example:**
```
Delete the file at http://localhost:3000/kwaku/private/ai-note.txt using my session.
```

## Error Handling
- All tools return clear, user-friendly error messages, including HTTP status codes and explanations for common Solid errors (401 Unauthorised, 403 Forbidden, 404 Not Found).
- If your session is invalid or expired, you will receive an error and should log in again.

## Security
- Credentials are never exposed to the AI or front-end; all authentication is handled securely on the backend.
- Sessions are automatically cleaned up after expiry.

## Logging

This project uses the [Pino](https://getpino.io/#/) logging library for all server and tool logging. Logs are configured to be written to **stderr** (standard error), which ensures that diagnostic and informational logs do not interfere with the JSON-RPC protocol communication on **stdout** (standard output). This is particularly important for compatibility with the Claude AI Desktop application and other MCP-compatible clients.

- **Default log level:** `info` (can be changed in `src/logger.ts`)
- **Log output:** All logs are sent to stderr by default.
- **Purpose:** Keeping logs separate from protocol output prevents corruption of the data stream between the MCP server and clients.

If you wish to customise logging (for example, to change the log level or output destination), you can edit the configuration in `src/logger.ts`. For more advanced options, refer to the [Pino documentation](https://getpino.io/#/).

Logging is used throughout the codebase, including in all major operations and error handling (even within try/catch blocks), to provide clear diagnostics and traceability.

## Testing & Test Scope

This project includes both unit and integration tests to ensure reliability and maintainability.

### Running Tests

To run all tests, use:
```
npm test
```

### Test Types
- **Unit tests** (in `src/services/solid.service.test.ts`):
  - Cover all public methods of the core service (`SolidCssMcpService`).
  - Use comprehensive mocking for all external dependencies (Solid client, authentication, network, etc.).
  - Test both success and error/edge cases, including environment variable handling and session management.
  - Assertions are made on returned values, thrown errors, and correct behaviour for all scenarios.

- **Integration tests** (in `__tests__/main-test.ts`):
  - Start the actual server and test the end-to-end flow, including tool registration and invocation.
  - Simulate real tool calls (e.g., `solid_login`) and assert on the server's responses.
  - Ensure the server works as expected in a real environment, with environment variables set.

### Scope
- All public service methods are tested, including authentication, resource reading/writing, container listing, RDF updates, and access grants.
- Integration tests verify the server's ability to register tools and handle requests via the Model Context Protocol.
- Mocking is used extensively in unit tests to isolate logic and avoid network or external service dependencies.
- Tests use British English in comments and messages for consistency.

For more details, see the test files in `src/services/` and `__tests__/`.

---
For further details, see the code in `src/services/solid.service.ts` and `src/tools/solid.tools.ts`.

