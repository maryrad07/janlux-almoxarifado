const express = require('express');
const router = express.Router();
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const db = require('../utils/db-helper');
const { requireAuth, requireRole } = require('../middleware/auth');
const { gerarComprovantePDF } = require('../utils/pdfGenerator');

const isVercel = !!process.env.VERCEL;
const pdfDir = isVercel ? '/tmp/pdfs' : path.join(__dirname, '..', '..', 'pdfs');
const uploadDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(pdfDir)) {
  try { fs.mkdirSync(pdfDir, { recursive: true }); } catch (e) {}
}
if (!fs.existsSync(uploadDir)) {
  try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `comprovante-assinado-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Listar Coletas
router.get('/', requireAuth, async (req, res) => {
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
      const b = `%${busca.trim()}%`;
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
      params.push(parseInt(transportadora_id, 10));
    }

    if (status_comprovante) {
      query += ` AND comp.status = ?`;
      params.push(status_comprovante);
    }

    query += ` ORDER BY c.id DESC LIMIT 150`;

    const coletas = await db.all(query, params);
    const transportadoras = await db.all('SELECT id, nome FROM transportadoras WHERE ativo = 1 ORDER BY nome');

    res.render('coletas/index', {
      title: 'Coletas e Retirada de Mercadorias',
      coletas,
      transportadoras,
      filtros: req.query,
      msg: req.query.sucesso || null,
      err: req.query.erro || null
    });
  } catch (err) {
    console.error('[COLETAS LIST]', err);
    res.status(500).render('error', { title: 'Erro', mensagem: err.message });
  }
});

// Formulário de Nova Coleta
router.get('/nova', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const expedicoesDisponiveis = await db.all(`
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

    const transportadoras = await db.all('SELECT id, nome FROM transportadoras WHERE ativo = 1 ORDER BY nome');
    const motoristas = await db.all('SELECT m.*, t.nome as transportadora_nome FROM motoristas m LEFT JOIN transportadoras t ON m.transportadora_id = t.id WHERE m.ativo = 1 ORDER BY m.nome');

    const anoAtual = new Date().getFullYear();
    const ultimaColeta = await db.get('SELECT id FROM coletas ORDER BY id DESC LIMIT 1');
    const proxSeq = (ultimaColeta ? parseInt(ultimaColeta.id) + 1 : 1);
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
      funcionarioPadrao: req.session.user.nome,
      err: req.query.erro || null
    });
  } catch (err) {
    console.error('[COLETAS FORM]', err);
    res.status(500).render('error', { title: 'Erro', mensagem: err.message });
  }
});

// Salvar Nova Coleta e Gerar PDF Automático
router.post('/salvar', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const {
      numero,
      data_retirada,
      hora_retirada,
      transportadora_id,
      transportadora_nome_novo,
      motorista_nome,
      motorista_documento,
      placa_veiculo,
      funcionario_liberacao,
      observacoes,
      expedicoes_selecionadas
    } = req.body;

    if (!numero || !data_retirada || !hora_retirada) {
      return res.redirect('/coletas/nova?erro=Campos obrigatórios da coleta não foram preenchidos.');
    }

    if (!motorista_nome || !motorista_nome.trim()) {
      return res.redirect('/coletas/nova?erro=O nome do motorista ou responsável é obrigatório.');
    }

    if (!motorista_documento || !motorista_documento.trim()) {
      return res.redirect('/coletas/nova?erro=O Documento de Identificação (RG / CPF) do motorista é obrigatório.');
    }

    const expIds = Array.isArray(expedicoes_selecionadas)
      ? expedicoes_selecionadas.map(id => parseInt(id, 10))
      : (expedicoes_selecionadas ? [parseInt(expedicoes_selecionadas, 10)] : []);

    if (expIds.length === 0) {
      return res.redirect('/coletas/nova?erro=Selecione pelo menos uma Nota Fiscal para a coleta.');
    }

    // Verificar se alguma NF já foi associada
    const placeholders = expIds.map(() => '?').join(',');
    const jaAssociada = await db.all(`
      SELECT e.numero_nf 
      FROM itens_coleta ic
      JOIN expedicoes e ON ic.expedicao_id = e.id
      WHERE ic.expedicao_id IN (${placeholders})
    `, expIds);

    if (jaAssociada.length > 0) {
      const nfs = jaAssociada.map(a => a.numero_nf).join(', ');
      return res.redirect(`/coletas/nova?erro=A(s) Nota(s) Fiscal(is) ${nfs} já faz(em) parte de outra coleta.`);
    }

    let finalTranspId = transportadora_id ? parseInt(transportadora_id, 10) : null;
    let finalTranspNome = '';

    if (finalTranspId) {
      const t = await db.get('SELECT nome FROM transportadoras WHERE id = ?', [finalTranspId]);
      finalTranspNome = t ? t.nome : '';
    } else if (transportadora_nome_novo && transportadora_nome_novo.trim()) {
      const infoT = await db.run('INSERT INTO transportadoras (nome, ativo) VALUES (?, 1)', [transportadora_nome_novo.trim()]);
      finalTranspId = infoT.id;
      finalTranspNome = transportadora_nome_novo.trim();
    }

    // Inserir Coleta
    const infoColeta = await db.run(`
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
      funcionario_liberacao || req.session.user.nome,
      req.session.user.id,
      observacoes || null
    ]);

    const coletaId = infoColeta.id;

    // Status "Coletada/Expedida"
    const statusColetada = await db.get("SELECT id FROM status_expedicao WHERE nome = 'Coletada/Expedida'");

    const itensParaPDF = [];

    for (const expId of expIds) {
      const volRow = await db.get('SELECT COUNT(*) as count FROM volumes_expedicao WHERE expedicao_id = ?', [expId]);
      const countVols = volRow ? parseInt(volRow.count) : 0;
      const qtdVols = countVols > 0 ? countVols : 1;

      await db.run('INSERT INTO itens_coleta (coleta_id, expedicao_id, quantidade_volumes) VALUES (?, ?, ?)', [coletaId, expId, qtdVols]);

      if (statusColetada) {
        await db.run("UPDATE expedicoes SET status_id = ?, atualizado_em = datetime('now','localtime') WHERE id = ?", [statusColetada.id, expId]);
      }

      const expData = await db.get('SELECT numero_nf, cliente_nome FROM expedicoes WHERE id = ?', [expId]);
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
    const pdfFilePath = path.join(pdfDir, pdfFilename);
    const dataColetaFormatada = data_retirada.split('-').reverse().join('/');

    try {
      await gerarComprovantePDF(
        {
          numero: numero.trim().toUpperCase(),
          comprovante_numero: numComprovante,
          data_retirada,
          data_retirada_formatada: dataColetaFormatada,
          hora_retirada,
          transportadora_nome: finalTranspNome,
          motorista_nome: motorista_nome || '',
          motorista_documento: motorista_documento || '',
          placa_veiculo: placa_veiculo || '',
          funcionario_liberacao: funcionario_liberacao || req.session.user.nome,
          observacoes
        },
        itensParaPDF,
        pdfFilePath
      );
    } catch (pdfErr) {
      console.warn('[PDF GENERATE WARNING]', pdfErr.message);
    }

    // Inserir Comprovante no banco
    await db.run(`
      INSERT INTO comprovantes (
        numero, coleta_id, status, arquivo_pdf, data_emissao, usuario_id
      ) VALUES (?, ?, 'emitido', ?, date('now','localtime'), ?)
    `, [
      numComprovante,
      coletaId,
      `/coletas/${coletaId}/pdf`,
      req.session.user.id
    ]);

    await db.historico(
      'coletas',
      coletaId,
      'criacao',
      null,
      null,
      numero.trim().toUpperCase(),
      `Registro da coleta com ${expIds.length} NF(s) e geração do comprovante em PDF com logo`,
      req.session.user.id,
      req.session.user.nome
    );

    res.redirect(`/coletas/${coletaId}?sucesso=Coleta registrada com sucesso! Comprovante em PDF gerado automaticamente.`);
  } catch (err) {
    console.error('[ERRO SALVAR COLETA]', err);
    res.redirect(`/coletas/nova?erro=${encodeURIComponent('Erro ao registrar coleta: ' + err.message)}`);
  }
});

// Detalhes da Coleta
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const coletaId = parseInt(req.params.id, 10);

    const coleta = await db.get(`
      SELECT c.*, t.nome as transportadora_cadastrada
      FROM coletas c
      LEFT JOIN transportadoras t ON c.transportadora_id = t.id
      WHERE c.id = ?
    `, [coletaId]);

    if (!coleta) {
      return res.status(404).render('error', { title: 'Não Encontrado', mensagem: 'Coleta não encontrada.' });
    }

    const itens = await db.all(`
      SELECT ic.*, e.numero_nf, e.cliente_nome, e.data_emissao,
             (SELECT COUNT(*) FROM volumes_expedicao WHERE expedicao_id = e.id) as volumes_fisicos
      FROM itens_coleta ic
      JOIN expedicoes e ON ic.expedicao_id = e.id
      WHERE ic.coleta_id = ?
    `, [coletaId]);

    const totalVolumes = itens.reduce((acc, curr) => acc + (parseInt(curr.quantidade_volumes) || 1), 0);
    const comprovante = await db.get('SELECT * FROM comprovantes WHERE coleta_id = ?', [coletaId]);
    const historico = await db.all("SELECT * FROM historico WHERE tabela = 'coletas' AND registro_id = ? ORDER BY id DESC", [coletaId]);

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
  } catch (err) {
    console.error('[COLETAS DETALHES]', err);
    res.status(500).render('error', { title: 'Erro', mensagem: err.message });
  }
});

// Regenerar PDF da Coleta Sob Demanda
router.post('/:id/regenerar-pdf', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const coletaId = parseInt(req.params.id, 10);
    const coleta = await db.get('SELECT * FROM coletas WHERE id = ?', [coletaId]);
    if (!coleta) return res.redirect('/coletas');

    const itens = await db.all(`
      SELECT ic.*, e.numero_nf, e.cliente_nome
      FROM itens_coleta ic
      JOIN expedicoes e ON ic.expedicao_id = e.id
      WHERE ic.coleta_id = ?
    `, [coletaId]);

    const numComprovante = `COMP-${coleta.numero}`;
    const pdfFilename = `${numComprovante}.pdf`;
    const pdfFilePath = path.join(pdfDir, pdfFilename);
    const dataColetaFormatada = (coleta.data_retirada || '').split('-').reverse().join('/');

    await gerarComprovantePDF(
      {
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
      },
      itens,
      pdfFilePath
    );

    const compExistente = await db.get('SELECT id FROM comprovantes WHERE coleta_id = ?', [coletaId]);
    if (compExistente) {
      await db.run("UPDATE comprovantes SET arquivo_pdf = ?, atualizado_em = datetime('now','localtime') WHERE id = ?",
        [`/coletas/${coletaId}/pdf`, compExistente.id]);
    } else {
      await db.run(`
        INSERT INTO comprovantes (numero, coleta_id, status, arquivo_pdf, data_emissao, usuario_id)
        VALUES (?, ?, 'emitido', ?, date('now','localtime'), ?)
      `, [numComprovante, coletaId, `/coletas/${coletaId}/pdf`, req.session.user.id]);
    }

    res.redirect(`/coletas/${coletaId}?sucesso=Comprovante PDF gerado com sucesso com a logo oficial!`);
  } catch (err) {
    console.error('[ERRO REGENERAR PDF]', err);
    res.redirect(`/coletas/${req.params.id}?erro=${encodeURIComponent('Erro ao gerar PDF: ' + err.message)}`);
  }
});

// Download ou Abertura Direta do PDF Gerado
router.get('/:id/pdf', requireAuth, async (req, res) => {
  try {
    const coletaId = parseInt(req.params.id, 10);
    const coleta = await db.get('SELECT * FROM coletas WHERE id = ?', [coletaId]);

    if (!coleta) {
      return res.status(404).send('Coleta não encontrada.');
    }

    const numComprovante = `COMP-${coleta.numero}`;
    const pdfFilename = `${numComprovante}.pdf`;
    const pdfFilePath = path.join(pdfDir, pdfFilename);

    if (!fs.existsSync(pdfFilePath)) {
      const itens = await db.all(`
        SELECT ic.*, e.numero_nf, e.cliente_nome
        FROM itens_coleta ic
        JOIN expedicoes e ON ic.expedicao_id = e.id
        WHERE ic.coleta_id = ?
      `, [coletaId]);

      const dataColetaFormatada = (coleta.data_retirada || '').split('-').reverse().join('/');
      await gerarComprovantePDF(
        {
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
        },
        itens,
        pdfFilePath
      );
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Comprovante-${coleta.numero}.pdf"`);
    fs.createReadStream(pdfFilePath).pipe(res);
  } catch (err) {
    console.error('[ERRO GERAR PDF ON THE FLY]', err);
    res.status(500).send('Erro ao gerar documento PDF: ' + err.message);
  }
});

// Atualizar Status do Comprovante
router.post('/:id/comprovante/status', requireAuth, requireRole('administrador', 'operacional'), upload.single('arquivo_assinado'), async (req, res) => {
  try {
    const coletaId = parseInt(req.params.id, 10);
    const { status, observacoes, confirmacao_fisica } = req.body;

    const comp = await db.get('SELECT * FROM comprovantes WHERE coleta_id = ?', [coletaId]);
    if (!comp) return res.redirect(`/coletas/${coletaId}`);

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
      params.push(req.session.user.nome);
    }

    if (observacoes) {
      updates.push('observacoes = ?');
      params.push(observacoes);
    }

    await db.run(`UPDATE comprovantes SET ${updates.join(', ')} WHERE id = ?`, [...params, comp.id]);

    await db.historico(
      'comprovantes',
      comp.id,
      'status',
      'status',
      comp.status,
      status,
      observacoes || (confirmacao_fisica ? 'Confirmação física de arquivamento' : 'Atualização de status do documento'),
      req.session.user.id,
      req.session.user.nome
    );

    res.redirect(`/coletas/${coletaId}?sucesso=Status do comprovante atualizado para "${status.toUpperCase()}"!`);
  } catch (err) {
    console.error('[STATUS COMPROVANTE ERRO]', err);
    res.redirect(`/coletas/${req.params.id}?erro=${encodeURIComponent(err.message)}`);
  }
});

// EXCLUIR COLETA (somente administrador)
router.post('/:id/excluir', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    const coletaId = parseInt(req.params.id, 10);
    const coleta = await db.get('SELECT * FROM coletas WHERE id = ?', [coletaId]);
    if (!coleta) return res.redirect('/coletas?erro=Coleta não encontrada.');

    const motivo = req.body.motivo_exclusao ? req.body.motivo_exclusao.trim() : 'Exclusão pelo administrador';

    // Reverter status das expedições para "Pronta para coleta"
    const statusPronta = await db.get("SELECT id FROM status_expedicao WHERE nome = 'Pronta para coleta'");
    if (statusPronta) {
      const idsExp = await db.all('SELECT expedicao_id FROM itens_coleta WHERE coleta_id = ?', [coletaId]);
      for (const item of idsExp) {
        await db.run("UPDATE expedicoes SET status_id = ?, atualizado_em = datetime('now','localtime') WHERE id = ?",
          [statusPronta.id, item.expedicao_id]);
      }
    }

    await db.historico(
      'coletas', coletaId, 'exclusao', null,
      coleta.numero,
      'EXCLUÍDO',
      motivo,
      req.session.user.id,
      req.session.user.nome
    );

    const pdfPath = path.join(pdfDir, `COMP-${coleta.numero}.pdf`);
    if (fs.existsSync(pdfPath)) {
      try { fs.unlinkSync(pdfPath); } catch (e) {}
    }

    await db.run('DELETE FROM coletas WHERE id = ?', [coletaId]);

    res.redirect('/coletas?sucesso=' + encodeURIComponent(`Coleta ${coleta.numero} excluída. As expedições foram revertidas para "Pronta para coleta".`));
  } catch (err) {
    console.error('[ERRO EXCLUIR COLETA]', err);
    res.redirect(`/coletas?erro=${encodeURIComponent('Erro ao excluir coleta: ' + err.message)}`);
  }
});

module.exports = router;
