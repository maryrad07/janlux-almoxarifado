// src/server.ts — Servidor Principal do Sistema JANLUX (TypeScript)
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

// Carrega .env se existir (desenvolvimento local)
try { dotenv.config(); } catch (e) {}

const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Inicializa banco de dados
import { initDatabase } from './database';
if (isProduction) {
  (initDatabase() as Promise<void>).catch((err: any) => console.error('[SERVER] Erro ao inicializar DB:', err.message));
} else {
  initDatabase();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração EJS e Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Middlewares essenciais
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Configuração de Sessão
let sessionConfig: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'janlux-almoxarifado-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 12, // 12 horas
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : false
  }
};

if (isProduction) {
  try {
    const connectPg = require('connect-pg-simple')(session);
    const { getPool } = require('./database-pg');
    sessionConfig.store = new connectPg({
      pool: getPool(),
      tableName: 'session',
      createTableIfMissing: false
    });
  } catch (e) {
    console.warn('[SERVER] connect-pg-simple não disponível, usando memória.');
  }
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// Variáveis e Helpers Globais para Todas as Views
app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.session = req.session;
  res.locals.currentPath = req.path;

  // Formatação de data brasileira (DD/MM/AAAA)
  res.locals.formatDateBR = (d: any): string => {
    if (!d) return '--/--/----';
    if (typeof d === 'object' && d instanceof Date) {
      return d.toLocaleDateString('pt-BR');
    }
    if (typeof d === 'string' && d.includes('-')) {
      const parts = d.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return String(d);
  };

  // Formatação de peso em quilogramas com 3 casas decimais (0,000 kg)
  res.locals.formatWeightKg = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '0,000 kg';
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
    if (isNaN(n)) return '0,000 kg';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
  };

  next();
});

// Arquivos Estáticos
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

if (!isProduction) {
  app.use('/pdfs', express.static(path.join(__dirname, '..', 'pdfs')));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
}

// Rotas da Aplicação
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import expedicoesRoutes from './routes/expedicoes';
import almoxarifadoRoutes from './routes/almoxarifado';
import coletasRoutes from './routes/coletas';
import cadastrosRoutes from './routes/cadastros';
import relatoriosRoutes from './routes/relatorios';
import adminRoutes from './routes/admin';

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/expedicoes', expedicoesRoutes);
app.use('/almoxarifado', almoxarifadoRoutes);
app.use('/coletas', coletasRoutes);
app.use('/cadastros', cadastrosRoutes);
app.use('/relatorios', relatoriosRoutes);
app.use('/admin', adminRoutes);

// Redirecionamento da raiz
app.get('/', (req: Request, res: Response) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).render('error', {
    title: 'Página Não Encontrada',
    mensagem: 'O endereço solicitado não existe ou foi removido.'
  });
});

// Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERRO SERVER]', err);
  res.status(500).render('error', {
    title: 'Erro Interno do Servidor',
    mensagem: process.env.NODE_ENV === 'production'
      ? 'Ocorreu um erro inesperado no sistema.'
      : err.message
  });
});

// Iniciar servidor local
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  SISTEMA JANLUX — ALMOXARIFADO E EXPEDIÇÃO (TYPESCRIPT)`);
    console.log(`  Acesso Local:       http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

export default app;
