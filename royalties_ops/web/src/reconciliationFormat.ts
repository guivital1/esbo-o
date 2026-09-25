const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export function cents(value: string): bigint {
  const match = value.match(/^(-?)(\d+)\.(\d{2})$/);
  if (!match) throw new Error("Valor monetário inválido na resposta da API.");
  return (match[1] ? -1n : 1n) * (BigInt(match[2]) * 100n + BigInt(match[3]));
}

export function moneyFromCents(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "−" : ""}R$ ${integer.format(absolute / 100n)},${String(absolute % 100n).padStart(2, "0")}`;
}

export function money(value: string): string {
  try { return moneyFromCents(cents(value)); }
  catch { return "—"; }
}

export function percent(value: string | null): string {
  return value === null ? "—" : `${value.replace(".", ",")}%`;
}

export function monthLabel(period: string): string {
  return month.format(new Date(`${period}-01T00:00:00Z`));
}

export function sourceNumber(value: number | null): string {
  return value === null ? "—" : String(value).padStart(3, "0");
}
