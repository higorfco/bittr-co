/** Escala máxima do escore global PANDA93 */
export const PANDA93_MAX = 93;

/** Converte pontuação 0–100 para a escala PANDA93 (0–93). */
export function toPanda93(score100: number): number {
  return Math.max(
    0,
    Math.min(PANDA93_MAX, Math.round((score100 / 100) * PANDA93_MAX)),
  );
}

/**
 * Faixas proporcionais à escala 0–93
 * (espelham 90/75/60/40% da escala clássica).
 */
export function classifyPanda93(score: number): {
  band: string;
  label: string;
} {
  if (score >= 84) return { band: "excelente", label: "Excelente" };
  if (score >= 70) return { band: "adequado", label: "Adequado" };
  if (score >= 56) return { band: "parcial", label: "Parcialmente adequado" };
  if (score >= 37) return { band: "insuficiente", label: "Insuficiente" };
  return { band: "critico", label: "Criticamente incompleto" };
}
