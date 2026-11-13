import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'coverage',
  '.venv', 'venv', '.idea', '.gradle', 'Pods', 'target', '.contextsquirrel',
]);

const SENSITIVE = /(^|[._-])(\.env|secret|secrets|credential|credentials|private|id_rsa|id_ed25519|keystore|\.npmrc)([._-]|$)/i;

const EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.kt', '.kts', '.swift',
  '.go', '.rs', '.c', '.h', '.cpp', '.hpp', '.dart', '.rb', '.php',
  '.json', '.yaml', '.yml', '.md', '.toml', '.sql', '.sh', '.css', '.html', '.xml',
]);

const MAX_FILE_BYTES = 1024 * 1024;

const STOP_WORDS = new Set(
  'a an the and of to for from at in on by with is are it this that how can code file fix add implement help use want create project please'.split(' ')
);

/** Rough token estimate (bytes/4). Not a provider tokenizer and not billable usage. */
export function estimateTokens(text) {
  return Math.ceil(Buffer.byteLength(String(text), 'utf8') / 4);
}

export function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function tokenize(text) {
  const matches = String(text).toLowerCase().match(/[a-z][a-z0-9_]{2,}/g) || [];
  return matches.filter((t) => !STOP_WORDS.has(t));
}

/**
 * Resolve `rel` against `root` and reject anything that escapes the project,
 * follows a symlink, lives in a skipped/sensitive path, or isn't a small,
 * known source-file extension.
 */
export function safeProjectFile(root, rel) {
  const base = fs.realpathSync(root);
  const full = path.resolve(base, rel);

  if (full !== base && !full.startsWith(base + path.sep)) {
    throw Error('Path escapes project');
  }
  if (fs.lstatSync(full).isSymbolicLink()) {
    throw Error('Symlinks blocked');
  }

  const real = fs.realpathSync(full);
  if (!real.startsWith(base + path.sep)) {
    throw Error('Path escapes project');
  }

  const pieces = path.relative(base, real).split(path.sep);
  if (pieces.some((p) => SKIP_DIRS.has(p) || SENSITIVE.test(p))) {
    throw Error('Sensitive/ignored path');
  }

  const stat = fs.statSync(real);
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
    throw Error('Unsupported file');
  }
  if (!EXTENSIONS.has(path.extname(real).toLowerCase())) {
    throw Error('Unsupported extension');
  }

  return real;
}

/** Walk the project tree, skipping ignored/sensitive directories and symlinks. */
export function walk(root, { maxFiles = 3000 } = {}) {
  const out = [];
  const base = fs.realpathSync(root);

  function visit(dir) {
    if (out.length >= maxFiles) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      if (entry.isSymbolicLink()) continue;

      const full = path.join(dir, entry.name);
      const rel = path.relative(base, full);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !SENSITIVE.test(entry.name)) visit(full);
      } else if (
        entry.isFile() &&
        EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
        !SENSITIVE.test(entry.name) &&
        fs.statSync(full).size <= MAX_FILE_BYTES
      ) {
        out.push(rel);
      }
    }
  }

  visit(base);
  return out;
}

const SYMBOL_PATTERN = /^\s*(export\s+)?(async\s+)?(function|class|interface|type|enum|def)\s+[\w$]+/;
const MEMBER_PATTERN = /^\s*(public|private|internal|protected|override|static|final|suspend|fun)\s+.*\b(fun|func|class)\b/;

/** Build a local index: per-file hash, size, and a lightweight symbol outline. */
export function buildIndex(root, options = {}) {
  const files = walk(root, options);
  const records = [];

  for (const rel of files) {
    let content;
    try {
      content = fs.readFileSync(safeProjectFile(root, rel), 'utf8');
    } catch {
      continue;
    }
    if (content.includes('\0')) continue;

    const lines = content.split(/\r?\n/);
    const symbols = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (SYMBOL_PATTERN.test(line) || MEMBER_PATTERN.test(line)) {
        symbols.push({ line: i + 1, text: line.trim().slice(0, 160) });
      }
    }

    records.push({
      path: rel,
      hash: sha(content),
      lines: lines.length,
      bytes: Buffer.byteLength(content),
      symbols: symbols.slice(0, 250),
    });
  }

  return { version: 1, root: path.resolve(root), createdAt: new Date().toISOString(), files: records };
}

export function saveIndex(root, index) {
  const dir = path.join(root, '.contextsquirrel');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const dest = path.join(dir, 'index.json');
  fs.writeFileSync(dest, JSON.stringify(index, null, 2), { mode: 0o600 });
  return dest;
}

export function loadIndex(root) {
  const dest = path.join(root, '.contextsquirrel', 'index.json');
  return fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, 'utf8')) : buildIndex(root);
}

/**
 * Keyword-ranked search over the index. Re-reads and re-hashes each candidate
 * file so results reflect current content, not stale index data.
 */
export function searchIndex(root, index, query, { maxTokens = 1600, maxFiles = 6, contextLines = 7 } = {}) {
  const terms = [...new Set(tokenize(query))];
  const scored = [];

  for (const rec of index.files) {
    let file;
    try {
      file = fs.readFileSync(safeProjectFile(root, rec.path), 'utf8');
    } catch {
      continue;
    }
    if (sha(file) !== rec.hash) continue;

    const lines = file.split(/\r?\n/);
    const name = rec.path.toLowerCase();
    const hits = [];
    let score = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const found = terms.filter((t) => line.includes(t));
      if (found.length) {
        hits.push({ i, weight: found.length });
        score += found.length;
      }
    }
    for (const t of terms) {
      if (name.includes(t)) score += 10;
    }
    // Code that *defines* a matching symbol (function/class/etc.) is almost
    // always more useful than prose that merely mentions it, so it outranks
    // repeated keyword mentions in docs.
    for (const sym of rec.symbols || []) {
      const symText = sym.text.toLowerCase();
      for (const t of terms) {
        if (symText.includes(t)) {
          score += 20;
          hits.push({ i: sym.line - 1, weight: 20 });
        }
      }
    }

    if (score) scored.push({ rec, lines, hits, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Don't pad the budget with low-relevance filler just because maxFiles
  // hasn't been reached yet — only keep files that are meaningfully close
  // to the top match.
  const topScore = scored.length ? scored[0].score : 0;
  const relevant = scored.filter((f) => f.score >= topScore * 0.6);

  let remaining = Math.max(0, Number(maxTokens) || 0);
  const outputs = [];

  for (const f of relevant.slice(0, maxFiles)) {
    const selected = new Set();
    if (f.hits.length) {
      const topHits = f.hits.sort((a, b) => b.weight - a.weight).slice(0, 8);
      for (const hit of topHits) {
        for (let i = Math.max(0, hit.i - contextLines); i <= Math.min(f.lines.length - 1, hit.i + contextLines); i++) {
          selected.add(i);
        }
      }
    } else {
      for (let i = 0; i < Math.min(15, f.lines.length); i++) selected.add(i);
    }

    const rows = [...selected].sort((a, b) => a - b).map((i) => `${i + 1}: ${f.lines[i]}`);
    let result = `FILE ${f.rec.path} (${f.rec.hash.slice(0, 10)})\n`;
    for (const row of rows) {
      if (estimateTokens(result + row + '\n') > remaining) break;
      result += row + '\n';
    }

    if (result.includes('\n1:') || result.split('\n').length > 2) {
      outputs.push(result.trimEnd());
      remaining -= estimateTokens(result);
    }
    if (remaining < 50) break;
  }

  const text = outputs.join('\n\n');
  return {
    text,
    selectedFiles: outputs.length,
    estimatedTokens: estimateTokens(text),
    warning: 'Relevant snippets only; request original source if needed. Token counts are estimates.',
  };
}

const CRITICAL_LINE = /(error|failed|failure|exception|traceback|fatal|panic|warn|cannot|undefined reference|assert|✗|✖|❌|caused by|\bat\s+\S+\([^)]*:\d+\))/i;

/**
 * Collapse long logs to their head, tail, and lines around critical markers
 * (errors/warnings/stack frames). Falls back to the untouched input whenever
 * the critical content itself would exceed the budget, so nothing important
 * is ever silently dropped.
 */
export function compressLog(input, { maxLines = 100, maxChars = 12000 } = {}) {
  const lines = String(input).split(/\r?\n/);
  if (lines.length <= maxLines && input.length <= maxChars) {
    return { text: input, changed: false, originalLines: lines.length, keptLines: lines.length };
  }

  const keep = new Set();
  for (let i = 0; i < Math.min(8, lines.length); i++) keep.add(i);
  for (let i = Math.max(0, lines.length - 8); i < lines.length; i++) keep.add(i);
  for (let i = 0; i < lines.length; i++) {
    if (CRITICAL_LINE.test(lines[i])) {
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) keep.add(j);
    }
  }

  const ranked = [...keep].sort((a, b) => a - b);

  // Safety: if critical context alone exceeds the budget, return original unchanged.
  if (ranked.length > maxLines || ranked.reduce((n, i) => n + lines[i].length + 12, 0) > maxChars) {
    return { text: input, changed: false, originalLines: lines.length, keptLines: lines.length, reason: 'critical data exceeds budget' };
  }

  let result = '';
  let last = -1;
  for (const i of ranked) {
    const gap = i - last - 1;
    const prefix = gap > 0 ? `[${gap} unselected lines omitted]\n` : '';
    const next = `${i + 1}: ${lines[i]}\n`;
    if (result.length + prefix.length + next.length > maxChars) {
      return { text: input, changed: false, originalLines: lines.length, keptLines: lines.length, reason: 'budget exceeded' };
    }
    result += prefix + next;
    last = i;
  }
  if (last < lines.length - 1) {
    result += `[${lines.length - 1 - last} unselected lines omitted]\n`;
  }

  return {
    text: result.trimEnd(),
    changed: true,
    originalLines: lines.length,
    keptLines: ranked.length,
    warning: 'Middle non-critical lines omitted. Use original logs for full investigation.',
  };
}

const TEST_FAILURE_LINE = /(^\s*(FAIL|FAILED|--- FAIL:)\b|✗|✖|❌|assertionerror|panic:|traceback|^\s*raise\b|expected.*(to|but))/i;

/**
 * Like compressLog, but tuned for test-runner output: keeps only failure
 * blocks (FAIL/FAILED/panic/traceback lines plus trailing stack context)
 * and a pass/fail count, dropping the noise from passing tests.
 */
export function extractTestFailures(input, { maxLines = 150, maxChars = 12000 } = {}) {
  const lines = String(input).split(/\r?\n/);
  const failed = lines.filter((l) => /^\s*(FAIL|FAILED|--- FAIL:)\b/i.test(l)).length;
  const passed = lines.filter((l) => /^\s*(PASS|ok)\b/i.test(l)).length;
  const summary = { failed, passed };

  if (lines.length <= maxLines && input.length <= maxChars) {
    return { text: input, changed: false, originalLines: lines.length, keptLines: lines.length, summary };
  }

  const keep = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (TEST_FAILURE_LINE.test(lines[i])) {
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 6); j++) keep.add(j);
    }
  }

  if (!keep.size) return compressLog(input, { maxLines, maxChars });

  const ranked = [...keep].sort((a, b) => a - b);
  if (ranked.reduce((n, i) => n + lines[i].length + 12, 0) > maxChars) {
    return { text: input, changed: false, originalLines: lines.length, keptLines: lines.length, reason: 'critical data exceeds budget', summary };
  }

  let result = '';
  let last = -1;
  for (const i of ranked) {
    const gap = i - last - 1;
    const prefix = gap > 0 ? `[${gap} unselected lines omitted]\n` : '';
    const next = `${i + 1}: ${lines[i]}\n`;
    if (result.length + prefix.length + next.length > maxChars) {
      return { text: input, changed: false, originalLines: lines.length, keptLines: lines.length, reason: 'budget exceeded', summary };
    }
    result += prefix + next;
    last = i;
  }
  if (last < lines.length - 1) result += `[${lines.length - 1 - last} unselected lines omitted]\n`;

  return {
    text: result.trimEnd(),
    changed: true,
    originalLines: lines.length,
    keptLines: ranked.length,
    summary,
    warning: 'Only failure blocks kept. Use original output for full investigation.',
  };
}

/**
 * Compress a unified git diff to per-file +/- stats plus the actual changed
 * lines (hunk headers and +/- lines), dropping unchanged context lines.
 */
export function summarizeDiff(input, { maxFiles = 50, maxCharsPerFile = 2000 } = {}) {
  const text = String(input);
  if (!text.includes('diff --git')) {
    return { text, changed: false, files: [], warning: 'Input does not look like a unified git diff; returned unchanged.' };
  }

  const chunks = text.split(/(?=^diff --git )/m).filter(Boolean);
  const files = [];
  const outputs = [];

  for (const chunk of chunks.slice(0, maxFiles)) {
    const header = chunk.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const filePath = header ? header[2] : 'unknown';
    const lines = chunk.split(/\r?\n/);
    let additions = 0;
    let deletions = 0;
    const kept = [];

    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      if (line.startsWith('+')) additions++;
      else if (line.startsWith('-')) deletions++;
      if (line.startsWith('@@') || line.startsWith('+') || line.startsWith('-')) kept.push(line);
    }

    files.push({ path: filePath, additions, deletions });

    let body = `FILE ${filePath} (+${additions}/-${deletions})\n`;
    for (const line of kept) {
      if (body.length + line.length + 1 > maxCharsPerFile) break;
      body += line + '\n';
    }
    outputs.push(body.trimEnd());
  }

  const text2 = outputs.join('\n\n');
  return {
    text: text2,
    changed: true,
    files,
    estimatedTokens: estimateTokens(text2),
    warning: 'Unchanged context lines dropped; only hunk headers and +/- lines kept. Use the original diff for full review.',
  };
}

function symbolName(text) {
  const m = text.match(/(?:function|class|interface|type|enum|def|fun|func)\s+([\w$]+)/);
  return m ? m[1] : text.trim().slice(0, 40);
}

/**
 * Render a compact repo tree from an already-built index: directories plus,
 * per file, a short list of its top-level symbols instead of full content.
 */
export function repoTree(index, { maxSymbolsPerFile = 5 } = {}) {
  const root = {};
  for (const file of index.files) {
    const parts = file.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] || { __dir: true, children: {} };
      node = node[parts[i]].children;
    }
    node[parts[parts.length - 1]] = { __file: true, symbols: file.symbols || [] };
  }

  const lines = [];
  function render(node, depth) {
    for (const key of Object.keys(node).sort()) {
      const entry = node[key];
      const indent = '  '.repeat(depth);
      if (entry.__file) {
        const names = entry.symbols.slice(0, maxSymbolsPerFile).map((s) => symbolName(s.text));
        const extra = entry.symbols.length > maxSymbolsPerFile ? `, +${entry.symbols.length - maxSymbolsPerFile} more` : '';
        lines.push(`${indent}${key}${names.length ? ` (${names.join(', ')}${extra})` : ''}`);
      } else {
        lines.push(`${indent}${key}/`);
        render(entry.children, depth + 1);
      }
    }
  }
  render(root, 0);

  const text = lines.join('\n');
  return { text, fileCount: index.files.length, estimatedTokens: estimateTokens(text) };
}

/**
 * Summarize a large JSON file's shape (keys/types, array length + one
 * sampled element) instead of returning every value.
 */
export function summarizeStructure(input, { maxDepth = 2, maxChars = 12000 } = {}) {
  const text = String(input);
  if (text.length <= maxChars) return { text, changed: false };

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { text, changed: false, warning: 'Input is not valid JSON; returned unchanged.' };
  }

  function describe(value, depth) {
    if (Array.isArray(value)) {
      if (!value.length) return [];
      if (depth >= maxDepth) return [`array(${value.length})`];
      return [{ __length: value.length, __sample: describe(value[0], depth + 1) }];
    }
    if (value !== null && typeof value === 'object') {
      if (depth >= maxDepth) return '{...}';
      const out = {};
      for (const key of Object.keys(value)) out[key] = describe(value[key], depth + 1);
      return out;
    }
    return typeof value;
  }

  const shapeText = JSON.stringify(describe(data, 0), null, 2);
  return {
    text: shapeText,
    changed: true,
    estimatedTokens: estimateTokens(shapeText),
    warning: 'Shape only (keys/types, one sampled array element). Read the original file for actual values.',
  };
}

/** Remove exact duplicate paragraphs (blocks separated by a blank line). */
export function dedupeSections(text) {
  const blocks = String(text).split(/\n\s*\n/);
  const seen = new Set();
  const result = [];
  let removed = 0;

  for (const block of blocks) {
    const key = sha(block.trim());
    if (block.trim() && seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    result.push(block);
  }

  return { text: result.join('\n\n'), removed };
}
