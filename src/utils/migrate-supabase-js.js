// src/utils/migrate-supabase-js.js
const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@supabase/supabase-js');
const path = require('node:path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem ser configurados no .env');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const sqlite = new DatabaseSync(path.join(__dirname, '..', '..', 'data', 'janlux.db'));

async function migrarTabela(nomeTabela, colunas, batchSize = 100) {
  try {
    const rows = sqlite.prepare(`SELECT * FROM ${nomeTabela}`).all();
    if (rows.length === 0) return;

    const cleanRows = rows.map(r => {
      const obj = {};
      for (const col of colunas) {
        if (r[col] !== undefined) obj[col] = r[col];
      }
      return obj;
    });

    for (let i = 0; i < cleanRows.length; i += batchSize) {
      const chunk = cleanRows.slice(i, i + batchSize);
      await supabase.from(nomeTabela).upsert(chunk, { onConflict: 'id' });
    }
  } catch (err) {}
}

module.exports = { migrarTabela };
