import { pino } from 'pino'; // FIX: Use a named import instead of a default import.

// Configure the logger to write to stderr, which is compatible with the Claude/Cursor apps.
// This ensures diagnostic logs don't interfere with the JSON-RPC communication on stdout.
const logger = pino({
    level: 'info', // Set the default log level (e.g., 'info', 'debug', 'warn', 'error')
}, pino.destination(process.stderr));

export default logger;
