const express = require('express');
const router = express.Router();
const db = require('../utils/db-helper');
const { requireAuth, requireRole } = require('../middleware/auth');

// ==================== CLIENTES ====================
router.get('/clientes', requireAuth, async (req, res) => {
  try {
    const busca = req.query.busca ? `%${req.query.busca.trim()}%` : null;
    let rows;
    if (busca) {
      rows = await db.all('SELECT * FROM clientes WHERE (razao_social LIKE ? OR cnpj LIKE ? OR cidade LIKE ?) ORDER BY razao_social ASC LIMIT 200', [busca, busca, busca]);
    } else {
      rows = await db.all('SELECT * FROM clientes ORDER BY razao_social ASC LIMIT 200');
    }
    res.render('cadastros/clientes', { title: 'Cadastro de Clientes', clientes: rows, busca: req.query.busca || '', msg: req.query.sucesso || null, err: req.query.erro || null });
  } catch (err) { res.redirect('/cadastros/clientes?erro=' + encodeURIComponent(err.message)); }
});

router.post('/clientes/salvar', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const { id, codigo, razao_social, nome_fantasia, cnpj, telefone, cidade, estado, observacoes } = req.body;
    if (!razao_social || !razao_social.trim()) return res.redirect('/cadastros/clientes?erro=Razão Social é obrigatória.');

    if (id) {
      await db.run('UPDATE clientes SET codigo = ?, razao_social = ?, nome_fantasia = ?, cnpj = ?, telefone = ?, cidade = ?, estado = ?, observacoes = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
        [codigo || null, razao_social.trim(), nome_fantasia || null, cnpj || null, telefone || null, cidade || null, estado || null, observacoes || null, id]);
      await db.historico('clientes', id, 'alteracao', null, null, razao_social.trim(), 'Edição de cliente', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/clientes?sucesso=Cliente atualizado com sucesso!');
    } else {
      const info = await db.run('INSERT INTO clientes (codigo, razao_social, nome_fantasia, cnpj, telefone, cidade, estado, observacoes, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [codigo || null, razao_social.trim(), nome_fantasia || null, cnpj || null, telefone || null, cidade || null, estado || null, observacoes || null]);
      await db.historico('clientes', info.id, 'criacao', null, null, razao_social.trim(), 'Cadastro de novo cliente', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/clientes?sucesso=Cliente cadastrado com sucesso!');
    }
  } catch (err) { res.redirect('/cadastros/clientes?erro=' + encodeURIComponent(err.message)); }
});

// ==================== EMITENTES ====================
router.get('/emitentes', requireAuth, async (req, res) => {
  try {
    const busca = req.query.busca ? `%${req.query.busca.trim()}%` : null;
    let rows;
    if (busca) {
      rows = await db.all('SELECT * FROM emitentes WHERE (razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj LIKE ? OR cidade LIKE ? OR codigo LIKE ?) ORDER BY padrao DESC, razao_social ASC LIMIT 100',
        [busca, busca, busca, busca, busca]);
    } else {
      rows = await db.all('SELECT * FROM emitentes ORDER BY padrao DESC, razao_social ASC LIMIT 100');
    }
    res.render('cadastros/emitentes', { title: 'Cadastro de Empresas Emitentes', emitentes: rows, busca: req.query.busca || '', msg: req.query.sucesso || null, err: req.query.erro || null });
  } catch (err) { res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent(err.message)); }
});

router.post('/emitentes/salvar', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const { id, codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, endereco, cidade, estado, telefone, email, padrao, observacoes } = req.body;
    if (!razao_social || !razao_social.trim()) return res.redirect('/cadastros/emitentes?erro=Razão Social é obrigatória.');
    if (!cnpj || !cnpj.trim()) return res.redirect('/cadastros/emitentes?erro=CNPJ do Emitente é obrigatório.');

    const isPadrao = padrao === '1' || padrao === 1 || padrao === 'on' ? 1 : 0;
    if (isPadrao === 1) await db.run('UPDATE emitentes SET padrao = 0');

    if (id) {
      await db.run('UPDATE emitentes SET codigo = ?, razao_social = ?, nome_fantasia = ?, cnpj = ?, inscricao_estadual = ?, endereco = ?, cidade = ?, estado = ?, telefone = ?, email = ?, padrao = ?, observacoes = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
        [codigo ? codigo.trim().toUpperCase() : null, razao_social.trim(), nome_fantasia ? nome_fantasia.trim() : null, cnpj.trim(),
         inscricao_estadual ? inscricao_estadual.trim() : null, endereco ? endereco.trim() : null, cidade ? cidade.trim() : null,
         estado ? estado.trim().toUpperCase() : null, telefone ? telefone.trim() : null, email ? email.trim() : null,
         isPadrao, observacoes ? observacoes.trim() : null, id]);
      await db.historico('emitentes', id, 'alteracao', null, null, razao_social.trim(), 'Edição de empresa emitente', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/emitentes?sucesso=Empresa emitente atualizada com sucesso!');
    } else {
      const ultimo = await db.get('SELECT id FROM emitentes ORDER BY id DESC LIMIT 1');
      const novoId = ultimo ? parseInt(ultimo.id) + 1 : 1;
      const codFinal = codigo && codigo.trim() ? codigo.trim().toUpperCase() : `EMI-${String(novoId).padStart(3, '0')}`;
      const info = await db.run('INSERT INTO emitentes (codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, endereco, cidade, estado, telefone, email, padrao, ativo, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
        [codFinal, razao_social.trim(), nome_fantasia ? nome_fantasia.trim() : null, cnpj.trim(),
         inscricao_estadual ? inscricao_estadual.trim() : null, endereco ? endereco.trim() : null, cidade ? cidade.trim() : null,
         estado ? estado.trim().toUpperCase() : null, telefone ? telefone.trim() : null, email ? email.trim() : null,
         isPadrao, observacoes ? observacoes.trim() : null]);
      await db.historico('emitentes', info.id, 'criacao', null, null, razao_social.trim(), 'Cadastro de empresa emitente', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/emitentes?sucesso=Empresa emitente cadastrada com sucesso!');
    }
  } catch (err) {
    console.error('[ERRO EMITENTE]', err);
    res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent('Erro ao salvar emitente: ' + err.message));
  }
});

router.post('/emitentes/:id/excluir', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const emi = await db.get('SELECT * FROM emitentes WHERE id = ?', [id]);
    if (!emi) return res.redirect('/cadastros/emitentes?erro=Emitente não encontrado.');

    const vinculada = await db.get('SELECT id FROM expedicoes WHERE emitente_id = ? LIMIT 1', [id]);
    if (vinculada) {
      await db.run('UPDATE emitentes SET ativo = 0, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [id]);
      return res.redirect('/cadastros/emitentes?sucesso=Emitente possui vínculos e foi desativado.');
    }
    await db.run('DELETE FROM emitentes WHERE id = ?', [id]);
    await db.historico('emitentes', id, 'exclusao', null, emi.razao_social, 'EXCLUÍDO', 'Exclusão de emitente', req.session.user.id, req.session.user.nome);
    res.redirect('/cadastros/emitentes?sucesso=Emitente excluído com sucesso!');
  } catch (err) { res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent(err.message)); }
});

// ==================== PRODUTOS ====================
router.get('/produtos', requireAuth, async (req, res) => {
  try {
    const busca = req.query.busca ? `%${req.query.busca.trim()}%` : null;
    let rows;
    if (busca) {
      rows = await db.all('SELECT * FROM produtos WHERE (codigo LIKE ? OR descricao LIKE ?) ORDER BY codigo ASC LIMIT 250', [busca, busca]);
    } else {
      rows = await db.all('SELECT * FROM produtos ORDER BY codigo ASC LIMIT 250');
    }
    res.render('cadastros/produtos', { title: 'Cadastro de Produtos', produtos: rows, busca: req.query.busca || '', msg: req.query.sucesso || null, err: req.query.erro || null });
  } catch (err) { res.redirect('/cadastros/produtos?erro=' + encodeURIComponent(err.message)); }
});

router.post('/produtos/salvar', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const { id, codigo, descricao, unidade_medida } = req.body;
    if (!codigo || !descricao) return res.redirect('/cadastros/produtos?erro=Código e descrição são obrigatórios.');

    if (id) {
      await db.run('UPDATE produtos SET codigo = ?, descricao = ?, unidade_medida = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
        [codigo.trim().toUpperCase(), descricao.trim(), unidade_medida || 'UN', id]);
      await db.historico('produtos', id, 'alteracao', null, null, codigo.trim(), 'Edição de produto', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/produtos?sucesso=Produto atualizado com sucesso!');
    } else {
      const info = await db.run('INSERT INTO produtos (codigo, descricao, unidade_medida, ativo) VALUES (?, ?, ?, 1)',
        [codigo.trim().toUpperCase(), descricao.trim(), unidade_medida || 'UN']);
      await db.historico('produtos', info.id, 'criacao', null, null, codigo.trim(), 'Cadastro de produto', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/produtos?sucesso=Produto cadastrado com sucesso!');
    }
  } catch (err) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
      return res.redirect('/cadastros/produtos?erro=Já existe um produto com este código.');
    }
    res.redirect('/cadastros/produtos?erro=' + encodeURIComponent(err.message));
  }
});

// ==================== TRANSPORTADORAS ====================
router.get('/transportadoras', requireAuth, async (req, res) => {
  try {
    const busca = req.query.busca ? `%${req.query.busca.trim()}%` : null;
    let rows;
    if (busca) {
      rows = await db.all('SELECT * FROM transportadoras WHERE (nome LIKE ? OR cnpj LIKE ?) ORDER BY nome ASC LIMIT 150', [busca, busca]);
    } else {
      rows = await db.all('SELECT * FROM transportadoras ORDER BY nome ASC LIMIT 150');
    }
    res.render('cadastros/transportadoras', { title: 'Cadastro de Transportadoras', transportadoras: rows, busca: req.query.busca || '', msg: req.query.sucesso || null, err: req.query.erro || null });
  } catch (err) { res.redirect('/cadastros/transportadoras?erro=' + encodeURIComponent(err.message)); }
});

router.post('/transportadoras/salvar', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const { id, nome, cnpj, telefone, observacoes } = req.body;
    if (!nome || !nome.trim()) return res.redirect('/cadastros/transportadoras?erro=Nome da transportadora é obrigatório.');

    if (id) {
      await db.run('UPDATE transportadoras SET nome = ?, cnpj = ?, telefone = ?, observacoes = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
        [nome.trim(), cnpj || null, telefone || null, observacoes || null, id]);
      await db.historico('transportadoras', id, 'alteracao', null, null, nome.trim(), 'Edição de transportadora', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/transportadoras?sucesso=Transportadora atualizada com sucesso!');
    } else {
      const info = await db.run('INSERT INTO transportadoras (nome, cnpj, telefone, observacoes, ativo) VALUES (?, ?, ?, ?, 1)',
        [nome.trim(), cnpj || null, telefone || null, observacoes || null]);
      await db.historico('transportadoras', info.id, 'criacao', null, null, nome.trim(), 'Cadastro de transportadora', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/transportadoras?sucesso=Transportadora cadastrada com sucesso!');
    }
  } catch (err) { res.redirect('/cadastros/transportadoras?erro=' + encodeURIComponent(err.message)); }
});

// ==================== MOTORISTAS ====================
router.get('/motoristas', requireAuth, async (req, res) => {
  try {
    const busca = req.query.busca ? `%${req.query.busca.trim()}%` : null;
    let motoristas;
    if (busca) {
      motoristas = await db.all('SELECT m.*, t.nome as transportadora_nome FROM motoristas m LEFT JOIN transportadoras t ON m.transportadora_id = t.id WHERE (m.nome LIKE ? OR m.cpf LIKE ? OR m.documento LIKE ? OR t.nome LIKE ?) ORDER BY m.nome ASC LIMIT 150',
        [busca, busca, busca, busca]);
    } else {
      motoristas = await db.all('SELECT m.*, t.nome as transportadora_nome FROM motoristas m LEFT JOIN transportadoras t ON m.transportadora_id = t.id ORDER BY m.nome ASC LIMIT 150');
    }
    const transportadoras = await db.all('SELECT id, nome FROM transportadoras WHERE ativo = 1 ORDER BY nome');
    res.render('cadastros/motoristas', { title: 'Cadastro de Motoristas / Responsáveis', motoristas, transportadoras, busca: req.query.busca || '', msg: req.query.sucesso || null, err: req.query.erro || null });
  } catch (err) { res.redirect('/cadastros/motoristas?erro=' + encodeURIComponent(err.message)); }
});

router.post('/motoristas/salvar', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const { id, nome, cpf, documento, telefone, transportadora_id } = req.body;
    if (!nome || !nome.trim()) return res.redirect('/cadastros/motoristas?erro=Nome do motorista é obrigatório.');
    if ((!documento || !documento.trim()) && (!cpf || !cpf.trim())) {
      return res.redirect('/cadastros/motoristas?erro=Documento de Identificação (RG / CPF) é obrigatório.');
    }

    const tid = transportadora_id ? parseInt(transportadora_id, 10) : null;
    if (id) {
      await db.run('UPDATE motoristas SET nome = ?, cpf = ?, documento = ?, telefone = ?, transportadora_id = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
        [nome.trim(), cpf || null, documento || null, telefone || null, tid, id]);
      await db.historico('motoristas', id, 'alteracao', null, null, nome.trim(), 'Edição de motorista', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/motoristas?sucesso=Motorista atualizado com sucesso!');
    } else {
      const info = await db.run('INSERT INTO motoristas (nome, cpf, documento, telefone, transportadora_id, ativo) VALUES (?, ?, ?, ?, ?, 1)',
        [nome.trim(), cpf || null, documento || null, telefone || null, tid]);
      await db.historico('motoristas', info.id, 'criacao', null, null, nome.trim(), 'Cadastro de motorista', req.session.user.id, req.session.user.nome);
      res.redirect('/cadastros/motoristas?sucesso=Motorista cadastrado com sucesso!');
    }
  } catch (err) { res.redirect('/cadastros/motoristas?erro=' + encodeURIComponent(err.message)); }
});

module.exports = router;
