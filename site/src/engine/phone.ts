// Phone numbers for the contact form. This module, and libphonenumber-js with it, is loaded only when the form
// first opens (form.ts imports it dynamically), so the scenes load exactly as fast as before.
// The `max` metadata knows each country's real number ranges, so "1234 5678" is no Singapore number.
// api/contact.js checks the number again with the same library.
import {
  Metadata,
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';

export const DEFAULT_COUNTRY: CountryCode = 'SG';

/** The select's value as a country the library knows (it always is one; Singapore otherwise). */
const known = (code: string): CountryCode => (isSupportedCountry(code) ? code : DEFAULT_COUNTRY);

// Digits, with the spaces, dashes, dots and brackets people write between them. A + only at the very start.
// (The library would also pick a number out of other text, letters and all; the form takes only this.)
const NATIONAL = /^[\d\s().-]*\d[\d\s().-]*$/;
const INTERNATIONAL = /^(?:\+|00)[\d\s().-]*\d[\d\s().-]*$/;

// The library knows each calling code's main country (+44: GB, not Guernsey; +1: US) but does not declare the
// method in its types. phone.test.ts pins what it answers; if it ever goes, the first country with the code is used.
const metadata = new Metadata() as Metadata & { getCountryCodeForCallingCode?: (callingCode: string) => string | undefined };
const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

export function countryName(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export interface CountryOption {
  code: CountryCode;
  name: string;
  dial: string;
}

/** Every country the library knows, A to Z by English name, with Singapore first. */
export function countryOptions(): CountryOption[] {
  const option = (code: CountryCode): CountryOption => ({ code, name: countryName(code), dial: getCountryCallingCode(code) });
  const rest = getCountries()
    .filter((code) => code !== DEFAULT_COUNTRY)
    .map(option)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return [option(DEFAULT_COUNTRY), ...rest];
}

export const dialCode = (code: string): string => getCountryCallingCode(known(code));

const isInternational = (value: string): boolean => /^(?:\+|00)/.test(value);
const withPlus = (value: string): string => value.replace(/^00/, '+');

/** The country to show for a calling code: the one already picked if it has that code, else the code's main country. */
function countryFor(callingCode: string, picked: CountryCode): CountryCode | undefined {
  if (getCountryCallingCode(picked) === callingCode) return picked;
  const main = metadata.getCountryCodeForCallingCode?.(callingCode);
  if (main && isSupportedCountry(main)) return main;
  return getCountries().find((code) => getCountryCallingCode(code) === callingCode);
}

/**
 * A full international number ("+44 7911 123456", "0044 ..."), split into the country to pick and the rest,
 * exactly as typed, without the calling code. Null for anything else, or a code that belongs to no country.
 */
export function splitInternational(value: string, picked: string): { country: CountryCode; national: string } | null {
  const typed = value.trim();
  if (!INTERNATIONAL.test(typed)) return null;
  const number = parsePhoneNumberFromString(withPlus(typed));
  if (!number) return null;
  const code = number.countryCallingCode;
  const country = countryFor(code, known(picked));
  if (!country) return null;
  // Walk past the + (or 00) and the code's digits, keeping whatever the visitor wrote after them.
  let at = typed.startsWith('+') ? 1 : 2;
  let digits = 0;
  while (at < typed.length && digits < code.length) {
    if (/\d/.test(typed[at])) digits++;
    else if (!/[\s().-]/.test(typed[at])) break;
    at++;
  }
  const national = typed.slice(at).replace(/^\)/, '').replace(/^[\s.-]+/, '');
  return national ? { country, national } : null;
}

/**
 * Null when the number is a real one for the picked country (or, written with + or 00, for its own);
 * otherwise the name of the country it was checked against ('' when there is none to name).
 */
export function phoneProblem(value: string, picked: string): string | null {
  const typed = value.trim();
  const country = known(picked);
  if (isInternational(typed)) {
    if (INTERNATIONAL.test(typed) && isValidPhoneNumber(withPlus(typed))) return null;
    const number = INTERNATIONAL.test(typed) ? parsePhoneNumberFromString(withPlus(typed)) : undefined;
    const its = number && countryFor(number.countryCallingCode, country);
    return its ? countryName(its) : '';
  }
  if (NATIONAL.test(typed) && isValidPhoneNumber(typed, country)) return null;
  return countryName(country);
}

/** The number in E.164 ("+6598881135"), or null if it is not a real number. */
export function toE164(value: string, picked: string): string | null {
  if (phoneProblem(value, picked) !== null) return null;
  const typed = value.trim();
  const number = isInternational(typed) ? parsePhoneNumberFromString(withPlus(typed)) : parsePhoneNumberFromString(typed, known(picked));
  return number?.number ?? null;
}

/** "+65 9888 1135" for "+6598881135". */
export function formatInternational(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
