export type CiqBand =
  | "excelente"
  | "adequado"
  | "parcialmente_adequado"
  | "insuficiente"
  | "criticamente_incompleto";

export type EssentialItem = {
  id: string;
  label: string;
  patterns: string[];
  /** Patterns that mark the item as explicitly not applicable */
  notApplicablePatterns?: string[];
};

export type AnamnesisTopic = {
  id: string;
  label: string;
  weight: number;
  patterns: string[];
  essentialItems: EssentialItem[];
  redFlagPatterns: string[];
  /** If true, topic can be omitted when context suggests N/A */
  optionallyApplicable?: boolean;
  contextRequiredPatterns?: string[];
};

export type ItemAssessment = {
  id: string;
  label: string;
  status: "informed" | "missing" | "not_applicable";
};

export type TopicScore = {
  topicId: string;
  label: string;
  weight: number;
  applicable: boolean;
  ciq: number;
  completeness: number;
  clarity: number;
  relevance: number;
  safety: number;
  band: CiqBand;
  items: ItemAssessment[];
};

export type GlobalPenalty = {
  id: string;
  label: string;
  points: number;
  applied: boolean;
};

export type H1Result = {
  cgqa: number;
  cgqaBeforePenalties: number;
  band: CiqBand;
  bandLabel: string;
  topics: TopicScore[];
  penalties: GlobalPenalty[];
  missing: string[];
  confusing: string[];
  irrelevant: string[];
  priorities: string[];
  /** Quantidade de trechos pessoais anonimizados (LGPD) */
  privacyRedactions: number;
};
