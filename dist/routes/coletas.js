"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/coletas.ts — Coletas, Retirada de Mercadorias e Emissão de Comprovantes
const express_1 = require("express");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const multer_1 = __importDefault(require("multer"));
const db_helper_1 = __importDefault(require("../utils/db-helper"));
const auth_1 = require("../middleware/auth");
const pdfGenerator_1 = require("../utils/pdfGenerator");
const router = (0, express_1.Router)();
const isVercel = !!process.env.VERCEL;
const pdfDir = isVercel ? '/tmp/pdfs' : node_path_1.default.join(__dirname, '..', '..', 'pdfs');
const uploadDir = isVercel ? '/tmp/uploads' : node_path_1.default.join(__dirname, '..', '..', 'uploads');
if (!node_fs_1.default.existsSync(pdfDir)) {
    try {
        node_fs_1.default.mkdirSync(pdfDir, { recursive: true });
    }
    catch (e) { }
}
if (!node_fs_1.default.existsSync(uploadDir)) {
    try {
        node_fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    catch (e) { }
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = node_path_1.default.extname(file.originalname);
        cb(null, `comprovante-assinado-${Date.now()}${ext}`);
    }
});
const upload = (0, multer_1.default)({ storage });
// Listar Coletas
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { busca, data_inicio, data_fim, transportadora_id, status_comprovante } = req.query;
        let query = `
      SELECT c.*, t.nome as transportadora_nome,
             (SELECT COUNT(*) FROM itens_coleta WHERE coleta_id = c.id) as total_nfs,
             (SELECT COALESCE(SUM(quantidade_volumes), 0) FROM itens_coleta WHERE coleta_id = c.id) as total_volumes,
             comp.status as comprovante_status, comp.id as comprovante_id, comp.arquivo_pdf, comp.arquivo_assinado
      FROM coletas c
      LEFT JOIN transportadoras t ON c.transportadora_id = t.id
      LEFT JOIN comprovantes comp ON comp.coleta_id = c.id
      WHERE 1=1
    `;
        const params = [];
        if (busca) {
            query += ` AND (c.numero LIKE ? OR c.motorista_nome LIKE ? OR c.placa_veiculo LIKE ? OR t.nome LIKE ? OR c.id IN (
        SELECT ic.coleta_id FROM itens_coleta ic JOIN expedicoes e ON ic.expedicao_id = e.id WHERE e.numero_nf LIKE ? OR e.cliente_nome LIKE ?
      ))`;
            const b = `%${String(busca).trim()}%`;
            params.push(b, b, b, b, b, b);
        }
        if (data_inicio) {
            query += ` AND c.data_retirada >= ?`;
            params.push(data_inicio);
        }
        if (data_fim) {
            query += ` AND c.data_retirada <= ?`;
            params.push(data_fim);
        }
        if (transportadora_id) {
            query += ` AND c.transportadora_id = ?`;
            params.push(parseInt(String(transportadora_id), 10));
        }
        if (status_comprovante) {
            query += ` AND comp.status = ?`;
            params.push(status_comprovante);
        }
        query += ` ORDER BY c.id DESC LIMIT 150`;
        const coletas = await db_helper_1.default.all(query, params);
        const transportadoras = await db_helper_1.default.all('SELECT id, nome FROM transportadoras WHERE ativo = 1 ORDER BY nome');
        res.render('coletas/index', {
            title: 'Coletas e Retirada de Mercadorias',
            coletas,
            transportadoras,
            filtros: req.query,
            msg: req.query.sucesso || null,
            err: req.query.erro || null
        });
    }
    catch (err) {
        console.error('[COLETAS LIST]', err);
        res.status(500).render('error', { title: 'Erro', mensagem: err.message });
    }
});
// Formulário de Nova Coleta
router.get('/nova', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), async (req, res) => {
    try {
        const expedicoesDisponiveis = await db_helper_1.default.all(`
      SELECT e.id, e.numero_nf, e.cliente_nome, e.data_emissao,
             t.nome as transportadora_prevista,
             s.nome as status_nome,
             (SELECT COUNT(*) FROM volumes_expedicao WHERE expedicao_id = e.id) as volumes_fisicos
      FROM expedicoes e
      LEFT JOIN transportadoras t ON e.transportadora_id = t.id
      LEFT JOIN status_expedicao s ON e.status_id = s.id
      WHERE e.id NOT IN (
        SELECT ic.expedicao_id FROM itens_coleta ic
      ) AND s.nome != 'Cancelada'
      ORDER BY e.id DESC
    `);
        const transportadoras = await db_helper_1.default.all('SELECT id, nome FROM transportadoras WHERE ativo = 1 ORDER BY nome');
        const motoristas = await db_helper_1.default.all('SELECT m.*, t.nome as transportadora_nome FROM motoristas m LEFT JOIN transportadoras t ON m.transportadora_id = t.id WHERE m.ativo = 1 ORDER BY m.nome');
        const anoAtual = new Date().getFullYear();
        const ultimaColeta = await db_helper_1.default.get('SELECT id FROM coletas ORDER BY id DESC LIMIT 1');
        const proxSeq = (ultimaColeta ? parseInt(ultimaColeta.id, 10) + 1 : 1);
        const numeroSugerido = `COL-${anoAtual}-${String(proxSeq).padStart(4, '0')}`;
        const agoraData = new Date().toISOString().slice(0, 10);
        const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        res.render('coletas/form', {
            title: 'Registrar Nova Coleta',
            numeroSugerido,
            agoraData,
            agoraHora,
            transportadoras,
            motoristas,
            expedicoesDisponiveis,
            funcionarioPadrao: req.session.user?.nome,
            err: req.query.erro || null
        });
    }
    catch (err) {
        console.error('[COLETAS FORM]', err);
        res.status(500).render('error', { title: 'Erro', mensagem: err.message });
    }
});
// Salvar Nova Coleta e Gerar PDF Automático
router.post('/salvar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), async (req, res) => {
    try {
        const { numero, data_retirada, hora_retirada, transportadora_id, transportadora_nome_novo, motorista_nome, motorista_documento, placa_veiculo, funcionario_liberacao, observacoes, expedicoes_selecionadas } = req.body;
        if (!numero || !data_retirada || !hora_retirada) {
            return res.redirect('/coletas/nova?erro=' + encodeURIComponent('Campos obrigatórios da coleta não foram preenchidos.'));
        }
        if (!motorista_nome || !motorista_nome.trim()) {
            return res.redirect('/coletas/nova?erro=' + encodeURIComponent('O nome do motorista ou responsável é obrigatório.'));
        }
        if (!motorista_documento || !motorista_documento.trim()) {
            return res.redirect('/coletas/nova?erro=' + encodeURIComponent('O Documento de Identificação (RG / CPF) do motorista é obrigatório.'));
        }
        const expIds = Array.isArray(expedicoes_selecionadas)
            ? expedicoes_selecionadas.map(id => parseInt(id, 10))
            : (expedicoes_selecionadas ? [parseInt(expedicoes_selecionadas, 10)] : []);
        if (expIds.length === 0) {
            return res.redirect('/coletas/nova?erro=' + encodeURIComponent('Selecione pelo menos uma Nota Fiscal para a coleta.'));
        }
        // Verificar se alguma NF já foi associada
        const placeholders = expIds.map(() => '?').join(',');
        const jaAssociada = await db_helper_1.default.all(`
      SELECT e.numero_nf 
      FROM itens_coleta ic
      JOIN expedicoes e ON ic.expedicao_id = e.id
      WHERE ic.expedicao_id IN (${placeholders})
    `, expIds);
        if (jaAssociada.length > 0) {
            const nfs = jaAssociada.map((a) => a.numero_nf).join(', ');
            return res.redirect(`/coletas/nova?erro=${encodeURIComponent(`A(s) Nota(s) Fiscal(is) ${nfs} já faz(em) parte de outra coleta.`)}`);
        }
        let finalTranspId = transportadora_id ? parseInt(transportadora_id, 10) : null;
        let finalTranspNome = '';
        if (finalTranspId) {
            const t = await db_helper_1.default.get('SELECT nome FROM transportadoras WHERE id = ?', [finalTranspId]);
            finalTranspNome = t ? t.nome : '';
        }
        else if (transportadora_nome_novo && transportadora_nome_novo.trim()) {
            const infoT = await db_helper_1.default.run('INSERT INTO transportadoras (nome, ativo) VALUES (?, 1)', [transportadora_nome_novo.trim()]);
            finalTranspId = Number(infoT.id);
            finalTranspNome = transportadora_nome_novo.trim();
        }
        const user = req.session.user;
        // Inserir Coleta
        const infoColeta = await db_helper_1.default.run(`
      INSERT INTO coletas (
        numero, data_retirada, hora_retirada, transportadora_id, transportadora_nome,
        motorista_nome, motorista_documento, placa_veiculo, funcionario_liberacao,
        usuario_id, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            numero.trim().toUpperCase(),
            data_retirada,
            hora_retirada,
            finalTranspId,
            finalTranspNome,
            motorista_nome || null,
            motorista_documento || null,
            placa_veiculo ? placa_veiculo.trim().toUpperCase() : null,
            funcionario_liberacao || user?.nome,
            user?.id,
            observacoes || null
        ]);
        const coletaId = Number(infoColeta.id);
        // Status "Coletada/Expedida"
        const statusColetada = await db_helper_1.default.get("SELECT id FROM status_expedicao WHERE nome = 'Coletada/Expedida'");
        const itensParaPDF = [];
        for (const expId of expIds) {
            const volRow = await db_helper_1.default.get('SELECT COUNT(*) as count FROM volumes_expedicao WHERE expedicao_id = ?', [expId]);
            const countVols = volRow ? parseInt(volRow.count, 10) : 0;
            const qtdVols = countVols > 0 ? countVols : 1;
            await db_helper_1.default.run('INSERT INTO itens_coleta (coleta_id, expedicao_id, quantidade_volumes) VALUES (?, ?, ?)', [coletaId, expId, qtdVols]);
            if (statusColetada) {
                await db_helper_1.default.run("UPDATE expedicoes SET status_id = ?, atualizado_em = datetime('now','localtime') WHERE id = ?", [statusColetada.id, expId]);
            }
            const expData = await db_helper_1.default.get('SELECT numero_nf, cliente_nome FROM expedicoes WHERE id = ?', [expId]);
            if (expData) {
                itensParaPDF.push({
                    numero_nf: expData.numero_nf,
                    cliente_nome: expData.cliente_nome,
                    quantidade_volumes: qtdVols
                });
            }
        }
        // Gerar Comprovante PDF automaticamente com a LOGO
        const numComprovante = `COMP-${numero.trim().toUpperCase()}`;
        const pdfFilename = `${numComprovante}.pdf`;
        const pdfFilePath = node_path_1.default.join(pdfDir, pdfFilename);
        const dataColetaFormatada = data_retirada.split('-').reverse().join('/');
        try {
            await (0, pdfGenerator_1.gerarComprovantePDF)({
                numero: numero.trim().toUpperCase(),
                comprovante_numero: numComprovante,
                data_retirada,
                data_retirada_formatada: dataColetaFormatada,
                hora_retirada,
                transportadora_nome: finalTranspNome,
                motorista_nome: motorista_nome || '',
                motorista_documento: motorista_documento || '',
                placa_veiculo: placa_veiculo || '',
                funcionario_liberacao: funcionario_liberacao || user?.nome,
                observacoes
            }, itensParaPDF, pdfFilePath);
        }
        catch (pdfErr) {
            console.warn('[PDF GENERATE WARNING]', pdfErr.message);
        }
        // Inserir Comprovante no banco
        await db_helper_1.default.run(`
      INSERT INTO comprovantes (
        numero, coleta_id, status, arquivo_pdf, data_emissao, usuario_id
      ) VALUES (?, ?, 'emitido', ?, date('now','localtime'), ?)
    `, [
            numComprovante,
            coletaId,
            `/coletas/${coletaId}/pdf`,
            user?.id
        ]);
        await db_helper_1.default.historico('coletas', coletaId, 'criacao', null, null, numero.trim().toUpperCase(), `Registro da coleta com ${expIds.length} NF(s) e geração do comprovante em PDF com logo`, user?.id, user?.nome);
        res.redirect(`/coletas/${coletaId}?sucesso=` + encodeURIComponent('Coleta registrada com sucesso! Comprovante em PDF gerado automaticamente.'));
    }
    catch (err) {
        console.error('[ERRO SALVAR COLETA]', err);
        res.redirect(`/coletas/nova?erro=${encodeURIComponent('Erro ao registrar coleta: ' + err.message)}`);
    }
});
// Detalhes da Coleta
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const coletaId = parseInt(String(req.params.id), 10);
        const coleta = await db_helper_1.default.get(`
      SELECT c.*, t.nome as transportadora_cadastrada
      FROM coletas c
      LEFT JOIN transportadoras t ON c.transportadora_id = t.id
      WHERE c.id = ?
    `, [coletaId]);
        if (!coleta) {
            return res.status(404).render('error', { title: 'Não Encontrado', mensagem: 'Coleta não encontrada.' });
        }
        const itens = await db_helper_1.default.all(`
      SELECT ic.*, e.numero_nf, e.cliente_nome, e.data_emissao,
             (SELECT COUNT(*) FROM volumes_expedicao WHERE expedicao_id = e.id) as volumes_fisicos
      FROM itens_coleta ic
      JOIN expedicoes e ON ic.expedicao_id = e.id
      WHERE ic.coleta_id = ?
    `, [coletaId]);
        const totalVolumes = itens.reduce((acc, curr) => acc + (parseInt(curr.quantidade_volumes, 10) || 1), 0);
        const comprovante = await db_helper_1.default.get('SELECT * FROM comprovantes WHERE coleta_id = ?', [coletaId]);
        const historico = await db_helper_1.default.all("SELECT * FROM historico WHERE tabela = 'coletas' AND registro_id = ? ORDER BY id DESC", [coletaId]);
        res.render('coletas/detalhes', {
            title: `Coleta ${coleta.numero}`,
            coleta,
            itens,
            totalVolumes,
            comprovante,
            historico,
            msg: req.query.sucesso || null,
            err: req.query.erro || null
        });
    }
    catch (err) {
        console.error('[COLETAS DETALHES]', err);
        res.status(500).render('error', { title: 'Erro', mensagem: err.message });
    }
});
// Regenerar PDF da Coleta Sob Demanda
router.post('/:id/regenerar-pdf', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), async (req, res) => {
    try {
        const coletaId = parseInt(String(req.params.id), 10);
        const coleta = await db_helper_1.default.get('SELECT * FROM coletas WHERE id = ?', [coletaId]);
        if (!coleta)
            return res.redirect('/coletas');
        const itens = await db_helper_1.default.all(`
      SELECT ic.*, e.numero_nf, e.cliente_nome
      FROM itens_coleta ic
      JOIN expedicoes e ON ic.expedicao_id = e.id
      WHERE ic.coleta_id = ?
    `, [coletaId]);
        const numComprovante = `COMP-${coleta.numero}`;
        const pdfFilename = `${numComprovante}.pdf`;
        const pdfFilePath = node_path_1.default.join(pdfDir, pdfFilename);
        const dataColetaFormatada = (coleta.data_retirada || '').split('-').reverse().join('/');
        await (0, pdfGenerator_1.gerarComprovantePDF)({
            numero: coleta.numero,
            comprovante_numero: numComprovante,
            data_retirada: coleta.data_retirada,
            data_retirada_formatada: dataColetaFormatada,
            hora_retirada: coleta.hora_retirada,
            transportadora_nome: coleta.transportadora_nome,
            motorista_nome: coleta.motorista_nome || '',
            motorista_documento: coleta.motorista_documento || '',
            placa_veiculo: coleta.placa_veiculo || '',
            funcionario_liberacao: coleta.funcionario_liberacao,
            observacoes: coleta.observacoes
        }, itens, pdfFilePath);
        const user = req.session.user;
        const compExistente = await db_helper_1.default.get('SELECT id FROM comprovantes WHERE coleta_id = ?', [coletaId]);
        if (compExistente) {
            await db_helper_1.default.run("UPDATE comprovantes SET arquivo_pdf = ?, atualizado_em = datetime('now','localtime') WHERE id = ?", [`/coletas/${coletaId}/pdf`, compExistente.id]);
        }
        else {
            await db_helper_1.default.run(`
        INSERT INTO comprovantes (numero, coleta_id, status, arquivo_pdf, data_emissao, usuario_id)
        VALUES (?, ?, 'emitido', ?, date('now','localtime'), ?)
      `, [numComprovante, coletaId, `/coletas/${coletaId}/pdf`, user?.id]);
        }
        res.redirect(`/coletas/${coletaId}?sucesso=` + encodeURIComponent('Comprovante PDF gerado com sucesso com a logo oficial!'));
    }
    catch (err) {
        console.error('[ERRO REGENERAR PDF]', err);
        res.redirect(`/coletas/${req.params.id}?erro=${encodeURIComponent('Erro ao gerar PDF: ' + err.message)}`);
    }
});
// Download ou Abertura Direta do PDF Gerado
router.get('/:id/pdf', auth_1.requireAuth, async (req, res) => {
    try {
        const coletaId = parseInt(String(req.params.id), 10);
        const coleta = await db_helper_1.default.get('SELECT * FROM coletas WHERE id = ?', [coletaId]);
        if (!coleta) {
            return res.status(404).send('Coleta não encontrada.');
        }
        const numComprovante = `COMP-${coleta.numero}`;
        const pdfFilename = `${numComprovante}.pdf`;
        const pdfFilePath = node_path_1.default.join(pdfDir, pdfFilename);
        if (!node_fs_1.default.existsSync(pdfFilePath)) {
            const itens = await db_helper_1.default.all(`
        SELECT ic.*, e.numero_nf, e.cliente_nome
        FROM itens_coleta ic
        JOIN expedicoes e ON ic.expedicao_id = e.id
        WHERE ic.coleta_id = ?
      `, [coletaId]);
            const dataColetaFormatada = (coleta.data_retirada || '').split('-').reverse().join('/');
            await (0, pdfGenerator_1.gerarComprovantePDF)({
                numero: coleta.numero,
                comprovante_numero: numComprovante,
                data_retirada: coleta.data_retirada,
                data_retirada_formatada: dataColetaFormatada,
                hora_retirada: coleta.hora_retirada,
                transportadora_nome: coleta.transportadora_nome,
                motorista_nome: coleta.motorista_nome || '',
                motorista_documento: coleta.motorista_documento || '',
                placa_veiculo: coleta.placa_veiculo || '',
                funcionario_liberacao: coleta.funcionario_liberacao,
                observacoes: coleta.observacoes
            }, itens, pdfFilePath);
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Comprovante-${coleta.numero}.pdf"`);
        node_fs_1.default.createReadStream(pdfFilePath).pipe(res);
    }
    catch (err) {
        console.error('[ERRO GERAR PDF ON THE FLY]', err);
        res.status(500).send('Erro ao gerar documento PDF: ' + err.message);
    }
});
// Atualizar Status do Comprovante
router.post('/:id/comprovante/status', auth_1.requireAuth, (0, auth_1.requireRole)('administrador', 'operacional'), upload.single('arquivo_assinado'), async (req, res) => {
    try {
        const coletaId = parseInt(String(req.params.id), 10);
        const { status, observacoes, confirmacao_fisica } = req.body;
        const user = req.session.user;
        const comp = await db_helper_1.default.get('SELECT * FROM comprovantes WHERE coleta_id = ?', [coletaId]);
        if (!comp)
            return res.redirect(`/coletas/${coletaId}`);
        let arquivoAssinadoPath = comp.arquivo_assinado;
        if (req.file) {
            arquivoAssinadoPath = `/uploads/${req.file.filename}`;
        }
        const updates = ['status = ?', "atualizado_em = datetime('now','localtime')"];
        const params = [status];
        if (arquivoAssinadoPath) {
            updates.push('arquivo_assinado = ?');
            params.push(arquivoAssinadoPath);
        }
        if (status === 'assinado' || status === 'arquivado') {
            updates.push("data_assinatura = COALESCE(data_assinatura, date('now','localtime'))");
            updates.push('responsavel_arquivo = ?');
            params.push(user?.nome);
        }
        if (observacoes) {
            updates.push('observacoes = ?');
            params.push(observacoes);
        }
        await db_helper_1.default.run(`UPDATE comprovantes SET ${updates.join(', ')} WHERE id = ?`, [...params, comp.id]);
        await db_helper_1.default.historico('comprovantes', Number(comp.id), 'status', 'status', comp.status, status, observacoes || (confirmacao_fisica ? 'Confirmação física de arquivamento' : 'Atualização de status do documento'), user?.id, user?.nome);
        res.redirect(`/coletas/${coletaId}?sucesso=` + encodeURIComponent(`Status do comprovante atualizado para "${status.toUpperCase()}"!`));
    }
    catch (err) {
        console.error('[STATUS COMPROVANTE ERRO]', err);
        res.redirect(`/coletas/${req.params.id}?erro=${encodeURIComponent(err.message)}`);
    }
});
// EXCLUIR COLETA (somente administrador)
router.post('/:id/excluir', auth_1.requireAuth, (0, auth_1.requireRole)('administrador'), async (req, res) => {
    try {
        const coletaId = parseInt(String(req.params.id), 10);
        const coleta = await db_helper_1.default.get('SELECT * FROM coletas WHERE id = ?', [coletaId]);
        if (!coleta)
            return res.redirect('/coletas?erro=' + encodeURIComponent('Coleta não encontrada.'));
        const user = req.session.user;
        const motivo = req.body.motivo_exclusao ? req.body.motivo_exclusao.trim() : 'Exclusão pelo administrador';
        // Reverter status das expedições para "Pronta para coleta"
        const statusPronta = await db_helper_1.default.get("SELECT id FROM status_expedicao WHERE nome = 'Pronta para coleta'");
        if (statusPronta) {
            const idsExp = await db_helper_1.default.all('SELECT expedicao_id FROM itens_coleta WHERE coleta_id = ?', [coletaId]);
            for (const item of idsExp) {
                await db_helper_1.default.run("UPDATE expedicoes SET status_id = ?, atualizado_em = datetime('now','localtime') WHERE id = ?", [statusPronta.id, item.expedicao_id]);
            }
        }
        await db_helper_1.default.historico('coletas', coletaId, 'exclusao', null, coleta.numero, 'EXCLUÍDO', motivo, user?.id, user?.nome);
        const pdfPath = node_path_1.default.join(pdfDir, `COMP-${coleta.numero}.pdf`);
        if (node_fs_1.default.existsSync(pdfPath)) {
            try {
                node_fs_1.default.unlinkSync(pdfPath);
            }
            catch (e) { }
        }
        await db_helper_1.default.run('DELETE FROM coletas WHERE id = ?', [coletaId]);
        res.redirect('/coletas?sucesso=' + encodeURIComponent(`Coleta ${coleta.numero} excluída. As expedições foram revertidas para "Pronta para coleta".`));
    }
    catch (err) {
        console.error('[ERRO EXCLUIR COLETA]', err);
        res.redirect(`/coletas/${req.params.id}?erro=${encodeURIComponent('Erro ao excluir coleta: ' + err.message)}`);
    }
});
exports.default = router;
