# Solid Pod MCP Service

# Overview
This service acts as a secure bridge between a large language model (LLM), such as Claude, and a personal Solid Pod. It exposes a set of callable tools over the Model Context Protocol (MCP), allowing an AI agent to perform complex operations on a Solid Pod—such as authentication, reading data, writing files, managing permissions, and updating structured data—through simple, natural language commands.
The core architecture separates the client (the Claude AI Desktop app) from the secure data store (the Solid Pod). The MCP server is the trusted backend that manages the authenticated session and handles all direct communication with the pod, ensuring that no sensitive credentials are ever exposed to the front-end or the AI model itself.

## Prerequisites & Setup

Before running this service, ensure the following are in place:
Community Solid Server (CSS): You must have a running instance of the CSS. The default configuration in the scripts assumes it is running at http://localhost:3000/.
Node.js Environment: The MCP server is a Node.js application and requires Node.js and npm to be installed.
Dependencies: Navigate to your project directory example (/Users/kwaku/solid-mcp-latest) in the terminal and run npm install to install all required packages.
Environment File (.env): Create a file named .env in the root of your project directory to store API keys for the AI models.

## .env
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
OPENAI_API_KEY="your-openai-api-key-here"


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


## Tool Reference & Usage Examples
The service exposes a suite of tools for interacting with a Solid Pod. The standard workflow is to first call solid_login to create an authenticated session. The AI will then automatically use the sessionId from that login for all subsequent tool calls within the same conversation.

### solid_login
Description: Logs into a Solid Pod to establish a secure session. This must be the first command you give.
email (string): The email for the Solid Pod account.
password (string): The password for the account.
oidcIssuer (string): The base URL of the Solid server.

#### Example Command in Claude Desktop:
Log me into my Solid Pod. My email is kwaku@theodi.org, my password is password, and the server is at http://localhost:3000/.

### write_text_resource
Description: Writes or overwrites a text-based file (e.g., .txt, .json) to a specified location on the Solid Pod.
sessionId (string): The active session ID (provided automatically by the AI after login).
resourceUrl (string): The full URL where the file should be saved.
content (string): The text content to be written to the file.

#### 
Example Command in Claude Desktop:
Using my current session, create a new file in my private folder at http://localhost:3000/kwaku/private/ai-note.txt with the content "This note was written by Claude."

### read_resource
Description: Reads and returns the text content of a specified resource from the Solid Pod.
sessionId (string): The active session ID.
resourceUrl (string): The full URL of the file to read.

#### Example Command in Claude Desktop:
Can you read the contents of the file http://localhost:3000/kwaku/private/ai-note.txt for me?

### update_rdf_resource
Description: Updates a specific data property (a "predicate") for a specific entry (a "Thing") within a structured RDF file (like a .ttl file).
sessionId (string): The active session ID.
resourceUrl (string): The URL of the RDF file (e.g., .../profile.ttl).
thingUrl (string): The URL of the specific data entry to update (e.g., .../profile.ttl#me).
predicate (string): The data property to update (e.g., http://xmlns.com/foaf/0.1/name).
value (string): The new value for the property.

#### Example Command in Claude Desktop:
Please update my profile at http://localhost:3000/kwaku/private/profile.ttl. For the entry http://localhost:3000/kwaku/private/profile.ttl#me, set the http://xmlns.com/foaf/0.1/name property to "Kwaku A."

### grant_access
Description: Grants specific access permissions for a resource to another person (identified by their WebID).
sessionId (string): The active session ID.
resourceUrl (string): The URL of the resource to share.
agentWebId (string): The WebID of the person to grant access to.
access (object): An object specifying read, write, and append permissions as booleans.

#### Example Command in Claude Desktop:
Grant access to my file http://localhost:3000/kwaku/private/ai-note.txt. Give the person with WebID http://localhost:3000/friend/profile/card#me read access, but deny write and append access.
list_container
Description: Lists all files and folders within a specified container on the Solid Pod.
sessionId (string): The active session ID.
containerUrl (string): The URL of the container to list.

#### Example Command in Claude Desktop:
Show me all the files in my private container.
(The AI should be able to infer the container URL from the login context).

### delete_resource
Description: Permanently deletes a file or an empty container from the Solid Pod.
sessionId (string): The active session ID.
resourceUrl (string): The full URL of the resource to delete.
#### Example Command in Claude Desktop:
Please delete the file at http://localhost:3000/kwaku/private/ai-note.txt.

