const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const logStream = fs.createWriteStream(path.join(__dirname, 'worker.log'), { flags: 'a' });

console.log("Starting worker wrapper...");
logStream.write(`--- Started at ${new Date().toISOString()} ---\n`);

const worker = spawn('bun', ['src/worker.ts'], {
  cwd: __dirname,
  env: { ...process.env },
  shell: true
});

worker.stdout.on('data', (data) => {
  logStream.write(`[STDOUT] ${data}`);
});

worker.stderr.on('data', (data) => {
  logStream.write(`[STDERR] ${data}`);
});

worker.on('close', (code) => {
  logStream.write(`--- Worker exited with code ${code} at ${new Date().toISOString()} ---\n`);
});

console.log("Worker spawned. Check worker.log for output.");
