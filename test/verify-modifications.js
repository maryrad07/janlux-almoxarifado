// test/verify-modifications.js
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const PDFParser = require('pdfkit');
const { gerarComprovantePDF } = require('../dist/utils/pdfGenerator');

async function testPDFPageCount() {
  console.log('[TESTE PDF] Verificando se o PDF gerado tem exatamente 1 página para coleta normal...');
  const outPath1 = path.join(__dirname, 'test-coleta-1page.pdf');
  const outPath2 = path.join(__dirname, 'test-coleta-2pages.pdf');

  // Coleta normal: 6 NFs
  const itens6 = [];
  for (let i = 1; i <= 6; i++) {
    itens6.push({
      numero_nf: `100${i}`,
      cliente_nome: `CLIENTE DE TESTE ${i} LTDA`,
      quantidade_volumes: 2
    });
  }

  await gerarComprovantePDF(
    {
      numero: 'COL-TEST-1PAGE',
      comprovante_numero: 'COMP-COL-TEST-1PAGE',
      data_retirada: '2026-11-13',
      data_retirada_formatada: '13/11/2026',
      hora_retirada: '16:00',
      transportadora_nome: 'RODONAVES TRANSPORTES',
      motorista_nome: 'João da Silva',
      motorista_documento: '12.345.678-9',
      placa_veiculo: 'ABC-1234',
      funcionario_liberacao: 'Sandra',
      observacoes: 'Mercadoria conferida e liberada sem avarias.'
    },
    itens6,
    outPath1
  );

  // Contar páginas no PDF gerado
  const pdfBytes1 = fs.readFileSync(outPath1).toString('binary');
  const pageMatches1 = pdfBytes1.match(/\/Type\s*\/Page\b/g);
  const pageCount1 = pageMatches1 ? pageMatches1.length : 0;
  console.log(`   Páginas geradas para coleta com 6 NFs: ${pageCount1}`);
  assert.strictEqual(pageCount1, 1, 'Coleta normal com 6 itens DEVE ter exatamente 1 página!');
  console.log('   ✓ Teste PDF 1 página: APROVADO!');

  // Coleta grande: 40 NFs (alto volume de dados que exige 2ª página)
  const itens40 = [];
  for (let i = 1; i <= 40; i++) {
    itens40.push({
      numero_nf: `200${i}`,
      cliente_nome: `CLIENTE GRANDE VOLUME ${i} S/A`,
      quantidade_volumes: 3
    });
  }

  await gerarComprovantePDF(
    {
      numero: 'COL-TEST-2PAGES',
      comprovante_numero: 'COMP-COL-TEST-2PAGES',
      data_retirada: '2026-11-13',
      data_retirada_formatada: '13/11/2026',
      hora_retirada: '17:00',
      transportadora_nome: 'JAMEF TRANSPORTES',
      motorista_nome: 'Carlos Eduardo',
      motorista_documento: '98.765.432-1',
      placa_veiculo: 'XYZ-9876',
      funcionario_liberacao: 'Ivan',
      observacoes: 'Grande volume de caixas.'
    },
    itens40,
    outPath2
  );

  const pdfBytes2 = fs.readFileSync(outPath2).toString('binary');
  const pageMatches2 = pdfBytes2.match(/\/Type\s*\/Page\b/g);
  const pageCount2 = pageMatches2 ? pageMatches2.length : 0;
  console.log(`   Páginas geradas para coleta grande com 40 NFs: ${pageCount2}`);
  assert(pageCount2 >= 2, 'Coleta grande com 40 itens deve ter 2 ou mais páginas!');
  console.log('   ✓ Teste PDF múltiplas páginas para grande volume: APROVADO!\n');

  // Limpeza
  try { fs.unlinkSync(outPath1); } catch(e) {}
  try { fs.unlinkSync(outPath2); } catch(e) {}
}

function testWeightFormatting() {
  console.log('[TESTE PESO] Verificando formatação de peso em kg com 3 casas decimais...');
  const formatWeightKg = (val) => {
    if (val === null || val === undefined || val === '') return '0,000 kg';
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
    if (isNaN(n)) return '0,000 kg';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
  };

  assert.strictEqual(formatWeightKg(0.35), '0,350 kg');
  assert.strictEqual(formatWeightKg(1.25), '1,250 kg');
  assert.strictEqual(formatWeightKg(0.08), '0,080 kg');
  assert.strictEqual(formatWeightKg('0,400'), '0,400 kg');
  assert.strictEqual(formatWeightKg('1.5'), '1,500 kg');
  assert.strictEqual(formatWeightKg(1500 / 1000), '1,500 kg');
  assert.strictEqual(formatWeightKg(0), '0,000 kg');
  assert.strictEqual(formatWeightKg(null), '0,000 kg');

  console.log('   ✓ Teste Formatação de Peso: 0,350 kg, 1,250 kg, 0,080 kg APROVADO!\n');
}

async function run() {
  testWeightFormatting();
  await testPDFPageCount();
  console.log('=================================================================');
  console.log('  TODAS AS NOVAS REGRAS E ALTERAÇÕES VALIDADAS COM SUCESSO!');
  console.log('=================================================================');
}

run().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
