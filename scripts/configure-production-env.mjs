import { randomBytes } from 'node:crypto';
import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function validatePort(name, port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name} port: ${port}`);
  }
}

async function readExistingEnv(envPath) {
  try {
    return await readFile(envPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

function getExistingValues(content) {
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in values)) values[match[1]] = match[2];
  }

  return values;
}

function updateEnvLines(content, updates) {
  const lines = content.split(/\r?\n/);
  const written = new Set();
  const updated = [];

  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    const key = match?.[1];

    if (!key || !(key in updates)) {
      updated.push(line);
      continue;
    }

    if (!written.has(key)) {
      updated.push(`${key}=${updates[key]}`);
      written.add(key);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!written.has(key)) {
      updated.push(`${key}=${value}`);
    }
  }

  return `${updated.join('\n').replace(/\n+$/, '')}\n`;
}

export async function configureProductionEnv({ envPath, domain, apiPort, webPort }) {
  if (typeof domain !== 'string' || !DOMAIN_PATTERN.test(domain)) {
    throw new Error(`Invalid domain: ${domain}`);
  }
  validatePort('API', apiPort);
  validatePort('web', webPort);

  const content = await readExistingEnv(envPath);
  const existing = getExistingValues(content);
  const updates = {
    POSTGRES_USER: existing.POSTGRES_USER || 'bowling',
    POSTGRES_PASSWORD: existing.POSTGRES_PASSWORD || randomBytes(24).toString('hex'),
    POSTGRES_DB: existing.POSTGRES_DB || 'bowling',
    JWT_SECRET: existing.JWT_SECRET || randomBytes(32).toString('hex'),
    COMPOSE_PROJECT_NAME: 'bowling-tournaments',
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    NEXT_PUBLIC_API_URL: `https://${domain}/trpc`,
    NEXT_PUBLIC_APP_URL: `https://${domain}`,
  };
  const temporaryPath = `${envPath}.tmp`;

  await writeFile(temporaryPath, updateEnvLines(content, updates), { mode: 0o600 });
  await rename(temporaryPath, envPath);
  await chmod(envPath, 0o600);
}

function parseCliArgs(argv) {
  const options = {};
  const names = {
    '--file': 'envPath',
    '--domain': 'domain',
    '--api-port': 'apiPort',
    '--web-port': 'webPort',
  };

  for (let index = 0; index < argv.length; index += 2) {
    const key = names[argv[index]];
    const value = argv[index + 1];
    if (!key || value === undefined) throw new Error(`Invalid argument: ${argv[index] ?? ''}`);
    options[key] = key.endsWith('Port') ? Number(value) : value;
  }

  for (const required of Object.values(names)) {
    if (options[required] === undefined) throw new Error(`Missing required argument: ${required}`);
  }

  return options;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  await configureProductionEnv(options);
  process.stdout.write(`Production environment configured for ${options.domain}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
