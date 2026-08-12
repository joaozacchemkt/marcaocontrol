# Plano de Melhoria da Agenda - Marcão Control

Melhorar o espaçamento da Agenda e implementar controle de zoom para popups/preview, focando em fluidez e usabilidade executiva.

## Mudanças

### UI / Layout
- Refatorar o grid da `CalendarAgenda.tsx` para permitir redimensionamento dinâmico.
- Adicionar uma barra de controle (Slider) para ajustar o "zoom" da interface (tamanho de fontes e cards).
- Ajustar espaçamentos (paddings/margins) para uma visualização mais limpa.

### Componentes
- **CalendarAgenda**: Implementar estado local `zoomLevel` (0.8 a 1.2).
- Aplicar o `zoomLevel` via estilos inline ou classes utilitárias dinâmicas nos containers de preview e navegação.
- Integrar o componente `Slider` do shadcn/ui para o controle de escala.

## Detalhes Técnicos
- Utilizar `framer-motion` para transições suaves de redimensionamento.
- O slider afetará a escala do preview do dia e da navegação lateral.
- Padrão de design: Minimalista, tokens semânticos, dark mode nativo.

## Verificação
- Testar o slider de zoom em diferentes tamanhos de tela (responsividade).
- Validar se o espaçamento se mantém harmônico em todos os níveis de zoom.
