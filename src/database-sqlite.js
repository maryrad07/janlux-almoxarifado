// src/database-sqlite.js — Versão SQLite para uso LOCAL
// Usado automaticamente quando não há variáveis SUPABASE_* no ambiente

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'janlux.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  return dbInstance;
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK(perfil IN ('administrador','operacional','consulta')),
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT,
      razao_social TEXT NOT NULL,
      nome_fantasia TEXT,
      cnpj TEXT,
      telefone TEXT,
      cidade TEXT,
      estado TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS emitentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT,
      razao_social TEXT NOT NULL,
      nome_fantasia TEXT,
      cnpj TEXT,
      inscricao_estadual TEXT,
      endereco TEXT,
      cidade TEXT,
      estado TEXT,
      telefone TEXT,
      email TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      padrao INTEGER NOT NULL DEFAULT 0,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      descricao TEXT NOT NULL,
      unidade_medida TEXT DEFAULT 'UN',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS transportadoras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cnpj TEXT,
      telefone TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS motoristas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT,
      documento TEXT,
      telefone TEXT,
      transportadora_id INTEGER REFERENCES transportadoras(id) ON DELETE SET NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS embalagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      descricao TEXT NOT NULL,
      unidade TEXT DEFAULT 'UN',
      comprimento_cm REAL DEFAULT 0,
      largura_cm REAL DEFAULT 0,
      altura_cm REAL DEFAULT 0,
      peso_g REAL DEFAULT 0,
      estoque_minimo INTEGER DEFAULT 0,
      estoque_inicial INTEGER DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS status_expedicao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      ordem INTEGER NOT NULL DEFAULT 0,
      cor TEXT DEFAULT '#6c757d',
      ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS expedicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_nf TEXT NOT NULL,
      serie_nf TEXT DEFAULT '1',
      data_emissao TEXT,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      cliente_nome TEXT,
      cnpj_destinatario TEXT,
      emitente_id INTEGER REFERENCES emitentes(id) ON DELETE SET NULL,
      emitente_nome TEXT DEFAULT 'JANLUX ELÉTRICOS LTDA.',
      cnpj_emitente TEXT DEFAULT '00.000.000/0001-00',
      transportadora_id INTEGER REFERENCES transportadoras(id) ON DELETE SET NULL,
      status_id INTEGER NOT NULL REFERENCES status_expedicao(id),
      data_disponibilizacao TEXT,
      hora_disponibilizacao TEXT,
      data_inicio_preparacao TEXT,
      hora_inicio_preparacao TEXT,
      data_pronta TEXT,
      hora_pronta TEXT,
      responsavel_preparacao TEXT,
      responsavel_conferencia TEXT,
      conferencia_realizada INTEGER NOT NULL DEFAULT 0,
      data_conferencia TEXT,
      hora_conferencia TEXT,
      conferencia_nf_ok INTEGER DEFAULT 0,
      conferencia_cliente_ok INTEGER DEFAULT 0,
      conferencia_volumes_ok INTEGER DEFAULT 0,
      conferencia_embalagens_ok INTEGER DEFAULT 0,
      conferencia_condicoes_ok INTEGER DEFAULT 0,
      conferencia_observacoes TEXT,
      observacoes TEXT,
      anotacoes TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS itens_expedicao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expedicao_id INTEGER NOT NULL REFERENCES expedicoes(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
      produto_codigo TEXT,
      produto_descricao TEXT,
      quantidade INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS volumes_expedicao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expedicao_id INTEGER NOT NULL REFERENCES expedicoes(id) ON DELETE CASCADE,
      numero_volume INTEGER NOT NULL DEFAULT 1,
      embalagem_id INTEGER REFERENCES embalagens(id) ON DELETE SET NULL,
      tipo_embalagem TEXT,
      comprimento_cm REAL DEFAULT 0,
      largura_cm REAL DEFAULT 0,
      altura_cm REAL DEFAULT 0,
      peso_g REAL DEFAULT 0,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS movimentacoes_embalagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      embalagem_id INTEGER NOT NULL REFERENCES embalagens(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada','saida','uso_expedicao','ajuste','devolucao')),
      quantidade INTEGER NOT NULL,
      motivo TEXT,
      expedicao_id INTEGER REFERENCES expedicoes(id) ON DELETE SET NULL,
      nota_fiscal TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS coletas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      data_retirada TEXT NOT NULL,
      hora_retirada TEXT NOT NULL,
      transportadora_id INTEGER REFERENCES transportadoras(id) ON DELETE SET NULL,
      transportadora_nome TEXT,
      motorista_nome TEXT,
      motorista_documento TEXT,
      motorista_id INTEGER REFERENCES motoristas(id) ON DELETE SET NULL,
      placa_veiculo TEXT,
      funcionario_liberacao TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS itens_coleta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coleta_id INTEGER NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
      expedicao_id INTEGER NOT NULL REFERENCES expedicoes(id) ON DELETE RESTRICT,
      quantidade_volumes INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS comprovantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      coleta_id INTEGER NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','emitido','assinado','arquivado','cancelado')),
      arquivo_pdf TEXT,
      arquivo_assinado TEXT,
      data_emissao TEXT,
      data_assinatura TEXT,
      responsavel_arquivo TEXT,
      observacoes TEXT,
      versao INTEGER NOT NULL DEFAULT 1,
      comprovante_anterior_id INTEGER REFERENCES comprovantes(id) ON DELETE SET NULL,
      motivo_substituicao TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS ocorrencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      expedicao_id INTEGER REFERENCES expedicoes(id) ON DELETE SET NULL,
      coleta_id INTEGER REFERENCES coletas(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','em_analise','resolvida','cancelada')),
      resolucao TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      resolvido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS historico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabela TEXT NOT NULL,
      registro_id INTEGER NOT NULL,
      acao TEXT NOT NULL,
      campo TEXT,
      valor_anterior TEXT,
      valor_novo TEXT,
      motivo TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      usuario_nome TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_expedicoes_nf ON expedicoes(numero_nf);
    CREATE INDEX IF NOT EXISTS idx_expedicoes_data ON expedicoes(data_emissao);
    CREATE INDEX IF NOT EXISTS idx_expedicoes_status ON expedicoes(status_id);
    CREATE INDEX IF NOT EXISTS idx_expedicoes_cliente ON expedicoes(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_coletas_numero ON coletas(numero);
    CREATE INDEX IF NOT EXISTS idx_coletas_data ON coletas(data_retirada);
    CREATE INDEX IF NOT EXISTS idx_itens_exp_nf ON itens_expedicao(expedicao_id);
    CREATE INDEX IF NOT EXISTS idx_vols_exp_nf ON volumes_expedicao(expedicao_id);
    CREATE INDEX IF NOT EXISTS idx_itens_coleta ON itens_coleta(coleta_id, expedicao_id);
    CREATE INDEX IF NOT EXISTS idx_historico_reg ON historico(tabela, registro_id);
  `);

  const statusDefaults = [
    { nome: 'Aguardando preparação', ordem: 1, cor: '#ffc107' },
    { nome: 'Em preparação', ordem: 2, cor: '#17a2b8' },
    { nome: 'Aguardando conferência', ordem: 3, cor: '#fd7e14' },
    { nome: 'Pronta para coleta', ordem: 4, cor: '#28a745' },
    { nome: 'Coleta agendada', ordem: 5, cor: '#6f42c1' },
    { nome: 'Coletada/Expedida', ordem: 6, cor: '#007bff' },
    { nome: 'Cancelada', ordem: 7, cor: '#dc3545' }
  ];
  const statusCount = db.prepare('SELECT COUNT(*) as count FROM status_expedicao').get().count;
  if (statusCount === 0) {
    const insertStatus = db.prepare('INSERT INTO status_expedicao (nome, ordem, cor) VALUES (?, ?, ?)');
    for (const s of statusDefaults) insertStatus.run(s.nome, s.ordem, s.cor);
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare('INSERT INTO usuarios (nome, login, senha, perfil) VALUES (?, ?, ?, ?)');
    insertUser.run('Administrador JANLUX', 'admin', bcrypt.hashSync('admin123', 10), 'administrador');
    insertUser.run('Sandra (Operacional)', 'sandra', bcrypt.hashSync('sandra123', 10), 'operacional');
    insertUser.run('Ivan (Operacional)', 'ivan', bcrypt.hashSync('ivan123', 10), 'operacional');
    insertUser.run('Usuário Consulta', 'consulta', bcrypt.hashSync('consulta123', 10), 'consulta');
  }

  const embCount = db.prepare('SELECT COUNT(*) as count FROM embalagens').get().count;
  if (embCount === 0) {
    const ins = db.prepare('INSERT INTO embalagens (codigo, descricao, unidade, comprimento_cm, largura_cm, altura_cm, peso_g, estoque_minimo, estoque_inicial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    ins.run('EMB-PAP-01', 'Caixa Papelão Padrão', 'UN', 50, 30, 20, 350, 20, 100);
    ins.run('EMB-MAD-01', 'Caixa de Madeira Reforçada', 'UN', 100, 30, 20, 2500, 10, 50);
    ins.run('EMB-PAC-01', 'Pacote / Envoltório Padrão', 'UN', 40, 20, 10, 80, 30, 150);
    ins.run('EMB-BOL-01', 'Plástico Bolha / Envoltório', 'UN', 50, 20, 10, 120, 20, 100);
  }

  // Migrações de coluna (compatibilidade)
  ['cnpj_emitente TEXT DEFAULT \'00.000.000/0001-00\'',
   'emitente_id INTEGER REFERENCES emitentes(id)',
   'emitente_nome TEXT DEFAULT \'JANLUX ELÉTRICOS LTDA.\''
  ].forEach(col => {
    try { db.exec(`ALTER TABLE expedicoes ADD COLUMN ${col}`); } catch(e) {}
  });

  const countEmitentes = db.prepare('SELECT COUNT(*) as count FROM emitentes').get().count;
  if (countEmitentes === 0) {
    db.prepare('INSERT INTO emitentes (codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, cidade, estado, padrao, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)')
      .run('EMI-001', 'JANLUX ELÉTRICOS LTDA.', 'JANLUX', '00.000.000/0001-00', 'ISENTO', 'São Paulo', 'SP');
  }

  try {
    const clientesSemCodigo = db.prepare("SELECT id FROM clientes WHERE codigo IS NULL OR codigo = ''").all();
    if (clientesSemCodigo.length > 0) {
      const upd = db.prepare("UPDATE clientes SET codigo = ? WHERE id = ?");
      for (const c of clientesSemCodigo) upd.run(`CLI-${String(c.id).padStart(4, '0')}`, c.id);
    }
  } catch(e) {}

  console.log('[DB-SQLite] Banco de dados local inicializado.');
  return db;
}

function registrarHistorico(tabela, registroId, acao, campo, valorAnterior, valorNovo, motivo, usuarioId, usuarioNome) {
  try {
    const db = getDb();
    db.prepare('INSERT INTO historico (tabela, registro_id, acao, campo, valor_anterior, valor_novo, motivo, usuario_id, usuario_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(tabela, registroId, acao, campo || null,
        valorAnterior !== undefined && valorAnterior !== null ? String(valorAnterior) : null,
        valorNovo !== undefined && valorNovo !== null ? String(valorNovo) : null,
        motivo || null, usuarioId || null, usuarioNome || null);
  } catch(err) {
    console.error('[DB-SQLite] Erro ao registrar histórico:', err.message);
  }
}

function calcularSaldoEmbalagem(embalagemId) {
  const db = getDb();
  const emb = db.prepare('SELECT estoque_inicial FROM embalagens WHERE id = ?').get(embalagemId);
  if (!emb) return 0;
  const movs = db.prepare('SELECT tipo, SUM(quantidade) as total FROM movimentacoes_embalagens WHERE embalagem_id = ? GROUP BY tipo').all(embalagemId);
  let saldo = emb.estoque_inicial || 0;
  for (const m of movs) {
    if (m.tipo === 'entrada' || m.tipo === 'devolucao') saldo += m.total;
    else if (m.tipo === 'saida' || m.tipo === 'uso_expedicao' || m.tipo === 'ajuste') saldo -= m.total;
  }
  return saldo;
}

module.exports = { getDb, initDatabase, registrarHistorico, calcularSaldoEmbalagem };
