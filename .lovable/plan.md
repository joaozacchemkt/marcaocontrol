# Plano de Implementação: Marcão Control

Sistema de gestão pessoal premium e minimalista para centralizar rotina profissional, tarefas, agenda, projetos, contatos, financeiro e ideias.

## 1. Banco de Dados (Supabase)

### Tabelas e Estrutura
- `profiles`: Extensão de auth.users (nome, avatar, cargo, empresa).
- `contacts`: Gestão de contatos (nome, email, telefone, categoria, empresa, etc).
- `projects`: Projetos (nome, categoria, status, prazos, valores).
- `tasks`: Tarefas vinculadas a projetos/contatos (status, prioridade, prazos).
- `events`: Agenda/compromissos (data, hora, objetivo, notas).
- `financial_transactions`: Fluxo de caixa (receita/despesa, categoria, status).
- `ideas`: Banco de insights e oportunidades.
- `activity_history`: Log de atividades para o dashboard.

### Segurança (RLS)
- Habilitar RLS em todas as tabelas.
- Políticas garantindo que usuários acessem apenas seus próprios dados.
- Grants para `authenticated` e `service_role`.

## 2. Interface e UX (Frontend)

### Design System
- **Estética:** Premium, minimalista, fundo claro, cantos arredondados.
- **Tokens:** Uso estrito de tokens semânticos (`bg-background`, `text-foreground`).
- **Navegação:** Menu lateral (Sidebar) fixo.
- **Responsividade:** Mobile-first, otimizado para Desktop.

### Rotas e Componentes
- `Dashboard`: Resumo geral com cards de métricas e listas de prioridades.
- `Pendências`: Kanban e Lista de tarefas com filtros.
- `Agenda`: Visão de calendário (dia/semana/mês).
- `Projetos`: Grid de projetos com página de detalhes (timeline).
- `Contatos`: Agenda inteligente com seção "Preciso retornar".
- `Financeiro`: Painel de receitas/despesas com gráficos discretos.
- `Ideias`: Lista de insights com conversão para projeto.
- `Configurações`: Perfil do usuário.

## 3. Funcionalidades Core (MVP)
- **Botão Rápido "+ Novo":** Modal centralizado para criar qualquer entidade.
- **Busca Global:** Atalho para encontrar contatos, projetos ou tarefas.
- **Relacionamentos:** Vincular tarefas a projetos e contatos.
- **Status Workflows:** Mudança de status em tarefas e projetos.

## Detalhes Técnicos
- **Framework:** TanStack Start v1 (React 19).
- **Backend:** Lovable Cloud (Supabase).
- **State Management:** TanStack Query para server state.
- **UI:** Tailwind CSS v4, Lucide Icons.

---

### Próximos Passos
1. Executar migração SQL inicial para tabelas e RLS.
2. Configurar layout base com Sidebar e Navegação.
3. Implementar Dashboard (Início) com dados de demonstração.
4. Desenvolver módulos individuais (Tarefas, Projetos, etc).
