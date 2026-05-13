import type { ConnectionStatus, PlatformKind } from '@/lib/supabase/types';

/**
 * Lightweight alerting. Posts to ALERT_WEBHOOK_URL using a Slack-incoming-
 * webhook-compatible payload. Slack, Discord (with /slack suffix), and most
 * no-code relays (Zapier, Make, Pipedream) accept this shape.
 *
 * Set ALERT_WEBHOOK_URL in your env. If unset, alerts are no-ops — useful for
 * dev and CI without flooding a real channel.
 */

export interface ConnectionFlipPayload {
  connectionId: string;
  platform: PlatformKind;
  accountTag?: string | null;
  handle?: string | null;
  fromStatus: ConnectionStatus;
  toStatus: ConnectionStatus;
  note?: string | null;
}

export async function notifyConnectionFlip(payload: ConnectionFlipPayload): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  if (payload.fromStatus === payload.toStatus) return;

  const where = [payload.accountTag, payload.handle].filter(Boolean).join(' · ');
  const arrow = payload.toStatus === 'connected' ? 'recovered' : 'flipped';
  const text =
    `KM Socials · *${payload.platform}*${where ? ` (${where})` : ''} ` +
    `${arrow} *${payload.fromStatus} → ${payload.toStatus}*` +
    (payload.note ? `\n> ${payload.note}` : '');

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        attachments: [
          {
            color: payload.toStatus === 'connected' ? '#22C55E' : '#EF4444',
            fields: [
              { title: 'Platform', value: payload.platform, short: true },
              { title: 'Status', value: `${payload.fromStatus} → ${payload.toStatus}`, short: true },
              { title: 'Connection', value: payload.connectionId, short: false },
              ...(payload.note ? [{ title: 'Detail', value: payload.note, short: false }] : [])
            ]
          }
        ]
      }),
      cache: 'no-store'
    });
  } catch {
    // Alerting is best-effort: a webhook outage must never break a refresh.
  }
}
