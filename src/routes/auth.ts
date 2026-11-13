// src/routes/auth.ts
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as pgDb from '../database-pg';
import * as sqliteDb from '../database-sqlite';

const router = express.Router();
const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

router.get('/login', (req: Request, res: Response) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: req.query.error || null, msg: req.query.msg || null });
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, senha } = req.body;
    if (!login || !senha) {
      return res.render('login', { error: 'Preencha usuário e senha.', msg: null });
    }

    let user: any = null;
    if (isProduction) {
      const result = await pgDb.query('SELECT * FROM usuarios WHERE login = $1 AND ativo = 1', [login.trim()]);
      user = result.rows[0];
      if (!user || !bcrypt.compareSync(senha, user.senha)) {
        return res.render('login', { error: 'Usuário ou senha inválidos.', msg: null });
      }
      req.session.user = { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil };
      await pgDb.registrarHistorico('usuarios', user.id, 'login', null, null, null, 'Login no sistema', user.id, user.nome);
    } else {
      const db = sqliteDb.getDb();
      user = db.prepare('SELECT * FROM usuarios WHERE login = ? AND ativo = 1').get(login.trim());
      if (!user || !bcrypt.compareSync(senha, user.senha)) {
        return res.render('login', { error: 'Usuário ou senha inválidos.', msg: null });
      }
      req.session.user = { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil };
      sqliteDb.registrarHistorico('usuarios', user.id, 'login', null, null, null, 'Login no sistema', user.id, user.nome);
    }

    const redirectUrl = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  } catch (err: any) {
    console.error('[AUTH] Erro no login:', err);
    res.render('login', { error: 'Erro no login: ' + err.message, msg: null });
  }
});

router.get('/logout', async (req: Request, res: Response) => {
  try {
    if (req.session && req.session.user) {
      if (isProduction) {
        await pgDb.registrarHistorico('usuarios', req.session.user.id, 'logout', null, null, null, 'Logout do sistema', req.session.user.id, req.session.user.nome);
      } else {
        sqliteDb.registrarHistorico('usuarios', req.session.user.id, 'logout', null, null, null, 'Logout do sistema', req.session.user.id, req.session.user.nome);
      }
    }
  } catch(e) {}
  req.session.destroy(() => res.redirect('/login?msg=Sessão encerrada com sucesso.'));
});

export default router;
