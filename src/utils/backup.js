const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'janlux.db');
const backupDir = path.join(__dirname, '..', '..', 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

function criarBackup() {
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

function listarBackups() {
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

function restaurarBackup(backupFileName) {
  const sourcePath = path.join(backupDir, backupFileName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Arquivo de backup não encontrado: ${backupFileName}`);
  }

  // Backup current state first
  const safetyBackup = path.join(backupDir, `pre-restore-safety-${Date.now()}.db`);
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, safetyBackup);
  }

  fs.copyFileSync(sourcePath, dbPath);
  console.log(`[BACKUP] Banco restaurado a partir de: ${sourcePath}`);
  return true;
}

if (require.main === module) {
  const action = process.argv[2] || 'create';
  if (action === 'create') {
    const res = criarBackup();
    console.log('Backup concluído:', res);
  } else if (action === 'list') {
    console.log('Backups existentes:', listarBackups());
  } else if (action === 'restore' && process.argv[3]) {
    restaurarBackup(process.argv[3]);
    console.log('Restauração concluída.');
  }
}

module.exports = {
  criarBackup,
  listarBackups,
  restaurarBackup
};
