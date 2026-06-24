#!/usr/bin/env node
// Imprint MCP installer.
//
//   node install.js <platform> <userId> <json|toml> <pathSeg> [pathSeg...]
//
// The <pathSeg> list is joined under the user's home dir to locate the IDE's
// MCP config file (e.g. ".claude.json" or ".cursor" "mcp.json"). The script:
//   1. ensures ~/imprint/mcp/server.js exists (clones + installs if missing),
//   2. writes the Imprint MCP server entry into the IDE config (JSON or TOML).
//
// Written as a committed file (not a shell one-liner) so it is immune to shell
// quoting quirks — most notably zsh history expansion on "!", which silently
// breaks `node -e "...if(!f.existsSync...)..."` on a default macOS terminal.
const os = require('os'), fs = require('fs'), path = require('path'), cp = require('child_process');

function have(cmd) { try { cp.execSync(cmd, { stdio: 'ignore' }); return true; } catch (e) { return false; } }
function rmrf(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }

try {
  const [platform, userId, format, ...segs] = process.argv.slice(2);
  if (!platform || !userId || !format || segs.length === 0) {
    throw new Error('Usage: node install.js <platform> <userId> <json|toml> <pathSeg> [pathSeg...]');
  }
  if (have('git --version') === false) {
    throw new Error('git is not installed. On macOS run: xcode-select --install');
  }

  // Ensure ~/imprint/mcp/server.js exists. A config that points at a server.js
  // the user never cloned is the #1 cause of "Cannot find module .../server.js".
  // If the folder exists but server.js does not, the previous clone was partial
  // or corrupt — wipe it so `git clone` does not fail on a non-empty directory.
  const dir = path.join(os.homedir(), 'imprint');
  const serverPath = path.join(dir, 'mcp', 'server.js');
  if (fs.existsSync(serverPath) === false) {
    if (fs.existsSync(dir) === true) rmrf(dir);
    process.chdir(os.homedir());
    cp.execSync('git clone https://github.com/YashasviThakur/Imprint imprint', { stdio: 'inherit' });
    cp.execSync('npm install', { cwd: path.join(dir, 'mcp'), stdio: 'inherit' });
  }
  const serverArg = serverPath.split(path.sep).join('/');

  const configPath = path.join(os.homedir(), ...segs);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  if (format === 'toml') {
    // Codex reads TOML ([mcp_servers.x]) — not JSON. Append a block idempotently.
    const body = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    if (body.includes('[mcp_servers.imprint]')) {
      console.log('Imprint already in ' + configPath);
    } else {
      const q = String.fromCharCode(34);
      const block =
        '\n\n[mcp_servers.imprint]\n' +
        'command = ' + q + 'node' + q + '\n' +
        'args = [' + q + serverArg + q + ']\n\n' +
        '[mcp_servers.imprint.env]\n' +
        'IMPRINT_USER_ID = ' + q + userId + q + '\n' +
        'IMPRINT_PLATFORM = ' + q + platform + q + '\n';
      fs.writeFileSync(configPath, body.trimEnd() + block);
      console.log('Done. Imprint added to ' + configPath);
    }
  } else {
    let config = {};
    if (fs.existsSync(configPath) === true) {
      const raw = fs.readFileSync(configPath, 'utf8').trim();
      if (raw.length > 0) {
        try {
          config = JSON.parse(raw);
        } catch (e) {
          // Existing config is invalid JSON (or JSONC with comments). Don't crash
          // and don't destroy it silently — back it up, then start clean.
          const backup = configPath + '.imprint-backup-' + Date.now();
          fs.writeFileSync(backup, raw);
          console.error('Warning: existing config was not valid JSON. Backed up to ' + backup);
          config = {};
        }
      }
    }
    if (typeof config !== 'object' || config === null) config = {};
    if (typeof config.mcpServers !== 'object' || config.mcpServers === null) config.mcpServers = {};
    config.mcpServers.imprint = {
      command: 'node',
      args: [serverArg],
      env: { IMPRINT_USER_ID: userId, IMPRINT_PLATFORM: platform },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Done. Imprint added to ' + configPath);
  }
} catch (e) {
  console.error('Imprint install failed: ' + e.message);
  process.exit(1);
}
