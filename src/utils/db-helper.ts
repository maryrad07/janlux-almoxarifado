// src/utils/db-helper.ts
import * as pgDb from '../database-pg';
import * as sqliteDb from '../database-sqlite';

export const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function convertQuery(sql: string, params: any[] = []): { sql: string; params: any[] } {
  if (!isProduction) return { sql, params };
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  const finalSql = pgSql
    .replace(/datetime\('now','localtime'\)/g, 'NOW()')
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/AUTOINCREMENT/g, '')
    .replace(/INTEGER PRIMARY KEY/g, 'SERIAL PRIMARY KEY')
    .replace(/COALESCE\(/g, 'COALESCE(')
    .replace(/lastInsertRowid/g, 'id');
  return { sql: finalSql, params };
}

export async function all(sql: string, params: any[] = []): Promise<any[]> {
  if (isProduction) {
    const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
    const result = await pgDb.query(pgSql, pgParams);
    return result.rows;
  } else {
    const db = sqliteDb.getDb();
    return db.prepare(sql).all(...params);
  }
}

export async function get(sql: string, params: any[] = []): Promise<any> {
  if (isProduction) {
    const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
    const result = await pgDb.query(pgSql, pgParams);
    return result.rows[0] || null;
  } else {
    const db = sqliteDb.getDb();
    return db.prepare(sql).get(...params) || null;
  }
}

export async function run(sql: string, params: any[] = []): Promise<{ id: number | null; changes: number; lastInsertRowid: number | null }> {
  if (isProduction) {
    const { sql: pgSql, params: pgParams } = convertQuery(sql, params);

    let finalSql = pgSql;
    if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.includes('RETURNING')) {
      finalSql = pgSql + ' RETURNING id';
    }

    const result = await pgDb.query(finalSql, pgParams);
    const rowId = result.rows[0]?.id ? Number(result.rows[0].id) : null;
    return {
      id: rowId,
      changes: result.rowCount || 0,
      lastInsertRowid: rowId
    };
  } else {
    const db = sqliteDb.getDb();
    const info = db.prepare(sql).run(...params);
    const rowId = info.lastInsertRowid ? Number(info.lastInsertRowid) : null;
    return {
      id: rowId,
      changes: info.changes || 0,
      lastInsertRowid: rowId
    };
  }
}

export async function historico(
  tabela: string,
  registroId: number,
  acao: string,
  campo?: string | null,
  anterior?: any,
  novo?: any,
  motivo?: string | null,
  userId?: number | null,
  userNome?: string | null
): Promise<void> {
  if (isProduction) {
    await pgDb.registrarHistorico(tabela, registroId, acao, campo, anterior, novo, motivo, userId, userNome);
  } else {
    sqliteDb.registrarHistorico(tabela, registroId, acao, campo, anterior, novo, motivo, userId, userNome);
  }
}

export async function saldoEmbalagem(id: number): Promise<number> {
  if (isProduction) {
    return await pgDb.calcularSaldoEmbalagem(id);
  } else {
    return sqliteDb.calcularSaldoEmbalagem(id);
  }
}

const db = {
  all,
  get,
  run,
  historico,
  saldoEmbalagem,
  isProduction,
  convertQuery
};

export default db;
