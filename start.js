const { spawn } = require('child_process');
const path = require('path');

const isDev = process.argv.includes('--dev');
const frontendCmd = isDev ? 'dev' : 'start';

console.log(`\n🚀 Starting Campus Hub (${isDev ? 'Development' : 'Production'} Mode)...\n`);

const servers = [
  { name: '📚 Library',        dir: 'mcp-servers/library-server',        port: 4001 },
  { name: '🍽️  Cafeteria',      dir: 'mcp-servers/cafeteria-server',      port: 4002 },
  { name: '🎉 Events',         dir: 'mcp-servers/events-server',         port: 4003 },
  { name: '🎓 Academics',      dir: 'mcp-servers/academics-server',      port: 4004 },
  { name: '🔔 Notifications',  dir: 'mcp-servers/notifications-server',  port: 4005 },
];

const children = [];

// Start all MCP servers
servers.forEach(server => {
  console.log(`  ${server.name} → port ${server.port}`);
  const child = spawn('node', ['index.js'], {
    cwd: path.join(__dirname, server.dir),
    env: { ...process.env, PORT: String(server.port) },
    shell: true,
    stdio: 'pipe',
  });

  child.stdout.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.log(`[${server.name}] ${msg}`);
  });
  child.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.log(`[${server.name}] ${msg}`);
  });
  child.on('error', err => console.error(`[${server.name}] Failed to start: ${err.message}`));

  children.push(child);
});

// Wait for MCP servers to initialize, then start Next.js
setTimeout(() => {
  console.log(`\n🌐 Starting Next.js Dashboard (npm run ${frontendCmd}) → port 3000...\n`);
  const frontend = spawn('npm', ['run', frontendCmd], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    stdio: 'inherit',
  });

  frontend.on('error', err => console.error(`[Next.js] Failed to start: ${err.message}`));
  children.push(frontend);
}, 3000);

// Graceful shutdown — works on Windows (SIGINT) and Unix
function shutdown() {
  console.log('\n🛑 Shutting down all services...');
  children.forEach(child => {
    try {
      // On Windows, child.kill() sends SIGTERM which may not work.
      // Using taskkill via shell ensures the process tree is cleaned up.
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { shell: true, stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch { /* already exited */ }
  });
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
