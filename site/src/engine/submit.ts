// Sending the contact form. This is the only place that knows where messages go.

export interface ContactPayload {
  name: string;
  email: string;
  needs: string[];
  message: string;
  /** The honeypot: empty from a visitor, who never sees the field. Only api/contact.js judges it. */
  website: string;
}

export const CONTACT_LIMITS = { name: 100, email: 254, needs: 500, message: 4000 } as const;
const CONTACT_TIMEOUT_MS = 15_000;

/** Length across the selected values, including a separator between choices. */
export function needsLength(needs: readonly string[]): number {
  return needs.reduce((length, need) => length + need.length, Math.max(0, needs.length - 1));
}

function withinLimits(payload: ContactPayload): boolean {
  return payload.name.length <= CONTACT_LIMITS.name
    && payload.email.length <= CONTACT_LIMITS.email
    && payload.message.length <= CONTACT_LIMITS.message
    && needsLength(payload.needs) <= CONTACT_LIMITS.needs;
}

export class SendError extends Error {
  readonly reason: 'not-connected' | 'failed' | 'invalid';
  constructor(reason: 'not-connected' | 'failed' | 'invalid') {
    super(`contact form: ${reason}`);
    this.reason = reason;
  }
}

// Production posts to the site's own function, api/contact.js (VITE_FORM_ENDPOINT in .env.production), which
// checks the same fields and limits again. The dev server has no endpoint, so there nothing is ever sent.
export const CONTACT_ENDPOINT: string | undefined = import.meta.env.VITE_FORM_ENDPOINT || undefined;

/** False in a production build with no endpoint: the form then says so up front and Send is off. */
export const canSend: boolean = Boolean(CONTACT_ENDPOINT) || import.meta.env.DEV;

/**
 * Sends a message to Hui Jie.
 * - With an endpoint configured: posts it, and resolves 'sent' only if the service accepted it.
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
      if (!response.ok || request.signal.aborted) throw new SendError('failed');
      return 'sent';
    } catch {
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
