import { expect, it } from 'vitest';
import { countryOptions, formatInternational, phoneProblem, splitInternational, toE164 } from './phone';

it('lists Singapore first, then the rest A to Z by English name, each once', () => {
  const options = countryOptions();
  expect(options[0]).toEqual({ code: 'SG', name: 'Singapore', dial: '65' });
  expect(options.filter((o) => o.code === 'SG')).toHaveLength(1);
  const names = options.slice(1).map((o) => o.name);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  expect(options).toContainEqual({ code: 'GB', name: 'United Kingdom', dial: '44' });
});

it.each([
  ['9888 1135'], ['98881135'], ['9888-1135'], ['9888.1135'], ['(9888) 1135'], [' 6123 4567 '], ['+65 9888 1135'], ['0065 9888 1135'],
])('takes %j as a Singapore number', (number) => {
  expect(phoneProblem(number, 'SG')).toBe(null);
  expect(toE164(number, 'SG')).toBe(number.includes('6123') ? '+6561234567' : '+6598881135');
});

it.each([
  ['1234 5678'], ['9888 113'], ['9888 11355'], ['9888 1135 abc'], ['9888/1135'], ['98+881135'], ['ext'], ['7911 123456'],
])('refuses %j for Singapore, naming it', (number) => {
  expect(phoneProblem(number, 'SG')).toBe('Singapore');
  expect(toE164(number, 'SG')).toBe(null);
});

it('checks a number written with its own + code against that code, whatever is picked', () => {
  expect(phoneProblem('+44 7911 123456', 'SG')).toBe(null);
  expect(toE164('+44 7911 123456', 'SG')).toBe('+447911123456');
  expect(phoneProblem('+44 123', 'SG')).toBe('United Kingdom');
  expect(phoneProblem('+999 1234 5678', 'SG')).toBe('');
});

it('takes a UK number in the UK, with or without its leading 0', () => {
  for (const number of ['7911 123456', '07911 123456', '020 7946 0958']) expect(phoneProblem(number, 'GB')).toBe(null);
  expect(toE164('07911 123456', 'GB')).toBe('+447911123456');
});

it.each([
  ['+44 7911 123456', 'SG', { country: 'GB', national: '7911 123456' }], // the code's main country, not Guernsey
  ['0044 (0)7911 123456', 'SG', { country: 'GB', national: '(0)7911 123456' }],
  ['+(44) 7911-123456', 'SG', { country: 'GB', national: '7911-123456' }],
  ['+44 7911 123456', 'GG', { country: 'GG', national: '7911 123456' }], // already a +44 country: kept
  ['+1 212 555 0123', 'SG', { country: 'US', national: '212 555 0123' }],
  ['+7 912 345 67 89', 'SG', { country: 'RU', national: '912 345 67 89' }],
  ['+65 9888 1135', 'SG', { country: 'SG', national: '9888 1135' }],
  ['+61 412 345 678', 'SG', { country: 'AU', national: '412 345 678' }],
])('splits %j (picked %s)', (typed, picked, expected) => {
  expect(splitInternational(typed, picked)).toEqual(expected);
});

it.each([['9888 1135'], ['+'], ['+4'], ['+999 1234'], ['+800 1234 5678'], ['+44 abc']])('leaves %j as it is', (typed) => {
  expect(splitInternational(typed, 'SG')).toBe(null);
});

it('writes a number the international way', () => {
  expect(formatInternational('+6598881135')).toBe('+65 9888 1135');
  expect(formatInternational('+447911123456')).toBe('+44 7911 123456');
});
