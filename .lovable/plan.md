# Finalização do Módulo Faculdade e Timeline Automática

Melhorar a experiência acadêmica do Marcão Control e automatizar a linha do tempo dos projetos para refletir ações reais.

## Alterações no Banco de Dados

- Criado enum  (A estudar, Estudando, Realizada, Corrigida).
- Criadas tabelas  (Resumos) e  (Trabalhos).
- Atualizada tabela  com campos de horário e status.
- Garantido RLS e Grants para todas as novas entidades.

## Módulo 1: Timeline Automática

- Implementado helper  em .
- Integração do helper nos modais de criação e edição:
  - **ProjectModal**: Log de criação e conversão de ideia.
  - **TaskModal**: Log de criação de tarefas.
  - **TaskList**: Log de conclusão/reabertura (movimentação no Kanban).
  - **TransactionModal**: Log de receitas/despesas.
  - **EventModal**: Log de compromissos.
- Refatoração de  para consumir os novos tipos de ação e descrição real.

## Módulo 2: Faculdade - Provas e Trabalhos

- Finalização da aba "Provas & Trabalhos" no .
- Implementação de sub-componentes para Listagem e Modais de Provas/Trabalhos.
- Cálculo de notas e médias (ponderadas se houver peso, simples se não).

## Módulo 3: Faculdade - Resumos

- Criação da aba "Resumos" para material de revisão.
- Interface de busca e filtro por matéria.
- Distinção visual entre Anotações (rápidas) e Resumos (estruturados).

## Módulo 4: Faculdade - Gestão de Faltas e Dashboard

- Melhoria visual da gestão de faltas com alertas de limite (ex: 80%).
- Seção "Estudar Agora" priorizando provas e trabalhos próximos.
- Visão Geral acadêmica consolidada com matérias ativas e próximos prazos.

## Detalhes Técnicos

- **Persistência**: Todas as ações utilizam Supabase e TanStack Query para atualização instantânea.
- **Segurança**: RLS aplicado em nível de  em todas as novas tabelas.
- **UI/UX**: Mantido o design premium com Shadcn/UI e Framer Motion.
