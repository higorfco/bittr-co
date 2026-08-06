# BITTR CO.

Ferramenta mobile-first para avaliar a **qualidade da anamnese** pelo algoritmo **H1** (Coeficiente de Completude Clínica).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Deploy: [Vercel](https://bittr-co.vercel.app)
- Código: [GitHub](https://github.com/higorfco/bittr-co)

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Modo H1

Único modo ativo. Para o texto da anamnese:

1. Calcula **CIQ** por tópico (Completude 50 + Clareza 20 + Relevância 20 + Segurança 10)
2. Calcula **CGQA** por média ponderada
3. Aplica penalidades globais de segurança
4. Lista faltantes, confusos, irrelevantes e prioridades de correção

Tópicos não aplicáveis saem do denominador.
