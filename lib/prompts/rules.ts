/**
 * Architectural Rule for Gemini Integration:
 *
 * Product links are ONLY ever set by server-side code from search results or buildPlatformSearchLink.
 * The Gemini model must NEVER output or modify URLs.
 * Products are referenced to the model by ID only.
 */
export const PRODUCT_LINK_SAFETY_RULE = `
CRITICAL SECURITY & INTEGRITY RULE:
- Never generate, hallucinate, alter, or output URLs/hyperlinks.
- Always refer to products exclusively by their unique 'id'.
- Product links, domains, and redirect targets are managed exclusively on the server side.
`.trim();
