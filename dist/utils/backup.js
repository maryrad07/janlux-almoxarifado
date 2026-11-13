"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.criarBackup = criarBackup;
exports.listarBackups = listarBackups;
exports.restaurarBackup = restaurarBackup;
// src/utils/backup.ts — Utilitário de Backup e Restauração Local (SQLite)
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dbPath = node_path_1.default.join(__dirname, '..', '..', 'data', 'janlux.db');
const backupDir = node_path_1.default.join(__dirname, '..', '..', 'backups');
if (!node_fs_1.default.existsSync(backupDir)) {
    node_fs_1.default.mkdirSync(backupDir, { recursive: true });
}
function criarBackup() {
    if (!node_fs_1.default.existsSync(dbPath)) {
        throw new Error('Banco de dados não encontrado para backup.');
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `janlux-backup-${timestamp}.db`;
    const targetPath = node_path_1.default.join(backupDir, backupFileName);
    node_fs_1.default.copyFileSync(dbPath, targetPath);
    console.log(`[BACKUP] Backup criado com sucesso: ${targetPath}`);
    return {
        arquivo: backupFileName,
        caminho: targetPath,
        data: new Date().toLocaleString('pt-BR'),
        tamanhoBytes: node_fs_1.default.statSync(targetPath).size
    };
}
function listarBackups() {
    if (!node_fs_1.default.existsSync(backupDir))
        return [];
    const files = node_fs_1.default.readdirSync(backupDir).filter(f => f.endsWith('.db'));
    return files.map(f => {
        const filePath = node_path_1.default.join(backupDir, f);
        const stats = node_fs_1.default.statSync(filePath);
        return {
            nome: f,
            caminho: filePath,
            tamanhoBytes: stats.size,
            tamanhoKb: Math.round(stats.size / 1024),
            criadoEm: stats.birthtime.toLocaleString('pt-BR')
        };
    }).reverse();
}
function restaurarBackup(backupFileName) {
    const sourcePath = node_path_1.default.join(backupDir, backupFileName);
    if (!node_fs_1.default.existsSync(sourcePath)) {
        throw new Error(`Arquivo de backup não encontrado: ${backupFileName}`);
    }
    const safetyBackup = node_path_1.default.join(backupDir, `pre-restore-safety-${Date.now()}.db`);
    if (node_fs_1.default.existsSync(dbPath)) {
        node_fs_1.default.copyFileSync(dbPath, safetyBackup);
    }
    node_fs_1.default.copyFileSync(sourcePath, dbPath);
    console.log(`[BACKUP] Banco restaurado a partir de: ${sourcePath}`);
    return true;
}
