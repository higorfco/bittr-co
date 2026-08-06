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

## Modo H1 · PANDA93

Único modo ativo. Para o texto da anamnese:

1. Anonimiza dados pessoais (LGPD): nome, documentos, contatos, endereço; idade vira faixa etária
2. Consulta o pacote **anamnese_terminologia_br_v1** (sem domínio de identificação)
3. Calcula o escore global **PANDA93** (0–93) e escores por tópico na mesma escala
4. Exibe apenas **escores** e **informações faltantes**
