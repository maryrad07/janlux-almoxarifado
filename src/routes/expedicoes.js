const express = require('express');
const router = express.Router();
const db = require('../utils/db-helper');
const { requireAuth, requireRole } = require('../middleware/auth');

// Listar Expedições com filtros e paginação
router.get('/', requireAuth, async (req, res) => {
  try {
    const { busca, status_id, transportadora_id, data_inicio, data_fim, conferencia } = req.query;

    let query = `
      SELECT e.*, 
             c.codigo as cliente_codigo,
             c.razao_social as cliente_nome_cadastrado, 
             t.nome as transportadora_nome, 
             s.nome as status_nome, 
             s.cor as status_cor,
             (SELECT COUNT(*) FROM volumes_expedicao WHERE expedicao_id = e.id) as total_volumes_fisicos,
             (SELECT SUM(quantidade) FROM itens_expedicao WHERE expedicao_id = e.id) as total_produtos
      FROM expedicoes e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      LEFT JOIN transportadoras t ON e.transportadora_id = t.id
      LEFT JOIN status_expedicao s ON e.status_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (busca) {
      query += ` AND (e.numero_nf LIKE ? OR e.cliente_nome LIKE ? OR c.razao_social LIKE ? OR c.codigo LIKE ? OR e.responsavel_preparacao LIKE ?)`;
      const b = `%${busca.trim()}%`;
      params.push(b, b, b, b, b);
    }

    if (status_id) {
      query += ` AND e.status_id = ?`;
      params.push(parseInt(status_id, 10));
    }

    if (transportadora_id) {
      query += ` AND e.transportadora_id = ?`;
      params.push(parseInt(transportadora_id, 10));
    }

    if (data_inicio) {
      query += ` AND (e.data_emissao >= ? OR e.data_disponibilizacao >= ?)`;
      params.push(data_inicio, data_inicio);
    }

    if (data_fim) {
      query += ` AND (e.data_emissao <= ? OR e.data_disponibilizacao <= ?)`;
      params.push(data_fim, data_fim);
    }

    if (conferencia !== undefined && conferencia !== '') {
      query += ` AND e.conferencia_realizada = ?`;
      params.push(parseInt(conferencia, 10));
    }

    query += ` ORDER BY e.id DESC LIMIT 200`;

    const expedicoes = await db.all(query, params);
    const statusList = await db.all('SELECT * FROM status_expedicao WHERE ativo = 1 ORDER BY ordem');
    const transportadoras = await db.all('SELECT * FROM transportadoras WHERE ativo = 1 ORDER BY nome');

    res.render('expedicoes/index', {
      title: 'Preparação e Expedição de Pedidos',
      expedicoes,
      statusList,
      transportadoras,
      filtros: req.query
    });
  } catch (err) {
    console.error('[EXPEDICOES LIST]', err);
    res.status(500).render('error', { title: 'Erro', mensagem: err.message });
  }
});

// Formulário de Nova Expedição
router.get('/nova', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const emitentes = await db.all('SELECT id, codigo, razao_social, nome_fantasia, cnpj, padrao FROM emitentes WHERE ativo = 1 ORDER BY padrao DESC, razao_social ASC');
    const clientes = await db.all('SELECT id, codigo, razao_social, cnpj FROM clientes WHERE ativo = 1 ORDER BY razao_social');
    const produtos = await db.all('SELECT id, codigo, descricao FROM produtos WHERE ativo = 1 ORDER BY codigo');
    const transportadoras = await db.all('SELECT id, nome FROM transportadoras WHERE ativo = 1 ORDER BY nome');
    const embalagens = await db.all('SELECT id, codigo, descricao, comprimento_cm, largura_cm, altura_cm, peso_g FROM embalagens WHERE ativo = 1 ORDER BY descricao');
    const statusList = await db.all('SELECT * FROM status_expedicao WHERE ativo = 1 ORDER BY ordem');

    res.render('expedicoes/form', {
      title: 'Nova Expedição de Mercadoria',
      expedicao: null,
      emitentes,
      clientes,
      produtos,
      transportadoras,
      embalagens,
      statusList
    });
  } catch (err) {
    console.error('[EXPEDICOES NOVA]', err);
    res.status(500).render('error', { title: 'Erro', mensagem: err.message });
  }
});

// Salvar Nova Expedição
router.post('/salvar', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const {
      numero_nf,
      emitente_id,
      emitente_nome,
      cnpj_emitente,
      data_emissao,
      cliente_codigo,
      cliente_id,
      cliente_nome_novo,
      cnpj_destinatario,
      transportadora_id,
      status_id,
      data_disponibilizacao,
      hora_disponibilizacao,
      data_inicio_preparacao,
      hora_inicio_preparacao,
      data_pronta,
      hora_pronta,
      responsavel_preparacao,
      observacoes,
      anotacoes,
      // Produtos arrays
      prod_codigo,
      prod_descricao,
      prod_quantidade,
      // Volumes arrays
      vol_embalagem_id,
      vol_comprimento,
      vol_largura,
      vol_altura,
      vol_peso,
      vol_observacoes
    } = req.body;

    let finalEmitenteId = emitente_id ? parseInt(emitente_id, 10) : null;
    let finalEmitenteNome = emitente_nome ? emitente_nome.trim() : 'JANLUX ELÉTRICOS LTDA.';
    let finalCnpjEmitente = cnpj_emitente ? cnpj_emitente.trim() : '00.000.000/0001-00';

    if (finalEmitenteId) {
      const emi = await db.get('SELECT razao_social, cnpj FROM emitentes WHERE id = ?', [finalEmitenteId]);
      if (emi) {
        finalEmitenteNome = emi.razao_social;
        if (!cnpj_emitente || !cnpj_emitente.trim()) {
          finalCnpjEmitente = emi.cnpj;
        }
      }
    }

    let finalClienteId = cliente_id ? parseInt(cliente_id, 10) : null;
    let finalClienteNome = '';

    // Se informou código de cliente e não selecionou ID diretamente
    if (!finalClienteId && cliente_codigo && cliente_codigo.trim()) {
      const cByCod = await db.get('SELECT id, razao_social, cnpj FROM clientes WHERE LOWER(codigo) = LOWER(?)', [cliente_codigo.trim()]);
      if (cByCod) {
        finalClienteId = cByCod.id;
        finalClienteNome = cByCod.razao_social;
      }
    }

    if (finalClienteId) {
      const c = await db.get('SELECT razao_social, cnpj FROM clientes WHERE id = ?', [finalClienteId]);
      finalClienteNome = c ? c.razao_social : '';
    } else if (cliente_nome_novo && cliente_nome_novo.trim()) {
      const ultimoCliente = await db.get('SELECT id FROM clientes ORDER BY id DESC LIMIT 1');
      const proximoId = (ultimoCliente ? parseInt(ultimoCliente.id) + 1 : 1);
      const novoCodigo = cliente_codigo && cliente_codigo.trim() ? cliente_codigo.trim().toUpperCase() : `CLI-${String(proximoId).padStart(4, '0')}`;
      const infoC = await db.run('INSERT INTO clientes (codigo, razao_social, cnpj, ativo) VALUES (?, ?, ?, 1)',
        [novoCodigo, cliente_nome_novo.trim(), cnpj_destinatario || null]);
      finalClienteId = infoC.id;
      finalClienteNome = cliente_nome_novo.trim();
    }

    const insertSql = `
      INSERT INTO expedicoes (
        numero_nf, serie_nf, emitente_id, emitente_nome, cnpj_emitente, data_emissao, cliente_id, cliente_nome, cnpj_destinatario,
        transportadora_id, status_id, data_disponibilizacao, hora_disponibilizacao,
        data_inicio_preparacao, hora_inicio_preparacao, data_pronta, hora_pronta,
        responsavel_preparacao, observacoes, anotacoes, usuario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const infoExp = await db.run(insertSql, [
      numero_nf ? numero_nf.trim() : 'S/N',
      '1',
      finalEmitenteId,
      finalEmitenteNome,
      finalCnpjEmitente,
      data_emissao || new Date().toISOString().slice(0, 10),
      finalClienteId,
      finalClienteNome,
      cnpj_destinatario ? cnpj_destinatario.trim() : null,
      transportadora_id ? parseInt(transportadora_id, 10) : null,
      status_id ? parseInt(status_id, 10) : 1,
      data_disponibilizacao || new Date().toISOString().slice(0, 10),
      hora_disponibilizacao || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      data_inicio_preparacao || null,
      hora_inicio_preparacao || null,
      data_pronta || null,
      hora_pronta || null,
      responsavel_preparacao || req.session.user.nome,
      observacoes || null,
      anotacoes || null,
      req.session.user.id
    ]);

    const expId = infoExp.id;

    // Inserir Itens
    if (prod_codigo) {
      const cods = Array.isArray(prod_codigo) ? prod_codigo : [prod_codigo];
      const descs = Array.isArray(prod_descricao) ? prod_descricao : [prod_descricao];
      const qtds = Array.isArray(prod_quantidade) ? prod_quantidade : [prod_quantidade];

      for (let i = 0; i < cods.length; i++) {
        if (cods[i] && cods[i].trim()) {
          const prod = await db.get('SELECT id, descricao FROM produtos WHERE codigo = ?', [cods[i].trim()]);
          await db.run(
            'INSERT INTO itens_expedicao (expedicao_id, produto_id, produto_codigo, produto_descricao, quantidade) VALUES (?, ?, ?, ?, ?)',
            [
              expId,
              prod ? prod.id : null,
              cods[i].trim(),
              descs[i] || (prod ? prod.descricao : cods[i].trim()),
              parseInt(qtds[i], 10) || 1
            ]
          );
        }
      }
    }

    // Inserir Volumes
    if (vol_embalagem_id) {
      const embIds = Array.isArray(vol_embalagem_id) ? vol_embalagem_id : [vol_embalagem_id];
      const comps = Array.isArray(vol_comprimento) ? vol_comprimento : [vol_comprimento];
      const largs = Array.isArray(vol_largura) ? vol_largura : [vol_largura];
      const alts = Array.isArray(vol_altura) ? vol_altura : [vol_altura];
      const pesos = Array.isArray(vol_peso) ? vol_peso : [vol_peso];
      const obss = Array.isArray(vol_observacoes) ? vol_observacoes : [vol_observacoes];

      for (let i = 0; i < embIds.length; i++) {
        const embId = parseInt(embIds[i], 10) || null;
        let tipoEmb = 'Papelão';
        if (embId) {
          const emb = await db.get('SELECT descricao FROM embalagens WHERE id = ?', [embId]);
          if (emb) tipoEmb = emb.descricao;
        }
        await db.run(
          'INSERT INTO volumes_expedicao (expedicao_id, numero_volume, embalagem_id, tipo_embalagem, comprimento_cm, largura_cm, altura_cm, peso_g, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            expId,
            i + 1,
            embId,
            tipoEmb,
            parseFloat(comps[i]) || 0,
            parseFloat(largs[i]) || 0,
            parseFloat(alts[i]) || 0,
            parseFloat(pesos[i]) || 0,
            obss[i] || null
          ]
        );
      }
    } else {
      await db.run(
        'INSERT INTO volumes_expedicao (expedicao_id, numero_volume, embalagem_id, tipo_embalagem, comprimento_cm, largura_cm, altura_cm, peso_g, observacoes) VALUES (?, 1, null, \'Papelão\', 0, 0, 0, 0, null)',
        [expId]
      );
    }

    await db.historico(
      'expedicoes',
      expId,
      'criacao',
      null,
      null,
      `NF ${numero_nf}`,
      'Cadastro de nova expedição',
      req.session.user.id,
      req.session.user.nome
    );

    res.redirect(`/expedicoes/${expId}?sucesso=Expedição criada com sucesso!`);
  } catch (err) {
    console.error('[ERRO SALVAR EXPEDICAO]', err);
    res.redirect('/expedicoes?erro=' + encodeURIComponent('Erro ao salvar expedição: ' + err.message));
  }
});

// Detalhes da Expedição
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const expId = parseInt(req.params.id, 10);

    const expedicao = await db.get(`
      SELECT e.*, c.codigo as cliente_codigo, c.razao_social as cliente_nome_cadastrado, c.cnpj as cliente_cnpj,
             t.nome as transportadora_nome, s.nome as status_nome, s.cor as status_cor
      FROM expedicoes e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      LEFT JOIN transportadoras t ON e.transportadora_id = t.id
      LEFT JOIN status_expedicao s ON e.status_id = s.id
      WHERE e.id = ?
    `, [expId]);

    if (!expedicao) {
      return res.status(404).render('error', { title: 'Não Encontrado', mensagem: 'Expedição não encontrada.' });
    }

    const itens = await db.all('SELECT * FROM itens_expedicao WHERE expedicao_id = ?', [expId]);
    const volumes = await db.all('SELECT * FROM volumes_expedicao WHERE expedicao_id = ? ORDER BY numero_volume', [expId]);
    const statusList = await db.all('SELECT * FROM status_expedicao WHERE ativo = 1 ORDER BY ordem');
    const ocorrencias = await db.all('SELECT * FROM ocorrencias WHERE expedicao_id = ?', [expId]);
    const historico = await db.all('SELECT * FROM historico WHERE tabela = ? AND registro_id = ? ORDER BY id DESC', ['expedicoes', expId]);

    // Verificar se já está em alguma coleta
    const coletaVinculada = await db.get(`
      SELECT c.*, ic.quantidade_volumes
      FROM itens_coleta ic
      JOIN coletas c ON ic.coleta_id = c.id
      WHERE ic.expedicao_id = ?
    `, [expId]);

    res.render('expedicoes/detalhes', {
      title: `Expedição NF ${expedicao.numero_nf}`,
      expedicao,
      itens,
      volumes,
      statusList,
      ocorrencias,
      historico,
      coletaVinculada,
      msg: req.query.sucesso || null,
      err: req.query.erro || null
    });
  } catch (err) {
    console.error('[EXPEDICAO DETALHES]', err);
    res.status(500).render('error', { title: 'Erro', mensagem: err.message });
  }
});

// Alterar Status da Expedição
router.post('/:id/status', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const expId = parseInt(req.params.id, 10);
    const { status_id, motivo } = req.body;

    const expAtual = await db.get('SELECT status_id FROM expedicoes WHERE id = ?', [expId]);
    if (!expAtual) return res.redirect('/expedicoes');

    const novoStatus = await db.get('SELECT nome FROM status_expedicao WHERE id = ?', [parseInt(status_id, 10)]);
    const statusAntigo = await db.get('SELECT nome FROM status_expedicao WHERE id = ?', [expAtual.status_id]);

    const updates = ['status_id = ?', "atualizado_em = datetime('now','localtime')"];
    const updateParams = [parseInt(status_id, 10)];

    if (novoStatus && novoStatus.nome === 'Pronta para coleta') {
      updates.push("data_pronta = COALESCE(data_pronta, date('now','localtime'))");
      updates.push("hora_pronta = COALESCE(hora_pronta, time('now','localtime'))");
    }

    if (novoStatus && novoStatus.nome === 'Em preparação') {
      updates.push("data_inicio_preparacao = COALESCE(data_inicio_preparacao, date('now','localtime'))");
      updates.push("hora_inicio_preparacao = COALESCE(hora_inicio_preparacao, time('now','localtime'))");
    }

    await db.run(`UPDATE expedicoes SET ${updates.join(', ')} WHERE id = ?`, [...updateParams, expId]);

    await db.historico(
      'expedicoes',
      expId,
      'status',
      'status_id',
      statusAntigo ? statusAntigo.nome : String(expAtual.status_id),
      novoStatus ? novoStatus.nome : String(status_id),
      motivo || 'Mudança de status operacional',
      req.session.user.id,
      req.session.user.nome
    );

    res.redirect(`/expedicoes/${expId}?sucesso=Status atualizado para "${novoStatus?.nome}"!`);
  } catch (err) {
    console.error('[EXPEDICAO STATUS]', err);
    res.redirect(`/expedicoes/${req.params.id}?erro=${encodeURIComponent(err.message)}`);
  }
});

// Registrar Conferência
router.post('/:id/conferencia', requireAuth, requireRole('administrador', 'operacional'), async (req, res) => {
  try {
    const expId = parseInt(req.params.id, 10);
    const {
      conferencia_nf_ok,
      conferencia_cliente_ok,
      conferencia_volumes_ok,
      conferencia_embalagens_ok,
      conferencia_condicoes_ok,
      conferencia_observacoes,
      houve_divergencia,
      divergencia_descricao
    } = req.body;

    const todosOk = conferencia_nf_ok && conferencia_cliente_ok && conferencia_volumes_ok && conferencia_embalagens_ok && conferencia_condicoes_ok;

    if (houve_divergencia || !todosOk) {
      // Registrar Ocorrência
      await db.run(
        'INSERT INTO ocorrencias (tipo, descricao, expedicao_id, status, usuario_id) VALUES (\'divergencia_conferencia\', ?, ?, \'pendente\', ?)',
        [divergencia_descricao || conferencia_observacoes || 'Divergência apontada na conferência de mercadoria.', expId, req.session.user.id]
      );

      await db.run(`
        UPDATE expedicoes SET
          conferencia_realizada = 0,
          data_conferencia = date('now','localtime'),
          hora_conferencia = time('now','localtime'),
          responsavel_conferencia = ?,
          conferencia_nf_ok = ?,
          conferencia_cliente_ok = ?,
          conferencia_volumes_ok = ?,
          conferencia_embalagens_ok = ?,
          conferencia_condicoes_ok = ?,
          conferencia_observacoes = ?,
          atualizado_em = datetime('now','localtime')
        WHERE id = ?
      `, [
        req.session.user.nome,
        conferencia_nf_ok ? 1 : 0,
        conferencia_cliente_ok ? 1 : 0,
        conferencia_volumes_ok ? 1 : 0,
        conferencia_embalagens_ok ? 1 : 0,
        conferencia_condicoes_ok ? 1 : 0,
        conferencia_observacoes || 'Conferência com divergências pendentes.',
        expId
      ]);

      await db.historico(
        'expedicoes',
        expId,
        'conferencia',
        'conferencia_realizada',
        'Pendente',
        'Divergência Registrada',
        divergencia_descricao || 'Divergência na conferência física',
        req.session.user.id,
        req.session.user.nome
      );

      return res.redirect(`/expedicoes/${expId}?erro=Divergência registrada! A conferência só pode ser concluída após a resolução da ocorrência.`);
    }

    // Conferência aprovada com sucesso!
    await db.run(`
      UPDATE expedicoes SET
        conferencia_realizada = 1,
        data_conferencia = date('now','localtime'),
        hora_conferencia = time('now','localtime'),
        responsavel_conferencia = ?,
        conferencia_nf_ok = 1,
        conferencia_cliente_ok = 1,
        conferencia_volumes_ok = 1,
        conferencia_embalagens_ok = 1,
        conferencia_condicoes_ok = 1,
        conferencia_observacoes = ?,
        atualizado_em = datetime('now','localtime')
      WHERE id = ?
    `, [
      req.session.user.nome,
      conferencia_observacoes || 'Conferência 100% aprovada sem divergências.',
      expId
    ]);

    // Mover para "Pronta para coleta" se estava aguardando
    const statusPronta = await db.get("SELECT id FROM status_expedicao WHERE nome = 'Pronta para coleta'");
    if (statusPronta) {
      await db.run(`
        UPDATE expedicoes SET
          status_id = ?,
          data_pronta = COALESCE(data_pronta, date('now','localtime')),
          hora_pronta = COALESCE(hora_pronta, time('now','localtime'))
        WHERE id = ? AND status_id IN (SELECT id FROM status_expedicao WHERE nome IN ('Aguardando preparação','Em preparação','Aguardando conferência'))
      `, [statusPronta.id, expId]);
    }

    await db.historico(
      'expedicoes',
      expId,
      'conferencia',
      'conferencia_realizada',
      'Pendente',
      'Aprovada (SIM)',
      conferencia_observacoes || 'Conferência validada com sucesso',
      req.session.user.id,
      req.session.user.nome
    );

    res.redirect(`/expedicoes/${expId}?sucesso=Conferência realizada e aprovada com sucesso!`);
  } catch (err) {
    console.error('[CONFERENCIA ERRO]', err);
    res.redirect(`/expedicoes/${req.params.id}?erro=${encodeURIComponent(err.message)}`);
  }
});

// EXCLUIR EXPEDIÇÃO
router.post('/:id/excluir', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    const expId = parseInt(req.params.id, 10);
    const exp = await db.get('SELECT numero_nf, cliente_nome, status_id FROM expedicoes WHERE id = ?', [expId]);
    if (!exp) return res.redirect('/expedicoes?erro=Expedição não encontrada.');

    // Não permite excluir se já está em uma coleta
    const jaColetada = await db.get('SELECT id FROM itens_coleta WHERE expedicao_id = ?', [expId]);
    if (jaColetada) {
      return res.redirect(`/expedicoes/${expId}?erro=Esta expedição já foi coletada e não pode ser excluída. Cancele a coleta primeiro.`);
    }

    const statusColetada = await db.get("SELECT id FROM status_expedicao WHERE nome = 'Coletada/Expedida'");
    if (statusColetada && exp.status_id === statusColetada.id) {
      return res.redirect(`/expedicoes/${expId}?erro=Expedições com status "Coletada/Expedida" não podem ser excluídas.`);
    }

    const motivo = req.body.motivo_exclusao ? req.body.motivo_exclusao.trim() : 'Exclusão pelo administrador';

    await db.historico(
      'expedicoes', expId, 'exclusao', null,
      `NF ${exp.numero_nf} — ${exp.cliente_nome}`,
      'EXCLUÍDO',
      motivo,
      req.session.user.id,
      req.session.user.nome
    );

    await db.run('DELETE FROM expedicoes WHERE id = ?', [expId]);

    res.redirect('/expedicoes?sucesso=' + encodeURIComponent(`Expedição NF ${exp.numero_nf} excluída com sucesso.`));
  } catch (err) {
    console.error('[ERRO EXCLUIR EXPEDIÇÃO]', err);
    res.redirect(`/expedicoes?erro=${encodeURIComponent('Erro ao excluir: ' + err.message)}`);
  }
});

module.exports = router;
