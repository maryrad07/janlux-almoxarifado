// src/utils/db-helper.js
// Abstrai diferenças entre SQLite (local) e PostgreSQL (produção)
// Uso: const db = require('../utils/db-helper');
//      const rows = await db.all('SELECT * FROM clientes WHERE ativo = $1', [1]);

const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Converte query SQLite (? placeholders) para PostgreSQL ($1, $2...)
function convertQuery(sql, params = []) {
  if (!isProduction) return { sql, params };
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  // Converter funções SQLite para PostgreSQL
  const finalSql = pgSql
    .replace(/datetime\('now','localtime'\)/g, 'NOW()')
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/AUTOINCREMENT/g, '')
    .replace(/INTEGER PRIMARY KEY/g, 'SERIAL PRIMARY KEY')
    .replace(/COALESCE\(/g, 'COALESCE(')
    .replace(/lastInsertRowid/g, 'id');
  return { sql: finalSql, params };
}

// Executa uma query e retorna array de rows
async function all(sql, params = []) {
  if (isProduction) {
    const { query } = require('../database-pg');
    const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
    const result = await query(pgSql, pgParams);
    return result.rows;
  } else {
    const { getDb } = require('../database-sqlite');
    const db = getDb();
    return db.prepare(sql).all(...params);
  }
}

// Executa uma query e retorna primeira row
async function get(sql, params = []) {
  if (isProduction) {
    const { query } = require('../database-pg');
    const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
    const result = await query(pgSql, pgParams);
    return result.rows[0] || null;
  } else {
    const { getDb } = require('../database-sqlite');
    const db = getDb();
    return db.prepare(sql).get(...params) || null;
  }
}

// Executa uma query de modificação; retorna { id } para INSERT, { changes } para UPDATE/DELETE
async function run(sql, params = []) {
  if (isProduction) {
    const { query } = require('../database-pg');
    const { sql: pgSql, params: pgParams } = convertQuery(sql, params);

    // Para INSERT, adicionar RETURNING id
    let finalSql = pgSql;
    if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.includes('RETURNING')) {
      finalSql = pgSql + ' RETURNING id';
    }

    const result = await query(finalSql, pgParams);
    return {
      id: result.rows[0]?.id || null,
      changes: result.rowCount || 0,
      lastInsertRowid: result.rows[0]?.id || null
    };
  } else {
    const { getDb } = require('../database-sqlite');
    const db = getDb();
    const info = db.prepare(sql).run(...params);
    return {
      id: info.lastInsertRowid ? Number(info.lastInsertRowid) : null,
      changes: info.changes || 0,
      lastInsertRowid: info.lastInsertRowid ? Number(info.lastInsertRowid) : null
    };
  }
}

// Registrar histórico
async function historico(tabela, registroId, acao, campo, anterior, novo, motivo, userId, userNome) {
  if (isProduction) {
    const { registrarHistorico } = require('../database-pg');
    await registrarHistorico(tabela, registroId, acao, campo, anterior, novo, motivo, userId, userNome);
  } else {
    const { registrarHistorico } = require('../database-sqlite');
    registrarHistorico(tabela, registroId, acao, campo, anterior, novo, motivo, userId, userNome);
  }
}

// Calcular saldo de embalagem
async function saldoEmbalagem(id) {
  if (isProduction) {
    const { calcularSaldoEmbalagem } = require('../database-pg');
    return await calcularSaldoEmbalagem(id);
  } else {
    const { calcularSaldoEmbalagem } = require('../database-sqlite');
    return calcularSaldoEmbalagem(id);
  }
}

module.exports = { all, get, run, historico, saldoEmbalagem, isProduction };
