export type FieldStatus = "present" | "partial" | "missing";

export type CrucialField = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  required: boolean;
};

export type ReviewTemplate = {
  id: string;
  name: string;
  summary: string;
  fields: CrucialField[];
  logicSteps: string[];
};

export type FieldAssessment = {
  field: CrucialField;
  status: FieldStatus;
  note: string;
  matchedTerms: string[];
};

export type LogicStepAssessment = {
  step: string;
  supported: boolean;
  note: string;
};

export type ReviewResult = {
  completeness: number;
  missingCount: number;
  partialCount: number;
  presentCount: number;
  fields: FieldAssessment[];
  logic: LogicStepAssessment[];
  verdict: string;
  recommendations: string[];
};
