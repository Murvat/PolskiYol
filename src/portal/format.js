const timeZone = 'Europe/Warsaw';
const timeFormatter = new Intl.DateTimeFormat('az-AZ', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone,
});
const dateFormatter = new Intl.DateTimeFormat('az-AZ', {
  day: 'numeric',
  month: 'long',
  timeZone,
});
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone });
const localFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const moneyFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });

export const fmtTime = (value) => timeFormatter.format(new Date(value));
export const fmtDate = (value) => dateFormatter.format(new Date(value));
export const dayKey = (value) => dayFormatter.format(new Date(value));
export const money = (amount) => moneyFormatter.format(amount / 100) + ' zł';
export const localInput = (value) => localFormatter.format(new Date(value)).replace(' ', 'T');

export function warsawISO(value) {
  const base = Date.parse(value + 'Z');
  const invalidTime = 'Bu yerli vaxt mövcud deyil. Fərqli vaxt seçin.';
  if (!Number.isFinite(base)) throw new Error(invalidTime);

  let guess = base;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = localInput(new Date(guess));
    guess = base - (Date.parse(rendered + 'Z') - guess);
  }

  const output = new Date(guess).toISOString();
  if (localInput(output) !== value) throw new Error(invalidTime);
  return output;
}
