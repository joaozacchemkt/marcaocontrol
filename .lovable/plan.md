# Plano de Implementação - Etapa Final - Marcão Control

Melhorar o fluxo diário, consolidar a busca global, alertas inteligentes e dashboard alimentado por dados reais, garantindo a persistência total do sistema.

## 1. Módulo de Ideias: Conversão em Projeto
- **Funcionalidade:** Adicionar ação "Transformar em Projeto" nos cards de ideias.
- **Integração:** O modal de Novo Projeto deve abrir pré-preenchido com os dados da ideia.
- **Persistência:** Criar o projeto, atualizar o status da ideia para `virou_projeto` e registrar o link entre as entidades.

## 2. Central de Alertas Inteligentes
- **Hook de Alertas (`useAlerts`):** Monitorar tarefas atrasadas, prioridades do dia e transações financeiras vencendo hoje.
- **Notificações:** Usar `sonner` para exibir alertas agrupados e não invasivos no carregamento do sistema.

## 3. Dashboard Executivo com Dados Reais
- **Prioridades do Dia:** Exibir as 5 tarefas mais críticas (atrasadas > alta prioridade > vencimento hoje).
- **Aguardando Terceiros:** Listar tarefas com status `aguardando_terceiro`, exibindo quem é o responsável externo e há quanto tempo está parado.
- **Projetos em Risco:** Exibir projetos com pendências atrasadas ou prazos próximos.
- **Hoje:** Resumo de compromissos e pendências financeiras do dia.

## 4. Busca Global (⌘K)
- **Componente:** Refinar o `GlobalSearch` para pesquisa em tempo real em Projetos, Contatos, Tarefas e Ideias.
- **Navegação:** Levar o usuário diretamente para o registro ou módulo correspondente.

## 5. Ações Rápidas (UX)
- **Contatos:** Adicionar atalhos para "Criar Pendência" e "Vincular a Projeto" diretamente nos cards.
- **Projetos:** No `ProjectDetail`, adicionar ações para "Nova Pendência", "Nova Receita" e "Nova Despesa".
- **Tarefas:** Permitir concluir ou alterar prioridade/prazo com um clique.

## 6. Persistência e Limpeza
- **Revisão:** Garantir que todas as alterações via Kanban e modais persistem após o reload.
- **Remoção de Mocks:** Substituir quaisquer dados estáticos remanescentes nas rotas principais.

## Detalhes Técnicos
- **TanStack Query:** Garantir invalidação correta dos caches ao converter ideias ou criar transações.
- **Supabase:** Verificar políticas RLS e triggers de `updated_at`.
- **UX/UI:** Manter o padrão visual premium e minimalista.
