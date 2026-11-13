"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarComprovantePDF = gerarComprovantePDF;
// src/utils/pdfGenerator.ts — Geração de Comprovante de Coleta em PDF A4 Otimizado para 1 Página
const pdfkit_1 = __importDefault(require("pdfkit"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
/**
 * Gera o Comprovante de Retirada e Recebimento de Mercadorias em PDF (Formato A4).
 * Otimizado para caber em EXATAMENTE 1 PÁGINA para coletas normais, gerando página 2 apenas se houver alto volume de NFs.
 */
function gerarComprovantePDF(coletaData, itensColeta, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const dir = node_path_1.default.dirname(outputPath);
            if (!node_fs_1.default.existsSync(dir)) {
                node_fs_1.default.mkdirSync(dir, { recursive: true });
            }
            const doc = new pdfkit_1.default({
                size: 'A4',
                margins: { top: 25, bottom: 15, left: 30, right: 30 },
                info: {
                    Title: `Comprovante de Retirada - Coleta ${coletaData.numero}`,
                    Author: 'JANLUX ELÉTRICOS LTDA.',
                    Subject: 'Comprovante de Retirada e Recebimento de Mercadorias'
                }
            });
            const writeStream = node_fs_1.default.createWriteStream(outputPath);
            doc.pipe(writeStream);
            const pageWidth = doc.page.width - 60; // 535.28 pt
            // === CABEÇALHO COM LOGO (Compacto: 48pt) ===
            const headerY = 25;
            const headerHeight = 48;
            doc.rect(30, headerY, pageWidth, headerHeight).fillAndStroke('#0f2b46', '#0f2b46');
            const logoPath = node_path_1.default.join(__dirname, '..', '..', 'public', 'img', 'logo.jpg');
            let textStartX = 38;
            if (node_fs_1.default.existsSync(logoPath)) {
                try {
                    doc.image(logoPath, 36, headerY + 5, { width: 38, height: 38 });
                    textStartX = 82;
                }
                catch (imgErr) {
                    console.error('[PDF] Erro ao carregar logo no PDF:', imgErr.message);
                }
            }
            // Texto Institucional Esquerda
            doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
                .text('JANLUX ELÉTRICOS LTDA.', textStartX, headerY + 8, { align: 'left' });
            doc.fontSize(7.5).font('Helvetica').fillColor('#cbd5e1')
                .text('CONTROLE DE ALMOXARIFADO, EMBALAGENS E EXPEDIÇÃO', textStartX, headerY + 22, { align: 'left' });
            const emiNome = coletaData.emitente_nome || 'JANLUX ELÉTRICOS LTDA.';
            const emiCnpj = coletaData.cnpj_emitente || '00.000.000/0001-00';
            doc.fontSize(6.8).fillColor('#94a3b8')
                .text(`Emitente: ${emiNome} • CNPJ: ${emiCnpj}`, textStartX, headerY + 34, { align: 'left' });
            // Dados do Documento Direita
            const numComp = coletaData.comprovante_numero || `COMP-${coletaData.numero}`;
            doc.fillColor('#f59e0b').fontSize(9.5).font('Helvetica-Bold')
                .text(numComp, 30, headerY + 8, { align: 'right', width: pageWidth - 10 });
            doc.fillColor('#e2e8f0').fontSize(7.5).font('Helvetica')
                .text(`Coleta: ${coletaData.numero}`, 30, headerY + 22, { align: 'right', width: pageWidth - 10 });
            const agora = new Date();
            doc.fillColor('#cbd5e1').fontSize(6.8)
                .text(`Emissão: ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 30, headerY + 34, { align: 'right', width: pageWidth - 10 });
            // === TÍTULO DO DOCUMENTO (Compacto: 1 linha) ===
            const titleY = headerY + headerHeight + 8;
            doc.fillColor('#0f2b46').fontSize(10).font('Helvetica-Bold')
                .text('COMPROVANTE DE RETIRADA E RECEBIMENTO DE MERCADORIAS', 30, titleY, { align: 'center', width: pageWidth });
            // === IDENTIFICAÇÃO DA COLETA E TRANSPORTADOR (Compacto: 46pt) ===
            const infoBoxY = titleY + 16;
            const infoBoxHeight = 46;
            doc.rect(30, infoBoxY, pageWidth, infoBoxHeight).fillAndStroke('#f8fafc', '#cbd5e1');
            doc.fillColor('#0f2b46').fontSize(7.5).font('Helvetica-Bold')
                .text('IDENTIFICAÇÃO DA RETIRADA E DO TRANSPORTADOR', 38, infoBoxY + 5);
            doc.font('Helvetica').fontSize(7.5).fillColor('#1e293b');
            // Linha 1
            doc.font('Helvetica-Bold').text('Nº Coleta: ', 38, infoBoxY + 17, { continued: true })
                .font('Helvetica').text(coletaData.numero, { continued: true })
                .font('Helvetica-Bold').text('   •   Data Retirada: ', { continued: true })
                .font('Helvetica').text(coletaData.data_retirada_formatada || coletaData.data_retirada, { continued: true })
                .font('Helvetica-Bold').text('   •   Horário: ', { continued: true })
                .font('Helvetica').text(coletaData.hora_retirada || '--:--');
            // Linha 2
            doc.font('Helvetica-Bold').text('Transportadora: ', 38, infoBoxY + 28, { continued: true })
                .font('Helvetica').text((coletaData.transportadora_nome || 'NÃO INFORMADA').slice(0, 42), { continued: true })
                .font('Helvetica-Bold').text('   •   Placa: ', { continued: true })
                .font('Helvetica').text(coletaData.placa_veiculo || 'NÃO INFORMADA');
            // Linha 3
            doc.font('Helvetica-Bold').text('Motorista: ', 38, infoBoxY + 38, { continued: true })
                .font('Helvetica').text((coletaData.motorista_nome || 'NÃO INFORMADO').slice(0, 36), { continued: true })
                .font('Helvetica-Bold').text('   •   Documento (RG/CPF): ', { continued: true })
                .font('Helvetica').text(coletaData.motorista_documento || 'NÃO INFORMADO');
            // === TABELA DE NOTAS FISCAIS E VOLUMES ===
            const tableTitleY = infoBoxY + infoBoxHeight + 8;
            doc.fillColor('#0f2b46').fontSize(8.5).font('Helvetica-Bold')
                .text('RELAÇÃO DE NOTAS FISCAIS E VOLUMES FÍSICOS RETIRADOS', 30, tableTitleY);
            const tableTop = tableTitleY + 12;
            const colItem = 30;
            const colNF = 60;
            const colCliente = 160;
            const colVolumes = 455;
            // Header da Tabela (16pt)
            doc.rect(30, tableTop, pageWidth, 16).fillAndStroke('#0f2b46', '#0f2b46');
            doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
            doc.text('ITEM', colItem + 5, tableTop + 4);
            doc.text('NOTA FISCAL', colNF, tableTop + 4);
            doc.text('CLIENTE / DESTINATÁRIO', colCliente, tableTop + 4);
            doc.text('VOLUMES FÍSICOS', colVolumes - 15, tableTop + 4, { align: 'right', width: 85 });
            let currentY = tableTop + 16;
            let totalVolumes = 0;
            // Espaço estático necessário após a tabela (Total + Declaração + Assinaturas + Rodapé) = ~140pt
            const staticClosingHeight = 140;
            const maxPageY = doc.page.height - 25 - staticClosingHeight;
            if (!itensColeta || itensColeta.length === 0) {
                doc.rect(30, currentY, pageWidth, 16).stroke('#e2e8f0');
                doc.fillColor('#64748b').fontSize(7.5).text('Nenhuma nota fiscal associada a esta coleta.', 38, currentY + 4);
                currentY += 16;
            }
            else {
                itensColeta.forEach((item, index) => {
                    // Só quebra de página se o restante não couber junto com o bloco de encerramento
                    if (currentY > maxPageY) {
                        doc.addPage();
                        currentY = 30;
                        // Mini-header na página 2
                        doc.rect(30, currentY, pageWidth, 16).fillAndStroke('#0f2b46', '#0f2b46');
                        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
                        doc.text(`COLETA ${coletaData.numero} — CONTINUAÇÃO DA RELAÇÃO DE VOLUMES`, 38, currentY + 4);
                        currentY += 20;
                        // Re-renderizar cabeçalho da tabela
                        doc.rect(30, currentY, pageWidth, 16).fillAndStroke('#1e293b', '#1e293b');
                        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
                        doc.text('ITEM', colItem + 5, currentY + 4);
                        doc.text('NOTA FISCAL', colNF, currentY + 4);
                        doc.text('CLIENTE / DESTINATÁRIO', colCliente, currentY + 4);
                        doc.text('VOLUMES FÍSICOS', colVolumes - 15, currentY + 4, { align: 'right', width: 85 });
                        currentY += 16;
                    }
                    const rowHeight = 14.5;
                    const isOdd = index % 2 === 1;
                    if (isOdd) {
                        doc.rect(30, currentY, pageWidth, rowHeight).fill('#f8fafc');
                    }
                    else {
                        doc.rect(30, currentY, pageWidth, rowHeight).stroke('#e2e8f0');
                    }
                    doc.fillColor('#1e293b').fontSize(7.5);
                    doc.font('Helvetica').text(String(index + 1), colItem + 5, currentY + 3.5);
                    doc.font('Helvetica-Bold').text(`NF ${item.numero_nf}`, colNF, currentY + 3.5).font('Helvetica');
                    const clienteNomeCortado = (item.cliente_nome || 'NÃO INFORMADO').slice(0, 58);
                    doc.text(clienteNomeCortado, colCliente, currentY + 3.5);
                    const vols = Number(item.quantidade_volumes) || 1;
                    totalVolumes += vols;
                    doc.font('Helvetica-Bold').text(`${vols} vol(s)`, colVolumes - 15, currentY + 3.5, { align: 'right', width: 85 }).font('Helvetica');
                    currentY += rowHeight;
                });
            }
            // Linha de Total Geral (Compacto: 18pt)
            doc.rect(30, currentY, pageWidth, 18).fillAndStroke('#e2e8f0', '#cbd5e1');
            doc.fillColor('#0f2b46').fontSize(8).font('Helvetica-Bold');
            doc.text('TOTAL GERAL DE VOLUMES FÍSICOS RETIRADOS NA COLETA:', 38, currentY + 5);
            doc.fontSize(9).fillColor('#0f2b46')
                .text(`${totalVolumes} volume(s) físico(s)`, colVolumes - 45, currentY + 4.5, { align: 'right', width: 115 });
            currentY += 24;
            // === DECLARAÇÃO DE RECEBIMENTO (Compacto: 32pt) ===
            doc.rect(30, currentY, pageWidth, 32).fillAndStroke('#fffbeb', '#fde68a');
            doc.fillColor('#92400e').fontSize(7).font('Helvetica-Bold')
                .text('DECLARAÇÃO DE RECEBIMENTO:', 38, currentY + 4);
            doc.fillColor('#78350f').font('Helvetica').fontSize(6.8)
                .text('“Declaro que recebi e retirei as mercadorias relacionadas neste comprovante, referentes às notas fiscais identificadas neste documento, responsabilizando-me pelo recebimento dos volumes discriminados, conforme as condições verificadas no momento da coleta.”', 38, currentY + 14, { width: pageWidth - 16, align: 'justify', lineGap: 0.5 });
            currentY += 38;
            // === CAMPOS DE ASSINATURA (Compacto: 78pt) ===
            const boxWidth = (pageWidth - 8) / 2;
            const sigBoxHeight = 78;
            // Box do Transportador (Esquerda)
            doc.rect(30, currentY, boxWidth, sigBoxHeight).fillAndStroke('#ffffff', '#94a3b8');
            doc.fillColor('#0f2b46').fontSize(7.5).font('Helvetica-Bold')
                .text('RESPONSÁVEL PELA RETIRADA (TRANSPORTADOR)', 36, currentY + 5);
            doc.fillColor('#334155').fontSize(6.8).font('Helvetica');
            doc.text(`Nome completo: ${(coletaData.motorista_nome || '_________________________________').slice(0, 38)}`, 36, currentY + 17);
            doc.text(`Documento (RG/CPF): ${(coletaData.motorista_documento || '___________________________').slice(0, 34)}`, 36, currentY + 28);
            doc.text(`Transportadora: ${(coletaData.transportadora_nome || '').slice(0, 26)}   •   Placa: ${coletaData.placa_veiculo || '_______'}`, 36, currentY + 39);
            // Linha de assinatura transportador
            doc.strokeColor('#64748b').lineWidth(0.8)
                .moveTo(36, currentY + 63).lineTo(30 + boxWidth - 12, currentY + 63).stroke();
            doc.fontSize(6.5).fillColor('#64748b').text('Assinatura do Responsável pela Retirada', 36, currentY + 67, { align: 'center', width: boxWidth - 18 });
            // Box da JANLUX (Direita)
            const rightBoxX = 30 + boxWidth + 8;
            doc.rect(rightBoxX, currentY, boxWidth, sigBoxHeight).fillAndStroke('#ffffff', '#94a3b8');
            doc.fillColor('#0f2b46').fontSize(7.5).font('Helvetica-Bold')
                .text('LIBERAÇÃO JANLUX ELÉTRICOS LTDA.', rightBoxX + 6, currentY + 5);
            doc.fillColor('#334155').fontSize(6.8).font('Helvetica');
            doc.text(`Funcionário responsável: ${(coletaData.funcionario_liberacao || 'Sandra / Ivan').slice(0, 36)}`, rightBoxX + 6, currentY + 17);
            doc.text(`Data / Horário da Liberação: ${coletaData.data_retirada_formatada || coletaData.data_retirada} às ${coletaData.hora_retirada}`, rightBoxX + 6, currentY + 28);
            doc.text(`Obs: ${(coletaData.observacoes || 'Mercadoria conferida e liberada sem avarias aparentes.').slice(0, 42)}`, rightBoxX + 6, currentY + 39);
            // Linha de assinatura JANLUX
            doc.strokeColor('#64748b').lineWidth(0.8)
                .moveTo(rightBoxX + 8, currentY + 63).lineTo(rightBoxX + boxWidth - 12, currentY + 63).stroke();
            doc.fontSize(6.5).fillColor('#64748b').text('Assinatura / Carimbo do Funcionário JANLUX', rightBoxX + 6, currentY + 67, { align: 'center', width: boxWidth - 18 });
            // === RODAPÉ DO DOCUMENTO ===
            doc.fillColor('#64748b').fontSize(6.5).font('Helvetica')
                .text('JANLUX ELÉTRICOS LTDA. — Documento gerado automaticamente pelo Sistema de Expedição. Válido como comprovante legal de retirada física.', 30, doc.page.height - 30, { align: 'center', width: pageWidth, lineBreak: false });
            doc.end();
            writeStream.on('finish', () => resolve(outputPath));
            writeStream.on('error', reject);
        }
        catch (err) {
            reject(err);
        }
    });
}
