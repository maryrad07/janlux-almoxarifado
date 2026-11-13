// src/routes/admin.ts — Gestão de Usuários, Histórico/Auditoria e Backup
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../utils/db-helper';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// ==================== USUÁRIOS ====================
router.get('/usuarios', requireAuth, requireRole('administrador'), async (req: Request, res: Response) => {
  try {
    const usuarios = await db.all('SELECT id, nome, login, perfil, ativo, criado_em, atualizado_em FROM usuarios ORDER BY nome');
    res.render('admin/usuarios', {
      title: 'Gerenciamento de Usuários e Permissões',
      usuarios,
      msg: req.query.sucesso || null,
      err: req.query.erro || null
    });
  } catch (err: any) {
    res.redirect('/admin/usuarios?erro=' + encodeURIComponent(err.message));
  }
});

router.post('/usuarios/salvar', requireAuth, requireRole('administrador'), async (req: Request, res: Response) => {
  try {
    const { id, nome, login, senha, perfil, ativo } = req.body;
    if (!nome || !login) {
      return res.redirect('/admin/usuarios?erro=' + encodeURIComponent('Nome e Login são obrigatórios.'));
    }

    const user = req.session.user;

    if (id) {
      if (senha && senha.trim()) {
        const hash = bcrypt.hashSync(senha.trim(), 10);
        await db.run(
          'UPDATE usuarios SET nome = ?, login = ?, senha = ?, perfil = ?, ativo = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
          [nome.trim(), login.trim().toLowerCase(), hash, perfil, ativo ? 1 : 0, id]
        );
      } else {
        await db.run(
          'UPDATE usuarios SET nome = ?, login = ?, perfil = ?, ativo = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?',
          [nome.trim(), login.trim().toLowerCase(), perfil, ativo ? 1 : 0, id]
        );
      }
      await db.historico('usuarios', Number(id), 'alteracao', null, null, login, 'Edição de usuário', user?.id, user?.nome);
      res.redirect('/admin/usuarios?sucesso=' + encodeURIComponent('Usuário atualizado com sucesso!'));
    } else {
      if (!senha || !senha.trim()) {
        return res.redirect('/admin/usuarios?erro=' + encodeURIComponent('Senha é obrigatória para novo usuário.'));
      }
      const hash = bcrypt.hashSync(senha.trim(), 10);
      const info = await db.run(
        'INSERT INTO usuarios (nome, login, senha, perfil, ativo) VALUES (?, ?, ?, ?, 1)',
        [nome.trim(), login.trim().toLowerCase(), hash, perfil]
      );
      await db.historico('usuarios', Number(info.id), 'criacao', null, null, login, 'Novo usuário criado', user?.id, user?.nome);
      res.redirect('/admin/usuarios?sucesso=' + encodeURIComponent('Usuário criado com sucesso!'));
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
      return res.redirect('/admin/usuarios?erro=' + encodeURIComponent('Este login já está em uso.'));
    }
    res.redirect('/admin/usuarios?erro=' + encodeURIComponent(err.message));
  }
});

// ==================== HISTÓRICO / AUDITORIA ====================
router.get('/historico', requireAuth, requireRole('administrador'), async (req: Request, res: Response) => {
  try {
    const { tabela, busca } = req.query;
    let sql = 'SELECT * FROM historico WHERE 1=1';
    const params: any[] = [];

    if (tabela) {
      sql += ' AND tabela = ?';
      params.push(tabela);
    }
    if (busca) {
      sql += ' AND (motivo LIKE ? OR usuario_nome LIKE ? OR campo LIKE ?)';
      const b = `%${String(busca).trim()}%`;
      params.push(b, b, b);
    }
    sql += ' ORDER BY id DESC LIMIT 250';
    const historico = await db.all(sql, params);

    res.render('admin/historico', {
      title: 'Histórico e Rastreabilidade (Audit Log)',
      historico,
      tabela: tabela || '',
      busca: busca || ''
    });
  } catch (err: any) {
    res.status(500).render('error', { title: 'Erro', mensagem: err.message });
  }
});

// ==================== BACKUP E RESTAURAÇÃO ====================
router.get('/backup', requireAuth, requireRole('administrador'), async (req: Request, res: Response) => {
  if (db.isProduction) {
    return res.render('admin/backup', {
      title: 'Segurança, Backup e Recuperação',
      backups: [],
      msg: 'Backup automático gerenciado pelo Supabase. Acesse https://supabase.com para exportar dados.',
      err: req.query.erro || null
    });
  }
  const { listarBackups } = await import('../utils/backup');
  const backups = listarBackups();
  res.render('admin/backup', {
    title: 'Segurança, Backup e Recuperação',
    backups,
    msg: req.query.sucesso || null,
    err: req.query.erro || null
  });
});

router.post('/backup/criar', requireAuth, requireRole('administrador'), async (req: Request, res: Response) => {
  if (db.isProduction) {
    return res.redirect('/admin/backup?erro=' + encodeURIComponent('Backup manual não disponível em produção. Use o painel do Supabase.'));
  }
  try {
    const { criarBackup } = await import('../utils/backup');
    const bkp = criarBackup();
    const user = req.session.user;
    await db.historico('sistema', 0, 'backup', 'janlux.db', null, bkp.arquivo, 'Backup manual criado', user?.id, user?.nome);
    res.redirect(`/admin/backup?sucesso=${encodeURIComponent(`Backup criado com sucesso: ${bkp.arquivo}`)}`);
  } catch (err: any) {
    res.redirect('/admin/backup?erro=' + encodeURIComponent(err.message));
  }
});

router.post('/backup/restaurar', requireAuth, requireRole('administrador'), async (req: Request, res: Response) => {
  if (db.isProduction) {
    return res.redirect('/admin/backup?erro=' + encodeURIComponent('Restauração não disponível em produção via interface.'));
  }
  const { arquivo } = req.body;
  if (!arquivo) return res.redirect('/admin/backup?erro=' + encodeURIComponent('Selecione um arquivo para restaurar.'));
  try {
    const { restaurarBackup } = await import('../utils/backup');
    restaurarBackup(arquivo);
    const user = req.session.user;
    await db.historico('sistema', 0, 'restauracao', 'janlux.db', arquivo, null, 'Banco restaurado pelo administrador', user?.id, user?.nome);
    res.redirect('/admin/backup?sucesso=' + encodeURIComponent(`Banco de dados restaurado com sucesso a partir de ${arquivo}`));
  } catch (err: any) {
    res.redirect('/admin/backup?erro=' + encodeURIComponent(err.message));
  }
});

export default router;
