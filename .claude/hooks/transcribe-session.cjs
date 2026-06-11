#!/usr/bin/env node
/**
 * Hook Stop di Claude Code: rigenera la trascrizione markdown della sessione.
 *
 * Riceve su stdin il JSON dell'evento hook ({ session_id, transcript_path, cwd, ... }),
 * legge il transcript JSONL completo della sessione e riscrive da zero il file
 *   {repo}\.claude\transcripts\{utente}@{session_id}.md
 *
 * Cross-platform (Windows / macOS / Linux): solo API Node standard, zero dipendenze.
 * Non deve MAI bloccare Claude: ogni errore termina con exit 0 silenzioso.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_TOOL_OUTPUT_CHARS = 2000;
const MAX_TOOL_INPUT_CHARS = 1500;

let rawInput = '';
process.stdin.on('data', (chunk) => (rawInput += chunk));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(rawInput));
  } catch (_) {
    // mai bloccare la sessione per colpa della trascrizione
  }
  process.exit(0);
});

const RETRY_DELAY_MS = 250;

function main(hookEvent) {
  const transcriptPath = hookEvent.transcript_path;
  const sessionId = hookEvent.session_id;
  if (!transcriptPath || !sessionId || !fs.existsSync(transcriptPath)) return;

  let entries = readTranscript(transcriptPath);

  // L'hook Stop puo' scattare prima che l'ultima entry "assistant" sia
  // flush-ata su disco: se il transcript termina con un turno utente,
  // riprova una volta dopo una breve attesa.
  if (lastMeaningfulEntryType(entries) === 'user') {
    sleepMs(RETRY_DELAY_MS);
    entries = readTranscript(transcriptPath);
  }

  const username = os.userInfo().username;
  const markdown = renderMarkdown(entries, { hookEvent, username });

  const repoRoot = hookEvent.cwd || process.cwd();
  const outputDir = path.join(repoRoot, '.claude', 'transcripts');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${username}@${sessionId}.md`);
  fs.writeFileSync(outputFile, markdown, 'utf8');
}

function readTranscript(transcriptPath) {
  return fs
    .readFileSync(transcriptPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

// Tipo dell'ultima entry "rilevante" (esclude meta e turni utente vuoti/solo
// tool_result), per capire se il transcript termina su un turno utente o
// sull'ultima risposta dell'assistente.
function lastMeaningfulEntryType(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.isMeta) continue;
    if (entry.type === 'user') {
      return extractUserText(entry) ? 'user' : null;
    }
    if (entry.type === 'assistant') return 'assistant';
  }
  return null;
}

function sleepMs(ms) {
  const sharedBuffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sharedBuffer), 0, 0, ms);
}

function renderMarkdown(entries, { hookEvent, username }) {
  // Indicizza i risultati dei tool per tool_use_id: arrivano come blocchi
  // tool_result dentro messaggi di tipo "user" successivi alla chiamata.
  const toolResultsById = new Map();
  for (const entry of entries) {
    const content = entry?.message?.content;
    if (entry.type === 'user' && Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_result') toolResultsById.set(block.tool_use_id, block);
      }
    }
  }

  const lines = [];
  lines.push('# Conversazione Claude Code');
  lines.push('');
  lines.push(`- **Utente:** ${username}`);
  lines.push(`- **Sessione:** \`${hookEvent.session_id}\``);
  if (hookEvent.cwd) lines.push(`- **Directory:** \`${hookEvent.cwd}\``);
  const firstTimestamp = entries.find((e) => e.timestamp)?.timestamp;
  if (firstTimestamp) lines.push(`- **Inizio:** ${formatTimestamp(firstTimestamp)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  let lastSpeaker = null;

  for (const entry of entries) {
    if (entry.isMeta) continue;

    if (entry.type === 'user') {
      const text = extractUserText(entry);
      if (!text) continue;
      if (lastSpeaker !== 'user') {
        lines.push(`## 🧑 Utente${timestampSuffix(entry)}`);
        lines.push('');
      }
      lines.push(text);
      lines.push('');
      lastSpeaker = 'user';
    } else if (entry.type === 'assistant') {
      const blocks = Array.isArray(entry?.message?.content) ? entry.message.content : [];
      const text = blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
        .trim();
      const toolUses = blocks.filter((b) => b.type === 'tool_use');
      if (!text && toolUses.length === 0) continue;

      if (lastSpeaker !== 'assistant') {
        lines.push(`## 🤖 Claude${timestampSuffix(entry)}`);
        lines.push('');
      }
      if (text) {
        lines.push(text);
        lines.push('');
      }
      for (const toolUse of toolUses) {
        lines.push(renderToolUse(toolUse, toolResultsById.get(toolUse.id)));
        lines.push('');
      }
      lastSpeaker = 'assistant';
    }
  }

  return lines.join('\n');
}

function extractUserText(entry) {
  const content = entry?.message?.content;
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    // I messaggi "user" che contengono solo tool_result non sono turni dell'utente.
    text = content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
  text = text.trim();
  if (!text) return null;
  // Rumore di sistema iniettato dal runtime, non parlato dall'utente.
  if (text.startsWith('<command-name>') || text.startsWith('<local-command-stdout>')) return null;
  if (text.startsWith('<system-reminder>') && text.endsWith('</system-reminder>')) return null;
  if (text.startsWith('Caveat: The messages below were generated by the user while running local commands')) return null;
  return text;
}

function renderToolUse(toolUse, result) {
  const outcome = !result ? '⏳ senza esito' : result.is_error ? '❌ errore' : '✅ ok';
  const parts = [];
  parts.push('<details>');
  parts.push(`<summary>🔧 <b>${toolUse.name}</b> — ${outcome}</summary>`);
  parts.push('');
  parts.push('**Input:**');
  parts.push('```json');
  parts.push(truncate(JSON.stringify(toolUse.input ?? {}, null, 2), MAX_TOOL_INPUT_CHARS));
  parts.push('```');
  if (result) {
    parts.push('');
    parts.push('**Risultato:**');
    parts.push('```');
    parts.push(truncate(extractResultText(result), MAX_TOOL_OUTPUT_CHARS));
    parts.push('```');
  }
  parts.push('');
  parts.push('</details>');
  return parts.join('\n');
}

function extractResultText(result) {
  const content = result.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b.type === 'text' ? b.text : `[${b.type}]`))
      .join('\n');
  }
  return String(content ?? '');
}

function truncate(text, maxChars) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n… [troncato, ${text.length} caratteri totali]`;
}

function formatTimestamp(isoString) {
  try {
    return new Date(isoString).toLocaleString();
  } catch (_) {
    return isoString;
  }
}

function timestampSuffix(entry) {
  if (!entry.timestamp) return '';
  try {
    return ` — ${new Date(entry.timestamp).toLocaleTimeString()}`;
  } catch (_) {
    return '';
  }
}
