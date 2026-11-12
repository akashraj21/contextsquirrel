import fs from 'node:fs';
import path from 'node:path';

const configFile = (root) => path.join(root, '.contextsquirrel', 'mode.json');

export function getStatus(root) {
  const file = configFile(path.resolve(root));
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { enabled: data.mode === 'safe', mode: data.mode === 'safe' ? 'safe' : 'off', project: path.resolve(root) };
  } catch {
    return { enabled: false, mode: 'off', project: path.resolve(root) };
  }
}

export function setMode(root, mode) {
  if (!['safe', 'off'].includes(mode)) throw new Error('Unsupported mode');

  const dir = path.dirname(configFile(root));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    configFile(root),
    JSON.stringify({ mode, updatedAt: new Date().toISOString() }, null, 2) + '\n',
    { mode: 0o600 }
  );

  return getStatus(root);
}

export function policyText() {
  return `ContextSquirrel SAFE MODE is enabled for this project. Prefer precise, relevant file searches and bounded output rather than dumping entire directories. Avoid repeated reads of unchanged files when already in context. For long successful logs, preserve errors, warnings and surrounding lines while collapsing irrelevant repetition. Never shorten final answers solely to save tokens; provide all required implementation details. Do not omit dependencies, tests, security issues, or user requirements. If optimized context is insufficient, retrieve original content. This is advisory context hygiene, not automatic interception or a guarantee of token savings.`;
}

export function sessionHook(root) {
  if (!getStatus(root).enabled) return;
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: policyText() } }) + '\n'
  );
}
