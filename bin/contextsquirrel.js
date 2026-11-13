#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex, saveIndex, loadIndex, searchIndex, compressLog, dedupeSections, estimateTokens, extractTestFailures, summarizeDiff, repoTree, summarizeStructure } from '../src/core.js';
import { serveMcp } from '../src/mcp.js';
import { getStatus, setMode, sessionHook, policyText } from '../src/mode.js';

const [command, ...args] = process.argv.slice(2);
const root = path.resolve(process.env.CONTEXTSQUIRREL_ROOT || process.cwd());

const USAGE = `ContextSquirrel 0.2.0 \u{1F43F}️
Usage:
  contextsquirrel on|off|toggle|status
  contextsquirrel index
  contextsquirrel search "your question"
  contextsquirrel compress path/to/build.log (or stdin)
  contextsquirrel dedupe path/to/text.txt (or stdin)
  contextsquirrel test-failures path/to/test-output.log (or stdin)
  contextsquirrel diff-summary path/to/change.diff (or stdin, e.g. git diff | contextsquirrel diff-summary)
  contextsquirrel tree
  contextsquirrel json-summary path/to/data.json (or stdin)
  contextsquirrel benchmark
  contextsquirrel mcp
Set CONTEXTSQUIRREL_ROOT=/path/to/project to target another repository.`;

function readInput() {
  return args.length ? fs.readFileSync(path.resolve(args[0]), 'utf8') : fs.readFileSync(0, 'utf8');
}

function output(value) {
  process.stdout.write(typeof value === 'string' ? value + '\n' : JSON.stringify(value, null, 2) + '\n');
}

function runBenchmark() {
  const log = [
    'Starting build...',
    ...Array.from({ length: 1000 }, (_, i) => `[INFO] compiled module ${i}`),
    'ERROR: cannot resolve module foo',
    'at src/app.ts:42:2',
    'Build failed',
  ];
  const input = log.join('\n');
  const compressed = compressLog(input);
  const originalTokens = estimateTokens(input);
  const optimizedTokens = estimateTokens(compressed.text);

  return {
    scenario: 'synthetic build log',
    originalEstimatedTokens: originalTokens,
    optimizedEstimatedTokens: optimizedTokens,
    reductionPercent: +(100 * (1 - optimizedTokens / originalTokens)).toFixed(1),
    changed: compressed.changed,
    disclaimer: 'Synthetic tool-output-only test. NOT end-to-end model token savings.',
  };
}

try {
  switch (command) {
    case 'on':
    case 'enable':
      output(setMode(root, 'safe'));
      break;

    case 'off':
    case 'disable':
      output(setMode(root, 'off'));
      break;

    case 'toggle': {
      const active = getStatus(root).enabled;
      output(setMode(root, active ? 'off' : 'safe'));
      break;
    }

    case 'status':
      output(getStatus(root));
      break;

    case 'policy':
      output(getStatus(root).enabled ? policyText() : 'ContextSquirrel inactive in this project.');
      break;

    case 'hook-session-start':
      sessionHook(root);
      break;

    case 'index': {
      const idx = buildIndex(root);
      const dest = saveIndex(root, idx);
      output({ indexed: idx.files.length, file: dest });
      break;
    }

    case 'search': {
      if (!args.length) throw Error('Provide a search query');
      const idx = loadIndex(root);
      output(searchIndex(root, idx, args.join(' ')));
      break;
    }

    case 'compress': {
      const original = readInput();
      const result = compressLog(original);
      output({ ...result, inputEstimatedTokens: estimateTokens(original), outputEstimatedTokens: estimateTokens(result.text) });
      break;
    }

    case 'dedupe':
      output(dedupeSections(readInput()));
      break;

    case 'test-failures': {
      const original = readInput();
      const result = extractTestFailures(original);
      output({ ...result, inputEstimatedTokens: estimateTokens(original), outputEstimatedTokens: estimateTokens(result.text) });
      break;
    }

    case 'diff-summary': {
      const original = readInput();
      const result = summarizeDiff(original);
      output({ ...result, inputEstimatedTokens: estimateTokens(original) });
      break;
    }

    case 'tree': {
      const idx = loadIndex(root);
      output(repoTree(idx));
      break;
    }

    case 'json-summary': {
      const original = readInput();
      const result = summarizeStructure(original);
      output({ ...result, inputEstimatedTokens: estimateTokens(original) });
      break;
    }

    case 'mcp':
      serveMcp();
      break;

    case 'benchmark':
      output(runBenchmark());
      break;

    default:
      output(USAGE);
  }
} catch (e) {
  process.stderr.write(`ContextSquirrel error: ${e.message}\n`);
  process.exitCode = 1;
}
