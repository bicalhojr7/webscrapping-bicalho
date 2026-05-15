export function normalizeBrazilPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length > 11 && digits.startsWith("0")) {
    return `55${digits.slice(1)}`;
  }

  return digits;
}
