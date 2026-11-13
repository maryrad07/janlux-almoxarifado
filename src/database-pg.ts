// src/database-pg.ts — Versão PostgreSQL para Supabase (produção)
import { Pool, QueryResult } from 'pg';
import bcrypt from 'bcryptjs';

const dbPass = process.env.DATABASE_PASSWORD ? encodeURIComponent(process.env.DATABASE_PASSWORD) : 'Janlux%400270';
const projectRef = (process.env.SUPABASE_URL || 'https://mkdwxarlqaclnbjcmuyo.supabase.co').replace('https://', '').replace('.supabase.co', '').replace(/\/.*$/, '');

const connectionString = process.env.DATABASE_URL ||
  `postgresql://postgres:${dbPass}@db.${projectRef}.supabase.co:5432/postgres`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});

pool.on('error', (err: Error) => {
  console.error('[DB-PG] Pool error:', err.message);
});

export async function query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

export function getPool(): Pool {
  return pool;
}

export function getDb(): Pool {
  return pool;
}

export async function initDatabase(): Promise<void> {
  try {
    const statusRes = await query('SELECT COUNT(*) as count FROM status_expedicao');
    if (parseInt(statusRes.rows[0].count) === 0) {
      const statusDefaults = [
        ['Aguardando preparação', 1, '#ffc107'],
        ['Em preparação', 2, '#17a2b8'],
        ['Aguardando conferência', 3, '#fd7e14'],
        ['Pronta para coleta', 4, '#28a745'],
        ['Coleta agendada', 5, '#6f42c1'],
        ['Coletada/Expedida', 6, '#007bff'],
        ['Cancelada', 7, '#dc3545']
      ];
      for (const [nome, ordem, cor] of statusDefaults) {
        await query('INSERT INTO status_expedicao (nome, ordem, cor) VALUES ($1, $2, $3) ON CONFLICT (nome) DO NOTHING', [nome, ordem, cor]);
      }
    }

    // Colunas de peso em kg no Supabase
    try {
      await query('ALTER TABLE embalagens ADD COLUMN IF NOT EXISTS peso_kg NUMERIC DEFAULT 0');
      await query('ALTER TABLE volumes_expedicao ADD COLUMN IF NOT EXISTS peso_kg NUMERIC DEFAULT 0');
      await query('UPDATE embalagens SET peso_kg = ROUND(peso_g / 1000.0, 3) WHERE (peso_kg IS NULL OR peso_kg = 0) AND peso_g > 0');
      await query('UPDATE volumes_expedicao SET peso_kg = ROUND(peso_g / 1000.0, 3) WHERE (peso_kg IS NULL OR peso_kg = 0) AND peso_g > 0');
    } catch (colErr) {}

    console.log('[DB-PG] Conexão com Supabase PostgreSQL ativa e pronta.');
  } catch (err: any) {
    console.error('[DB-PG] Erro initDatabase:', err.message);
  }
}

export async function registrarHistorico(
  tabela: string,
  registroId: number,
  acao: string,
  campo?: string | null,
  valorAnterior?: any,
  valorNovo?: any,
  motivo?: string | null,
  usuarioId?: number | null,
  usuarioNome?: string | null
): Promise<void> {
  try {
    await query(
      'INSERT INTO historico (tabela, registro_id, acao, campo, valor_anterior, valor_novo, motivo, usuario_id, usuario_nome) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [tabela, registroId, acao, campo || null,
       valorAnterior !== undefined && valorAnterior !== null ? String(valorAnterior) : null,
       valorNovo !== undefined && valorNovo !== null ? String(valorNovo) : null,
       motivo || null, usuarioId || null, usuarioNome || null]
    );
  } catch (err: any) {
    console.error('[DB-PG] Erro historico:', err.message);
  }
}

export async function calcularSaldoEmbalagem(embalagemId: number): Promise<number> {
  try {
    const emb = await query('SELECT estoque_inicial FROM embalagens WHERE id = $1', [embalagemId]);
    if (!emb.rows[0]) return 0;

    const movs = await query(
      'SELECT tipo, SUM(quantidade) as total FROM movimentacoes_embalagens WHERE embalagem_id = $1 GROUP BY tipo',
      [embalagemId]
    );

    let saldo = parseInt(emb.rows[0].estoque_inicial) || 0;
    for (const m of movs.rows) {
      if (m.tipo === 'entrada' || m.tipo === 'devolucao') saldo += parseInt(m.total);
      else if (m.tipo === 'saida' || m.tipo === 'uso_expedicao' || m.tipo === 'ajuste') saldo -= parseInt(m.total);
    }
    return saldo;
  } catch (err: any) {
    console.error('[DB-PG] Erro calcularSaldoEmbalagem:', err.message);
    return 0;
  }
}
