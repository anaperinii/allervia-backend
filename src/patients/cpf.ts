export function normalizeCpf(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (Number(digits[9]) !== check) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(digits[index]) * (11 - index);
  }
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return Number(digits[10]) === check;
}

export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '***';
  return `***.***.*${digits.slice(7, 9)}-${digits.slice(9)}`;
}
