const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../utils/db-helper');
const { requireAuth, requireRole } = require('../middleware/auth');

// ==================== USUÁRIOS ====================
router.get('/usuarios', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    const usuarios = await db.all('SELECT id, nome, login, perfil, ativo, criado_em, atualizado_em FROM usuarios ORDER BY nome');
    res.render('admin/usuarios', { title: 'Gerenciamento de Usuários e Permissões', usuarios, msg: req.query.sucesso || null, err: req.query.erro || null });
  } catch (err) { res.redirect('/admin/usuarios?erro=' + encodeURIComponent(err.message)); }
});

router.post('/usuarios/salvar', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    const { id, nome, login, senha, perfil, ativo } = req.body;
    if (!nome || !login) return res.redirect('/admin/usuarios?erro=Nome e Login são obrigatórios.');

    if (id) {
      if (senha && senha.trim()) {
        const hash = bcrypt.hashSync(senha.trim(), 10);
        await db.run('UPDATE usuarios SET nome = ?, login = ?, senha = ?, perfil = ?, ativo = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
          [nome.trim(), login.trim().toLowerCase(), hash, perfil, ativo ? 1 : 0, id]);
      } else {
        await db.run('UPDATE usuarios SET nome = ?, login = ?, perfil = ?, ativo = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
          [nome.trim(), login.trim().toLowerCase(), perfil, ativo ? 1 : 0, id]);
      }
      await db.historico('usuarios', id, 'alteracao', null, null, login, 'Edição de usuário', req.session.user.id, req.session.user.nome);
      res.redirect('/admin/usuarios?sucesso=Usuário atualizado com sucesso!');
    } else {
      if (!senha || !senha.trim()) return res.redirect('/admin/usuarios?erro=Senha é obrigatória para novo usuário.');
      const hash = bcrypt.hashSync(senha.trim(), 10);
      const info = await db.run('INSERT INTO usuarios (nome, login, senha, perfil, ativo) VALUES (?, ?, ?, ?, 1)',
        [nome.trim(), login.trim().toLowerCase(), hash, perfil]);
      await db.historico('usuarios', info.id, 'criacao', null, null, login, 'Novo usuário criado', req.session.user.id, req.session.user.nome);
      res.redirect('/admin/usuarios?sucesso=Usuário criado com sucesso!');
    }
  } catch (err) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
      return res.redirect('/admin/usuarios?erro=Este login já está em uso.');
    }
    res.redirect('/admin/usuarios?erro=' + encodeURIComponent(err.message));
  }
});

// ==================== HISTÓRICO / AUDITORIA ====================
router.get('/historico', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    const { tabela, busca } = req.query;
    let sql = 'SELECT * FROM historico WHERE 1=1';
    const params = [];

    if (tabela) { sql += ' AND tabela = ?'; params.push(tabela); }
    if (busca) {
      sql += ' AND (motivo LIKE ? OR usuario_nome LIKE ? OR campo LIKE ?)';
      const b = `%${busca.trim()}%`;
      params.push(b, b, b);
    }
    sql += ' ORDER BY id DESC LIMIT 250';
    const historico = await db.all(sql, params);

    res.render('admin/historico', { title: 'Histórico e Rastreabilidade (Audit Log)', historico, tabela: tabela || '', busca: busca || '' });
  } catch (err) { res.status(500).render('error', { title: 'Erro', mensagem: err.message }); }
});

// ==================== BACKUP E RESTAURAÇÃO ====================
router.get('/backup', requireAuth, requireRole('administrador'), (req, res) => {
  // Em produção (Vercel/Supabase), backup é gerenciado pelo Supabase
  if (db.isProduction) {
    return res.render('admin/backup', {
      title: 'Segurança, Backup e Recuperação',
      backups: [],
      msg: 'Backup automático gerenciado pelo Supabase. Acesse https://supabase.com para exportar dados.',
      err: req.query.erro || null
    });
  }
  const { listarBackups } = require('../utils/backup');
  const backups = listarBackups();
  res.render('admin/backup', { title: 'Segurança, Backup e Recuperação', backups, msg: req.query.sucesso || null, err: req.query.erro || null });
});

router.post('/backup/criar', requireAuth, requireRole('administrador'), async (req, res) => {
  if (db.isProduction) {
    return res.redirect('/admin/backup?erro=Backup manual não disponível em produção. Use o painel do Supabase.');
  }
  try {
    const { criarBackup } = require('../utils/backup');
    const bkp = criarBackup();
    await db.historico('sistema', 0, 'backup', 'janlux.db', null, bkp.arquivo, 'Backup manual criado', req.session.user.id, req.session.user.nome);
    res.redirect(`/admin/backup?sucesso=Backup criado com sucesso: ${bkp.arquivo}`);
  } catch (err) { res.redirect('/admin/backup?erro=' + encodeURIComponent(err.message)); }
});

router.post('/backup/restaurar', requireAuth, requireRole('administrador'), async (req, res) => {
  if (db.isProduction) {
    return res.redirect('/admin/backup?erro=Restauração não disponível em produção via interface.');
  }
  const { arquivo } = req.body;
  if (!arquivo) return res.redirect('/admin/backup?erro=Selecione um arquivo para restaurar.');
  try {
    const { restaurarBackup } = require('../utils/backup');
    restaurarBackup(arquivo);
    await db.historico('sistema', 0, 'restauracao', 'janlux.db', null, arquivo, 'Restauração de banco', req.session.user.id, req.session.user.nome);
    res.redirect('/admin/backup?sucesso=Banco restaurado com sucesso!');
  } catch (err) { res.redirect('/admin/backup?erro=' + encodeURIComponent(err.message)); }
});

// ==================== REDE LOCAL ====================
router.get('/rede', requireAuth, requireRole('administrador'), (req, res) => {
  if (db.isProduction) {
    return res.render('admin/rede', {
      title: 'Informações de Rede',
      ips: [],
      porta: 443,
      urlProducao: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'Configure no Vercel',
      msg: 'Sistema rodando em produção (Vercel). Acesso via URL pública.',
      err: null
    });
  }
  const os = require('node:os');
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push({ interface: name, address: iface.address });
    }
  }
  res.render('admin/rede', { title: 'Acesso pela Rede Local', ips, porta: process.env.PORT || 3000, urlProducao: null, msg: req.query.sucesso || null, err: req.query.erro || null });
});

module.exports = router;
