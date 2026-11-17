// Sending the contact form. This is the only place that knows where messages go.

export interface ContactPayload {
  name: string;
  email: string;
  needs: string[];
  message: string;
}

export class SendError extends Error {
  readonly reason: 'not-connected' | 'failed';
  constructor(reason: 'not-connected' | 'failed') {
    super(`contact form: ${reason}`);
    this.reason = reason;
  }
}

// TODO(form-endpoint): the form service gets chosen together with the hosting (Formspree, Netlify Forms,
// a small serverless function...). Put its URL in VITE_FORM_ENDPOINT (site/.env) and adjust the request
// below to the shape that service expects. Until then nothing is ever sent.
export const CONTACT_ENDPOINT: string | undefined = import.meta.env.VITE_FORM_ENDPOINT || undefined;

/**
 * Sends a message to Hui Jie.
 * - With an endpoint configured: posts it, and resolves 'sent' only if the service accepted it.
 * - Dev server only (`npm run dev`), no endpoint: logs the payload and resolves 'test', so the success
 *   state can be reviewed. The form then says plainly that nothing was sent.
 * - Production build, no endpoint: rejects. A real visitor is never told a message was sent when it was not.
 */
export async function submitContact(payload: ContactPayload): Promise<'sent' | 'test'> {
  if (CONTACT_ENDPOINT) {
    let response: Response;
    try {
      response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new SendError('failed');
    }
    if (!response.ok) throw new SendError('failed');
    return 'sent';
  }

  if (import.meta.env.DEV) {
    console.info('[hjaas] contact form payload (test mode, not sent):', payload);
    await new Promise((resolve) => setTimeout(resolve, 700));
    return 'test';
  }

  throw new SendError('not-connected');
}
