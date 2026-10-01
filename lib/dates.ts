export function taipeiDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

export function currentWeekStart(date = new Date()) {
  const { year, month, day } = taipeiDateParts(date);
  const local = new Date(Date.UTC(year, month - 1, day));
  const weekday = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - weekday + 1);
  return local.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (value: Date) => `${value.getUTCMonth() + 1}/${value.getUTCDate()}`;
  return `${fmt(start)}–${fmt(end)}`;
}

export function formatDate(value: string | null) {
  if (!value) return '未排定';
  const [, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
}
