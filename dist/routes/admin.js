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
// src/routes/admin.ts — Gestão de Usuários, Histórico/Auditoria e Backup
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_helper_1 = __importDefault(require("../utils/db-helper"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ==================== USUÁRIOS ====================
router.get('/usuarios', auth_1.requireAuth, (0, auth_1.requireRole)('administrador'), async (req, res) => {
    try {
        const usuarios = await db_helper_1.default.all('SELECT id, nome, login, perfil, ativo, criado_em, atualizado_em FROM usuarios ORDER BY nome');
        res.render('admin/usuarios', {
            title: 'Gerenciamento de Usuários e Permissões',
            usuarios,
            msg: req.query.sucesso || null,
            err: req.query.erro || null
        });
    }
    catch (err) {
        res.redirect('/admin/usuarios?erro=' + encodeURIComponent(err.message));
    }
});
router.post('/usuarios/salvar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador'), async (req, res) => {
    try {
        const { id, nome, login, senha, perfil, ativo } = req.body;
        if (!nome || !login) {
            return res.redirect('/admin/usuarios?erro=' + encodeURIComponent('Nome e Login são obrigatórios.'));
        }
        const user = req.session.user;
        if (id) {
            if (senha && senha.trim()) {
                const hash = bcryptjs_1.default.hashSync(senha.trim(), 10);
                await db_helper_1.default.run('UPDATE usuarios SET nome = ?, login = ?, senha = ?, perfil = ?, ativo = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [nome.trim(), login.trim().toLowerCase(), hash, perfil, ativo ? 1 : 0, id]);
            }
            else {
                await db_helper_1.default.run('UPDATE usuarios SET nome = ?, login = ?, perfil = ?, ativo = ?, atualizado_em = datetime(\'now\',\'localtime\') WHERE id = ?', [nome.trim(), login.trim().toLowerCase(), perfil, ativo ? 1 : 0, id]);
            }
            await db_helper_1.default.historico('usuarios', Number(id), 'alteracao', null, null, login, 'Edição de usuário', user?.id, user?.nome);
            res.redirect('/admin/usuarios?sucesso=' + encodeURIComponent('Usuário atualizado com sucesso!'));
        }
        else {
            if (!senha || !senha.trim()) {
                return res.redirect('/admin/usuarios?erro=' + encodeURIComponent('Senha é obrigatória para novo usuário.'));
            }
            const hash = bcryptjs_1.default.hashSync(senha.trim(), 10);
            const info = await db_helper_1.default.run('INSERT INTO usuarios (nome, login, senha, perfil, ativo) VALUES (?, ?, ?, ?, 1)', [nome.trim(), login.trim().toLowerCase(), hash, perfil]);
            await db_helper_1.default.historico('usuarios', Number(info.id), 'criacao', null, null, login, 'Novo usuário criado', user?.id, user?.nome);
            res.redirect('/admin/usuarios?sucesso=' + encodeURIComponent('Usuário criado com sucesso!'));
        }
    }
    catch (err) {
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
            return res.redirect('/admin/usuarios?erro=' + encodeURIComponent('Este login já está em uso.'));
        }
        res.redirect('/admin/usuarios?erro=' + encodeURIComponent(err.message));
    }
});
// ==================== HISTÓRICO / AUDITORIA ====================
router.get('/historico', auth_1.requireAuth, (0, auth_1.requireRole)('administrador'), async (req, res) => {
    try {
        const { tabela, busca } = req.query;
        let sql = 'SELECT * FROM historico WHERE 1=1';
        const params = [];
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
        const historico = await db_helper_1.default.all(sql, params);
        res.render('admin/historico', {
            title: 'Histórico e Rastreabilidade (Audit Log)',
            historico,
            tabela: tabela || '',
            busca: busca || ''
        });
    }
    catch (err) {
        res.status(500).render('error', { title: 'Erro', mensagem: err.message });
    }
});
// ==================== BACKUP E RESTAURAÇÃO ====================
router.get('/backup', auth_1.requireAuth, (0, auth_1.requireRole)('administrador'), async (req, res) => {
    if (db_helper_1.default.isProduction) {
        return res.render('admin/backup', {
            title: 'Segurança, Backup e Recuperação',
            backups: [],
            msg: 'Backup automático gerenciado pelo Supabase. Acesse https://supabase.com para exportar dados.',
            err: req.query.erro || null
        });
    }
    const { listarBackups } = await Promise.resolve().then(() => __importStar(require('../utils/backup')));
    const backups = listarBackups();
    res.render('admin/backup', {
        title: 'Segurança, Backup e Recuperação',
        backups,
        msg: req.query.sucesso || null,
        err: req.query.erro || null
    });
});
router.post('/backup/criar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador'), async (req, res) => {
    if (db_helper_1.default.isProduction) {
        return res.redirect('/admin/backup?erro=' + encodeURIComponent('Backup manual não disponível em produção. Use o painel do Supabase.'));
    }
    try {
        const { criarBackup } = await Promise.resolve().then(() => __importStar(require('../utils/backup')));
        const bkp = criarBackup();
        const user = req.session.user;
        await db_helper_1.default.historico('sistema', 0, 'backup', 'janlux.db', null, bkp.arquivo, 'Backup manual criado', user?.id, user?.nome);
        res.redirect(`/admin/backup?sucesso=${encodeURIComponent(`Backup criado com sucesso: ${bkp.arquivo}`)}`);
    }
    catch (err) {
        res.redirect('/admin/backup?erro=' + encodeURIComponent(err.message));
    }
});
router.post('/backup/restaurar', auth_1.requireAuth, (0, auth_1.requireRole)('administrador'), async (req, res) => {
    if (db_helper_1.default.isProduction) {
        return res.redirect('/admin/backup?erro=' + encodeURIComponent('Restauração não disponível em produção via interface.'));
    }
    const { arquivo } = req.body;
    if (!arquivo)
        return res.redirect('/admin/backup?erro=' + encodeURIComponent('Selecione um arquivo para restaurar.'));
    try {
        const { restaurarBackup } = await Promise.resolve().then(() => __importStar(require('../utils/backup')));
        restaurarBackup(arquivo);
        const user = req.session.user;
        await db_helper_1.default.historico('sistema', 0, 'restauracao', 'janlux.db', arquivo, null, 'Banco restaurado pelo administrador', user?.id, user?.nome);
        res.redirect('/admin/backup?sucesso=' + encodeURIComponent(`Banco de dados restaurado com sucesso a partir de ${arquivo}`));
    }
    catch (err) {
        res.redirect('/admin/backup?erro=' + encodeURIComponent(err.message));
    }
});
exports.default = router;
