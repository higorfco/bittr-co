import type { ReviewTemplate } from "./types";

export const templates: ReviewTemplate[] = [
  {
    id: "pesquisa",
    name: "Revisão de pesquisa",
    summary:
      "Avalia se um conjunto de informações tem base suficiente para sustentar uma conclusão.",
    fields: [
      {
        id: "contexto",
        label: "Contexto",
        description: "Onde e em que situação o fato ou problema aparece.",
        keywords: ["contexto", "cenário", "situação", "ambiente", "background"],
        required: true,
      },
      {
        id: "fonte",
        label: "Fonte / origem",
        description: "De onde veio a informação e se é rastreável.",
        keywords: ["fonte", "origem", "referência", "citação", "documento", "entrevista"],
        required: true,
      },
      {
        id: "evidencia",
        label: "Evidência",
        description: "Dados, números, trechos ou observações que sustentam o ponto.",
        keywords: ["evidência", "dado", "prova", "número", "métrica", "observação", "resultado"],
        required: true,
      },
      {
        id: "atores",
        label: "Atores envolvidos",
        description: "Quem participa, decide ou é afetado.",
        keywords: ["quem", "ator", "pessoa", "empresa", "órgão", "responsável"],
        required: true,
      },
      {
        id: "tempo",
        label: "Marco temporal",
        description: "Quando ocorreu ou a que período se refere.",
        keywords: ["quando", "data", "prazo", "período", "ano", "mês", "cronograma"],
        required: true,
      },
      {
        id: "hipotese",
        label: "Hipótese / tese",
        description: "O que se pretende demonstrar ou questionar.",
        keywords: ["hipótese", "tese", "afirmação", "proposta", "questão"],
        required: true,
      },
      {
        id: "conclusao",
        label: "Conclusão",
        description: "O encerramento lógico derivado das evidências.",
        keywords: ["conclusão", "portanto", "assim", "resultado final", "síntese"],
        required: true,
      },
      {
        id: "limitacoes",
        label: "Limitações",
        description: "O que ainda é incerto, incompleto ou fora do escopo.",
        keywords: ["limitação", "incerteza", "lacuna", "risco", "caveat", "parcial"],
        required: false,
      },
    ],
    logicSteps: [
      "Contexto e atores estão definidos",
      "Evidências são atribuídas a fontes",
      "Hipótese se conecta às evidências",
      "Conclusão decorre da hipótese sem salto injustificado",
    ],
  },
  {
    id: "decisao",
    name: "Brief de decisão",
    summary:
      "Verifica se uma decisão tem dados críticos para montagem lógica e ação.",
    fields: [
      {
        id: "objetivo",
        label: "Objetivo",
        description: "O resultado desejado da decisão.",
        keywords: ["objetivo", "meta", "alvo", "resultado esperado"],
        required: true,
      },
      {
        id: "opcoes",
        label: "Opções consideradas",
        description: "Alternativas em avaliação.",
        keywords: ["opção", "alternativa", "cenário A", "cenário B", "caminho"],
        required: true,
      },
      {
        id: "criterios",
        label: "Critérios",
        description: "Como as opções serão comparadas.",
        keywords: ["critério", "peso", "prioridade", "requisito", "métrica"],
        required: true,
      },
      {
        id: "custos",
        label: "Custos e restrições",
        description: "Limites de tempo, orçamento ou capacidade.",
        keywords: ["custo", "orçamento", "prazo", "restrição", "capacidade", "budget"],
        required: true,
      },
      {
        id: "riscos",
        label: "Riscos",
        description: "O que pode falhar e o impacto.",
        keywords: ["risco", "impacto", "mitigação", "falha", "ameaça"],
        required: true,
      },
      {
        id: "recomendacao",
        label: "Recomendação",
        description: "A escolha sugerida e o porquê.",
        keywords: ["recomendação", "sugerimos", "escolher", "proposta", "decisão"],
        required: true,
      },
      {
        id: "proximo",
        label: "Próximo passo",
        description: "Ação imediata após a decisão.",
        keywords: ["próximo passo", "ação", "responsável", "prazo de execução", "implementar"],
        required: true,
      },
    ],
    logicSteps: [
      "Objetivo e critérios estão alinhados",
      "Opções cobrem o espaço de decisão",
      "Custos e riscos foram pesados",
      "Recomendação aponta um próximo passo executável",
    ],
  },
  {
    id: "narrativa",
    name: "Montagem narrativa",
    summary:
      "Identifica ausência de dados cruciais para uma narrativa coerente e verificável.",
    fields: [
      {
        id: "gancho",
        label: "Gancho",
        description: "O ponto de entrada que justifica a atenção.",
        keywords: ["gancho", "problema", "tensão", "abertura", "por que importa"],
        required: true,
      },
      {
        id: "fatos",
        label: "Fatos-chave",
        description: "Elementos verificáveis da história.",
        keywords: ["fato", "aconteceu", "registro", "evento", "informação"],
        required: true,
      },
      {
        id: "causa",
        label: "Causa / mecanismo",
        description: "Como ou por que os fatos se encadearam.",
        keywords: ["porque", "causa", "mecanismo", "motivo", "devido"],
        required: true,
      },
      {
        id: "impacto",
        label: "Impacto",
        description: "Quem é afetado e com que intensidade.",
        keywords: ["impacto", "efeito", "consequência", "afetados", "resultado"],
        required: true,
      },
      {
        id: "contraponto",
        label: "Contraponto",
        description: "Visão alternativa ou contestação.",
        keywords: ["por outro lado", "contraponto", "crítica", "contestação", "alternativa"],
        required: false,
      },
      {
        id: "fechamento",
        label: "Fechamento",
        description: "Síntese que amarra a montagem lógica.",
        keywords: ["fechamento", "em suma", "conclusão", "síntese", "ao fim"],
        required: true,
      },
    ],
    logicSteps: [
      "Gancho introduz um problema real",
      "Fatos sustentam a causa proposta",
      "Impacto está ligado aos fatos",
      "Fechamento não introduz fato novo sem suporte",
    ],
  },
];

export function getTemplate(id: string): ReviewTemplate {
  return templates.find((t) => t.id === id) ?? templates[0];
}
