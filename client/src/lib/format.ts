export function formatDecimal(value: number, fractionDigits = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatAreaHa(value: number): string {
  return `${formatDecimal(value)} ha`;
}
