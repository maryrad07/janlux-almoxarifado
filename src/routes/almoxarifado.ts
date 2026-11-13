// src/routes/almoxarifado.ts — Controle de Almoxarifado, Embalagens e Saldos
import { Router, Request, Response } from 'express';
import db from '../utils/db-helper';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Listar Embalagens e Saldos
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const embalagens = await db.all('SELECT * FROM embalagens ORDER BY ativo DESC, codigo ASC');
    const lista = [];
    for (const emb of embalagens) {
      const saldo = await db.saldoEmbalagem(emb.id);
      lista.push({
        ...emb,
        saldo,
        abaixoMinimo: emb.estoque_minimo > 0 && saldo <= emb.estoque_minimo
      });
    }
    const ultimasMovs = await db.all(`
      SELECT m.*, e.codigo as embalagem_codigo, e.descricao as embalagem_descricao, u.nome as usuario_nome
      FROM movimentacoes_embalagens m
      JOIN embalagens e ON m.embalagem_id = e.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      ORDER BY m.id DESC LIMIT 30
    `);

    res.render('almoxarifado/index', {
      title: 'Almoxarifado e Controle de Embalagens',
      embalagens: lista,
      ultimasMovs,
      msg: req.query.sucesso || null,
      err: req.query.erro || null
    });
  } catch (err: any) {
    res.redirect('/almoxarifado?erro=' + encodeURIComponent(err.message));
  }
});

// Cadastrar Nova Embalagem (com peso em kg e 3 casas decimais)
router.post('/embalagens/salvar', requireAuth, requireRole('administrador', 'operacional'), async (req: Request, res: Response) => {
  try {
    const {
      codigo,
      descricao,
      unidade,
      comprimento_cm,
      largura_cm,
      altura_cm,
      peso_kg,
      peso_g,
      estoque_minimo,
      estoque_inicial,
      observacoes
    } = req.body;

    if (!codigo || !descricao) {
      return res.redirect('/almoxarifado?erro=' + encodeURIComponent('Código e descrição são obrigatórios.'));
    }

    // Processamento do peso em kg com 3 casas decimais
    let finalPesoKg = 0;
    if (peso_kg !== undefined && peso_kg !== null && String(peso_kg).trim() !== '') {
      finalPesoKg = parseFloat(String(peso_kg).replace(',', '.')) || 0;
    } else if (peso_g !== undefined && peso_g !== null && String(peso_g).trim() !== '') {
      finalPesoKg = (parseFloat(String(peso_g).replace(',', '.')) || 0) / 1000.0;
    }
    const finalPesoG = Math.round(finalPesoKg * 1000.0);

    const user = req.session.user;

    const info = await db.run(
      'INSERT INTO embalagens (codigo, descricao, unidade, comprimento_cm, largura_cm, altura_cm, peso_g, peso_kg, estoque_minimo, estoque_inicial, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        codigo.trim().toUpperCase(),
        descricao.trim(),
        unidade || 'UN',
        parseFloat(comprimento_cm) || 0,
        parseFloat(largura_cm) || 0,
        parseFloat(altura_cm) || 0,
        finalPesoG,
        finalPesoKg,
        parseInt(estoque_minimo, 10) || 0,
        parseInt(estoque_inicial, 10) || 0,
        observacoes || null
      ]
    );

    await db.historico('embalagens', Number(info.id), 'criacao', null, null, codigo.trim(), 'Cadastro de nova embalagem', user?.id, user?.nome);
    res.redirect('/almoxarifado?sucesso=' + encodeURIComponent('Embalagem cadastrada com sucesso!'));
  } catch (err: any) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
      return res.redirect('/almoxarifado?erro=' + encodeURIComponent('Já existe uma embalagem com este código.'));
    }
    res.redirect('/almoxarifado?erro=' + encodeURIComponent(err.message));
  }
});

// Registrar Movimentação de Estoque
router.post('/movimentar', requireAuth, requireRole('administrador', 'operacional'), async (req: Request, res: Response) => {
  try {
    const { embalagem_id, tipo, quantidade, motivo, nota_fiscal, observacoes, autorizacao_saldo_negativo } = req.body;
    const embId = parseInt(embalagem_id, 10);
    const qtd = parseInt(quantidade, 10);
    const user = req.session.user;

    if (!embId || !tipo || !qtd || qtd <= 0) {
      return res.redirect('/almoxarifado?erro=' + encodeURIComponent('Preencha a embalagem, tipo e quantidade válida.'));
    }

    const saldoAtual = await db.saldoEmbalagem(embId);
    const reduzEstoque = ['saida', 'uso_expedicao', 'ajuste'].includes(tipo);

    if (reduzEstoque && (saldoAtual - qtd) < 0 && !autorizacao_saldo_negativo && user?.perfil !== 'administrador') {
      return res.redirect(`/almoxarifado?erro=${encodeURIComponent(`Operação resultaria em saldo negativo (${saldoAtual - qtd}). Necessária autorização de administrador.`)}`);
    }

    const info = await db.run(
      'INSERT INTO movimentacoes_embalagens (embalagem_id, tipo, quantidade, motivo, nota_fiscal, usuario_id, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        embId,
        tipo,
        qtd,
        motivo || null,
        nota_fiscal || null,
        user?.id,
        observacoes || (autorizacao_saldo_negativo ? 'Autorizado saldo negativo extraordinário' : null)
      ]
    );

    const novoSaldo = await db.saldoEmbalagem(embId);
    await db.historico(
      'movimentacoes_embalagens',
      Number(info.id),
      'movimentacao',
      tipo,
      String(saldoAtual),
      String(novoSaldo),
      `Movimentação ${tipo}: ${qtd} un (${motivo || 'Sem motivo'})`,
      user?.id,
      user?.nome
    );

    res.redirect('/almoxarifado?sucesso=' + encodeURIComponent('Movimentação de estoque registrada com sucesso!'));
  } catch (err: any) {
    res.redirect('/almoxarifado?erro=' + encodeURIComponent(err.message));
  }
});

export default router;
