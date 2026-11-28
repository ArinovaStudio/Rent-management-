// "Flat 101" -> "101". Tables with a Flat column show just the number. A label that is only "Flat" is left as it is.
export const flatNo = (label: string) => label.replace(/^flat[\s\-_.:#]*/i, "").trim() || label;
