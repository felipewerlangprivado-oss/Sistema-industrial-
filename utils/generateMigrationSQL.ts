
import { CURRENT_DB_VERSION } from '../config/systemVersion';

export function generateMigrationSQL(fromVersion: number): string {
  // Se a versão informada for igual ou maior que a atual, não há nada a fazer
  if (fromVersion >= CURRENT_DB_VERSION) {
    return '';
  }

  let sql = `-- Script gerado automaticamente pelo sistema\n`;
  sql += `-- Data: ${new Date().toLocaleString()}\n`;
  sql += `-- Versão atual do banco: ${fromVersion}\n`;
  sql += `-- Versão alvo: ${CURRENT_DB_VERSION}\n\n`;

  // --- MIGRATION V1 ---
  if (fromVersion < 1) {
    sql += `-- ==========================================\n`;
    sql += `-- V1: Criar tabela de sincronização e segurança pública\n`;
    sql += `-- ==========================================\n\n`;

    sql += `create table if not exists homepots_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default now()
);\n\n`;

    sql += `alter table homepots_sync enable row level security;\n\n`;

    sql += `drop policy if exists "permitir_acesso_total_sync" on homepots_sync;\n`;
    sql += `create policy "permitir_acesso_total_sync"
on homepots_sync
for all
using (true)
with check (true);\n\n`;

    sql += `-- Habilitar sincronização em tempo real (WebSockets)\n`;
    sql += `begin;\n`;
    sql += `  drop publication if exists supabase_realtime;\n`;
    sql += `  create publication supabase_realtime;\n`;
    sql += `commit;\n`;
    sql += `alter publication supabase_realtime add table homepots_sync;\n\n`;

    sql += `-- ==========================================\n`;
    sql += `-- Opcional: Tabela de colaboradores (para segurança)\n`;
    sql += `-- ==========================================\n\n`;

    sql += `create table if not exists colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pin text not null,
  setor text not null,
  role text not null default 'colaborador',
  ativo boolean default true,
  created_at timestamp with time zone default now()
);\n\n`;

    sql += `alter table colaboradores enable row level security;\n\n`;

    sql += `drop policy if exists "liberar_acesso_total_desenvolvimento" on colaboradores;\n`;
    sql += `create policy "liberar_acesso_total_desenvolvimento"
on colaboradores
for all
using (true)
with check (true);\n\n`;
  }

  return sql;
}
