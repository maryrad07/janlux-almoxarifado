-- ============================================================
-- JANLUX ELÉTRICOS LTDA. - Schema PostgreSQL para Supabase
-- Execute este script no SQL Editor do seu projeto Supabase
-- ============================================================

-- USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK(perfil IN ('administrador','operacional','consulta')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  codigo TEXT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  telefone TEXT,
  cidade TEXT,
  estado TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- EMITENTES
CREATE TABLE IF NOT EXISTS emitentes (
  id SERIAL PRIMARY KEY,
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
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PRODUTOS
CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  unidade_medida TEXT DEFAULT 'UN',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- TRANSPORTADORAS
CREATE TABLE IF NOT EXISTS transportadoras (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  telefone TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- MOTORISTAS
CREATE TABLE IF NOT EXISTS motoristas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT,
  documento TEXT,
  telefone TEXT,
  transportadora_id INTEGER REFERENCES transportadoras(id) ON DELETE SET NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- EMBALAGENS
CREATE TABLE IF NOT EXISTS embalagens (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  unidade TEXT DEFAULT 'UN',
  comprimento_cm NUMERIC DEFAULT 0,
  largura_cm NUMERIC DEFAULT 0,
  altura_cm NUMERIC DEFAULT 0,
  peso_g NUMERIC DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 0,
  estoque_inicial INTEGER DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- STATUS DE EXPEDICAO
CREATE TABLE IF NOT EXISTS status_expedicao (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  ordem INTEGER NOT NULL DEFAULT 0,
  cor TEXT DEFAULT '#6c757d',
  ativo INTEGER NOT NULL DEFAULT 1
);

-- EXPEDICOES
CREATE TABLE IF NOT EXISTS expedicoes (
  id SERIAL PRIMARY KEY,
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
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ITENS DA EXPEDICAO
CREATE TABLE IF NOT EXISTS itens_expedicao (
  id SERIAL PRIMARY KEY,
  expedicao_id INTEGER NOT NULL REFERENCES expedicoes(id) ON DELETE CASCADE,
  produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
  produto_codigo TEXT,
  produto_descricao TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- VOLUMES FISICOS DA EXPEDICAO
CREATE TABLE IF NOT EXISTS volumes_expedicao (
  id SERIAL PRIMARY KEY,
  expedicao_id INTEGER NOT NULL REFERENCES expedicoes(id) ON DELETE CASCADE,
  numero_volume INTEGER NOT NULL DEFAULT 1,
  embalagem_id INTEGER REFERENCES embalagens(id) ON DELETE SET NULL,
  tipo_embalagem TEXT,
  comprimento_cm NUMERIC DEFAULT 0,
  largura_cm NUMERIC DEFAULT 0,
  altura_cm NUMERIC DEFAULT 0,
  peso_g NUMERIC DEFAULT 0,
  observacoes TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- MOVIMENTACOES DE EMBALAGENS
CREATE TABLE IF NOT EXISTS movimentacoes_embalagens (
  id SERIAL PRIMARY KEY,
  embalagem_id INTEGER NOT NULL REFERENCES embalagens(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('entrada','saida','uso_expedicao','ajuste','devolucao')),
  quantidade INTEGER NOT NULL,
  motivo TEXT,
  expedicao_id INTEGER REFERENCES expedicoes(id) ON DELETE SET NULL,
  nota_fiscal TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  observacoes TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- COLETAS
CREATE TABLE IF NOT EXISTS coletas (
  id SERIAL PRIMARY KEY,
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
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ITENS DA COLETA
CREATE TABLE IF NOT EXISTS itens_coleta (
  id SERIAL PRIMARY KEY,
  coleta_id INTEGER NOT NULL REFERENCES coletas(id) ON DELETE CASCADE,
  expedicao_id INTEGER NOT NULL REFERENCES expedicoes(id) ON DELETE RESTRICT,
  quantidade_volumes INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- COMPROVANTES
CREATE TABLE IF NOT EXISTS comprovantes (
  id SERIAL PRIMARY KEY,
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
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- OCORRENCIAS
CREATE TABLE IF NOT EXISTS ocorrencias (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  expedicao_id INTEGER REFERENCES expedicoes(id) ON DELETE SET NULL,
  coleta_id INTEGER REFERENCES coletas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','em_analise','resolvida','cancelada')),
  resolucao TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  resolvido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- HISTORICO / AUDIT LOG
CREATE TABLE IF NOT EXISTS historico (
  id SERIAL PRIMARY KEY,
  tabela TEXT NOT NULL,
  registro_id INTEGER NOT NULL,
  acao TEXT NOT NULL,
  campo TEXT,
  valor_anterior TEXT,
  valor_novo TEXT,
  motivo TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nome TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SESSOES (para express-session com connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- INDEXES de performance
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

-- ============================================================
-- DADOS INICIAIS (execute após criar as tabelas)
-- ============================================================

-- Status de Expedição
INSERT INTO status_expedicao (nome, ordem, cor) VALUES
  ('Aguardando preparação', 1, '#ffc107'),
  ('Em preparação', 2, '#17a2b8'),
  ('Aguardando conferência', 3, '#fd7e14'),
  ('Pronta para coleta', 4, '#28a745'),
  ('Coleta agendada', 5, '#6f42c1'),
  ('Coletada/Expedida', 6, '#007bff'),
  ('Cancelada', 7, '#dc3545')
ON CONFLICT (nome) DO NOTHING;

-- Emitente padrão
INSERT INTO emitentes (codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, cidade, estado, padrao, ativo)
VALUES ('EMI-001', 'JANLUX ELÉTRICOS LTDA.', 'JANLUX', '00.000.000/0001-00', 'ISENTO', 'São Paulo', 'SP', 1, 1)
ON CONFLICT DO NOTHING;

-- Embalagens padrão
INSERT INTO embalagens (codigo, descricao, unidade, comprimento_cm, largura_cm, altura_cm, peso_g, estoque_minimo, estoque_inicial)
VALUES
  ('EMB-PAP-01', 'Caixa Papelão Padrão', 'UN', 50, 30, 20, 350, 20, 100),
  ('EMB-MAD-01', 'Caixa de Madeira Reforçada', 'UN', 100, 30, 20, 2500, 10, 50),
  ('EMB-PAC-01', 'Pacote / Envoltório Padrão', 'UN', 40, 20, 10, 80, 30, 150),
  ('EMB-BOL-01', 'Plástico Bolha / Envoltório', 'UN', 50, 20, 10, 120, 20, 100)
ON CONFLICT (codigo) DO NOTHING;

-- NOTA: Usuários padrão são criados automaticamente pelo sistema na primeira execução
-- (admin/admin123, sandra/sandra123, ivan/ivan123, consulta/consulta123)
