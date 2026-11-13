// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  res.locals.currentUser = req.session.user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
