// src/utils/backup.ts — Utilitário de Backup e Restauração Local (SQLite)
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join(__dirname, '..', '..', 'data', 'janlux.db');
const backupDir = path.join(__dirname, '..', '..', 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

export interface BackupResult {
  arquivo: string;
  caminho: string;
  data: string;
  tamanhoBytes: number;
}

export interface BackupInfo {
  nome: string;
  caminho: string;
  tamanhoBytes: number;
  tamanhoKb: number;
  criadoEm: string;
}

export function criarBackup(): BackupResult {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Banco de dados não encontrado para backup.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `janlux-backup-${timestamp}.db`;
  const targetPath = path.join(backupDir, backupFileName);

  fs.copyFileSync(dbPath, targetPath);
  console.log(`[BACKUP] Backup criado com sucesso: ${targetPath}`);

  return {
    arquivo: backupFileName,
    caminho: targetPath,
    data: new Date().toLocaleString('pt-BR'),
    tamanhoBytes: fs.statSync(targetPath).size
  };
}

export function listarBackups(): BackupInfo[] {
  if (!fs.existsSync(backupDir)) return [];
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
  return files.map(f => {
    const filePath = path.join(backupDir, f);
    const stats = fs.statSync(filePath);
    return {
      nome: f,
      caminho: filePath,
      tamanhoBytes: stats.size,
      tamanhoKb: Math.round(stats.size / 1024),
      criadoEm: stats.birthtime.toLocaleString('pt-BR')
    };
  }).reverse();
}

export function restaurarBackup(backupFileName: string): boolean {
  const sourcePath = path.join(backupDir, backupFileName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Arquivo de backup não encontrado: ${backupFileName}`);
  }

  const safetyBackup = path.join(backupDir, `pre-restore-safety-${Date.now()}.db`);
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, safetyBackup);
  }

  fs.copyFileSync(sourcePath, dbPath);
  console.log(`[BACKUP] Banco restaurado a partir de: ${sourcePath}`);
  return true;
}
