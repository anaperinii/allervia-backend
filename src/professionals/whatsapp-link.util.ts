const DEFAULT_COUNTRY_CODE = '55';

export function normalizeWhatsappNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');

  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return digits;
  }

  return `${DEFAULT_COUNTRY_CODE}${digits}`;
}

export function buildWhatsappLink(
  phoneNumber: string,
  message: string,
): string {
  const number = normalizeWhatsappNumber(phoneNumber);

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
