# Plano de Desenvolvimento: Marcão Control - Faculdade e Timeline

Este plano foca na finalização do módulo acadêmico e na automação da linha do tempo dos projetos, garantindo persistência real e uma experiência executiva fluida.

## 1. Banco de Dados e Infraestrutura
- Criar tipos `exam_status` e `assignment_status` via migração Supabase.
- Criar tabelas `academic_summaries` (Resumos) e `academic_assignments` (Trabalhos).
- Implementar utilitário `logActivity` em `src/lib/activity.ts` para padronizar o registro de eventos na timeline.

## 2. Automação da Timeline
- Integrar `logActivity` nos componentes:
    - `ProjectModal`: Criação de projeto, mudança de status/prazo.
    - `TaskModal` & `TaskList`: Criação, conclusão e reabertura de tarefas.
    - `EventModal`: Agendamento e realização de compromissos.
    - `TransactionModal`: Registro de fluxos financeiros.
- Refatorar `ProjectTimeline.tsx` para exibir ícones e descrições baseadas nos dados reais da tabela `activity_history`.

## 3. Template Faculdade (Acadêmico)
- **Módulo de Provas**: Criar interface para gestão de provas com status (Estudando, Realizada, etc) e notas.
- **Módulo de Trabalhos**: Sistema de prazos e acompanhamento de entrega.
- **Módulo de Resumos**: Espaço estruturado para material de revisão, separado de anotações rápidas.
- **Notas e Faltas**: Implementar cálculo automático de médias (simples/ponderada) e alertas de limite de faltas (ex: >80%).
- **Seção "Estudar Agora"**: Algoritmo simples de priorização (provas próximas > trabalhos > tarefas atrasadas).
- **Visão Geral**: Dashboard consolidado com resumo do semestre e alertas críticos.

## 4. Persistência e UI/UX
- Garantir que todos os modais novos (`ExamModal`, `SummaryModal`, etc) persistam dados no backend.
- Manter o design system premium com Shadcn/UI, Dark Mode e animações fluidas.
- Validação de dados com Zod para evitar erros de integridade.

## Detalhes Técnicos
- **Entidades Relacionadas**: Provas, Trabalhos e Resumos vinculados obrigatoriamente a uma Matéria (`academic_subjects`).
- **Feedback Visual**: Uso de `sonner` para confirmações discretas e alertas de prazos.
- **Performance**: Uso intensivo de TanStack Query para cache e invalidação inteligente.
