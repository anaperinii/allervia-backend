import { addDate } from './date.utils';

describe('addDate', () => {
  it.each([
    [new Date(2024, 0, 22, 10, 30), 7, new Date(2024, 0, 29, 10, 30)],
    [new Date(2024, 0, 29, 10, 30), 7, new Date(2024, 1, 5, 10, 30)],
    [new Date(2024, 11, 28, 10, 30), 7, new Date(2025, 0, 4, 10, 30)],
    [new Date(2024, 1, 28, 10, 30), 1, new Date(2024, 1, 29, 10, 30)],
    [new Date(2025, 1, 28, 10, 30), 1, new Date(2025, 2, 1, 10, 30)],
  ])(
    'adds calendar days to %s without using the current month/year',
    (date, days, expected) => {
      const original = date.getTime();
      expect(addDate(date, days)).toEqual(expected);
      expect(date.getTime()).toBe(original);
    },
  );
});
