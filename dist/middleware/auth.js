"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    res.locals.currentUser = req.session.user;
    next();
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }
        const userRole = req.session.user.perfil;
        if (roles.includes(userRole)) {
            return next();
        }
        res.status(403).render('error', {
            title: 'Acesso Negado',
            mensagem: 'Você não tem permissão para acessar este recurso ou executar esta operação.',
            currentUser: req.session.user
        });
    };
}
