const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.LOG_VIEWER_PORT || 4500);
const BUFFER_LIMIT = 3000;
const PAGE = path.join(__dirname, 'log-viewer.html');

const ANSI = /\[[0-9;]*m/g;
const PRISMA_LINE = /^prisma:(query|info|warn|error)\s*(.*)$/s;
const NEST_LINE =
  /^\[Nest\]\s+\d+\s+-\s+[\d/]+,?\s+[\d:]+\s*(?:AM|PM)?\s+(LOG|ERROR|WARN|DEBUG|VERBOSE)\s*(?:\[([^\]]+)\])?\s*(.*)$/s;

const clients = new Set();
const buffer = [];
let sequence = 0;
let transaction = 0;
let openTransaction = null;

function classify(raw, stream) {
  const line = raw.replace(ANSI, '').trimEnd();
  if (!line.trim()) return null;

  const prisma = line.match(PRISMA_LINE);
  if (prisma) {
    const [, level, rest] = prisma;
    if (level !== 'query') {
      return { category: `prisma-${level}`, message: rest };
    }
    const sql = rest.trim();
    const operation = (sql.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
    if (operation === 'BEGIN') {
      transaction += 1;
      openTransaction = transaction;
    }
    const event = {
      category: 'query',
      message: sql,
      operation,
      table: extractTable(sql),
      transaction: openTransaction,
    };
    if (operation === 'COMMIT' || operation === 'ROLLBACK') {
      openTransaction = null;
    }
    return event;
  }

  const nest = line.match(NEST_LINE);
  if (nest) {
    const [, level, context, message] = nest;
    return {
      category: level === 'ERROR' || level === 'WARN' ? level.toLowerCase() : 'nest',
      message,
      context: context ?? null,
      level,
    };
  }

  return { category: stream === 'stderr' ? 'stderr' : 'stdout', message: line };
}

function extractTable(sql) {
  const patterns = [
    /INSERT\s+INTO\s+"?public"?\."?([A-Za-z_][\w]*)"?/i,
    /UPDATE\s+"?public"?\."?([A-Za-z_][\w]*)"?/i,
    /DELETE\s+FROM\s+"?public"?\."?([A-Za-z_][\w]*)"?/i,
    /FROM\s+"?public"?\."?([A-Za-z_][\w]*)"?/i,
    /FROM\s+"([A-Za-z_][\w]*)"/,
    /UPDATE\s+"([A-Za-z_][\w]*)"/,
  ];
  for (const pattern of patterns) {
    const match = sql.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function publish(raw, stream) {
  const parsed = classify(raw, stream);
  if (!parsed) return;
  sequence += 1;
  const event = { id: sequence, at: new Date().toISOString(), ...parsed };
  buffer.push(event);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(payload);
}

const server = http.createServer((request, response) => {
  if (request.url === '/stream') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write(`retry: 2000\n\n`);
    response.write(`data: ${JSON.stringify({ type: 'snapshot', events: buffer })}\n\n`);
    clients.add(response);
    const keepAlive = setInterval(() => response.write(': ping\n\n'), 25_000);
    request.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(response);
    });
    return;
  }

  if (request.url === '/' || request.url?.startsWith('/index')) {
    fs.readFile(PAGE, (error, content) => {
      if (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('log-viewer.html não encontrado ao lado do script.');
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(content);
    });
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('not found');
});

function consume(stream, kind, echo) {
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  reader.on('line', (line) => {
    publish(line, kind);
    if (echo(line)) process.stdout.write(`${line}\n`);
  });
}

function start() {
  const separator = process.argv.indexOf('--');
  const command = separator === -1 ? [] : process.argv.slice(separator + 1);
  const quiet = process.argv.includes('--quiet');
  const echoAll = process.argv.includes('--echo-all');
  const echo = (line) => {
    if (quiet) return false;
    if (echoAll) return true;
    return !line.replace(ANSI, '').startsWith('prisma:query');
  };

  server.listen(PORT, () => {
    process.stdout.write(`\n  log viewer: http://localhost:${PORT}\n\n`);
  });

  if (command.length > 0) {
    const child = spawn(command[0], command.slice(1), {
      shell: true,
      env: process.env,
    });
    consume(child.stdout, 'stdout', echo);
    consume(child.stderr, 'stderr', echo);
    child.on('exit', (code) => {
      publish(`processo encerrado com código ${code ?? 0}`, 'stderr');
    });
    const stop = () => {
      child.kill();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    return;
  }

  if (!process.stdin.isTTY) {
    consume(process.stdin, 'stdout', echo);
    return;
  }

  process.stdout.write(
    [
      '  nenhuma entrada conectada. use uma das formas:',
      '',
      '    npm run start:dev | node scripts/log-viewer.cjs',
      '    node scripts/log-viewer.cjs -- npm run start:dev',
      '',
      '  flags: --quiet (não repete nada no terminal) · --echo-all (repete tudo)',
      '',
    ].join('\n'),
  );
}

start();
