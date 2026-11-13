"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importExcel = importExcel;
const exceljs_1 = __importDefault(require("exceljs"));
const database_1 = require("../database");
async function importExcel(filePath) {
    console.log(`[IMPORT] Iniciando importação de: ${filePath}`);
    (0, database_1.initDatabase)();
    const db = (0, database_1.getDb)();
    const wb = new exceljs_1.default.Workbook();
    await wb.xlsx.readFile(filePath);
    function formatDate(val) {
        if (!val)
            return null;
        if (val instanceof Date) {
            if (isNaN(val.getTime()))
                return null;
            return val.toISOString().slice(0, 10);
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed))
                return trimmed.slice(0, 10);
            if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
                const parts = trimmed.split('/');
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return trimmed;
        }
        return null;
    }
    function formatTime(val) {
        if (!val)
            return null;
        if (val instanceof Date) {
            if (isNaN(val.getTime()))
                return null;
            const h = String(val.getUTCHours()).padStart(2, '0');
            const m = String(val.getUTCMinutes()).padStart(2, '0');
            const s = String(val.getUTCSeconds()).padStart(2, '0');
            return `${h}:${m}:${s}`;
        }
        if (typeof val === 'string') {
            const match = val.match(/\d{1,2}:\d{2}(:\d{2})?/);
            if (match)
                return match[0];
            return val.trim();
        }
        return null;
    }
    function cleanString(val) {
        if (val === null || val === undefined)
            return '';
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
        wsProdutos.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return;
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
        wsTransp.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return;
            const nome = cleanString(row.getCell(1).value);
            if (nome) {
                insertTransp.run(nome);
                countTransp++;
            }
        });
    }
    console.log(`[IMPORT] ${countTransp} transportadoras processadas.`);
}
