# Plano de Implementação - Marcão Control (Etapa 2)

O objetivo desta etapa é transformar o Marcão Control em uma ferramenta funcional, implementando o módulo de Pendências completo, o sistema global "+ Novo" com modais e a visualização detalhada de Projetos.

## 1. Módulo de Pendências (Tarefas)
- **Visualização Lista/Kanban**: Implementar toggle para alternar entre as visões.
- **Kanban**: Colunas ("A fazer", "Em andamento", "Aguardando terceiro", "Concluído") com suporte a drag and drop usando `dnd-kit` ou similar.
- **Destaque Visual**: Tarefas atrasadas com indicador visual discreto.
- **Filtros Rápidos**: Barra de filtros funcionais (Hoje, Atrasadas, Esta semana, Alta prioridade, etc.).
- **Detalhes da Tarefa**: Sidebar ou modal lateral para visualização e edição rápida.

## 2. Sistema Global "+ Novo"
- **Menu Centralizado**: Refatorar o botão "Novo" na Sidebar para abrir um menu suspenso ou modal de escolha.
- **Modais de Cadastro Rápido**:
    - **Nova Pendência**: Formulário rápido com campos de título, projeto, responsável, prioridade, etc.
    - **Novo Projeto**: Incluindo campos específicos para projetos imobiliários.
    - **Novo Contato**: Cadastro de pessoas/empresas.
    - **Financeiro**: Lançamento de receitas e despesas.
    - **Nova Ideia**: Captura rápida de insights.
- **Integração**: Conectar os formulários ao Supabase para persistência real dos dados.

## 3. Módulo de Projetos
- **Listagem de Projetos**: Grid de cards com filtros de status e indicadores de progresso/pendências.
- **Página Individual do Projeto**:
    - **Visão Executiva**: Cabeçalho com dados principais e KPI de financeiro.
    - **Seções Internas**: Pendências vinculadas, Contatos envolvidos e Financeiro detalhado (incluindo campos imobiliários).
    - **Timeline Automática**: Histórico cronológico de ações registradas no banco (tarefa concluída, status alterado, etc.).

## Detalhes Técnicos
- **Estado Global**: Utilizar `TanStack Query` para sincronização de dados entre componentes.
- **Drag and Drop**: `dnd-kit` para performance e acessibilidade no Kanban.
- **Formulários**: `react-hook-form` com validação `Zod`.
- **Banco de Dados**: Consultas no Supabase otimizadas com filtros e joins para timeline.
- **UX**: Manter o design minimalista com `shadcn/ui` e foco em redução de cliques.

## Próximos Passos (Pós-aprovado)
1. Instalar dependências necessárias (`dnd-kit`, `date-fns`).
2. Implementar os componentes de modal reutilizáveis para o "+ Novo".
3. Desenvolver a lógica da timeline no banco via consultas SQL eficientes.
