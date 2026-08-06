export type BlurResult = {
  sanitized: string;
  changes: number;
};

function ageBand(age: number): string {
  if (age < 1) return "<1 ano";
  if (age <= 4) return "1–4 anos";
  if (age <= 11) return "5–11 anos";
  if (age <= 17) return "12–17 anos";
  if (age <= 29) return "18–29 anos";
  if (age <= 39) return "30–39 anos";
  if (age <= 49) return "40–49 anos";
  if (age <= 59) return "50–59 anos";
  if (age <= 69) return "60–69 anos";
  if (age <= 79) return "70–79 anos";
  return "80+ anos";
}

/**
 * Remove ou generaliza identificadores pessoais antes da análise (LGPD).
 * Mantém sinais clinicamente úteis, como faixa etária.
 */
export function blurPersonalData(input: string): BlurResult {
  let text = input;
  let changes = 0;

  const apply = (pattern: RegExp, replacement: string | ((...args: string[]) => string)) => {
    text = text.replace(pattern, (...args) => {
      changes += 1;
      if (typeof replacement === "function") {
        return replacement(...(args as string[]));
      }
      return replacement;
    });
  };

  // Documentos e contatos
  apply(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF omitido]");
  apply(/\b\d{2}\.?\d{3}\.?\d{3}-?[0-9Xx]\b/g, "[RG omitido]");
  apply(/\b(?:CNS|cns)[:\s]*\d{15}\b/gi, "[CNS omitido]");
  apply(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4,5}-?\d{4}\b/g, "[telefone omitido]");
  apply(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-mail omitido]");
  apply(/\bCEP\s*[:\-–]?\s*\d{5}-?\d{3}\b/gi, "[CEP omitido]");

  // Endereço / residência / procedência
  apply(
    /\b(?:rua|r\.|av\.|avenida|travessa|alameda|rodovia|estrada)\s+[^,\n;]{3,80}/gi,
    "[endereço omitido]",
  );
  apply(
    /\b(?:reside(?:nte)?(?:\s+em)?|domic[ií]lio(?:\s+em)?|mora(?:\s+em)?|endere[cç]o[:\s]+)\s*[^,\n;.]{3,80}/gi,
    "[residência omitida]",
  );
  apply(/\bnatural(?:idade)?(?:\s+de)?\s*[^,\n;.]{2,60}/gi, "[naturalidade omitida]");
  apply(/\bprocedente(?:\s+de)?\s*[^,\n;.]{2,60}/gi, "[procedência omitida]");

  // Nome / identificação explícita
  apply(
    /\b(?:nome(?:\s+completo)?|paciente|sr\.?a?|sra\.?)\s*[:\-–]?\s*[A-Za-zÁÉÍÓÚÂÊÔÃÕáéíóúâêôãõç][^\n,;]{2,80}/gi,
    "[nome omitido]",
  );

  // Prontuário / registro
  apply(
    /\b(?:prontu[aá]rio|registro|n[uú]mero\s+do\s+atendimento)\s*[:\-–]?\s*\w+/gi,
    "[registro omitido]",
  );

  // Idade exata → faixa etária
  apply(/\b(?:idade\s*[:\-–]?\s*)?(\d{1,3})\s*anos?\b/gi, (full, ageStr) => {
    const age = Number(ageStr);
    if (!Number.isFinite(age) || age > 120) return full;
    return `[faixa etária: ${ageBand(age)}]`;
  });
  apply(/\b(\d{1,3})a\b/g, (full, ageStr) => {
    const age = Number(ageStr);
    if (!Number.isFinite(age) || age < 1 || age > 120) return full;
    return `[faixa etária: ${ageBand(age)}]`;
  });

  // Data de nascimento
  apply(
    /\b(?:DN|data\s+de\s+nascimento)\s*[:\-–]?\s*\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/gi,
    "[data de nascimento omitida]",
  );

  return { sanitized: text, changes };
}
