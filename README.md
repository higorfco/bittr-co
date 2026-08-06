# BITTR CO.

Ferramenta mobile-first para **revisar informações**, **identificar dados cruciais ausentes** e **avaliar a montagem lógica**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Deploy previsto: [Vercel](https://vercel.com)
- Código: GitHub

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## O que a v0.1 faz

1. Escolhe um modo: pesquisa, brief de decisão ou montagem narrativa
2. Cola o texto a revisar
3. Recebe completude, campos ausentes/parciais, elos lógicos fracos e próximos reforços

## Deploy (GitHub + Vercel)

1. Publique o repositório no GitHub
2. Importe o projeto em [vercel.com/new](https://vercel.com/new)
3. Framework: Next.js (detectado automaticamente)
4. Cada push em `main` gera um novo deploy

Ou via CLI:

```bash
npx vercel
```
