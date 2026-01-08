#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

import { parseCnlToTypedAst } from './frontend/cnl/typing.mjs';
import { parseDslToTypedAst } from './frontend/dsl/typing.mjs';
import { Vocabulary } from './frontend/schema/vocab.mjs';

function printUsage() {
  console.log('UBH (Universal Boolean Hypergraph)');
  console.log('Usage:');
  console.log('  node src/index.mjs --cnl <file.cnl> [--vocab <file.sys2>] [--print-ast]');
  console.log('  node src/index.mjs --dsl <file.sys2> [--print-ast]');
}

function getArg(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function summarizeVocab(vocab) {
  return {
    domains: Array.from(vocab.domains.keys()).sort(),
    consts: Array.from(vocab.consts.keys()).sort(),
    predicates: Array.from(vocab.predicates.keys()).sort(),
    functions: Array.from(vocab.functions.keys()).sort(),
    aliases: Array.from(vocab.aliases.keys()).sort()
  };
}

async function loadVocab(vocabPath) {
  const content = await fs.readFile(vocabPath, 'utf8');
  const vocab = new Vocabulary();
  parseDslToTypedAst(content, {
    vocab,
    baseDir: path.dirname(vocabPath),
    loadFiles: true
  });
  return vocab;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    return;
  }

  const cnlPath = getArg(args, '--cnl');
  const dslPath = getArg(args, '--dsl');
  const vocabPath = getArg(args, '--vocab');
  const printAst = args.includes('--print-ast') || args.includes('--json');

  if ((cnlPath && dslPath) || (!cnlPath && !dslPath)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  let vocab = null;
  if (vocabPath) {
    vocab = await loadVocab(vocabPath);
  } else {
    vocab = new Vocabulary();
  }

  if (cnlPath) {
    const content = await fs.readFile(cnlPath, 'utf8');
    const result = parseCnlToTypedAst(content, vocab, {
      updateVocab: !vocabPath
    });
    if (printAst) {
      console.log(JSON.stringify({
        format: 'cnl',
        statements: result.statements,
        vocab: summarizeVocab(result.vocab)
      }, null, 2));
      return;
    }
    console.log(`CNL parsed: ${result.statements.length} statement(s).`);
    console.log(`Vocabulary: ${result.vocab.domains.size} domains, ${result.vocab.consts.size} consts, ${result.vocab.predicates.size} predicates.`);
    return;
  }

  if (dslPath) {
    const content = await fs.readFile(dslPath, 'utf8');
    const result = parseDslToTypedAst(content, {
      vocab,
      baseDir: path.dirname(dslPath),
      loadFiles: true
    });
    if (printAst) {
      console.log(JSON.stringify({
        format: 'dsl',
        statements: result.statements,
        vocab: summarizeVocab(result.vocab)
      }, null, 2));
      return;
    }
    console.log(`DSL parsed: ${result.statements.length} statement(s).`);
    console.log(`Vocabulary: ${result.vocab.domains.size} domains, ${result.vocab.consts.size} consts, ${result.vocab.predicates.size} predicates.`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exitCode = 1;
});
