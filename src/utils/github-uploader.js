// src/utils/github-uploader.js
// Envia arquivos diretamente para o repositório GitHub via REST API
const fs = require('node:fs');
const path = require('node:path');

const OWNER = 'maryrad07';
const REPO = 'janlux-almoxarifado';
const BRANCH = 'main';

async function uploadFile(token, relativePath, fullPath) {
  const content = fs.readFileSync(fullPath).toString('base64');
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${relativePath.replace(/\\/g, '/')}`;

  // Verificar se já existe para obter SHA (para update)
  let sha = undefined;
  try {
    const checkRes = await fetch(url + `?ref=${BRANCH}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'JANLUX-Uploader',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (checkRes.ok) {
      const data = await checkRes.json();
      sha = data.sha;
    }
  } catch(e) {}

  const body = {
    message: `Upload ${relativePath.replace(/\\/g, '/')}`,
    content,
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'JANLUX-Uploader',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha em ${relativePath}: ${res.status} ${errText}`);
  }
}

function getFiles(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath, baseDir));
    } else {
      results.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath)
      });
    }
  }
  return results;
}

async function uploadAll(token) {
  const baseDir = path.join(__dirname, '..', '..');
  const foldersToUpload = ['api', 'src', 'views', 'public'];

  console.log(`Iniciando upload para ${OWNER}/${REPO}...`);
  let total = 0;

  for (const folder of foldersToUpload) {
    const folderPath = path.join(baseDir, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = getFiles(folderPath, baseDir);
    for (const f of files) {
      process.stdout.write(`Enviando ${f.relativePath}... `);
      await uploadFile(token, f.relativePath, f.fullPath);
      console.log('✓');
      total++;
    }
  }

  console.log(`\nUpload concluído! ${total} arquivos enviados com sucesso.`);
}

module.exports = { uploadAll };

if (require.main === module) {
  const token = process.argv[2] || process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Uso: node src/utils/github-uploader.js <SEU_GITHUB_TOKEN>');
    process.exit(1);
  }
  uploadAll(token).catch(err => {
    console.error('[ERRO]', err.message);
    process.exit(1);
  });
}
