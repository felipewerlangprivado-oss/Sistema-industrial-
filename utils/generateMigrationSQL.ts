
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
    sql += `-- V1: Criar tabela colaboradores e segurança básica\n`;
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

    sql += `create policy "liberar_acesso_total_desenvolvimento"
on colaboradores
for all
using (true)
with check (true);\n\n`;
  }

  return sql;
}
