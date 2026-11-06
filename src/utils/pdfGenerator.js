const PDFDocument = require('pdfkit');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Gera o Comprovante de Retirada e Recebimento de Mercadorias em PDF (Formato A4)
 * Conforme requisitos das Seções 8 e 9 do projeto JANLUX, com a logo oficial da empresa.
 */
function gerarComprovantePDF(coletaData, itensColeta, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Garante diretório de saída
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 35, right: 35 },
        info: {
          Title: `Comprovante de Retirada - Coleta ${coletaData.numero}`,
          Author: 'JANLUX ELÉTRICOS LTDA.',
          Subject: 'Comprovante de Retirada e Recebimento de Mercadorias'
        }
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const pageWidth = doc.page.width - 70; // 525pt

      // === CABEÇALHO COM LOGO ===
      const headerY = 30;
      const headerHeight = 65;
      doc.rect(35, headerY, pageWidth, headerHeight).fillAndStroke('#0f2b46', '#0f2b46');

      // Desenhar a Logo se existir
      const logoPath = path.join(__dirname, '..', '..', 'public', 'img', 'logo.jpg');
      let textStartX = 45;
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 42, headerY + 8, { width: 50, height: 50 });
          textStartX = 100;
        } catch (imgErr) {
          console.error('[PDF] Erro ao carregar logo no PDF:', imgErr.message);
        }
      }

      // Texto institucional
      doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
         .text('JANLUX ELÉTRICOS LTDA.', textStartX, headerY + 12, { align: 'left' });

      doc.fontSize(8.5).font('Helvetica').fillColor('#cbd5e1')
         .text('CONTROLE DE ALMOXARIFADO, EMBALAGENS E EXPEDIÇÃO', textStartX, headerY + 28, { align: 'left' });
      
      const emiNome = coletaData.emitente_nome || 'JANLUX ELÉTRICOS LTDA.';
      const emiCnpj = coletaData.cnpj_emitente || '00.000.000/0001-00';
      doc.fontSize(7.5).fillColor('#94a3b8')
         .text(`Emitente: ${emiNome} • CNPJ: ${emiCnpj}`, textStartX, headerY + 42, { align: 'left' });

      // Dados do documento (lado direito)
      const numComp = coletaData.comprovante_numero || `COMP-${coletaData.numero}`;
      doc.fillColor('#f59e0b').fontSize(11).font('Helvetica-Bold')
         .text(numComp, 35, headerY + 12, { align: 'right', width: pageWidth - 10 });

      doc.fillColor('#e2e8f0').fontSize(8).font('Helvetica')
         .text(`Coleta: ${coletaData.numero}`, 35, headerY + 28, { align: 'right', width: pageWidth - 10 });

      const agora = new Date();
      doc.fillColor('#cbd5e1').fontSize(7.5)
         .text(`Emissão: ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 35, headerY + 42, { align: 'right', width: pageWidth - 10 });

      doc.y = headerY + headerHeight + 12;

      // === TÍTULO DO DOCUMENTO ===
      doc.fillColor('#0f2b46').fontSize(12).font('Helvetica-Bold')
         .text('COMPROVANTE DE RETIRADA E RECEBIMENTO DE MERCADORIAS', 35, doc.y, { align: 'center', width: pageWidth });

      doc.moveDown(0.6);

      // === IDENTIFICAÇÃO DA COLETA E TRANSPORTADOR ===
      const startBoxY = doc.y;
      const infoBoxHeight = 62;
      doc.rect(35, startBoxY, pageWidth, infoBoxHeight).fillAndStroke('#f8fafc', '#cbd5e1');

      doc.fillColor('#0f2b46').fontSize(8.5).font('Helvetica-Bold');
      doc.text('IDENTIFICAÇÃO DA RETIRADA E DO TRANSPORTADOR', 45, startBoxY + 6);

      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

      // Linha 1
      doc.font('Helvetica-Bold').text('Nº da Coleta: ', 45, startBoxY + 20, { continued: true })
         .font('Helvetica').text(coletaData.numero, { continued: true })
         .font('Helvetica-Bold').text('    Data Efetiva da Retirada: ', { continued: true })
         .font('Helvetica').text(coletaData.data_retirada_formatada || coletaData.data_retirada, { continued: true })
         .font('Helvetica-Bold').text('    Horário Efetivo: ', { continued: true })
         .font('Helvetica').text(coletaData.hora_retirada || '--:--');

      // Linha 2
      doc.font('Helvetica-Bold').text('Transportadora: ', 45, startBoxY + 33, { continued: true })
         .font('Helvetica').text(coletaData.transportadora_nome || 'NÃO INFORMADA', { continued: true })
         .font('Helvetica-Bold').text('    Placa do Veículo: ', { continued: true })
         .font('Helvetica').text(coletaData.placa_veiculo || 'NÃO INFORMADA');

      // Linha 3
      doc.font('Helvetica-Bold').text('Motorista / Responsável: ', 45, startBoxY + 46, { continued: true })
         .font('Helvetica').text(coletaData.motorista_nome || 'NÃO INFORMADO', { continued: true })
         .font('Helvetica-Bold').text('    Documento (RG / CPF): ', { continued: true })
         .font('Helvetica').text(coletaData.motorista_documento || 'NÃO INFORMADO');

      doc.y = startBoxY + infoBoxHeight + 10;

      // === TABELA DE NOTAS FISCAIS E VOLUMES (SEM COLUNA SÉRIE - CONFORME SOLICITADO) ===
      doc.fillColor('#0f2b46').fontSize(9.5).font('Helvetica-Bold')
         .text('RELAÇÃO DE NOTAS FISCAIS E VOLUMES FÍSICOS RETIRADOS', 35, doc.y);

      doc.moveDown(0.3);

      const tableTop = doc.y;
      const colItem = 35;
      const colNF = 70;
      const colCliente = 175;
      const colVolumes = 455;

      // Header da Tabela
      doc.rect(35, tableTop, pageWidth, 18).fillAndStroke('#0f2b46', '#0f2b46');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('ITEM', colItem + 5, tableTop + 5);
      doc.text('NOTA FISCAL', colNF, tableTop + 5);
      doc.text('CLIENTE / DESTINATÁRIO', colCliente, tableTop + 5);
      doc.text('VOLUMES FÍSICOS', colVolumes - 20, tableTop + 5, { align: 'right', width: 85 });

      let currentY = tableTop + 18;
      let totalVolumes = 0;

      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

      if (!itensColeta || itensColeta.length === 0) {
        doc.rect(35, currentY, pageWidth, 20).stroke('#e2e8f0');
        doc.fillColor('#64748b').text('Nenhuma nota fiscal associada a esta coleta.', 45, currentY + 6);
        currentY += 20;
      } else {
        itensColeta.forEach((item, index) => {
          // Checagem de quebra de página
          if (currentY > 640) {
            doc.addPage();
            currentY = 40;
          }

          const isOdd = index % 2 === 1;
          if (isOdd) {
            doc.rect(35, currentY, pageWidth, 18).fill('#f8fafc');
          } else {
            doc.rect(35, currentY, pageWidth, 18).stroke('#e2e8f0');
          }

          doc.fillColor('#1e293b');
          doc.text(String(index + 1), colItem + 5, currentY + 5);
          doc.font('Helvetica-Bold').text(`NF ${item.numero_nf}`, colNF, currentY + 5).font('Helvetica');

          const clienteNomeCortado = (item.cliente_nome || 'NÃO INFORMADO').slice(0, 55);
          doc.text(clienteNomeCortado, colCliente, currentY + 5);

          const vols = parseInt(item.quantidade_volumes, 10) || 1;
          totalVolumes += vols;
          doc.font('Helvetica-Bold').text(`${vols} vol(s)`, colVolumes - 20, currentY + 5, { align: 'right', width: 85 }).font('Helvetica');

          currentY += 18;
        });
      }

      // Linha de Total Geral
      doc.rect(35, currentY, pageWidth, 22).fillAndStroke('#e2e8f0', '#cbd5e1');
      doc.fillColor('#0f2b46').fontSize(9).font('Helvetica-Bold');
      doc.text('TOTAL GERAL DE VOLUMES FÍSICOS RETIRADOS NA COLETA:', 45, currentY + 6);
      doc.fontSize(10.5).fillColor('#0f2b46')
         .text(`${totalVolumes} volume(s) físico(s)`, colVolumes - 60, currentY + 5, { align: 'right', width: 125 });

      currentY += 30;

      // === DECLARAÇÃO DE RECEBIMENTO (OBRIGATÓRIA - ITEM 9.4) ===
      doc.rect(35, currentY, pageWidth, 45).fillAndStroke('#fffbeb', '#fde68a');
      doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold')
         .text('DECLARAÇÃO DE RECEBIMENTO:', 45, currentY + 5);

      doc.fillColor('#78350f').font('Helvetica').fontSize(7.5)
         .text(
           '“Declaro que recebi e retirei as mercadorias relacionadas neste comprovante, referentes às notas fiscais identificadas neste documento, responsabilizando-me pelo recebimento dos volumes discriminados, conforme as condições verificadas no momento da coleta.”',
           45,
           currentY + 16,
           { width: pageWidth - 20, align: 'justify', lineGap: 1 }
         );

      currentY += 54;

      // === CAMPOS DE ASSINATURA (SEÇÃO 9.5 e 9.6) ===
      const boxWidth = (pageWidth - 10) / 2;

      // Box do Transportador (Esquerda)
      doc.rect(35, currentY, boxWidth, 125).fillAndStroke('#ffffff', '#94a3b8');
      doc.fillColor('#0f2b46').fontSize(8).font('Helvetica-Bold')
         .text('RESPONSÁVEL PELA RETIRADA (TRANSPORTADOR)', 42, currentY + 8);

      doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
      doc.text(`Nome completo: ${coletaData.motorista_nome || '_____________________________________'}`, 42, currentY + 22);
      doc.text(`CPF ou Documento: ${coletaData.motorista_documento || '__________________________________'}`, 42, currentY + 36);
      doc.text(`Transportadora: ${(coletaData.transportadora_nome || '').slice(0, 32)}`, 42, currentY + 50);
      doc.text(`Placa do veículo: ${coletaData.placa_veiculo || '_________'}   Data: ___/___/______   Hora: ___:___`, 42, currentY + 64);

      // Linha de assinatura
      doc.strokeColor('#64748b').lineWidth(0.8)
         .moveTo(42, currentY + 105).lineTo(35 + boxWidth - 15, currentY + 105).stroke();
      doc.fontSize(7).text('Assinatura do Responsável pela Retirada', 42, currentY + 110, { align: 'center', width: boxWidth - 20 });

      // Box da JANLUX (Direita)
      const rightBoxX = 35 + boxWidth + 10;
      doc.rect(rightBoxX, currentY, boxWidth, 125).fillAndStroke('#ffffff', '#94a3b8');
      doc.fillColor('#0f2b46').fontSize(8).font('Helvetica-Bold')
         .text('LIBERAÇÃO JANLUX ELÉTRICOS LTDA.', rightBoxX + 8, currentY + 8);

      doc.fillColor('#334155').fontSize(7.5).font('Helvetica');
      doc.text(`Funcionário responsável: ${coletaData.funcionario_liberacao || 'Sandra / Ivan'}`, rightBoxX + 8, currentY + 22);
      doc.text(`Data / Horário da Liberação: ${coletaData.data_retirada_formatada || coletaData.data_retirada} às ${coletaData.hora_retirada}`, rightBoxX + 8, currentY + 36);
      doc.text(`Observações: ${(coletaData.observacoes || 'Mercadoria conferida e liberada sem avarias aparentes.').slice(0, 48)}`, rightBoxX + 8, currentY + 50);

      // Linha de assinatura
      doc.strokeColor('#64748b').lineWidth(0.8)
         .moveTo(rightBoxX + 10, currentY + 105).lineTo(rightBoxX + boxWidth - 15, currentY + 105).stroke();
      doc.fontSize(7).text('Assinatura / Carimbo do Funcionário JANLUX', rightBoxX + 10, currentY + 110, { align: 'center', width: boxWidth - 20 });

      // === RODAPÉ DO DOCUMENTO ===
      doc.fillColor('#64748b').fontSize(6.8).font('Helvetica')
         .text(
           'JANLUX ELÉTRICOS LTDA. — Documento gerado automaticamente pelo Sistema de Expedição. Válido como comprovante legal de retirada física.',
           35,
           doc.page.height - 22,
           { align: 'center', width: pageWidth }
         );

      doc.end();

      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { gerarComprovantePDF };
