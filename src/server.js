const express = require('express');
const session = require('express-session');
const path = require('node:path');
const fs = require('node:fs');

// Carrega .env se existir (desenvolvimento local)
try { require('dotenv').config(); } catch(e) {}

const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Inicializa banco de dados
const { initDatabase } = require('./database');
if (isProduction) {
  // Async init para PostgreSQL — não bloqueia
  initDatabase().catch(err => console.error('[SERVER] Erro ao inicializar DB:', err.message));
} else {
  // Sync init para SQLite
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
let sessionConfig = {
  secret: process.env.SESSION_SECRET || 'janlux-almoxarifado-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 12, // 12 horas
    httpOnly: true,
    secure: isProduction, // HTTPS em produção
    sameSite: isProduction ? 'lax' : false
  }
};

if (isProduction) {
  // Usar connect-pg-simple para sessões persistentes no Vercel
  try {
    const pgSession = require('connect-pg-simple')(session);
    const { getPool } = require('./database-pg');
    sessionConfig.store = new pgSession({
      pool: getPool(),
      tableName: 'session',
      createTableIfMissing: false
    });
  } catch(e) {
    console.warn('[SERVER] connect-pg-simple não disponível, usando memória.');
  }
  // Confia no proxy do Vercel para cookies seguros
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// Variáveis globais para todas as views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.session = req.session;
  res.locals.currentPath = req.path;
  res.locals.formatDateBR = (d) => {
    if (!d) return '--/--/----';
    if (typeof d === 'object' && d instanceof Date) {
      return d.toLocaleDateString('pt-BR');
    }
    if (typeof d === 'string' && d.includes('-')) {
      const parts = d.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  };
  next();
});

// Arquivos Estáticos
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Em produção (Vercel), não servir pdfs/uploads locais — usar Supabase Storage
if (!isProduction) {
  app.use('/pdfs', express.static(path.join(__dirname, '..', 'pdfs')));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
}

// Rotas da Aplicação
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const expedicoesRoutes = require('./routes/expedicoes');
const almoxarifadoRoutes = require('./routes/almoxarifado');
const coletasRoutes = require('./routes/coletas');
const cadastrosRoutes = require('./routes/cadastros');
const relatoriosRoutes = require('./routes/relatorios');
const adminRoutes = require('./routes/admin');

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/expedicoes', expedicoesRoutes);
app.use('/almoxarifado', almoxarifadoRoutes);
app.use('/coletas', coletasRoutes);
app.use('/cadastros', cadastrosRoutes);
app.use('/relatorios', relatoriosRoutes);
app.use('/admin', adminRoutes);

// Redirecionamento da raiz
app.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página Não Encontrada',
    mensagem: 'O endereço solicitado não existe ou foi removido.'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('[ERRO SERVER]', err);
  res.status(500).render('error', {
    title: 'Erro Interno do Servidor',
    mensagem: process.env.NODE_ENV === 'production'
      ? 'Ocorreu um erro inesperado no sistema.'
      : err.message
  });
});

// Iniciar servidor local (não executa no Vercel)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  SISTEMA JANLUX — ALMOXARIFADO E EXPEDIÇÃO ATIVO`);
    console.log(`  Acesso Local:       http://localhost:${PORT}`);
    console.log(`  Acesso em Rede:     http://[IP-DO-COMPUTADOR]:${PORT}`);
    console.log(`=======================================================`);

    if (process.env.NO_OPEN !== 'true' && process.env.NODE_ENV !== 'test') {
      try {
        const { exec } = require('node:child_process');
        exec(`start http://localhost:${PORT}`);
      } catch(e) {}
    }
  });
}

module.exports = app;
