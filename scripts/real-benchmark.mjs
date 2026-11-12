#!/usr/bin/env node
// Real (non-synthetic) benchmark: for each query, compares the token cost of
// ContextSquirrel's search() output against the token cost of reading the
// single correct source file in full, and records whether the correct file
// was actually present in the search results (a miss is reported as a miss,
// never silently folded into the average).
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex, searchIndex, estimateTokens } from '../src/core.js';

const root = path.resolve(process.argv[2] || process.cwd());

// Ground truth: query -> file that actually answers it (hand-verified by reading the source).
const CASES = [
  { query: 'how does dedupe work', truth: 'src/core.js' },
  { query: 'how does log compression work', truth: 'src/core.js' },
  { query: 'where is safe mode on off status stored', truth: 'src/mode.js' },
  { query: 'what tools does the MCP server expose', truth: 'src/mcp.js' },
  { query: 'how are secret files excluded from indexing', truth: 'src/core.js' },
];

const idx = buildIndex(root);
const results = [];

for (const { query, truth } of CASES) {
  const search = searchIndex(root, idx, query);
  const matchedFiles = [...search.text.matchAll(/^FILE (\S+)/gm)].map((m) => m[1]);
  const hit = matchedFiles.includes(truth);

  const truthPath = path.join(root, truth);
  const baselineTokens = estimateTokens(fs.readFileSync(truthPath, 'utf8'));
  const searchTokens = search.estimatedTokens;

  results.push({
    query,
    truth,
    hit,
    matchedFiles,
    baselineTokens,
    searchTokens,
    reductionPercent: hit ? +(100 * (1 - searchTokens / baselineTokens)).toFixed(1) : null,
  });
}

const hits = results.filter((r) => r.hit);
const misses = results.filter((r) => !r.hit);
const avgReduction = hits.length
  ? +(hits.reduce((s, r) => s + r.reductionPercent, 0) / hits.length).toFixed(1)
  : null;

console.log(JSON.stringify({
  disclaimer: 'Estimated tokens (bytes/4), not provider-billed tokens. Small, hand-picked case set from this repo only — not a general claim.',
  caseCount: results.length,
  hitRate: +(100 * hits.length / results.length).toFixed(1),
  avgReductionOnHits: avgReduction,
  results,
}, null, 2));
