/**
 * Datas: o banco guarda timestamptz (UTC); o painel edita e exibe em
 * America/Sao_Paulo. Valores: centavos inteiros de BRL.
 */
export const TIME_ZONE = "America/Sao_Paulo";

/** Deslocamento (minutos) do fuso para um instante: ex. -180 para UTC-3. */
function offsetMinutes(instant: Date, timeZone = TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** ISO (UTC) → valor de <input type="datetime-local"> em São Paulo. */
export function utcToLocalInput(iso: string | undefined | null, timeZone = TIME_ZONE): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + offsetMinutes(date, timeZone) * 60000);
  return shifted.toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (horário de São Paulo) → ISO com offset. */
export function localInputToUtc(local: string, timeZone = TIME_ZONE): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return undefined;
  const naiveUtc = new Date(`${local}:00Z`);
  // Duas passadas cobrem mudanças de horário (o Brasil não tem horário de
  // verão desde 2019, mas o cálculo não depende disso).
  let instant = new Date(naiveUtc.getTime() - offsetMinutes(naiveUtc, timeZone) * 60000);
  instant = new Date(naiveUtc.getTime() - offsetMinutes(instant, timeZone) * 60000);
  return instant.toISOString();
}

/** "1.234,56" / "1234.56" / "R$ 99,90" → centavos; vazio → undefined; inválido → null. */
export function parseBrlToCents(input: string): number | undefined | null {
  const raw = input.replace(/\s|R\$/g, "");
  if (raw === "") return undefined;
  let normalized = raw;
  if (/,\d{1,2}$/.test(raw)) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: number | undefined | null): string {
  return cents === undefined || cents === null ? "" : brl.format(cents / 100);
}

/** Centavos → texto editável ("199,90"). */
export function centsToInput(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
