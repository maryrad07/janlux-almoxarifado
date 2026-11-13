"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProduction = void 0;
exports.convertQuery = convertQuery;
exports.all = all;
exports.get = get;
exports.run = run;
exports.historico = historico;
exports.saldoEmbalagem = saldoEmbalagem;
// src/utils/db-helper.ts
const pgDb = __importStar(require("../database-pg"));
const sqliteDb = __importStar(require("../database-sqlite"));
exports.isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
function convertQuery(sql, params = []) {
    if (!exports.isProduction)
        return { sql, params };
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const finalSql = pgSql
        .replace(/datetime\('now','localtime'\)/g, 'NOW()')
        .replace(/datetime\('now'\)/g, 'NOW()')
        .replace(/AUTOINCREMENT/g, '')
        .replace(/INTEGER PRIMARY KEY/g, 'SERIAL PRIMARY KEY')
        .replace(/COALESCE\(/g, 'COALESCE(')
        .replace(/lastInsertRowid/g, 'id');
    return { sql: finalSql, params };
}
async function all(sql, params = []) {
    if (exports.isProduction) {
        const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
        const result = await pgDb.query(pgSql, pgParams);
        return result.rows;
    }
    else {
        const db = sqliteDb.getDb();
        return db.prepare(sql).all(...params);
    }
}
async function get(sql, params = []) {
    if (exports.isProduction) {
        const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
        const result = await pgDb.query(pgSql, pgParams);
        return result.rows[0] || null;
    }
    else {
        const db = sqliteDb.getDb();
        return db.prepare(sql).get(...params) || null;
    }
}
async function run(sql, params = []) {
    if (exports.isProduction) {
        const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
        let finalSql = pgSql;
        if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.includes('RETURNING')) {
            finalSql = pgSql + ' RETURNING id';
        }
        const result = await pgDb.query(finalSql, pgParams);
        const rowId = result.rows[0]?.id ? Number(result.rows[0].id) : null;
        return {
            id: rowId,
            changes: result.rowCount || 0,
            lastInsertRowid: rowId
        };
    }
    else {
        const db = sqliteDb.getDb();
        const info = db.prepare(sql).run(...params);
        const rowId = info.lastInsertRowid ? Number(info.lastInsertRowid) : null;
        return {
            id: rowId,
            changes: info.changes || 0,
            lastInsertRowid: rowId
        };
    }
}
async function historico(tabela, registroId, acao, campo, anterior, novo, motivo, userId, userNome) {
    if (exports.isProduction) {
        await pgDb.registrarHistorico(tabela, registroId, acao, campo, anterior, novo, motivo, userId, userNome);
    }
    else {
        sqliteDb.registrarHistorico(tabela, registroId, acao, campo, anterior, novo, motivo, userId, userNome);
    }
}
async function saldoEmbalagem(id) {
    if (exports.isProduction) {
        return await pgDb.calcularSaldoEmbalagem(id);
    }
    else {
        return sqliteDb.calcularSaldoEmbalagem(id);
    }
}
const db = {
    all,
    get,
    run,
    historico,
    saldoEmbalagem,
    isProduction: exports.isProduction,
    convertQuery
};
exports.default = db;
