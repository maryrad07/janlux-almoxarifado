"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/cadastros.ts — Rotas de Cadastros Básicos (Clientes, Emitentes, Produtos, Transportadoras, Motoristas)
const express_1 = require("express");
const db_helper_1 = __importDefault(require("../utils/db-helper"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ==================== CLIENTES ====================
router.get('/clientes', auth_1.requireAuth, async (req, res) => {
    try {
        const busca = req.query.busca ? `%${String(req.query.busca).trim()}%` : null;
        let rows;
        if (busca) {
            rows = await db_helper_1.default.all('SELECT * FROM clientes WHERE (razao_social LIKE ? OR cnpj LIKE ? OR cidade LIKE ?) ORDER BY razao_social ASC LIMIT 200', [busca, busca, busca]);
        }
        else {
            rows = await db_helper_1.default.all('SELECT * FROM clientes ORDER BY razao_social ASC LIMIT 200');
        }
        res.render('cadastros/clientes', {
            title: 'Cadastro de Clientes',
            clientes: rows,
            busca: req.query.busca || '',
            msg: req.query.sucesso || null,
            err: req.query.erro || null
        });
    }
    catch (err) {
        res.redirect('/cadastros/clientes?erro=' + encodeURIComponent(err.message));
    }
});
router.post('/clientes/salvar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), async (req, res) => {
    try {
        const { id, codigo, razao_social, nome_fantasia, cnpj, telefone, cidade, estado, observacoes } = req.body;
        if (!razao_social || !razao_social.trim()) {
            return res.redirect('/cadastros/clientes?erro=' + encodeURIComponent('Razão Social é obrigatória.'));
        }
        const user = req.session.user;
        if (id) {
            await db_helper_1.default.run('UPDATE clientes SET codigo = ?, razao_social = ?, nome_fantasia = ?, cnpj = ?, telefone = ?, cidade = ?, estado = ?, observacoes = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [codigo || null, razao_social.trim(), nome_fantasia || null, cnpj || null, telefone || null, cidade || null, estado || null, observacoes || null, id]);
            await db_helper_1.default.historico('clientes', Number(id), 'alteracao', null, null, razao_social.trim(), 'Edição de cliente', user?.id, user?.nome);
            res.redirect('/cadastros/clientes?sucesso=' + encodeURIComponent('Cliente atualizado com sucesso!'));
        }
        else {
            const info = await db_helper_1.default.run('INSERT INTO clientes (codigo, razao_social, nome_fantasia, cnpj, telefone, cidade, estado, observacoes, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)', [codigo || null, razao_social.trim(), nome_fantasia || null, cnpj || null, telefone || null, cidade || null, estado || null, observacoes || null]);
            await db_helper_1.default.historico('clientes', Number(info.id), 'criacao', null, null, razao_social.trim(), 'Cadastro de novo cliente', user?.id, user?.nome);
            res.redirect('/cadastros/clientes?sucesso=' + encodeURIComponent('Cliente cadastrado com sucesso!'));
        }
    }
    catch (err) {
        res.redirect('/cadastros/clientes?erro=' + encodeURIComponent(err.message));
    }
});
// ==================== EMITENTES ====================
router.get('/emitentes', auth_1.requireAuth, async (req, res) => {
    try {
        const busca = req.query.busca ? `%${String(req.query.busca).trim()}%` : null;
        let rows;
        if (busca) {
            rows = await db_helper_1.default.all('SELECT * FROM emitentes WHERE (razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj LIKE ? OR cidade LIKE ? OR codigo LIKE ?) ORDER BY padrao DESC, razao_social ASC LIMIT 100', [busca, busca, busca, busca, busca]);
        }
        else {
            rows = await db_helper_1.default.all('SELECT * FROM emitentes ORDER BY padrao DESC, razao_social ASC LIMIT 100');
        }
        res.render('cadastros/emitentes', {
            title: 'Cadastro de Empresas Emitentes',
            emitentes: rows,
            busca: req.query.busca || '',
            msg: req.query.sucesso || null,
            err: req.query.erro || null
        });
    }
    catch (err) {
        res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent(err.message));
    }
});
router.post('/emitentes/salvar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), async (req, res) => {
    try {
        const { id, codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, endereco, cidade, estado, telefone, email, padrao, observacoes } = req.body;
        if (!razao_social || !razao_social.trim()) {
            return res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent('Razão Social é obrigatória.'));
        }
        if (!cnpj || !cnpj.trim()) {
            return res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent('CNPJ do Emitente é obrigatório.'));
        }
        const isPadrao = padrao === '1' || padrao === 1 || padrao === 'on' ? 1 : 0;
        if (isPadrao === 1)
            await db_helper_1.default.run('UPDATE emitentes SET padrao = 0');
        const user = req.session.user;
        if (id) {
            await db_helper_1.default.run('UPDATE emitentes SET codigo = ?, razao_social = ?, nome_fantasia = ?, cnpj = ?, inscricao_estadual = ?, endereco = ?, cidade = ?, estado = ?, telefone = ?, email = ?, padrao = ?, observacoes = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [
                codigo ? codigo.trim().toUpperCase() : null,
                razao_social.trim(),
                nome_fantasia ? nome_fantasia.trim() : null,
                cnpj.trim(),
                inscricao_estadual ? inscricao_estadual.trim() : null,
                endereco ? endereco.trim() : null,
                cidade ? cidade.trim() : null,
                estado ? estado.trim().toUpperCase() : null,
                telefone ? telefone.trim() : null,
                email ? email.trim() : null,
                isPadrao,
                observacoes ? observacoes.trim() : null,
                id
            ]);
            await db_helper_1.default.historico('emitentes', Number(id), 'alteracao', null, null, razao_social.trim(), 'Edição de empresa emitente', user?.id, user?.nome);
            res.redirect('/cadastros/emitentes?sucesso=' + encodeURIComponent('Empresa emitente atualizada com sucesso!'));
        }
        else {
            const ultimo = await db_helper_1.default.get('SELECT id FROM emitentes ORDER BY id DESC LIMIT 1');
            const novoId = ultimo ? parseInt(ultimo.id, 10) + 1 : 1;
            const codFinal = codigo && codigo.trim() ? codigo.trim().toUpperCase() : `EMI-${String(novoId).padStart(3, '0')}`;
            const info = await db_helper_1.default.run('INSERT INTO emitentes (codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, endereco, cidade, estado, telefone, email, padrao, ativo, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', [
                codFinal,
                razao_social.trim(),
                nome_fantasia ? nome_fantasia.trim() : null,
                cnpj.trim(),
                inscricao_estadual ? inscricao_estadual.trim() : null,
                endereco ? endereco.trim() : null,
                cidade ? cidade.trim() : null,
                estado ? estado.trim().toUpperCase() : null,
                telefone ? telefone.trim() : null,
                email ? email.trim() : null,
                isPadrao,
                observacoes ? observacoes.trim() : null
            ]);
            await db_helper_1.default.historico('emitentes', Number(info.id), 'criacao', null, null, razao_social.trim(), 'Cadastro de empresa emitente', user?.id, user?.nome);
            res.redirect('/cadastros/emitentes?sucesso=' + encodeURIComponent('Empresa emitente cadastrada com sucesso!'));
        }
    }
    catch (err) {
        console.error('[ERRO EMITENTE]', err);
        res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent('Erro ao salvar emitente: ' + err.message));
    }
});
router.post('/emitentes/:id/excluir', auth_1.requireAuth, (0, auth_1.requireRole)('administrador'), async (req, res) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        const emi = await db_helper_1.default.get('SELECT * FROM emitentes WHERE id = ?', [id]);
        if (!emi)
            return res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent('Emitente não encontrado.'));
        const user = req.session.user;
        const vinculada = await db_helper_1.default.get('SELECT id FROM expedicoes WHERE emitente_id = ? LIMIT 1', [id]);
        if (vinculada) {
            await db_helper_1.default.run('UPDATE emitentes SET ativo = 0, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [id]);
            return res.redirect('/cadastros/emitentes?sucesso=' + encodeURIComponent('Emitente possui vínculos e foi desativado.'));
        }
        await db_helper_1.default.run('DELETE FROM emitentes WHERE id = ?', [id]);
        await db_helper_1.default.historico('emitentes', id, 'exclusao', null, emi.razao_social, 'EXCLUÍDO', 'Exclusão de emitente', user?.id, user?.nome);
        res.redirect('/cadastros/emitentes?sucesso=' + encodeURIComponent('Emitente excluído com sucesso!'));
    }
    catch (err) {
        res.redirect('/cadastros/emitentes?erro=' + encodeURIComponent(err.message));
    }
});
// ==================== PRODUTOS ====================
router.get('/produtos', auth_1.requireAuth, async (req, res) => {
    try {
        const busca = req.query.busca ? `%${String(req.query.busca).trim()}%` : null;
        let rows;
        if (busca) {
            rows = await db_helper_1.default.all('SELECT * FROM produtos WHERE (codigo LIKE ? OR descricao LIKE ?) ORDER BY codigo ASC LIMIT 250', [busca, busca]);
        }
        else {
            rows = await db_helper_1.default.all('SELECT * FROM produtos ORDER BY codigo ASC LIMIT 250');
        }
        res.render('cadastros/produtos', {
            title: 'Cadastro de Produtos',
            produtos: rows,
            busca: req.query.busca || '',
            msg: req.query.sucesso || null,
            err: req.query.erro || null
        });
    }
    catch (err) {
        res.redirect('/cadastros/produtos?erro=' + encodeURIComponent(err.message));
    }
});
router.post('/produtos/salvar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), async (req, res) => {
    try {
        const { id, codigo, descricao, unidade_medida } = req.body;
        if (!codigo || !descricao) {
            return res.redirect('/cadastros/produtos?erro=' + encodeURIComponent('Código e descrição são obrigatórios.'));
        }
        const user = req.session.user;
        if (id) {
            await db_helper_1.default.run('UPDATE produtos SET codigo = ?, descricao = ?, unidade_medida = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [codigo.trim().toUpperCase(), descricao.trim(), unidade_medida || 'UN', id]);
            await db_helper_1.default.historico('produtos', Number(id), 'alteracao', null, null, codigo.trim(), 'Edição de produto', user?.id, user?.nome);
            res.redirect('/cadastros/produtos?sucesso=' + encodeURIComponent('Produto atualizado com sucesso!'));
        }
        else {
            const info = await db_helper_1.default.run('INSERT INTO produtos (codigo, descricao, unidade_medida, ativo) VALUES (?, ?, ?, 1)', [codigo.trim().toUpperCase(), descricao.trim(), unidade_medida || 'UN']);
            await db_helper_1.default.historico('produtos', Number(info.id), 'criacao', null, null, codigo.trim(), 'Cadastro de produto', user?.id, user?.nome);
            res.redirect('/cadastros/produtos?sucesso=' + encodeURIComponent('Produto cadastrado com sucesso!'));
        }
    }
    catch (err) {
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
            return res.redirect('/cadastros/produtos?erro=' + encodeURIComponent('Já existe um produto com este código.'));
        }
        res.redirect('/cadastros/produtos?erro=' + encodeURIComponent(err.message));
    }
});
// ==================== TRANSPORTADORAS ====================
router.get('/transportadoras', auth_1.requireAuth, async (req, res) => {
    try {
        const busca = req.query.busca ? `%${String(req.query.busca).trim()}%` : null;
        let rows;
        if (busca) {
            rows = await db_helper_1.default.all('SELECT * FROM transportadoras WHERE (nome LIKE ? OR cnpj LIKE ?) ORDER BY nome ASC LIMIT 150', [busca, busca]);
        }
        else {
            rows = await db_helper_1.default.all('SELECT * FROM transportadoras ORDER BY nome ASC LIMIT 150');
        }
        res.render('cadastros/transportadoras', {
            title: 'Cadastro de Transportadoras',
            transportadoras: rows,
            busca: req.query.busca || '',
            msg: req.query.sucesso || null,
            err: req.query.erro || null
        });
    }
    catch (err) {
        res.redirect('/cadastros/transportadoras?erro=' + encodeURIComponent(err.message));
    }
});
router.post('/transportadoras/salvar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), async (req, res) => {
    try {
        const { id, nome, cnpj, telefone, observacoes } = req.body;
        if (!nome || !nome.trim()) {
            return res.redirect('/cadastros/transportadoras?erro=' + encodeURIComponent('Nome da transportadora é obrigatório.'));
        }
        const user = req.session.user;
        if (id) {
            await db_helper_1.default.run('UPDATE transportadoras SET nome = ?, cnpj = ?, telefone = ?, observacoes = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [nome.trim(), cnpj || null, telefone || null, observacoes || null, id]);
            await db_helper_1.default.historico('transportadoras', Number(id), 'alteracao', null, null, nome.trim(), 'Edição de transportadora', user?.id, user?.nome);
            res.redirect('/cadastros/transportadoras?sucesso=' + encodeURIComponent('Transportadora atualizada com sucesso!'));
        }
        else {
            const info = await db_helper_1.default.run('INSERT INTO transportadoras (nome, cnpj, telefone, observacoes, ativo) VALUES (?, ?, ?, ?, 1)', [nome.trim(), cnpj || null, telefone || null, observacoes || null]);
            await db_helper_1.default.historico('transportadoras', Number(info.id), 'criacao', null, null, nome.trim(), 'Cadastro de transportadora', user?.id, user?.nome);
            res.redirect('/cadastros/transportadoras?sucesso=' + encodeURIComponent('Transportadora cadastrada com sucesso!'));
        }
    }
    catch (err) {
        res.redirect('/cadastros/transportadoras?erro=' + encodeURIComponent(err.message));
    }
});
// ==================== MOTORISTAS ====================
router.get('/motoristas', auth_1.requireAuth, async (req, res) => {
    try {
        const busca = req.query.busca ? `%${String(req.query.busca).trim()}%` : null;
        let motoristas;
        if (busca) {
            motoristas = await db_helper_1.default.all('SELECT m.*, t.nome as transportadora_nome FROM motoristas m LEFT JOIN transportadoras t ON m.transportadora_id = t.id WHERE (m.nome LIKE ? OR m.cpf LIKE ? OR m.documento LIKE ? OR t.nome LIKE ?) ORDER BY m.nome ASC LIMIT 150', [busca, busca, busca, busca]);
        }
        else {
            motoristas = await db_helper_1.default.all('SELECT m.*, t.nome as transportadora_nome FROM motoristas m LEFT JOIN transportadoras t ON m.transportadora_id = t.id ORDER BY m.nome ASC LIMIT 150');
        }
        const transportadoras = await db_helper_1.default.all('SELECT id, nome FROM transportadoras WHERE ativo = 1 ORDER BY nome');
        res.render('cadastros/motoristas', {
            title: 'Cadastro de Motoristas / Responsáveis',
            motoristas,
            transportadoras,
            busca: req.query.busca || '',
            msg: req.query.sucesso || null,
            err: req.query.erro || null
        });
    }
    catch (err) {
        res.redirect('/cadastros/motoristas?erro=' + encodeURIComponent(err.message));
    }
});
router.post('/motoristas/salvar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), async (req, res) => {
    try {
        const { id, nome, cpf, documento, telefone, transportadora_id } = req.body;
        if (!nome || !nome.trim()) {
            return res.redirect('/cadastros/motoristas?erro=' + encodeURIComponent('Nome do motorista é obrigatório.'));
        }
        if ((!documento || !documento.trim()) && (!cpf || !cpf.trim())) {
            return res.redirect('/cadastros/motoristas?erro=' + encodeURIComponent('Documento de Identificação (RG / CPF) é obrigatório.'));
        }
        const tid = transportadora_id ? parseInt(transportadora_id, 10) : null;
        const user = req.session.user;
        if (id) {
            await db_helper_1.default.run('UPDATE motoristas SET nome = ?, cpf = ?, documento = ?, telefone = ?, transportadora_id = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [nome.trim(), cpf || null, documento || null, telefone || null, tid, id]);
            await db_helper_1.default.historico('motoristas', Number(id), 'alteracao', null, null, nome.trim(), 'Edição de motorista', user?.id, user?.nome);
            res.redirect('/cadastros/motoristas?sucesso=' + encodeURIComponent('Motorista atualizado com sucesso!'));
        }
        else {
            const info = await db_helper_1.default.run('INSERT INTO motoristas (nome, cpf, documento, telefone, transportadora_id, ativo) VALUES (?, ?, ?, ?, ?, 1)', [nome.trim(), cpf || null, documento || null, telefone || null, tid]);
            await db_helper_1.default.historico('motoristas', Number(info.id), 'criacao', null, null, nome.trim(), 'Cadastro de motorista', user?.id, user?.nome);
            res.redirect('/cadastros/motoristas?sucesso=' + encodeURIComponent('Motorista cadastrado com sucesso!'));
        }
    }
    catch (err) {
        res.redirect('/cadastros/motoristas?erro=' + encodeURIComponent(err.message));
    }
});
exports.default = router;
