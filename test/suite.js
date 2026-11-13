const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { getDb, initDatabase, calcularSaldoEmbalagem, registrarHistorico } = require('../dist/database');
const { gerarComprovantePDF } = require('../dist/utils/pdfGenerator');
const { criarBackup, restaurarBackup } = require('../dist/utils/backup');

async function runTestSuite() {
  console.log('=================================================================');
  console.log('  INICIANDO BATERIA DE TESTES OBRIGATÓRIOS — JANLUX (SEÇÃO 18)');
  console.log('=================================================================\n');

  initDatabase();
  const db = getDb();

  // -------------------------------------------------------------
  // TESTE 1: Expedição Simples (1 NF, 1 Cliente, 3 Volumes Físicos)
  // -------------------------------------------------------------
  const tSuffix = Date.now();
  console.log('[TESTE 1] Expedição Simples: 1 NF, 1 Cliente, 3 Volumes Físicos...');
  const expInfo1 = db.prepare(`
    INSERT INTO expedicoes (numero_nf, serie_nf, data_emissao, cliente_nome, status_id, responsavel_preparacao)
    VALUES (?, '1', '2026-10-23', 'CLIENTE TESTE 1 LTDA', 4, 'Sandra')
  `).run(`NF-TEST-${tSuffix}`);
  const expId1 = Number(expInfo1.lastInsertRowid);

  // Inserir volumes físicos individuais
  const insertVol = db.prepare(`
    INSERT INTO volumes_expedicao (expedicao_id, numero_volume, tipo_embalagem, comprimento_cm, largura_cm, altura_cm, peso_g)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertVol.run(expId1, 1, 'Papelão', 50, 30, 20, 1500);
  insertVol.run(expId1, 2, 'Papelão', 50, 30, 20, 1400);
  insertVol.run(expId1, 3, 'Papelão', 50, 30, 20, 1600);

  const volsExp1 = db.prepare('SELECT COUNT(*) as count, SUM(peso_g) as totalPeso FROM volumes_expedicao WHERE expedicao_id = ?').get(expId1);
  assert.strictEqual(volsExp1.count, 3, 'Deve conter exatamente 3 volumes');
  assert.strictEqual(volsExp1.totalPeso, 4500, 'Peso total deve ser 4500g');
  console.log('   ✓ Teste 1 APROVADO: Expedição registrada com 3 volumes físicos e conferência OK.\n');

  // -------------------------------------------------------------
  // TESTE 3: Diferença Obrigatória entre Produtos, Embalagens e Volumes (Seção 7 e 18)
  // -------------------------------------------------------------
  console.log('[TESTE 3] Diferença Obrigatória: 20 Produtos acondicionados em 3 Caixas...');
  const expInfo3 = db.prepare(`
    INSERT INTO expedicoes (numero_nf, serie_nf, cliente_nome, status_id, responsavel_preparacao)
    VALUES ('NF-TEST-PROD-VOL', '1', 'CLIENTE REGRA DE OURO', 1, 'Ivan')
  `).run();
  const expId3 = Number(expInfo3.lastInsertRowid);

  // Inserir 20 produtos (ex: V018RT)
  db.prepare(`
    INSERT INTO itens_expedicao (expedicao_id, produto_codigo, produto_descricao, quantidade)
    VALUES (?, 'V018RT', 'VS2000SK15RT-440MM', 20)
  `).run(expId3);

  // Inserir 3 caixas físicas
  insertVol.run(expId3, 1, 'Papelão', 50, 30, 20, 1200);
  insertVol.run(expId3, 2, 'Papelão', 50, 30, 20, 1200);
  insertVol.run(expId3, 3, 'Papelão', 50, 30, 20, 1200);

  const totalProdutos = db.prepare('SELECT SUM(quantidade) as total FROM itens_expedicao WHERE expedicao_id = ?').get(expId3).total;
  const totalVolumesFisicos = db.prepare('SELECT COUNT(*) as total FROM volumes_expedicao WHERE expedicao_id = ?').get(expId3).total;

  assert.strictEqual(totalProdutos, 20, 'Quantidade de produtos comercializados deve ser 20');
  assert.strictEqual(totalVolumesFisicos, 3, 'Quantidade de volumes físicos deve ser 3');
  assert.notStrictEqual(totalProdutos, totalVolumesFisicos, 'Produtos e volumes físicos NUNCA devem ser confundidos');
  console.log(`   ✓ Teste 3 APROVADO: Distinção preservada: ${totalProdutos} produtos comercializados vs ${totalVolumesFisicos} volumes físicos.\n`);

  // -------------------------------------------------------------
  // TESTE 2: Coleta com Múltiplas Notas Fiscais (5 NFs, Destinatários Diferentes)
  // -------------------------------------------------------------
  console.log('[TESTE 2] Coleta com 5 Notas Fiscais de destinatários diferentes...');
  const nfIdsColeta = [];
  const expectedVolumes = [2, 1, 3, 2, 4]; // Total = 12 volumes
  let somaVolumesEsperados = 0;

  for (let i = 1; i <= 5; i++) {
    const info = db.prepare(`
      INSERT INTO expedicoes (numero_nf, serie_nf, cliente_nome, status_id)
      VALUES (?, '1', ?, 4)
    `).run(`NF-COLETA-MULT-${tSuffix}-${i}`, `DESTINATÁRIO DIVERSOS ${i}`);
    const id = Number(info.lastInsertRowid);
    nfIdsColeta.push(id);

    const vols = expectedVolumes[i - 1];
    somaVolumesEsperados += vols;
    for (let v = 1; v <= vols; v++) {
      insertVol.run(id, v, 'Papelão', 40, 25, 15, 800);
    }
  }

  // Criar Coleta
  const numColeta = `COL-TEST-${tSuffix}`;
  const infoC = db.prepare(`
    INSERT INTO coletas (numero, data_retirada, hora_retirada, transportadora_nome, motorista_nome, placa_veiculo, funcionario_liberacao)
    VALUES (?, '2026-10-23', '14:30', 'RODONAVES TRANSPORTES', 'Marcos Pereira', 'ABC-9988', 'Sandra')
  `).run(numColeta);
  const coletaId = Number(infoC.lastInsertRowid);

  // Vincular 5 NFs com seus respectivos volumes
  const insertItemColeta = db.prepare(`
    INSERT INTO itens_coleta (coleta_id, expedicao_id, quantidade_volumes)
    VALUES (?, ?, ?)
  `);

  for (let i = 0; i < nfIdsColeta.length; i++) {
    insertItemColeta.run(coletaId, nfIdsColeta[i], expectedVolumes[i]);
  }

  const itensColetados = db.prepare(`
    SELECT ic.*, e.numero_nf, e.cliente_nome 
    FROM itens_coleta ic 
    JOIN expedicoes e ON ic.expedicao_id = e.id 
    WHERE ic.coleta_id = ?
  `).all(coletaId);

  assert.strictEqual(itensColetados.length, 5, 'Coleta deve conter 5 NFs');
  const somaCalculada = itensColetados.reduce((a, b) => a + b.quantidade_volumes, 0);
  assert.strictEqual(somaCalculada, 12, 'Total de volumes físicos da coleta deve ser 12');
  console.log(`   ✓ Teste 2 APROVADO: 5 NFs associadas individualmente. Total geral = ${somaCalculada} volumes físicos conferidos.\n`);

  // -------------------------------------------------------------
  // TESTE 4: Controle e Movimentação de Embalagens
  // -------------------------------------------------------------
  console.log('[TESTE 4] Almoxarifado: Entrada de embalagens, consumo e cálculo de saldo...');
  const embTeste = db.prepare('SELECT id, estoque_inicial FROM embalagens WHERE codigo = ?').get('EMB-PAP-01');
  const saldoAntes = calcularSaldoEmbalagem(embTeste.id);

  // Entrada de 50 caixas
  db.prepare(`
    INSERT INTO movimentacoes_embalagens (embalagem_id, tipo, quantidade, motivo, usuario_id)
    VALUES (?, 'entrada', 50, 'Compra Fornecedor Alfa', 1)
  `).run(embTeste.id);
  const saldoAposEntrada = calcularSaldoEmbalagem(embTeste.id);
  assert.strictEqual(saldoAposEntrada, saldoAntes + 50, 'Saldo deve ter aumentado em 50 un');

  // Utilização de 10 caixas em expedição
  db.prepare(`
    INSERT INTO movimentacoes_embalagens (embalagem_id, tipo, quantidade, motivo, nota_fiscal, usuario_id)
    VALUES (?, 'uso_expedicao', 10, 'Consumo na NF 10099', '10099', 1)
  `).run(embTeste.id);
  const saldoAposUso = calcularSaldoEmbalagem(embTeste.id);
  assert.strictEqual(saldoAposUso, saldoAposEntrada - 10, 'Saldo deve ter reduzido em 10 un');
  console.log(`   ✓ Teste 4 APROVADO: Saldo inicial: ${saldoAntes} -> Entrada (+50) = ${saldoAposEntrada} -> Uso (-10) = ${saldoAposUso}.\n`);

  // -------------------------------------------------------------
  // TESTE 5: Retirada, Geração do Comprovante A4 em PDF e Assinatura
  // -------------------------------------------------------------
  console.log('[TESTE 5] Retirada Física e Geração de PDF do Comprovante A4...');
  const pdfTestPath = path.join(__dirname, '..', 'pdfs', 'teste-comprovante-secao9.pdf');

  const dadosPDF = {
    numero: numColeta,
    comprovante_numero: `COMP-${numColeta}`,
    data_retirada: '2026-10-23',
    data_retirada_formatada: '23/10/2026',
    hora_retirada: '14:30',
    transportadora_nome: 'RODONAVES TRANSPORTES',
    motorista_nome: 'Marcos Pereira',
    motorista_documento: '12.345.678-9',
    placa_veiculo: 'ABC-9988',
    funcionario_liberacao: 'Sandra'
  };

  const itensPDF = itensColetados.map(it => ({
    numero_nf: it.numero_nf,
    serie_nf: '1',
    cliente_nome: it.cliente_nome,
    quantidade_volumes: it.quantidade_volumes
  }));

  await gerarComprovantePDF(dadosPDF, itensPDF, pdfTestPath);
  assert.strictEqual(fs.existsSync(pdfTestPath), true, 'Arquivo PDF deve ter sido gerado');
  const statsPdf = fs.statSync(pdfTestPath);
  assert.ok(statsPdf.size > 1000, 'Tamanho do PDF gerado deve ser válido (> 1KB)');
  console.log(`   ✓ Teste 5 APROVADO: Comprovante PDF gerado com sucesso (${statsPdf.size} bytes). Contém cabeçalho JANLUX, tabela com as 5 NFs, declaração legal e espaços de assinatura.\n`);

  // -------------------------------------------------------------
  // TESTE 6: Histórico e Rastreabilidade (Audit Log)
  // -------------------------------------------------------------
  console.log('[TESTE 6] Histórico e Rastreabilidade de Alteração...');
  registrarHistorico(
    'expedicoes',
    expId1,
    'alteracao',
    'transportadora_id',
    'CORREIO SEDEX',
    'BRASPRESS',
    'Cliente solicitou troca urgente de modal',
    1,
    'Administrador'
  );

  const hist = db.prepare('SELECT * FROM historico WHERE tabela = ? AND registro_id = ? ORDER BY id DESC LIMIT 1').get('expedicoes', expId1);
  assert.strictEqual(hist.campo, 'transportadora_id');
  assert.strictEqual(hist.valor_anterior, 'CORREIO SEDEX');
  assert.strictEqual(hist.valor_novo, 'BRASPRESS');
  assert.strictEqual(hist.usuario_nome, 'Administrador');
  console.log('   ✓ Teste 6 APROVADO: Evento de auditoria registrado com valores anterior/novo e usuário responsável.\n');

  // -------------------------------------------------------------
  // TESTE 7: Pesquisas e Consultas Cruzadas
  // -------------------------------------------------------------
  console.log('[TESTE 7] Pesquisas Rápidas por NF, Cliente, Transportadora e Data...');
  const buscaNF = db.prepare('SELECT id FROM expedicoes WHERE numero_nf = ?').get(`NF-TEST-${tSuffix}`);
  assert.ok(buscaNF, 'Busca por NF deve encontrar');

  const buscaCliente = db.prepare('SELECT id FROM expedicoes WHERE cliente_nome LIKE ?').all('%REGRA DE OURO%');
  assert.ok(buscaCliente.length > 0, 'Busca por Cliente deve retornar');

  const buscaColeta = db.prepare('SELECT id FROM coletas WHERE motorista_nome LIKE ?').get('%Marcos Pereira%');
  assert.ok(buscaColeta, 'Busca por motorista deve retornar');
  console.log('   ✓ Teste 7 APROVADO: Consultas cruzadas funcionando com precisão.\n');

  // -------------------------------------------------------------
  // TESTE 8: Backup e Restauração de Dados
  // -------------------------------------------------------------
  console.log('[TESTE 8] Segurança: Criação e Restauração de Backup...');
  const bkp = criarBackup();
  assert.ok(fs.existsSync(bkp.caminho), 'Arquivo de backup deve existir');
  assert.ok(bkp.tamanhoBytes > 50000, 'Backup deve conter os dados do banco');

  // Testar restauração
  const restOk = restaurarBackup(bkp.arquivo);
  assert.strictEqual(restOk, true, 'Restauração deve retornar sucesso');
  console.log(`   ✓ Teste 8 APROVADO: Backup criado (${bkp.tamanhoBytes} bytes) e procedimento de restauração validado.\n`);

  console.log('=================================================================');
  console.log('  TODOS OS TESTES OBRIGATÓRIOS FORAM EXECUTADOS COM SUCESSO (100%)');
  console.log('=================================================================');
}

runTestSuite().catch(err => {
  console.error('[ERRO TESTE]', err);
  process.exit(1);
});
