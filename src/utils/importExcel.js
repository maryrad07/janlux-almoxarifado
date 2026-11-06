const path = require('node:path');
const ExcelJS = require('exceljs');
const { getDb, initDatabase } = require('../database');

async function importExcel(filePath) {
  console.log(`[IMPORT] Iniciando importação de: ${filePath}`);
  initDatabase();
  const db = getDb();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  function formatDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return val.toISOString().slice(0, 10);
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
      if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
        const parts = trimmed.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return trimmed;
    }
    return null;
  }

  function formatTime(val) {
    if (!val) return null;
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      const h = String(val.getUTCHours()).padStart(2, '0');
      const m = String(val.getUTCMinutes()).padStart(2, '0');
      const s = String(val.getUTCSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    if (typeof val === 'string') {
      const match = val.match(/\d{1,2}:\d{2}(:\d{2})?/);
      if (match) return match[0];
      return val.trim();
    }
    return null;
  }

  function cleanString(val) {
    if (val === null || val === undefined) return '';
    return String(val).trim();
  }

  // 1. IMPORT PRODUTOS
  console.log('[IMPORT] Importando Produtos...');
  const wsProdutos = wb.getWorksheet('Produtos');
  let countProdutos = 0;
  if (wsProdutos) {
    const insertProd = db.prepare(`
      INSERT INTO produtos (codigo, descricao, unidade_medida, ativo)
      VALUES (?, ?, 'UN', 1)
      ON CONFLICT(codigo) DO UPDATE SET descricao = excluded.descricao
    `);
    
    wsProdutos.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header
      const cod = cleanString(row.getCell(1).value);
      const desc = cleanString(row.getCell(2).value);
      if (cod) {
        insertProd.run(cod, desc || cod);
        countProdutos++;
      }
    });
  }
  console.log(`[IMPORT] ${countProdutos} produtos processados.`);

  // 2. IMPORT TRANSPORTADORAS
  console.log('[IMPORT] Importando Transportadoras...');
  const wsTransp = wb.getWorksheet('Transportadoras');
  let countTransp = 0;
  const transpMap = new Map(); // nome_normalizado -> id

  // Load existing carriers
  const existingTransp = db.prepare('SELECT id, nome FROM transportadoras').all();
  for (const t of existingTransp) {
    transpMap.set(t.nome.trim().toUpperCase(), t.id);
  }

  if (wsTransp) {
    const insertTransp = db.prepare(`
      INSERT INTO transportadoras (nome, ativo)
      VALUES (?, 1)
    `);
    wsTransp.eachRow((row, rowNumber) => {
      const nome = cleanString(row.getCell(2).value || row.getCell(1).value);
      if (nome && nome.toUpperCase() !== 'TRANSPORTADORA' && !transpMap.has(nome.toUpperCase())) {
        const info = insertTransp.run(nome);
        transpMap.set(nome.toUpperCase(), Number(info.lastInsertRowid));
        countTransp++;
      }
    });
  }
  console.log(`[IMPORT] ${countTransp} novas transportadoras adicionadas.`);

  // 3. IMPORT EMBALAGENS (Caixa sheet)
  console.log('[IMPORT] Verificando Embalagens...');
  const wsCaixa = wb.getWorksheet('Caixa');
  const embMap = new Map(); // nome_normalizado -> id
  const existingEmbs = db.prepare('SELECT id, codigo, descricao FROM embalagens').all();
  for (const e of existingEmbs) {
    embMap.set(e.descricao.trim().toUpperCase(), e.id);
    embMap.set(e.codigo.trim().toUpperCase(), e.id);
  }

  if (wsCaixa) {
    const insertEmb = db.prepare(`
      INSERT INTO embalagens (codigo, descricao, unidade, ativo)
      VALUES (?, ?, 'UN', 1)
      ON CONFLICT(codigo) DO UPDATE SET descricao = excluded.descricao
    `);
    let embIdx = 1;
    wsCaixa.eachRow((row, rowNumber) => {
      const tipo = cleanString(row.getCell(2).value || row.getCell(1).value);
      if (tipo && !embMap.has(tipo.toUpperCase())) {
        const cod = `EMB-CX-${String(embIdx++).padStart(2, '0')}`;
        const info = insertEmb.run(cod, tipo);
        embMap.set(tipo.toUpperCase(), Number(info.lastInsertRowid));
      }
    });
  }

  // Load status map
  const statusMap = new Map();
  const allStatus = db.prepare('SELECT id, nome FROM status_expedicao').all();
  for (const s of allStatus) {
    statusMap.set(s.nome.trim().toUpperCase(), s.id);
  }
  const defaultStatusId = statusMap.get('COLETADA/EXPEDIDA') || allStatus[0]?.id || 1;
  const despachadaStatusId = statusMap.get('COLETADA/EXPEDIDA') || 6;
  const aguardandoStatusId = statusMap.get('AGUARDANDO PREPARAÇÃO') || 1;
  const canceladaStatusId = statusMap.get('CANCELADA') || 7;

  // Cache clientes
  const clientMap = new Map();
  const existingClients = db.prepare('SELECT id, razao_social FROM clientes').all();
  for (const c of existingClients) {
    clientMap.set(c.razao_social.trim().toUpperCase(), c.id);
  }
  const insertClient = db.prepare(`
    INSERT INTO clientes (razao_social, ativo)
    VALUES (?, 1)
  `);

  function getOrCreateClient(clientName) {
    if (!clientName) return null;
    const norm = clientName.trim().toUpperCase();
    if (clientMap.has(norm)) return clientMap.get(norm);
    const info = insertClient.run(clientName.trim());
    const newId = Number(info.lastInsertRowid);
    clientMap.set(norm, newId);
    return newId;
  }

  function getOrCreateCarrier(carrierName) {
    if (!carrierName) return null;
    const norm = carrierName.trim().toUpperCase();
    if (transpMap.has(norm)) return transpMap.get(norm);
    const insertT = db.prepare('INSERT INTO transportadoras (nome, ativo) VALUES (?, 1)');
    const info = insertT.run(carrierName.trim());
    const newId = Number(info.lastInsertRowid);
    transpMap.set(norm, newId);
    return newId;
  }

  // 4. IMPORT EXPEDICOES MAIN SHEET
  console.log('[IMPORT] Importando Expedições de "Controle Almoxarifado 2026"...');
  const wsMain = wb.getWorksheet('Controle Almoxarifado 2026');
  let countExpedicoes = 0;
  let countItens = 0;
  let countVolumes = 0;

  if (wsMain) {
    const insertExp = db.prepare(`
      INSERT INTO expedicoes (
        numero_nf, serie_nf, data_emissao, cliente_id, cliente_nome,
        transportadora_id, status_id, data_disponibilizacao, hora_disponibilizacao,
        data_pronta, hora_pronta, responsavel_preparacao, responsavel_conferencia,
        conferencia_realizada, conferencia_observacoes, observacoes, anotacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO itens_expedicao (expedicao_id, produto_id, produto_codigo, produto_descricao, quantidade)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertVol = db.prepare(`
      INSERT INTO volumes_expedicao (
        expedicao_id, numero_volume, embalagem_id, tipo_embalagem,
        comprimento_cm, largura_cm, altura_cm, peso_g, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Cache products for fast lookup
    const prodMap = new Map();
    const allProds = db.prepare('SELECT id, codigo, descricao FROM produtos').all();
    for (const p of allProds) {
      prodMap.set(p.codigo.trim().toUpperCase(), p);
    }

    wsMain.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Header

      const dataOpRaw = row.getCell(1).value;
      const clienteNome = cleanString(row.getCell(2).value);
      const nfRaw = cleanString(row.getCell(3).value);
      const transpNome = cleanString(row.getCell(4).value);
      const statusRaw = cleanString(row.getCell(5).value);

      // If no customer and no NF, skip empty rows
      if (!clienteNome && !nfRaw) return;

      const dataOp = formatDate(dataOpRaw);
      const clienteId = clienteNome ? getOrCreateClient(clienteNome) : null;
      const transportadoraId = transpNome ? getOrCreateCarrier(transpNome) : null;

      // Status mapping
      let statusId = despachadaStatusId;
      const sNorm = statusRaw.toUpperCase();
      if (sNorm.includes('A DESPACHAR') || sNorm.includes('A COLETAR')) {
        statusId = aguardandoStatusId;
      } else if (sNorm.includes('CANCELADA')) {
        statusId = canceladaStatusId;
      }

      // Notes & Conference
      const caixaTipo = cleanString(row.getCell(22).value);
      const compCm = Number(row.getCell(23).value) || 0;
      const largCm = Number(row.getCell(24).value) || 0;
      const altCm = Number(row.getCell(25).value) || 0;
      const pesoG = Number(row.getCell(26).value) || 0;
      const qtdVolumesFisicos = parseInt(row.getCell(27).value, 10) || 1;
      const obsGeral = cleanString(row.getCell(28).value);
      const confStatus = cleanString(row.getCell(29).value).toUpperCase() === 'SIM' ? 1 : 0;
      const dataNf = formatDate(row.getCell(30).value) || dataOp;
      const horaDesceu = formatTime(row.getCell(31).value);
      const horaPronta = formatTime(row.getCell(32).value);
      const responsavel = cleanString(row.getCell(33).value);
      const anotacoes = cleanString(row.getCell(34).value);

      const expInfo = insertExp.run(
        nfRaw || 'S/N',
        '1',
        dataNf,
        clienteId,
        clienteNome,
        transportadoraId,
        statusId,
        dataOp,
        horaDesceu,
        dataOp,
        horaPronta,
        responsavel,
        confStatus ? responsavel : null,
        confStatus,
        confStatus ? 'Conferido na planilha original' : 'Pendente de conferência',
        obsGeral,
        anotacoes
      );
      const expedicaoId = Number(expInfo.lastInsertRowid);
      countExpedicoes++;

      // Insert Items (cols 6/7, 8/9, 10/11, 12/13, 14/15, 16/17, 18/19, 20/21)
      const itemCols = [
        [6, 7],
        [8, 9],
        [10, 11],
        [12, 13],
        [14, 15],
        [16, 17],
        [18, 19],
        [20, 21]
      ];

      for (const [codCol, qtdCol] of itemCols) {
        const prodCod = cleanString(row.getCell(codCol).value);
        const prodQtd = parseInt(row.getCell(qtdCol).value, 10) || 0;
        if (prodCod) {
          const prodObj = prodMap.get(prodCod.toUpperCase());
          insertItem.run(
            expedicaoId,
            prodObj ? prodObj.id : null,
            prodCod,
            prodObj ? prodObj.descricao : prodCod,
            prodQtd > 0 ? prodQtd : 1
          );
          countItens++;
        }
      }

      // Insert Volumes (at least 1 physical volume per expedition)
      const numVols = Math.max(1, qtdVolumesFisicos);
      const embId = caixaTipo ? embMap.get(caixaTipo.toUpperCase()) || null : null;
      for (let v = 1; v <= numVols; v++) {
        insertVol.run(
          expedicaoId,
          v,
          embId,
          caixaTipo || 'Papelão',
          compCm,
          largCm,
          altCm,
          pesoG > 0 ? Math.round(pesoG / numVols) : 0,
          numVols > 1 ? `Volume ${v} de ${numVols}` : ''
        );
        countVolumes++;
      }
    });
  }

  // 5. IMPORT Planilha3 (KAUA single row)
  const wsP3 = wb.getWorksheet('Planilha3');
  if (wsP3) {
    wsP3.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const clienteNome = cleanString(row.getCell(2).value);
      if (!clienteNome) return;
      const nfRaw = cleanString(row.getCell(3).value) || 'S/N';
      const clienteId = getOrCreateClient(clienteNome);
      const prodDesc = cleanString(row.getCell(6).value);
      const qtd = parseInt(row.getCell(7).value, 10) || 1;
      const comp = Number(row.getCell(8).value) || 0;
      const larg = Number(row.getCell(9).value) || 0;
      const alt = Number(row.getCell(10).value) || 0;
      const peso = Number(row.getCell(11).value) || 0;
      const resp = cleanString(row.getCell(14).value);

      const insertExp = db.prepare(`
        INSERT INTO expedicoes (
          numero_nf, serie_nf, data_emissao, cliente_id, cliente_nome,
          status_id, responsavel_preparacao, observacoes
        ) VALUES (?, '1', date('now','localtime'), ?, ?, ?, ?, 'Importado de Planilha3')
      `);
      const info = insertExp.run(nfRaw, clienteId, clienteNome, despachadaStatusId, resp);
      const expId = Number(info.lastInsertRowid);
      countExpedicoes++;

      // Insert item
      const insertItem = db.prepare(`
        INSERT INTO itens_expedicao (expedicao_id, produto_codigo, produto_descricao, quantidade)
        VALUES (?, ?, ?, ?)
      `);
      insertItem.run(expId, 'DIVERSOS', prodDesc, qtd);
      countItens++;

      // Insert volume
      const insertVol = db.prepare(`
        INSERT INTO volumes_expedicao (
          expedicao_id, numero_volume, tipo_embalagem, comprimento_cm, largura_cm, altura_cm, peso_g
        ) VALUES (?, 1, 'Papelão', ?, ?, ?, ?)
      `);
      insertVol.run(expId, comp, larg, alt, peso);
      countVolumes++;
    });
  }

  console.log(`[IMPORT] Importação concluída com sucesso!`);
  console.log(`[IMPORT] Total de Expedições: ${countExpedicoes}`);
  console.log(`[IMPORT] Total de Itens de NF: ${countItens}`);
  console.log(`[IMPORT] Total de Volumes Físicos: ${countVolumes}`);
  console.log(`[IMPORT] Total de Clientes Cadastrados: ${clientMap.size}`);
  console.log(`[IMPORT] Total de Transportadoras: ${transpMap.size}`);

  return {
    expedicoes: countExpedicoes,
    itens: countItens,
    volumes: countVolumes,
    clientes: clientMap.size,
    transportadoras: transpMap.size,
    produtos: countProdutos
  };
}

if (require.main === module) {
  const defaultPath = path.join(
    'C:',
    'Users',
    'Usuário',
    '.gemini',
    'antigravity',
    'brain',
    'e7954bb4-8d40-4fcb-aec5-8b3813df2175',
    '.user_uploaded',
    'media_1792779141572_3fcc9dc3.xlsx'
  );
  importExcel(process.argv[2] || defaultPath)
    .then(stats => {
      console.log('Resultados da importação:', stats);
      process.exit(0);
    })
    .catch(err => {
      console.error('Erro na importação:', err);
      process.exit(1);
    });
}

module.exports = { importExcel };
