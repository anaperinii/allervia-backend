export interface FieldDiff {
  changedFields: string[];
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}

const SENSITIVE_FIELD_PATTERN =
  /(password|senha|token|secret|hash|salt|credential|authorization|apikey)/i;

export function isSensitiveField(field: string): boolean {
  return SENSITIVE_FIELD_PATTERN.test(field);
}

export function diffFields(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
  allowlist: readonly string[],
): FieldDiff {
  const diff: FieldDiff = {
    changedFields: [],
    oldValues: {},
    newValues: {},
  };

  const fields = allowlist.filter((field) => !isSensitiveField(field));

  for (const field of fields) {
    const before = oldData?.[field];
    const after = newData?.[field];

    if (isEqual(before, after)) continue;

    diff.changedFields.push(field);
    diff.oldValues[field] = before;
    diff.newValues[field] = after;
  }

  return diff;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, val: unknown) => {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) {
      return val;
    }

    const record = val as Record<string, unknown>;

    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = record[key];

        return acc;
      }, {});
  });

  return serialized ?? 'undefined';
}
