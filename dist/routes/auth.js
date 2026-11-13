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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auth.ts
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pgDb = __importStar(require("../database-pg"));
const sqliteDb = __importStar(require("../database-sqlite"));
const router = express_1.default.Router();
const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
router.get('/login', (req, res) => {
    if (req.session && req.session.user)
        return res.redirect('/dashboard');
    res.render('login', { error: req.query.error || null, msg: req.query.msg || null });
});
router.post('/login', async (req, res) => {
    try {
        const { login, senha } = req.body;
        if (!login || !senha) {
            return res.render('login', { error: 'Preencha usuário e senha.', msg: null });
        }
        let user = null;
        if (isProduction) {
            const result = await pgDb.query('SELECT * FROM usuarios WHERE login = $1 AND ativo = 1', [login.trim()]);
            user = result.rows[0];
            if (!user || !bcryptjs_1.default.compareSync(senha, user.senha)) {
                return res.render('login', { error: 'Usuário ou senha inválidos.', msg: null });
            }
            req.session.user = { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil };
            await pgDb.registrarHistorico('usuarios', user.id, 'login', null, null, null, 'Login no sistema', user.id, user.nome);
        }
        else {
            const db = sqliteDb.getDb();
            user = db.prepare('SELECT * FROM usuarios WHERE login = ? AND ativo = 1').get(login.trim());
            if (!user || !bcryptjs_1.default.compareSync(senha, user.senha)) {
                return res.render('login', { error: 'Usuário ou senha inválidos.', msg: null });
            }
            req.session.user = { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil };
            sqliteDb.registrarHistorico('usuarios', user.id, 'login', null, null, null, 'Login no sistema', user.id, user.nome);
        }
        const redirectUrl = req.session.returnTo || '/dashboard';
        delete req.session.returnTo;
        res.redirect(redirectUrl);
    }
    catch (err) {
        console.error('[AUTH] Erro no login:', err);
        res.render('login', { error: 'Erro no login: ' + err.message, msg: null });
    }
});
router.get('/logout', async (req, res) => {
    try {
        if (req.session && req.session.user) {
            if (isProduction) {
                await pgDb.registrarHistorico('usuarios', req.session.user.id, 'logout', null, null, null, 'Logout do sistema', req.session.user.id, req.session.user.nome);
            }
            else {
                sqliteDb.registrarHistorico('usuarios', req.session.user.id, 'logout', null, null, null, 'Logout do sistema', req.session.user.id, req.session.user.nome);
            }
        }
    }
    catch (e) { }
    req.session.destroy(() => res.redirect('/login?msg=Sessão encerrada com sucesso.'));
});
exports.default = router;
