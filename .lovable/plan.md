# Workspaces reais do Marcus — plano em fases

O escopo enviado é grande demais para uma única entrega segura. Abaixo está a divisão em fases, preservando toda a arquitetura modular já existente (abas comuns, Faculdade, Timeline, Financeiro, Arquivos). Nada é reconstruído e nenhum dado é removido.

## Princípio de arquitetura (vale para todas as fases)

Dado global + relacionamento com projeto. Tarefas, eventos, contatos, transações, arquivos e atividades continuam nas tabelas globais, sempre filtrados por `project_id`. Módulos novos só ganham tabela quando não existe equivalente global.

---

## Fase 1 — Fundação (esta entrega)

1. **Configurar Ambiente**: cada projeto guarda quais abas estão ativas e em que ordem. Ocultar aba nunca apaga dado. Painel discreto no cabeçalho do projeto.
2. **Projetos Relacionados**: nova tabela `project_relations` (relacionado, subprojeto, estratégico, operacional, origem) + seção "Projetos Relacionados" na Visão Geral, com criação/remoção de vínculo.
3. **Visão Geral executiva padronizada**: responde às 6 perguntas (o que acontece, o que fazer, o que está atrasado, próxima ação, aguardando quem, decisão pendente) — enxuta, sem 15 cards.
4. **Tipos de projeto**: ampliar o enum para cobrir os ambientes reais (perfil imobiliário, reformas/obra, OAB, obra-execução, produto digital, consultoria, doméstico, financeiro pessoal, genérico).
5. **Gestão de tempo em tarefas**: campos tempo estimado e tempo realizado (sem cronômetro).
6. **Tarefas recorrentes (global)**: frequência, intervalo, início, término opcional, próxima execução; ao concluir, gera a próxima ocorrência.
7. **Lembretes (estrutura)**: data, hora, recorrência, entidade relacionada, canal desejado — sem nenhuma integração externa.

## Fase 2 — Ecossistema imobiliário

- **Negócios Imobiliários — Perfil Marcus**: abas Posicionamento, Pesquisa de Mercado, Público-Alvo (personas), Referências, Conteúdo (pipeline Ideia→Publicado), Banco de Temas, Parceiros (via Contatos), Jornada do Cliente, Cases.
- **JPA — Reformas**: Obras, pipeline comercial (Lead→Finalizado), Orçamentos, Profissionais, Fornecedores, Antes e Depois.
- **Papucaia — Obra**: Etapas, Cronograma, tarefas com subtarefas, Profissionais, Pagamentos, Materiais, Medições, Fotos, financeiro da obra.
- **Papucaia — Casa/Leilão**: Aquisição, Legalização (checklist), Custos consolidados (puxando a obra, sem duplicar transações), ROI, Venda, Fotos, Vídeo Final, Case.
- Relações entre os quatro projetos criadas via `project_relations`.

## Fase 3 — Estudos

- **Faculdade de Direito**: mantém tudo o que existe; ganha Biblioteca Jurídica e IA & Ferramentas.
- **Preparação OAB**: Dashboard (contagem para jan/2028, meta 40/80 + meta pessoal), Plano de Estudos, Disciplinas com peso, Banco de Questões, Caderno de Erros (alimentado pelos erros), Simulados, Revisões, Lei Seca, Técnicas, Caligrafia, Rotina, Desempenho, Coach (só arquitetura, sem IA).

## Fase 4 — Consultoria e demais

- **Consultoria Pontual**: Frentes, Plano de Ação (Problema→Ação→Responsável→Prazo→Status), Reuniões, Decisões, Projetos Pontual, Indicadores Executivos, CRM Externo (painel de acompanhamento, não CRM), Integrações (SGA, Assistência 24h, Eventos). Nenhuma base operacional de leads/associados/veículos entra no Marcão Control.
- **Pontual Digital**, **Ulhoa Canto**, **SPKR**: estrutura base, sem inventar escopo.
- **Assuntos Domésticos** e **Financeiro Pessoal**: usando tarefas recorrentes e o financeiro global, com visões próprias.

---

## Detalhes técnicos (Fase 1)

- Migração: `project_relations` (user_id, project_id, related_project_id, relation_type, RLS por `auth.uid()` + GRANTs); `projects.tab_config jsonb`; `tasks.estimated_minutes`, `tasks.actual_minutes`; `task_recurrences`; `reminders`; novos valores no enum `project_type`.
- Frontend: `ProjectDetail.tsx` passa a montar as abas a partir de `tab_config` (com padrão por tipo), novos componentes `ConfigurarAmbiente.tsx`, `ProjectRelations.tsx` e refatoração enxuta de `ProjectOverview.tsx`.

Ao final de cada fase entrego o relatório com workspaces, abas, componentes reutilizados/novos, mudanças no banco, placeholders e limitações.
