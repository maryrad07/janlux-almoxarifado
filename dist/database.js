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
exports.getDb = getDb;
exports.initDatabase = initDatabase;
exports.registrarHistorico = registrarHistorico;
exports.calcularSaldoEmbalagem = calcularSaldoEmbalagem;
// src/database.ts — Adaptador para Supabase/PostgreSQL (produção) + SQLite (local)
const pgDb = __importStar(require("./database-pg"));
const sqliteDb = __importStar(require("./database-sqlite"));
const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
function getDb() {
    return isProduction ? pgDb.getDb() : sqliteDb.getDb();
}
function initDatabase() {
    return isProduction ? pgDb.initDatabase() : sqliteDb.initDatabase();
}
function registrarHistorico(tabela, registroId, acao, campo, valorAnterior, valorNovo, motivo, usuarioId, usuarioNome) {
    return isProduction
        ? pgDb.registrarHistorico(tabela, registroId, acao, campo, valorAnterior, valorNovo, motivo, usuarioId, usuarioNome)
        : sqliteDb.registrarHistorico(tabela, registroId, acao, campo, valorAnterior, valorNovo, motivo, usuarioId, usuarioNome);
}
function calcularSaldoEmbalagem(embalagemId) {
    return isProduction
        ? pgDb.calcularSaldoEmbalagem(embalagemId)
        : sqliteDb.calcularSaldoEmbalagem(embalagemId);
}
