#!/usr/bin/env node
// Imprint MCP uninstaller.
//
//   node uninstall.js <json|toml> <pathSeg> [pathSeg...]
//
// Removes the Imprint MCP server entry from the IDE's config file (JSON or TOML).
// Committed as a file (not a shell one-liner) so shell quoting quirks — notably
// zsh history expansion on "!" — can never break it.
const os = require('os'), fs = require('fs'), path = require('path');

try {
  const [format, ...segs] = process.argv.slice(2);
  if (!format || segs.length === 0) {
    throw new Error('Usage: node uninstall.js <json|toml> <pathSeg> [pathSeg...]');
  }
  const configPath = path.join(os.homedir(), ...segs);
  if (fs.existsSync(configPath) === false) { console.log('No config at ' + configPath); process.exit(0); }
  const raw = fs.readFileSync(configPath, 'utf8');
  if (raw.trim().length === 0) { console.log('Config is empty; nothing to remove.'); process.exit(0); }

  if (format === 'toml') {
    const lines = raw.split(/\r?\n/);
    const out = []; let skip = false, removed = false;
    for (const line of lines) {
      if (/^\[/.test(line)) { skip = /^\[mcp_servers\.imprint/.test(line); if (skip) removed = true; }
      if (skip === false) out.push(line);
    }
    fs.writeFileSync(configPath, out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
    console.log(removed ? 'Removed Imprint from ' + configPath : 'Imprint not found in ' + configPath);
  } else {
    let config;
    try {
      config = JSON.parse(raw);
    } catch (e) {
      console.log('Config is not valid JSON; left untouched.');
      process.exit(0);
    }
    let removed = false;
    if (config.mcpServers && config.mcpServers.imprint) { delete config.mcpServers.imprint; removed = true; }
    if (config.servers && config.servers.imprint) { delete config.servers.imprint; removed = true; }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(removed ? 'Removed Imprint from ' + configPath : 'Imprint not found in ' + configPath);
  }
} catch (e) {
  console.error('Imprint uninstall failed: ' + e.message);
  process.exit(1);
}
