import { spawn } from 'child_process';
import path from 'path';
import { once } from 'events';

describe('Integration: Solid Pod MCP Server', () => {
  it('should start the server and respond to a solid_login tool call', async () => {
    // Path to the compiled server.js (adjust if needed)
    const serverPath = path.resolve(__dirname, '../dist/server.js');
    const env = { ...process.env, SOLID_EMAIL: 'test@example.com', SOLID_PASSWORD: 'pw' };
    const child = spawn('node', [serverPath], { env });

    // Helper to send a JSON-RPC request
    function sendRpc(method, params, id = 1) {
      const req = JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n';
      child.stdin.write(req);
    }

    // Wait for server to be ready (give it a moment to start)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Listen for output
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Send a list_tools request
    sendRpc('list_tools', {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(output).toContain('solid_login');

    // Send a solid_login tool call (simulate the tool call structure)
    sendRpc('call_tool', {
      name: 'solid_login',
      arguments: { oidcIssuer: 'http://localhost:3000/' }
    }, 2);

    // Wait for the response
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(output).toMatch(/Login successful|sessionId/i);

    // Clean up
    child.kill();
  });
});
