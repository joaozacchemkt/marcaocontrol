/**
 * Liga/desliga funcionalidades inteiras.
 *
 * outlook: PAUSADO em 2026-10-02 a pedido do Marcus (e-mail corporativo da
 * SPKR passando por ferramenta que a TI não audita). Credenciais MS_* e
 * OUTLOOK_TOKEN_KEY foram removidas da Vercel. Pra retomar: registrar o app
 * de novo no Entra (com a TI), recadastrar as env vars e virar pra `true`.
 */
export const FEATURES = {
  outlook: false,
} as const;
