const relativeBase = new URL('https://hjaas-build.invalid/');
const safeOrigin = /^https?:\/\/(?:[a-z\d.-]+|\[[a-f\d:]+\])(?::\d+)?$/i;

/** Extend the checked-in policy with the form destination's origin. Relative URLs use 'self'. */
export function headersForEndpoint(template, endpoint) {
  if (!endpoint?.trim()) return template;
  const value = endpoint.trim();
  let url;
  try {
    url = new URL(value, relativeBase);
  } catch {
    throw new Error('VITE_FORM_ENDPOINT must be an HTTP(S) URL or a same-origin path');
  }
  if (!safeOrigin.test(url.origin) || url.username || url.password) {
    throw new Error('VITE_FORM_ENDPOINT must have an HTTP(S) origin and no credentials');
  }
  if (url.origin === relativeBase.origin && !/^(?:https?:|\/\/)/i.test(value)) return template;
  return template.replace("connect-src 'self';", `connect-src 'self' ${url.origin};`);
}
