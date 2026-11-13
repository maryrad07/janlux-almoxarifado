// src/utils/importExcel.ts — Importador de planilhas Excel para SQLite/PostgreSQL
import path from 'node:path';
import ExcelJS from 'exceljs';
import { getDb, initDatabase } from '../database';

export async function importExcel(filePath: string): Promise<void> {
  console.log(`[IMPORT] Iniciando importação de: ${filePath}`);
  initDatabase();
  const db = getDb();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  function formatDate(val: any): string | null {
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

  function formatTime(val: any): string | null {
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

  function cleanString(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val).trim();
  }

  // 1. IMPORT PRODUTOS
  console.log('[IMPORT] Importando Produtos...');
  const wsProdutos = wb.getWorksheet('Produtos');
  let countProdutos = 0;
  if (wsProdutos && db.prepare) {
    const insertProd = db.prepare(`
      INSERT INTO produtos (codigo, descricao, unidade_medida, ativo)
      VALUES (?, ?, 'UN', 1)
      ON CONFLICT(codigo) DO UPDATE SET descricao = excluded.descricao
    `);

    wsProdutos.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;
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
  if (wsTransp && db.prepare) {
    const insertTransp = db.prepare(`
      INSERT INTO transportadoras (nome, ativo)
      VALUES (?, 1)
      ON CONFLICT(nome) DO NOTHING
    `);

    wsTransp.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;
      const nome = cleanString(row.getCell(1).value);
      if (nome) {
        insertTransp.run(nome);
        countTransp++;
      }
    });
  }
  console.log(`[IMPORT] ${countTransp} transportadoras processadas.`);
}
