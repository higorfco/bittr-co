export type Concept = {
  i: string;
  d: string;
  c: string;
  t: string[];
  q: string;
  e: number;
  p: number;
  r: number;
  s: number;
  x?: string[];
  n?: number;
  u?: string;
  v?: string;
  a?: string[];
  g?: string;
  k?: string[];
  f?: number;
  b?: number;
  z?: number;
};

export type NegationLexeme = {
  i: string;
  c: "NEG" | "UNK" | "NI" | "NA" | "POS";
  t: string[];
};

export type QualityFlag = {
  i: string;
  c: string;
  t?: string[];
  k?: string[];
  b?: number;
  f?: number;
  z?: number;
  p?: number;
  s?: number;
};

export type Relation = {
  i: string;
  c: string;
  k: string[];
  p?: number;
  s?: number;
};

export type DomainRequirement = {
  d?: string;
  if?: string;
  req: string[];
  w?: number;
};

export type WeightsPack = {
  v: string;
  dim: {
    completude: number;
    clareza: number;
    relevancia: number;
    seguranca: number;
  };
  domains: Record<string, number>;
  penalties: Record<string, number>;
  classes: Array<[number, number, string]>;
};

export type MatchStatus = "POS" | "NEG" | "UNK" | "NI" | "NA" | "ABSENT";

export type ConceptHit = {
  concept: Concept;
  status: MatchStatus;
  matchedTerm?: string;
};
