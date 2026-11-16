/** Alter in vollen Jahren am Stichtag; birth im Format JJJJ-MM-TT */
export function ageOn(birth: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date.getTime() > now.getTime()) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < d)) age -= 1;
  return age;
}

export function isAdult(birth: string, minAge: number, now = new Date()): boolean {
  const age = ageOn(birth, now);
  return age !== null && age >= minAge && age < 120;
}
