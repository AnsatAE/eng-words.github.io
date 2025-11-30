#!/usr/bin/env node
/**
 * Convert an HTML table of words to JSON with phonetics.
 * Usage:
 *   node tools/convert-table-to-json.js <inputHtmlFile|-> <outputJsonFile>
 * - inputHtmlFile: path to HTML file containing <tr><td>...</td> rows, or '-' to read from stdin
 * - outputJsonFile: path to write JSON output (array of {word, phonetic, translation})
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

function readFile(filePath) {
  return fs.promises.readFile(filePath, 'utf8');
}

function extractRows(html) {
  // naive but effective parsing for well-formed rows
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html))) {
    const trInner = trMatch[1];
    const tds = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trInner))) {
      const text = tdMatch[1]
        .replace(/<[^>]*>/g, '') // strip inner tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      tds.push(text);
    }
    if (tds.length >= 3) {
      rows.push({ index: tds[0], word: tds[1], translation: tds[2] });
    }
  }
  return rows;
}

function mergeByWord(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.word) continue;
    const key = r.word.trim();
    const tr = r.translation ? r.translation.trim() : '';
    if (!map.has(key)) map.set(key, new Set());
    if (tr) {
      // split by comma to collect granular translations, then re-join later
      tr.split(',').map((s) => s.trim()).filter(Boolean).forEach((part) => map.get(key).add(part));
    }
  }
  const merged = [];
  for (const [word, set] of map.entries()) {
    const translation = Array.from(set).join(' / ');
    merged.push({ word, translation });
  }
  // sort alphabetically to keep deterministic order
  merged.sort((a, b) => a.word.localeCompare(b.word));
  return merged;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            resolve(null);
          }
        });
      })
      .on('error', (err) => resolve(null));
  });
}

async function fetchPhonetic(word) {
  // dictionaryapi.dev free endpoint
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const json = await fetchJson(url);
  if (!json || !Array.isArray(json) || json.length === 0) return '';
  // Try to find a phonetic text field
  for (const entry of json) {
    if (entry && Array.isArray(entry.phonetics)) {
      // Prefer entries where text looks like IPA
      const withText = entry.phonetics.find((p) => p && typeof p.text === 'string' && /[ˈˌæɪʊʌɔːəθðʃʒŋ]/.test(p.text));
      if (withText && withText.text) return withText.text.replace(/^\/*|\/*$/g, '');
      const anyText = entry.phonetics.find((p) => p && typeof p.text === 'string');
      if (anyText && anyText.text) return anyText.text.replace(/^\/*|\/*$/g, '');
    }
    if (typeof entry.phonetic === 'string' && entry.phonetic) {
      return entry.phonetic.replace(/^\/*|\/*$/g, '');
    }
  }
  return '';
}

async function pLimit(concurrency, iterable, iterator) {
  const ret = [];
  const executing = new Set();
  for (const item of iterable) {
    const p = Promise.resolve().then(() => iterator(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    console.error('Usage: node tools/convert-table-to-json.js <inputHtmlFile|-> <outputJsonFile>');
    process.exit(1);
  }

  const html = inputArg === '-' ? await readStdin() : await readFile(path.resolve(inputArg));
  const rows = extractRows(html);
  if (!rows.length) {
    console.error('No rows parsed. Ensure the input contains <tr><td>...</td></tr> rows.');
    process.exit(2);
  }

  const merged = mergeByWord(rows);

  const results = [];
  await pLimit(5, merged, async (item) => {
    const phonetic = await fetchPhonetic(item.word);
    results.push({ word: item.word, phonetic, translation: item.translation });
  });

  // Keep consistent sorting by word
  results.sort((a, b) => a.word.localeCompare(b.word));

  await fs.promises.mkdir(path.dirname(path.resolve(outputArg)), { recursive: true });
  await fs.promises.writeFile(path.resolve(outputArg), JSON.stringify(results, null, 2), 'utf8');
  console.log(`Wrote ${results.length} items to ${outputArg}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
