// src/utils/migrate-to-supabase.js
// Script para migrar todos os dados locais do SQLite (data/janlux.db) para o Supabase (PostgreSQL)

require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { Pool } = require('pg');

const dbPath = path.join(__dirname, '..', '..', 'data', 'janlux.db');

if (!fs.existsSync(dbPath)) {
  console.error('[ERRO] Banco SQLite não encontrado em:', dbPath);
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL ||
  (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? `postgresql://postgres.${process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
    : null);

if (!connectionString) {
  console.error('================================================================');
  console.error('  ERRO: Configuração do Supabase ausente!');
  console.error('  Defina no arquivo .env ou como variáveis de ambiente:');
  console.error('    SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co');
  console.error('    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...');
  console.error('    DATABASE_URL=postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres');
  console.error('================================================================');
  process.exit(1);
}

const sqlite = new DatabaseSync(dbPath);
const pgPool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function migrarTabela(nomeTabela, colunas, idCol = 'id') {
  try {
    const rows = sqlite.prepare(`SELECT * FROM ${nomeTabela}`).all();
    if (rows.length === 0) {
      console.log(`[${nomeTabela}] Nenhum registro para migrar.`);
      return;
    }

    console.log(`[${nomeTabela}] Migrando ${rows.length} registros...`);

    const colsStr = colunas.join(', ');
    const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ');

    let inseridos = 0;
    for (const r of rows) {
      const vals = colunas.map(c => r[c] !== undefined ? r[c] : null);
      try {
        await pgPool.query(
          `INSERT INTO ${nomeTabela} (${colsStr}) VALUES (${placeholders}) ON CONFLICT (${idCol}) DO NOTHING`,
          vals
        );
        inseridos++;
      } catch (insertErr) {
        // Tenta sem ON CONFLICT se idCol não tiver constraint de unicidade
        try {
          await pgPool.query(`INSERT INTO ${nomeTabela} (${colsStr}) VALUES (${placeholders})`, vals);
          inseridos++;
        } catch (e2) {
          console.warn(`   Aviso na linha ${r.id || ''}:`, e2.message);
        }
      }
    }

    // Atualiza a sequence do SERIAL no PostgreSQL
    if (idCol === 'id') {
      try {
        await pgPool.query(`SELECT setval(pg_get_serial_sequence('${nomeTabela}', 'id'), COALESCE((SELECT MAX(id) FROM ${nomeTabela}), 1))`);
      } catch (seqErr) {}
    }

    console.log(`[${nomeTabela}] ✓ ${inseridos}/${rows.length} registros sincronizados.`);
  } catch (err) {
    console.error(`[${nomeTabela}] Erro ao migrar:`, err.message);
  }
}

async function executarMigracao() {
  console.log('================================================================');
  console.log('  INICIANDO MIGRAÇÃO DOS DADOS: SQLite -> Supabase (PostgreSQL)');
  console.log('================================================================');

  try {
    // 1. Status de Expedição
    await migrarTabela('status_expedicao', ['id', 'nome', 'ordem', 'cor', 'ativo']);

    // 2. Usuários
    await migrarTabela('usuarios', ['id', 'nome', 'login', 'senha', 'perfil', 'ativo', 'criado_em', 'atualizado_em']);

    // 3. Emitentes
    await migrarTabela('emitentes', ['id', 'codigo', 'razao_social', 'nome_fantasia', 'cnpj', 'inscricao_estadual', 'endereco', 'cidade', 'estado', 'telefone', 'email', 'ativo', 'padrao', 'observacoes', 'criado_em', 'atualizado_em']);

    // 4. Clientes
    await migrarTabela('clientes', ['id', 'codigo', 'razao_social', 'nome_fantasia', 'cnpj', 'telefone', 'cidade', 'estado', 'ativo', 'observacoes', 'criado_em', 'atualizado_em']);

    // 5. Produtos
    await migrarTabela('produtos', ['id', 'codigo', 'descricao', 'unidade_medida', 'ativo', 'criado_em', 'atualizado_em']);

    // 6. Transportadoras
    await migrarTabela('transportadoras', ['id', 'nome', 'cnpj', 'telefone', 'ativo', 'observacoes', 'criado_em', 'atualizado_em']);

    // 7. Motoristas
    await migrarTabela('motoristas', ['id', 'nome', 'cpf', 'documento', 'telefone', 'transportadora_id', 'ativo', 'criado_em', 'atualizado_em']);

    // 8. Embalagens
    await migrarTabela('embalagens', ['id', 'codigo', 'descricao', 'unidade', 'comprimento_cm', 'largura_cm', 'altura_cm', 'peso_g', 'estoque_minimo', 'estoque_inicial', 'ativo', 'observacoes', 'criado_em', 'atualizado_em']);

    // 9. Expedições
    await migrarTabela('expedicoes', [
      'id', 'numero_nf', 'serie_nf', 'data_emissao', 'cliente_id', 'cliente_nome', 'cnpj_destinatario',
      'emitente_id', 'emitente_nome', 'cnpj_emitente', 'transportadora_id', 'status_id',
      'data_disponibilizacao', 'hora_disponibilizacao', 'data_inicio_preparacao', 'hora_inicio_preparacao',
      'data_pronta', 'hora_pronta', 'responsavel_preparacao', 'responsavel_conferencia', 'conferencia_realizada',
      'data_conferencia', 'hora_conferencia', 'conferencia_nf_ok', 'conferencia_cliente_ok',
      'conferencia_volumes_ok', 'conferencia_embalagens_ok', 'conferencia_condicoes_ok',
      'conferencia_observacoes', 'observacoes', 'anotacoes', 'usuario_id', 'criado_em', 'atualizado_em'
    ]);

    // 10. Itens de Expedição
    await migrarTabela('itens_expedicao', ['id', 'expedicao_id', 'produto_id', 'produto_codigo', 'produto_descricao', 'quantidade', 'criado_em']);

    // 11. Volumes de Expedição
    await migrarTabela('volumes_expedicao', ['id', 'expedicao_id', 'numero_volume', 'embalagem_id', 'tipo_embalagem', 'comprimento_cm', 'largura_cm', 'altura_cm', 'peso_g', 'observacoes', 'criado_em']);

    // 12. Movimentações de Embalagens
    await migrarTabela('movimentacoes_embalagens', ['id', 'embalagem_id', 'tipo', 'quantidade', 'motivo', 'expedicao_id', 'nota_fiscal', 'usuario_id', 'observacoes', 'criado_em']);

    // 13. Coletas
    await migrarTabela('coletas', ['id', 'numero', 'data_retirada', 'hora_retirada', 'transportadora_id', 'transportadora_nome', 'motorista_nome', 'motorista_documento', 'motorista_id', 'placa_veiculo', 'funcionario_liberacao', 'usuario_id', 'observacoes', 'criado_em', 'atualizado_em']);

    // 14. Itens de Coleta
    await migrarTabela('itens_coleta', ['id', 'coleta_id', 'expedicao_id', 'quantidade_volumes', 'observacoes', 'criado_em']);

    // 15. Comprovantes
    await migrarTabela('comprovantes', ['id', 'numero', 'coleta_id', 'status', 'arquivo_pdf', 'arquivo_assinado', 'data_emissao', 'data_assinatura', 'responsavel_arquivo', 'observacoes', 'versao', 'comprovante_anterior_id', 'motivo_substituicao', 'usuario_id', 'criado_em', 'atualizado_em']);

    // 16. Ocorrências
    await migrarTabela('ocorrencias', ['id', 'tipo', 'descricao', 'expedicao_id', 'coleta_id', 'status', 'resolucao', 'usuario_id', 'resolvido_por', 'criado_em', 'atualizado_em']);

    // 17. Histórico
    await migrarTabela('historico', ['id', 'tabela', 'registro_id', 'acao', 'campo', 'valor_anterior', 'valor_novo', 'motivo', 'usuario_id', 'usuario_nome', 'criado_em']);

    console.log('================================================================');
    console.log('  MIGRAÇÃO DE DADOS PARA O SUPABASE CONCLUÍDA COM SUCESSO! ✓');
    console.log('================================================================');
  } finally {
    await pgPool.end();
  }
}

executarMigracao().catch(err => {
  console.error('[ERRO CRÍTICO NA MIGRAÇÃO]', err);
  process.exit(1);
});
