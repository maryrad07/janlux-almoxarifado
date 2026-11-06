// src/database.js — Adaptado para Supabase/PostgreSQL (produção) + SQLite (local)
// Detecta o ambiente e usa o banco correto:
//   - Produção (Vercel): usa Supabase via pg
//   - Local (sem .env): usa SQLite nativo (node:sqlite)

const isProduction = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

if (isProduction) {
  // Exporta a versão Supabase/PostgreSQL
  module.exports = require('./database-pg');
} else {
  // Exporta a versão SQLite local (legado)
  module.exports = require('./database-sqlite');
}
