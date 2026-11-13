"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/relatorios.ts — Relatórios e Consultas Gerenciais
const express_1 = require("express");
const exceljs_1 = __importDefault(require("exceljs"));
const db_helper_1 = __importDefault(require("../utils/db-helper"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Página central de Relatórios
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const clientes = await db_helper_1.default.all('SELECT id, razao_social FROM clientes ORDER BY razao_social LIMIT 100');
        const transportadoras = await db_helper_1.default.all('SELECT id, nome FROM transportadoras ORDER BY nome');
        res.render('relatorios/index', { title: 'Relatórios e Consultas Gerenciais', clientes, transportadoras });
    }
    catch (err) {
        res.status(500).render('error', { title: 'Erro', mensagem: err.message });
    }
});
// Executar Relatório Específico
router.get('/executar', auth_1.requireAuth, async (req, res) => {
    try {
        const { tipo, data_inicio, data_fim, cliente_id, transportadora_id, exportar } = req.query;
        let titulo = 'Relatório';
        let colunas = [];
        let dados = [];
        switch (tipo) {
            case '1': {
                titulo = 'Expedições Realizadas por Período';
                colunas = ['Data Op.', 'NF', 'Série', 'Cliente', 'Transportadora', 'Volumes', 'Status', 'Responsável'];
                let sql = `SELECT e.data_disponibilizacao, e.numero_nf, e.serie_nf, e.cliente_nome, t.nome as transp_nome,
          (SELECT COUNT(*) FROM volumes_expedicao WHERE expedicao_id = e.id) as volumes, s.nome as status_nome, e.responsavel_preparacao
          FROM expedicoes e LEFT JOIN transportadoras t ON e.transportadora_id = t.id LEFT JOIN status_expedicao s ON e.status_id = s.id WHERE 1=1`;
                const p = [];
                if (data_inicio) {
                    sql += ' AND (e.data_emissao >= ? OR e.data_disponibilizacao >= ?)';
                    p.push(data_inicio, data_inicio);
                }
                if (data_fim) {
                    sql += ' AND (e.data_emissao <= ? OR e.data_disponibilizacao <= ?)';
                    p.push(data_fim, data_fim);
                }
                sql += ' ORDER BY e.id DESC LIMIT 500';
                const rows = await db_helper_1.default.all(sql, p);
                dados = rows.map((r) => [
                    r.data_disponibilizacao ? r.data_disponibilizacao.split('-').reverse().join('/') : '',
                    r.numero_nf,
                    r.serie_nf || '1',
                    r.cliente_nome,
                    r.transp_nome || 'N/A',
                    r.volumes || 1,
                    r.status_nome,
                    r.responsavel_preparacao || ''
                ]);
                break;
            }
            case '2': {
                titulo = 'Notas Fiscais Expedidas por Cliente';
                colunas = ['Cliente', 'Total NFs', 'Total Volumes Físicos', 'Última Expedição'];
                let sql = `SELECT e.cliente_nome, COUNT(DISTINCT e.id) as total_nfs, COUNT(v.id) as total_volumes, MAX(e.data_disponibilizacao) as ultima_data
          FROM expedicoes e LEFT JOIN volumes_expedicao v ON v.expedicao_id = e.id WHERE e.cliente_nome IS NOT NULL AND e.cliente_nome != ''`;
                const p = [];
                if (cliente_id) {
                    sql += ' AND e.cliente_id = ?';
                    p.push(cliente_id);
                }
                sql += ' GROUP BY e.cliente_nome ORDER BY total_nfs DESC LIMIT 300';
                const rows = await db_helper_1.default.all(sql, p);
                dados = rows.map((r) => [
                    r.cliente_nome,
                    r.total_nfs,
                    r.total_volumes,
                    r.ultima_data ? r.ultima_data.split('-').reverse().join('/') : ''
                ]);
                break;
            }
            case '3': {
                titulo = 'Coletas Realizadas por Transportadora';
                colunas = ['Transportadora', 'Total Coletas', 'Total NFs Retiradas', 'Total Volumes Físicos'];
                let sql = `SELECT COALESCE(t.nome, c.transportadora_nome, 'Não Informada') as transp, COUNT(DISTINCT c.id) as total_coletas,
          COUNT(DISTINCT ic.expedicao_id) as total_nfs, COALESCE(SUM(ic.quantidade_volumes), 0) as total_volumes
          FROM coletas c LEFT JOIN transportadoras t ON c.transportadora_id = t.id LEFT JOIN itens_coleta ic ON ic.coleta_id = c.id WHERE 1=1`;
                const p = [];
                if (transportadora_id) {
                    sql += ' AND c.transportadora_id = ?';
                    p.push(transportadora_id);
                }
                if (data_inicio) {
                    sql += ' AND c.data_retirada >= ?';
                    p.push(data_inicio);
                }
                if (data_fim) {
                    sql += ' AND c.data_retirada <= ?';
                    p.push(data_fim);
                }
                sql += ' GROUP BY transp ORDER BY total_coletas DESC';
                const rows = await db_helper_1.default.all(sql, p);
                dados = rows.map((r) => [r.transp, r.total_coletas, r.total_nfs, r.total_volumes]);
                break;
            }
            case '4': {
                titulo = 'Volumes Retirados por Data';
                colunas = ['Data de Retirada', 'Total de Coletas', 'Total de Volumes Físicos Retirados'];
                let sql = `SELECT c.data_retirada, COUNT(DISTINCT c.id) as total_coletas, COALESCE(SUM(ic.quantidade_volumes), 0) as total_volumes
          FROM coletas c LEFT JOIN itens_coleta ic ON ic.coleta_id = c.id WHERE 1=1`;
                const p = [];
                if (data_inicio) {
                    sql += ' AND c.data_retirada >= ?';
                    p.push(data_inicio);
                }
                if (data_fim) {
                    sql += ' AND c.data_retirada <= ?';
                    p.push(data_fim);
                }
                sql += ' GROUP BY c.data_retirada ORDER BY c.data_retirada DESC LIMIT 100';
                const rows = await db_helper_1.default.all(sql, p);
                dados = rows.map((r) => [
                    r.data_retirada ? r.data_retirada.split('-').reverse().join('/') : '',
                    r.total_coletas,
                    r.total_volumes
                ]);
                break;
            }
            case '5': {
                titulo = 'Histórico de Coleta por Nota Fiscal';
                colunas = ['NF', 'Cliente', 'Data Retirada', 'Hora', 'Coleta Nº', 'Transportadora', 'Motorista', 'Volumes'];
                const rows = await db_helper_1.default.all(`SELECT e.numero_nf, e.cliente_nome, c.data_retirada, c.hora_retirada, c.numero as coleta_numero,
          COALESCE(t.nome, c.transportadora_nome) as transp, c.motorista_nome, ic.quantidade_volumes
          FROM itens_coleta ic JOIN coletas c ON ic.coleta_id = c.id JOIN expedicoes e ON ic.expedicao_id = e.id
          LEFT JOIN transportadoras t ON c.transportadora_id = t.id ORDER BY c.data_retirada DESC, c.hora_retirada DESC LIMIT 200`);
                dados = rows.map((r) => [
                    r.numero_nf,
                    r.cliente_nome,
                    r.data_retirada ? r.data_retirada.split('-').reverse().join('/') : '',
                    r.hora_retirada || '',
                    r.coleta_numero,
                    r.transp || '',
                    r.motorista_nome || '',
                    r.quantidade_volumes || 1
                ]);
                break;
            }
            case '6': {
                titulo = 'Coletas com Comprovantes Pendentes de Assinatura';
                colunas = ['Coleta Nº', 'Data', 'Transportadora', 'Motorista', 'Status Comprovante', 'Total NFs', 'Total Volumes'];
                const rows = await db_helper_1.default.all(`SELECT c.numero, c.data_retirada, COALESCE(t.nome, c.transportadora_nome) as transp, c.motorista_nome,
          comp.status as comp_status,
          (SELECT COUNT(*) FROM itens_coleta WHERE coleta_id = c.id) as nfs,
          (SELECT SUM(quantidade_volumes) FROM itens_coleta WHERE coleta_id = c.id) as vols
          FROM coletas c LEFT JOIN transportadoras t ON c.transportadora_id = t.id
          LEFT JOIN comprovantes comp ON comp.coleta_id = c.id WHERE comp.status IN ('pendente', 'emitido') ORDER BY c.data_retirada DESC`);
                dados = rows.map((r) => [
                    r.numero,
                    r.data_retirada ? r.data_retirada.split('-').reverse().join('/') : '',
                    r.transp || '',
                    r.motorista_nome || '',
                    (r.comp_status || 'pendente').toUpperCase(),
                    r.nfs || 0,
                    r.vols || 0
                ]);
                break;
            }
            case '7': {
                titulo = 'Comprovantes Assinados e Arquivados';
                colunas = ['Comprovante Nº', 'Coleta Nº', 'Data Assinatura', 'Arquivado Por', 'Status'];
                const rows = await db_helper_1.default.all(`SELECT comp.numero, c.numero as coleta_num, comp.data_assinatura, comp.responsavel_arquivo, comp.status
          FROM comprovantes comp JOIN coletas c ON comp.coleta_id = c.id WHERE comp.status IN ('assinado', 'arquivado') ORDER BY comp.data_assinatura DESC`);
                dados = rows.map((r) => [
                    r.numero,
                    r.coleta_num,
                    r.data_assinatura ? r.data_assinatura.split('-').reverse().join('/') : '',
                    r.responsavel_arquivo || '',
                    r.status.toUpperCase()
                ]);
                break;
            }
            case '8': {
                titulo = 'Movimentações de Embalagens';
                colunas = ['Data/Hora', 'Embalagem', 'Tipo', 'Quantidade', 'Motivo', 'NF Relacionada', 'Usuário'];
                const rows = await db_helper_1.default.all(`SELECT m.criado_em, e.descricao as emb_nome, m.tipo, m.quantidade, m.motivo, m.nota_fiscal, u.nome as user_nome
          FROM movimentacoes_embalagens m JOIN embalagens e ON m.embalagem_id = e.id LEFT JOIN usuarios u ON m.usuario_id = u.id ORDER BY m.id DESC LIMIT 200`);
                dados = rows.map((r) => [
                    r.criado_em,
                    r.emb_nome,
                    r.tipo.toUpperCase(),
                    r.quantidade,
                    r.motivo || '',
                    r.nota_fiscal || '',
                    r.user_nome || ''
                ]);
                break;
            }
            case '9': {
                titulo = 'Saldo Atual de Estoque de Embalagens';
                colunas = ['Código', 'Descrição', 'Dimensões (CxLxA)', 'Estoque Mínimo', 'Saldo Atual', 'Situação'];
                const rows = await db_helper_1.default.all('SELECT * FROM embalagens WHERE ativo = 1 ORDER BY codigo');
                dados = [];
                for (const e of rows) {
                    const saldo = await db_helper_1.default.saldoEmbalagem(e.id);
                    const alerta = e.estoque_minimo > 0 && saldo <= e.estoque_minimo;
                    dados.push([e.codigo, e.descricao, `${e.comprimento_cm}x${e.largura_cm}x${e.altura_cm} cm`, e.estoque_minimo, saldo, alerta ? 'ESTOQUE BAIXO' : 'OK']);
                }
                break;
            }
            case '10': {
                titulo = 'Consumo de Embalagens em Expedições';
                colunas = ['Tipo Embalagem', 'Total Volumes Embalados', 'Peso Total (kg)'];
                const rows = await db_helper_1.default.all(`
          SELECT v.tipo_embalagem, COUNT(v.id) as total_vols,
                 ROUND(SUM(COALESCE(v.peso_kg, v.peso_g / 1000.0)), 3) as peso_kg
          FROM volumes_expedicao v
          WHERE v.tipo_embalagem IS NOT NULL AND v.tipo_embalagem != ''
          GROUP BY v.tipo_embalagem
          ORDER BY total_vols DESC
        `);
                dados = rows.map((r) => {
                    const num = parseFloat(r.peso_kg) || 0;
                    const fmt = num.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
                    return [r.tipo_embalagem, r.total_vols, fmt];
                });
                break;
            }
            case '11': {
                titulo = 'Ocorrências e Divergências Registradas';
                colunas = ['Data Registro', 'Tipo', 'Descrição', 'NF', 'Status', 'Resolução'];
                const rows = await db_helper_1.default.all(`SELECT o.criado_em, o.tipo, o.descricao, e.numero_nf, o.status, o.resolucao
          FROM ocorrencias o LEFT JOIN expedicoes e ON o.expedicao_id = e.id ORDER BY o.id DESC`);
                dados = rows.map((r) => [r.criado_em, r.tipo, r.descricao, r.numero_nf || 'Geral', r.status.toUpperCase(), r.resolucao || 'Pendente']);
                break;
            }
            case '12': {
                titulo = 'Tempo de Operação: Disponibilização vs Caixa Pronta';
                colunas = ['Data', 'NF', 'Cliente', 'Hora NF Desceu', 'Hora Caixa Pronta', 'Responsável'];
                const rows = await db_helper_1.default.all(`SELECT data_disponibilizacao, numero_nf, cliente_nome, hora_disponibilizacao, hora_pronta, responsavel_preparacao
          FROM expedicoes WHERE hora_disponibilizacao IS NOT NULL AND hora_pronta IS NOT NULL AND hora_pronta != '00:00:00' ORDER BY id DESC LIMIT 200`);
                dados = rows.map((r) => [
                    r.data_disponibilizacao ? r.data_disponibilizacao.split('-').reverse().join('/') : '',
                    r.numero_nf,
                    r.cliente_nome,
                    r.hora_disponibilizacao,
                    r.hora_pronta,
                    r.responsavel_preparacao || ''
                ]);
                break;
            }
            default:
                return res.redirect('/relatorios');
        }
        // Exportar para Excel
        if (exportar === 'excel') {
            const wb = new exceljs_1.default.Workbook();
            const ws = wb.addWorksheet(titulo.slice(0, 30));
            ws.columns = colunas.map(c => ({ header: c, width: 22 }));
            ws.addRows(dados);
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2B46' } };
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(titulo)}.xlsx"`);
            return wb.xlsx.write(res).then(() => res.end());
        }
        res.render('relatorios/resultado', { title: titulo, colunas, dados, tipo, filtros: req.query });
    }
    catch (err) {
        console.error('[RELATORIOS]', err);
        res.status(500).render('error', { title: 'Erro no Relatório', mensagem: err.message });
    }
});
exports.default = router;
