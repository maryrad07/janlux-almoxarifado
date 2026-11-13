// src/database.ts — Adaptador para Supabase/PostgreSQL (produção) + SQLite (local)
import * as pgDb from './database-pg';
import * as sqliteDb from './database-sqlite';

const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getDb(): any {
  return isProduction ? pgDb.getDb() : sqliteDb.getDb();
}

export function initDatabase(): any {
  return isProduction ? pgDb.initDatabase() : sqliteDb.initDatabase();
}

export function registrarHistorico(
  tabela: string,
  registroId: number,
  acao: string,
  campo?: string | null,
  valorAnterior?: any,
  valorNovo?: any,
  motivo?: string | null,
  usuarioId?: number | null,
  usuarioNome?: string | null
): any {
  return isProduction
    ? pgDb.registrarHistorico(tabela, registroId, acao, campo, valorAnterior, valorNovo, motivo, usuarioId, usuarioNome)
    : sqliteDb.registrarHistorico(tabela, registroId, acao, campo, valorAnterior, valorNovo, motivo, usuarioId, usuarioNome);
}

export function calcularSaldoEmbalagem(embalagemId: number): any {
  return isProduction
    ? pgDb.calcularSaldoEmbalagem(embalagemId)
    : sqliteDb.calcularSaldoEmbalagem(embalagemId);
}
