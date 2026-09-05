import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  countEmails,
  mapLegacyRecord,
  emptyMigrationReport,
  tallyEmailStatus,
  formatMigrationReport,
} from '../workers/migration.js';

function arg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cols[i] || '';
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function classifyRecords(records) {
  const report = emptyMigrationReport();
  report.total = records.length;
  const emailCounts = countEmails(records, (row) => row.email || row.email_address || row.Email);
  const mapped = [];
  for (const record of records) {
    const row = mapLegacyRecord(record, emailCounts);
    if (!row.legacy_user_id) {
      report.errors += 1;
      report.error_ids.push('missing-legacy-id');
      continue;
    }
    tallyEmailStatus(report, row.email_status);
    mapped.push(row);
  }
  return { report, mapped };
}

async function main() {
  const file = arg('file', 'scripts/legacy-customers.sample.json');
  const dry = hasFlag('dry-run') || !hasFlag('apply');
  const origin = arg('origin', 'http://127.0.0.1:8787').replace(/\/$/, '');
  const token = arg('token');
  const abs = resolve(file);
  const raw = await readFile(abs, 'utf8');
  const records = abs.endsWith('.csv') ? parseCsv(raw) : JSON.parse(raw);
  if (!Array.isArray(records)) {
    throw new Error('Legacy file must be a JSON array or CSV');
  }

  const local = classifyRecords(records);
  console.log(formatMigrationReport({
    ...local.report,
    imported: local.mapped.length,
  }));
  console.log(dry ? '\nDry run only. Re-run with --apply --origin <url> --token <admin_session_token> to import.' : '');

  if (dry) return;

  if (!token) {
    throw new Error('Pass --token with an admin session token from /admin-login');
  }

  const res = await fetch(`${origin}/api/fn/importLegacyCustomers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      admin_session_token: token,
      customers: records,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Import failed (${res.status})`);
  }
  console.log('\nServer report:');
  console.log(formatMigrationReport(data.report));
  if (data.report.error_ids?.length) {
    console.log('Error ids (truncated):', data.report.error_ids.slice(0, 20).join(', '));
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
