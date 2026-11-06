const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);

    if (isProduction) {
      const { query, calcularSaldoEmbalagem } = require('../database-pg');

      const [expHojeRes, emPrepRes, prontasRes, agendadasRes, coletasHojeRes, totalColetasRes,
             volumesHojeRes, compPendRes, embalagensRes, ocorrRes, ultimasExpRes, ultimasColRes] = await Promise.all([
        query('SELECT COUNT(*) as count FROM expedicoes WHERE data_disponibilizacao = $1 OR data_emissao = $1', [hoje]),
        query("SELECT COUNT(*) as count FROM expedicoes e JOIN status_expedicao s ON e.status_id = s.id WHERE s.nome = 'Em preparação'"),
        query("SELECT COUNT(*) as count FROM expedicoes e JOIN status_expedicao s ON e.status_id = s.id WHERE s.nome = 'Pronta para coleta'"),
        query("SELECT COUNT(*) as count FROM expedicoes e JOIN status_expedicao s ON e.status_id = s.id WHERE s.nome = 'Coleta agendada'"),
        query('SELECT COUNT(*) as count FROM coletas WHERE data_retirada = $1', [hoje]),
        query('SELECT COUNT(*) as count FROM coletas'),
        query('SELECT COALESCE(SUM(ic.quantidade_volumes), 0) as total FROM itens_coleta ic JOIN coletas c ON ic.coleta_id = c.id WHERE c.data_retirada = $1', [hoje]),
        query("SELECT COUNT(*) as count FROM comprovantes WHERE status IN ('pendente', 'emitido')"),
        query('SELECT * FROM embalagens WHERE ativo = 1'),
        query("SELECT COUNT(*) as count FROM ocorrencias WHERE status IN ('pendente', 'em_analise')"),
        query(`SELECT e.*, c.razao_social as cliente_nome_cadastrado, t.nome as transportadora_nome, s.nome as status_nome, s.cor as status_cor,
                      (SELECT COUNT(*) FROM volumes_expedicao WHERE expedicao_id = e.id) as total_volumes_fisicos
               FROM expedicoes e
               LEFT JOIN clientes c ON e.cliente_id = c.id
               LEFT JOIN transportadoras t ON e.transportadora_id = t.id
               LEFT JOIN status_expedicao s ON e.status_id = s.id
               ORDER BY e.id DESC LIMIT 10`),
        query(`SELECT c.*, t.nome as transportadora_nome,
                      (SELECT SUM(quantidade_volumes) FROM itens_coleta WHERE coleta_id = c.id) as total_volumes,
                      (SELECT COUNT(*) FROM itens_coleta WHERE coleta_id = c.id) as total_nfs,
                      comp.status as comprovante_status, comp.id as comprovante_id
               FROM coletas c
               LEFT JOIN transportadoras t ON c.transportadora_id = t.id
               LEFT JOIN comprovantes comp ON comp.coleta_id = c.id
               ORDER BY c.id DESC LIMIT 8`)
      ]);

      // Calcular saldo de embalagens
      const embalagensAlertas = [];
      let embalagensEstoqueBaixo = 0;
      for (const emb of embalagensRes.rows) {
        const saldo = await calcularSaldoEmbalagem(emb.id);
        if (emb.estoque_minimo > 0 && saldo <= emb.estoque_minimo) {
          embalagensEstoqueBaixo++;
          embalagensAlertas.push({ id: emb.id, codigo: emb.codigo, descricao: emb.descricao, saldo, minimo: emb.estoque_minimo });
        }
      }

      return res.render('dashboard', {
        title: 'Painel Principal',
        hoje,
        indicadores: {
          expHoje: parseInt(expHojeRes.rows[0].count),
          emPreparacao: parseInt(emPrepRes.rows[0].count),
          prontasColeta: parseInt(prontasRes.rows[0].count),
          coletasAgendadas: parseInt(agendadasRes.rows[0].count),
          coletasConcluidasHoje: parseInt(coletasHojeRes.rows[0].count),
          totalColetas: parseInt(totalColetasRes.rows[0].count),
          volumesHoje: parseInt(volumesHojeRes.rows[0].total) || 0,
          comprovantesPendentes: parseInt(compPendRes.rows[0].count),
          embalagensEstoqueBaixo,
          ocorrenciasPendentes: parseInt(ocorrRes.rows[0].count)
        },
        embalagensAlertas,
        ultimasExpedicoes: ultimasExpRes.rows,
        ultimasColetas: ultimasColRes.rows
      });

    } else {
      // SQLite (local)
      const { getDb, calcularSaldoEmbalagem } = require('../database-sqlite');
      const db = getDb();

      const expHoje = db.prepare('SELECT COUNT(*) as count FROM expedicoes WHERE data_disponibilizacao = ? OR data_emissao = ?').get(hoje, hoje).count;
      const emPreparacao = db.prepare("SELECT COUNT(*) as count FROM expedicoes e JOIN status_expedicao s ON e.status_id = s.id WHERE s.nome = 'Em preparação'").get().count;
      const prontasColeta = db.prepare("SELECT COUNT(*) as count FROM expedicoes e JOIN status_expedicao s ON e.status_id = s.id WHERE s.nome = 'Pronta para coleta'").get().count;
      const coletasAgendadas = db.prepare("SELECT COUNT(*) as count FROM expedicoes e JOIN status_expedicao s ON e.status_id = s.id WHERE s.nome = 'Coleta agendada'").get().count;
      const coletasConcluidasHoje = db.prepare('SELECT COUNT(*) as count FROM coletas WHERE data_retirada = ?').get(hoje).count;
      const totalColetas = db.prepare('SELECT COUNT(*) as count FROM coletas').get().count;
      const volumesHoje = db.prepare('SELECT COALESCE(SUM(ic.quantidade_volumes), 0) as total FROM itens_coleta ic JOIN coletas c ON ic.coleta_id = c.id WHERE c.data_retirada = ?').get(hoje).total;
      const comprovantesPendentes = db.prepare("SELECT COUNT(*) as count FROM comprovantes WHERE status IN ('pendente', 'emitido')").get().count;
      const ocorrenciasPendentes = db.prepare("SELECT COUNT(*) as count FROM ocorrencias WHERE status IN ('pendente', 'em_analise')").get().count;

      const embalagens = db.prepare('SELECT * FROM embalagens WHERE ativo = 1').all();
      let embalagensEstoqueBaixo = 0;
      const embalagensAlertas = [];
      for (const emb of embalagens) {
        const saldo = calcularSaldoEmbalagem(emb.id);
        if (emb.estoque_minimo > 0 && saldo <= emb.estoque_minimo) {
          embalagensEstoqueBaixo++;
          embalagensAlertas.push({ id: emb.id, codigo: emb.codigo, descricao: emb.descricao, saldo, minimo: emb.estoque_minimo });
        }
      }

      const ultimasExpedicoes = db.prepare(`SELECT e.*, c.razao_social as cliente_nome_cadastrado, t.nome as transportadora_nome, s.nome as status_nome, s.cor as status_cor,
             (SELECT COUNT(*) FROM volumes_expedicao WHERE expedicao_id = e.id) as total_volumes_fisicos
        FROM expedicoes e LEFT JOIN clientes c ON e.cliente_id = c.id LEFT JOIN transportadoras t ON e.transportadora_id = t.id
        LEFT JOIN status_expedicao s ON e.status_id = s.id ORDER BY e.id DESC LIMIT 10`).all();

      const ultimasColetas = db.prepare(`SELECT c.*, t.nome as transportadora_nome,
             (SELECT SUM(quantidade_volumes) FROM itens_coleta WHERE coleta_id = c.id) as total_volumes,
             (SELECT COUNT(*) FROM itens_coleta WHERE coleta_id = c.id) as total_nfs,
             comp.status as comprovante_status, comp.id as comprovante_id
        FROM coletas c LEFT JOIN transportadoras t ON c.transportadora_id = t.id
        LEFT JOIN comprovantes comp ON comp.coleta_id = c.id ORDER BY c.id DESC LIMIT 8`).all();

      res.render('dashboard', {
        title: 'Painel Principal', hoje,
        indicadores: { expHoje, emPreparacao, prontasColeta, coletasAgendadas, coletasConcluidasHoje, totalColetas, volumesHoje, comprovantesPendentes, embalagensEstoqueBaixo, ocorrenciasPendentes },
        embalagensAlertas, ultimasExpedicoes, ultimasColetas
      });
    }
  } catch (err) {
    console.error('[DASHBOARD] Erro:', err);
    res.status(500).render('error', { title: 'Erro', mensagem: 'Erro ao carregar painel: ' + err.message });
  }
});

module.exports = router;
