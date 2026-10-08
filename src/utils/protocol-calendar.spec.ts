import { addProtocolCalendarDays, localCalendarDay } from './protocol-calendar';
describe('protocol calendar', () => {
  it.each([
    [
      '2026-01-29T13:30:00Z',
      7,
      'America/Sao_Paulo',
      '2026-02-05T13:30:00.000Z',
    ],
    [
      '2026-12-29T13:30:00Z',
      7,
      'America/Sao_Paulo',
      '2027-01-05T13:30:00.000Z',
    ],
    [
      '2024-02-28T13:30:00Z',
      1,
      'America/Sao_Paulo',
      '2024-02-29T13:30:00.000Z',
    ],
    ['2026-03-07T15:00:00Z', 1, 'America/New_York', '2026-03-08T14:00:00.000Z'],
    ['2026-10-31T14:00:00Z', 1, 'America/New_York', '2026-11-01T15:00:00.000Z'],
  ])('adds local days at %s', (start, days, zone, expected) => {
    const input = new Date(start);
    expect(addProtocolCalendarDays(input, days, zone).toISOString()).toBe(
      expected,
    );
    expect(input.toISOString()).toBe(new Date(start).toISOString());
  });
  it('rejects nonexistent local wall time during DST jump', () => {
    expect(() =>
      addProtocolCalendarDays(
        new Date('2026-03-07T07:30:00Z'),
        1,
        'America/New_York',
      ),
    ).toThrow(RangeError);
  });
  it('uses the clinic day across UTC midnight', () => {
    expect(
      localCalendarDay(new Date('2026-01-02T01:00:00Z'), 'America/Sao_Paulo'),
    ).toBe('2026-1-1');
  });
});
