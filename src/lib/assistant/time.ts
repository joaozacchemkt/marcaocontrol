/**
 * Datas do assistente sempre no fuso de São Paulo.
 *
 * O servidor (Vercel) roda em UTC: `new Date()`/`todayLocalStr()` lá dão o
 * dia errado depois das 21h. Tudo que o assistente grava ou mostra passa por
 * aqui. O Brasil não tem horário de verão desde 2019, então o offset é fixo.
 */
export const TZ = "America/Sao_Paulo";
const OFFSET = "-03:00";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateStr(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isTimeStr(v: string): boolean {
  return TIME_RE.test(v);
}

function parts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Hoje em São Paulo, "YYYY-MM-DD". */
export function todaySP(now = new Date()): string {
  return parts(now).date;
}

/** Agora em São Paulo, ex.: "quarta-feira, 30/09/2026 14:32". */
export function nowLabelSP(now = new Date()): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" }).format(now);
  const { date, time } = parts(now);
  const [y, m, d] = date.split("-");
  return `${weekday}, ${d}/${m}/${y} ${time}`;
}

/** Data + hora de São Paulo → instante ISO (UTC) pra colunas timestamptz. */
export function instantSP(date: string, time: string): string {
  return new Date(`${date}T${time}:00${OFFSET}`).toISOString();
}

/** Instante do banco → { date, time } em São Paulo (pra mostrar ao modelo). */
export function splitInstantSP(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return parts(d);
}

/** Soma dias a "YYYY-MM-DD" (aritmética de calendário, sem fuso). */
export function addDaysStr(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
