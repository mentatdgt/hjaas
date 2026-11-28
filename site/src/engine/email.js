// The one email rule, for the form (form.ts) and the server (api/contact.js) alike: an address the page lets
// through is one the server takes. Plain JavaScript, because the function runs as it is; email.d.ts gives its type.
//
// One plain address: no spaces, line breaks or control characters, nothing that could name a second one, and a
// last part of two or more characters with no dot in it (so "a@b.com." is refused on the page, not by the server).
export const EMAIL = /^[^\s\p{C}@<>()[\]\\,;:"]+@[^\s\p{C}@<>()[\]\\,;:"]+\.[^\s\p{C}@<>()[\]\\,;:".]{2,}$/u;
