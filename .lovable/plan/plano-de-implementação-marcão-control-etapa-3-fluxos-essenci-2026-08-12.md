# Plano de Implementação - Marcão Control (Etapa 3: Fluxos Essenciais)

Finalização do Kanban, implementação de modais globais e desenvolvimento do módulo financeiro executivo com integração total ao banco de dados.

## 1. Kanban de Pendências (Drag & Drop)
- Implementar `DndContext`, `SortableContext` e `VerticalSelectionStrategy` no `TaskList.tsx`.
- Criar componentes `KanbanColumn` e `KanbanCard` (usando `useSortable`).
- Implementar `mutation` para atualizar o status no Supabase ao soltar o card.
- Adicionar sinalização visual para tarefas atrasadas e exibição de "Aguardando: [Nome]" conforme solicitado.

## 2. Sistema Global "+ Novo" (Modais)
- Criar `ProjectModal.tsx` para criação de projetos com os campos: Nome, Categoria, Descrição, Objetivo, Status, Datas, Valor e Próxima ação.
- Criar `ContactModal.tsx` para contatos: Nome (obrigatório), Empresa, Cargo, Contatos (Tel/Whats/Email), Cidade, Categoria e Notas.
- Integrar novos modais no `GlobalAddButton.tsx`.
- Garantir feedback de sucesso (Sonner) e atualização automática do cache do TanStack Query.

## 3. Módulo Financeiro Executivo
- **Página Financeiro (`src/routes/financeiro.tsx`):**
  - Cards de resumo: Receitas/Despesas do mês, Resultado, A Receber/A Pagar.
  - Filtros de período: Este mês, Anterior, Próximo, Personalizado.
  - Lista de movimentações com filtros por tipo, status, projeto e categoria.
- **Modais Financeiros:**
  - `TransactionModal.tsx` (reutilizável para Receita/Despesa).
  - Campos: Descrição, Valor, Datas (Lançamento/Vencimento), Categoria, Projeto (relacionamento), Contato, Status (Pendente/Pago).

## 4. Integração Financeira nos Projetos
- Atualizar `ProjectDetail.tsx` para calcular indicadores financeiros reais a partir da tabela `financial_transactions`.
- Implementar visualização de indicadores imobiliários (Compra, Obra Prevista/Real, Venda, Lucro).

## Detalhes Técnicos
- **Banco de Dados:** Uso integral das tabelas `tasks`, `projects`, `contacts` e `financial_transactions`.
- **UX:** Design minimalista, mobile-first e tokens semânticos (shadcn/ui).
- **Performance:** Otimização de queries com joins (`select('*, projects(name)')`).
