const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

router.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: req.query.error || null, msg: req.query.msg || null });
});

router.post('/login', async (req, res) => {
  try {
    const { login, senha } = req.body;
    if (!login || !senha) {
      return res.render('login', { error: 'Preencha usuário e senha.', msg: null });
    }

    let user;
    if (isProduction) {
      const { query, registrarHistorico } = require('../database-pg');
      const result = await query('SELECT * FROM usuarios WHERE login = $1 AND ativo = 1', [login.trim()]);
      user = result.rows[0];
      if (!user || !bcrypt.compareSync(senha, user.senha)) {
        return res.render('login', { error: 'Usuário ou senha inválidos.', msg: null });
      }
      req.session.user = { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil };
      await registrarHistorico('usuarios', user.id, 'login', null, null, null, 'Login no sistema', user.id, user.nome);
    } else {
      const { getDb, registrarHistorico } = require('../database-sqlite');
      const db = getDb();
      user = db.prepare('SELECT * FROM usuarios WHERE login = ? AND ativo = 1').get(login.trim());
      if (!user || !bcrypt.compareSync(senha, user.senha)) {
        return res.render('login', { error: 'Usuário ou senha inválidos.', msg: null });
      }
      req.session.user = { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil };
      registrarHistorico('usuarios', user.id, 'login', null, null, null, 'Login no sistema', user.id, user.nome);
    }

    const redirectUrl = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('[AUTH] Erro no login:', err);
    res.render('login', { error: 'Erro interno. Tente novamente.', msg: null });
  }
});

router.get('/logout', async (req, res) => {
  try {
    if (req.session && req.session.user) {
      if (isProduction) {
        const { registrarHistorico } = require('../database-pg');
        await registrarHistorico('usuarios', req.session.user.id, 'logout', null, null, null, 'Logout do sistema', req.session.user.id, req.session.user.nome);
      } else {
        const { registrarHistorico } = require('../database-sqlite');
        registrarHistorico('usuarios', req.session.user.id, 'logout', null, null, null, 'Logout do sistema', req.session.user.id, req.session.user.nome);
      }
    }
  } catch(e) {}
  req.session.destroy(() => res.redirect('/login?msg=Sessão encerrada com sucesso.'));
});

module.exports = router;
