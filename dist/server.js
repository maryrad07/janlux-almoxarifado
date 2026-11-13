"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts — Servidor Principal do Sistema JANLUX (TypeScript)
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Carrega .env se existir (desenvolvimento local)
try {
    dotenv_1.default.config();
}
catch (e) { }
const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
// Inicializa banco de dados
const database_1 = require("./database");
if (isProduction) {
    (0, database_1.initDatabase)().catch((err) => console.error('[SERVER] Erro ao inicializar DB:', err.message));
}
else {
    (0, database_1.initDatabase)();
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Configuração EJS e Views
app.set('view engine', 'ejs');
app.set('views', node_path_1.default.join(__dirname, '..', 'views'));
// Middlewares essenciais
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(express_1.default.json({ limit: '10mb' }));
// Configuração de Sessão
let sessionConfig = {
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
        const connectPg = require('connect-pg-simple')(express_session_1.default);
        const { getPool } = require('./database-pg');
        sessionConfig.store = new connectPg({
            pool: getPool(),
            tableName: 'session',
            createTableIfMissing: false
        });
    }
    catch (e) {
        console.warn('[SERVER] connect-pg-simple não disponível, usando memória.');
    }
    app.set('trust proxy', 1);
}
app.use((0, express_session_1.default)(sessionConfig));
// Variáveis e Helpers Globais para Todas as Views
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.session = req.session;
    res.locals.currentPath = req.path;
    // Formatação de data brasileira (DD/MM/AAAA)
    res.locals.formatDateBR = (d) => {
        if (!d)
            return '--/--/----';
        if (typeof d === 'object' && d instanceof Date) {
            return d.toLocaleDateString('pt-BR');
        }
        if (typeof d === 'string' && d.includes('-')) {
            const parts = d.split('T')[0].split('-');
            if (parts.length === 3)
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return String(d);
    };
    // Formatação de peso em quilogramas com 3 casas decimais (0,000 kg)
    res.locals.formatWeightKg = (val) => {
        if (val === null || val === undefined || val === '')
            return '0,000 kg';
        const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
        if (isNaN(n))
            return '0,000 kg';
        return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
    };
    next();
});
// Arquivos Estáticos
app.use('/public', express_1.default.static(node_path_1.default.join(__dirname, '..', 'public')));
if (!isProduction) {
    app.use('/pdfs', express_1.default.static(node_path_1.default.join(__dirname, '..', 'pdfs')));
    app.use('/uploads', express_1.default.static(node_path_1.default.join(__dirname, '..', 'uploads')));
}
// Rotas da Aplicação
const auth_1 = __importDefault(require("./routes/auth"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const expedicoes_1 = __importDefault(require("./routes/expedicoes"));
const almoxarifado_1 = __importDefault(require("./routes/almoxarifado"));
const coletas_1 = __importDefault(require("./routes/coletas"));
const cadastros_1 = __importDefault(require("./routes/cadastros"));
const relatorios_1 = __importDefault(require("./routes/relatorios"));
const admin_1 = __importDefault(require("./routes/admin"));
app.use('/', auth_1.default);
app.use('/', dashboard_1.default);
app.use('/expedicoes', expedicoes_1.default);
app.use('/almoxarifado', almoxarifado_1.default);
app.use('/coletas', coletas_1.default);
app.use('/cadastros', cadastros_1.default);
app.use('/relatorios', relatorios_1.default);
app.use('/admin', admin_1.default);
// Redirecionamento da raiz
app.get('/', (req, res) => {
    if (req.session && req.session.user)
        return res.redirect('/dashboard');
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
// Iniciar servidor local
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`  SISTEMA JANLUX — ALMOXARIFADO E EXPEDIÇÃO (TYPESCRIPT)`);
        console.log(`  Acesso Local:       http://localhost:${PORT}`);
        console.log(`=======================================================`);
    });
}
exports.default = app;
