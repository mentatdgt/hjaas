// Sending the contact form. This is the only place that knows where messages go.

export interface ContactPayload {
  name: string;
  /** At least one of email and phone is there; a missing one is left out, never sent empty. */
  email?: string;
  /** E.164, "+6598881135". */
  phone?: string;
  needs: string[];
  message: string;
  /** The honeypot ("Leave this empty"): empty from a visitor, who never sees the field. Only api/contact.js judges it. */
  extra: string;
}

export const CONTACT_LIMITS = { name: 100, email: 254, phone: 20, needs: 500, message: 4000 } as const;
const CONTACT_TIMEOUT_MS = 15_000;

/** Length across the selected values, including a separator between choices. */
export function needsLength(needs: readonly string[]): number {
  return needs.reduce((length, need) => length + need.length, Math.max(0, needs.length - 1));
}

function withinLimits(payload: ContactPayload): boolean {
  return payload.name.length <= CONTACT_LIMITS.name
    && (payload.email ?? '').length <= CONTACT_LIMITS.email
    && (payload.phone ?? '').length <= CONTACT_LIMITS.phone
    && payload.message.length <= CONTACT_LIMITS.message
    && needsLength(payload.needs) <= CONTACT_LIMITS.needs;
}

/**
 * Why a message was not sent:
 * - 'busy': too many tries for now (429). `retryAfter` is the wait in seconds, if the server said.
 * - 'failed': no connection, a timeout, the server's own trouble (5xx), or any answer that is not its JSON {"ok":true}.
 * - 'not-connected': a production build with no endpoint. 'invalid': over the limits, never posted.
 */
export type SendFailure = 'not-connected' | 'failed' | 'invalid' | 'busy';

export class SendError extends Error {
  readonly reason: SendFailure;
  readonly retryAfter: number | undefined;
  constructor(reason: SendFailure, retryAfter?: number) {
    super(`contact form: ${reason}`);
    this.reason = reason;
    this.retryAfter = retryAfter;
  }
}

/** Retry-After as whole seconds from now: a number of seconds or an HTTP date. Undefined if missing or unreadable. */
export function retryAfterSeconds(value: string | null, now = Date.now()): number | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (/^\d+$/.test(text)) return Number(text);
  // An HTTP date names its day and month ("Sat, 28 Nov 2026 10:01:30 GMT"); "-5" is no date, whatever Date.parse says.
  const at = /[a-z]{3}/i.test(text) ? Date.parse(text) : NaN;
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000));
}

/** True only for the function's own success: a JSON body that is an object with ok: true. */
async function acknowledged(response: Response): Promise<boolean> {
  try {
    const body: unknown = JSON.parse(await response.text());
    return typeof body === 'object' && body !== null && (body as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}

// Production posts to the site's own function, api/contact.js (VITE_FORM_ENDPOINT in .env.production), which
// checks the same fields and limits again. The dev server has no endpoint, so there nothing is ever sent.
export const CONTACT_ENDPOINT: string | undefined = import.meta.env.VITE_FORM_ENDPOINT || undefined;

/** False in a production build with no endpoint: the form then says so up front and Send is off. */
export const canSend: boolean = Boolean(CONTACT_ENDPOINT) || import.meta.env.DEV;

/**
 * Sends a message to Hui Jie.
 * - With an endpoint configured: posts it, and resolves 'sent' only if the function answered 2xx with JSON
 *   {"ok":true}. An empty body, an HTML page (a misrouted endpoint) or broken JSON is a failure; 429 is 'busy'.
 * - Dev server only (`npm run dev`), no endpoint: logs the payload and resolves 'test', so the success
 *   state can be reviewed. The form then says plainly that nothing was sent.
 * - Production build, no endpoint: rejects. A real visitor is never told a message was sent when it was not.
 */
export async function submitContact(payload: ContactPayload, signal?: AbortSignal): Promise<'sent' | 'test'> {
  if (!withinLimits(payload)) throw new SendError('invalid');
  if (signal?.aborted) throw new SendError('failed');
  if (CONTACT_ENDPOINT) {
    const request = new AbortController();
    let cancel!: () => void;
    const cancelled = new Promise<never>((_, reject) => {
      cancel = () => {
        request.abort();
        reject(new SendError('failed'));
      };
    });
    signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(cancel, CONTACT_TIMEOUT_MS);
    try {
      const response = await Promise.race([
        fetch(CONTACT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: request.signal,
        }),
        cancelled,
      ]);
      if (response.status === 429) throw new SendError('busy', retryAfterSeconds(response.headers.get('Retry-After')));
      // The body is read inside the same 15 seconds as the answer.
      const ok = response.ok && (await Promise.race([acknowledged(response), cancelled]));
      if (!ok || request.signal.aborted) throw new SendError('failed');
      return 'sent';
    } catch (error) {
      if (error instanceof SendError && error.reason === 'busy' && !request.signal.aborted) throw error;
      throw new SendError('failed');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
    }
  }

  if (import.meta.env.DEV) {
    console.info('[hjaas] contact form payload (test mode, not sent):', payload);
    await new Promise((resolve) => setTimeout(resolve, 700));
    return 'test';
  }

  throw new SendError('not-connected');
}
