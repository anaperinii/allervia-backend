export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static create(value: string): PhoneNumber {
    // Remove caracteres não numéricos
    const cleaned = value.replace(/\D/g, '');
    return new PhoneNumber(cleaned);
  }

  getValue(): string {
    return this.value;
  }

  getFormatted(): string {
    // Formata como (XX) XXXXX-XXXX
    if (this.value.length === 11) {
      return `(${this.value.slice(0, 2)}) ${this.value.slice(2, 7)}-${this.value.slice(7)}`;
    }
    return this.value;
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }
}

