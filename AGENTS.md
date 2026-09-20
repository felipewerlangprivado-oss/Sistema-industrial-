# Regras e Diretrizes do Projeto Home Pots Manager

## Controle de Versão e Histórico de Atualizações
- **Regra Mandatória**: A cada modificação ou atualização realizada no sistema, a versão do sistema (`systemVersion` e `INITIAL_VERSION` em `store.ts`) DEVE ser incrementada (semantic versioning: PATCH para correções e pequenos ajustes, MINOR para novas telas e funcionalidades, MAJOR para mudanças estruturais).
- **Registro no Histórico (Changelog)**: Cada alteração DEVE conter obrigatoriamente uma nova entrada no `INITIAL_CHANGELOG` em `store.ts` com:
  - `version`: a nova versão correspondente;
  - `date`: `Date.now()`;
  - `type`: `'FEATURE'` | `'FIX'` | `'IMPROVEMENT'`;
  - `description`: descrição clara e profissional em português das alterações realizadas.
- **Painel do Supervisor**: As versões registradas devem ser exibidas de forma clara e cronológica na aba de Histórico de Versões do Painel do Supervisor (`SupervisorDashboard.tsx`).
