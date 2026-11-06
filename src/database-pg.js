// src/database-pg.js — Versão PostgreSQL para Supabase (produção)
// Usado automaticamente em produção quando há SUPABASE_URL no ambiente

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Conexão com Supabase via connection string ou variáveis individuais
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://postgres.${process.env.SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '')}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB-PG] Pool error:', err.message);
});

// Helper: executar query com array de parâmetros
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// Retorna o pool para uso externo (sessions, etc.)
function getPool() {
  return pool;
}

// getDb() — compatibilidade: retorna objeto com interface similar ao sqlite
// As rotas usarão as funções async exportadas, não getDb()
function getDb() {
  return pool;
}

// Inicializar banco (cria usuários padrão se não existirem)
// As TABELAS devem ser criadas via supabase-schema.sql no Supabase SQL Editor
async function initDatabase() {
  try {
    // Verifica se status_expedicao está vazia
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
      console.log('[DB-PG] Status de expedição padrão inseridos.');
    }

    // Verifica usuários
    const userRes = await query('SELECT COUNT(*) as count FROM usuarios');
    if (parseInt(userRes.rows[0].count) === 0) {
      const users = [
        ['Administrador JANLUX', 'admin', 'admin123', 'administrador'],
        ['Sandra (Operacional)', 'sandra', 'sandra123', 'operacional'],
        ['Ivan (Operacional)', 'ivan', 'ivan123', 'operacional'],
        ['Usuário Consulta', 'consulta', 'consulta123', 'consulta']
      ];
      for (const [nome, login, senha, perfil] of users) {
        const hash = bcrypt.hashSync(senha, 10);
        await query('INSERT INTO usuarios (nome, login, senha, perfil) VALUES ($1, $2, $3, $4) ON CONFLICT (login) DO NOTHING', [nome, login, hash, perfil]);
      }
      console.log('[DB-PG] Usuários padrão criados.');
    }

    // Verifica embalagens
    const embRes = await query('SELECT COUNT(*) as count FROM embalagens');
    if (parseInt(embRes.rows[0].count) === 0) {
      const embs = [
        ['EMB-PAP-01', 'Caixa Papelão Padrão', 'UN', 50, 30, 20, 350, 20, 100],
        ['EMB-MAD-01', 'Caixa de Madeira Reforçada', 'UN', 100, 30, 20, 2500, 10, 50],
        ['EMB-PAC-01', 'Pacote / Envoltório Padrão', 'UN', 40, 20, 10, 80, 30, 150],
        ['EMB-BOL-01', 'Plástico Bolha / Envoltório', 'UN', 50, 20, 10, 120, 20, 100]
      ];
      for (const [cod, desc, un, c, l, a, p, emin, einic] of embs) {
        await query('INSERT INTO embalagens (codigo, descricao, unidade, comprimento_cm, largura_cm, altura_cm, peso_g, estoque_minimo, estoque_inicial) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (codigo) DO NOTHING',
          [cod, desc, un, c, l, a, p, emin, einic]);
      }
    }

    // Verifica emitente padrão
    const emitRes = await query('SELECT COUNT(*) as count FROM emitentes');
    if (parseInt(emitRes.rows[0].count) === 0) {
      await query('INSERT INTO emitentes (codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, cidade, estado, padrao, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7,1,1)',
        ['EMI-001', 'JANLUX ELÉTRICOS LTDA.', 'JANLUX', '00.000.000/0001-00', 'ISENTO', 'São Paulo', 'SP']);
    }

    console.log('[DB-PG] Banco Supabase/PostgreSQL inicializado com sucesso.');
  } catch (err) {
    console.error('[DB-PG] Erro ao inicializar banco:', err.message);
  }
}

// Registrar histórico de auditoria
async function registrarHistorico(tabela, registroId, acao, campo, valorAnterior, valorNovo, motivo, usuarioId, usuarioNome) {
  try {
    await query(
      'INSERT INTO historico (tabela, registro_id, acao, campo, valor_anterior, valor_novo, motivo, usuario_id, usuario_nome) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [tabela, registroId, acao, campo || null,
       valorAnterior !== undefined && valorAnterior !== null ? String(valorAnterior) : null,
       valorNovo !== undefined && valorNovo !== null ? String(valorNovo) : null,
       motivo || null, usuarioId || null, usuarioNome || null]
    );
  } catch (err) {
    console.error('[DB-PG] Erro ao registrar histórico:', err.message);
  }
}

// Calcular saldo de embalagem
async function calcularSaldoEmbalagem(embalagemId) {
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
}

module.exports = { getDb, getPool, query, initDatabase, registrarHistorico, calcularSaldoEmbalagem };
