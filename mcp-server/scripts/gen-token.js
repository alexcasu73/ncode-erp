#!/usr/bin/env node
import crypto from 'node:crypto';

const token = 'mcp_' + crypto.randomBytes(24).toString('hex');
const line = `\nMCP_AUTH_TOKEN=${token}\n`;

console.log('\nNuovo MCP_AUTH_TOKEN generato:\n');
console.log('  ' + token + '\n');
console.log('Copialo nel file .env di mcp-server:');
console.log(line.trim());
console.log('\nI client dovranno inviarlo come header:');
console.log('  Authorization: Bearer ' + token);
console.log('e la API key aziendale come header:');
console.log('  X-API-Key: <ncode_...>\n');