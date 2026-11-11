import {
  buildEmailIconMarkup,
  type EmailGlyphIconVariant,
} from './email-assets.util';
import { getPlatformName } from './platform-name.util';

export { getPlatformName } from './platform-name.util';

/**
 * Email palette — Orion Systems navy / blue from the official wordmark.
 */
const EMAIL_COLORS = {
  brand: '#0B2545',
  brandAccent: '#1B365D',
  brandBright: '#3B82F6',
  brandDark: '#7EB6E0',
  success: '#157f3c',
  successDark: '#20b155',
  background: '#fafafa',
  backgroundDark: '#09090b',
  card: '#ffffff',
  cardDark: '#101014',
  foreground: '#09090b',
  foregroundDark: '#fafafa',
  muted: '#71717a',
  mutedDark: '#a1a1aa',
  bodyText: '#52525b',
  bodyTextDark: '#d4d4d8',
  border: '#e4e4e7',
  borderDark: '#1f1f23',
} as const;

const BRAND_PRIMARY_SLOGAN = 'A gateway into the digital world';
const BRAND_SECONDARY_SLOGAN = 'Building today, Empowering tomorrow.';

export type EmailPanelVariant = 'neutral' | 'success' | 'warning' | 'security';
export type EmailIconVariant = EmailGlyphIconVariant;

export interface EmailDetailRow {
  label: string;
  value: string;
}

export interface EmailDocumentOptions {
  subject: string;
  eyebrow?: string;
  eyebrowColor?: string;
  icon?: EmailIconVariant;
  heading: string;
  bodyHtml: string;
  footerNoteHtml?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildBrandNameHtml(): string {
  const name = escapeHtml(getPlatformName());

  return `<p style="margin:0 0 4px;font-size:20px;line-height:1.3;font-weight:700;letter-spacing:0.08em;">
  <span class="email-brand-name" style="color:${EMAIL_COLORS.brand} !important;text-decoration:none;">${name}</span>
</p>`;
}

function buildBrandHeaderHtml(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-brand-header">
    <tr>
      <td align="center" style="padding:28px 24px 20px;border-bottom:1px solid ${EMAIL_COLORS.border};">
        ${buildBrandNameHtml()}
        <p class="email-tagline" style="margin:6px 0 0;font-size:11px;line-height:1.5;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">${escapeHtml(BRAND_PRIMARY_SLOGAN)}</p>
      </td>
    </tr>
  </table>`;
}

function buildEyebrowHtml(
  eyebrow: string,
  eyebrowColor: string,
  icon?: EmailIconVariant,
): string {
  const iconMarkup = icon ? buildEmailIconMarkup(icon, 20) : '';
  const iconCell = iconMarkup
    ? `<td style="padding-right:8px;vertical-align:middle;width:20px;">${iconMarkup}</td>`
    : '';

  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 12px;">
    <tr>
      ${iconCell}
      <td style="vertical-align:middle;">
        <p class="email-eyebrow" style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.15em;text-transform:uppercase;color:${eyebrowColor};font-weight:600;">${escapeHtml(eyebrow)}</p>
      </td>
    </tr>
  </table>`;
}

function buildBrandFooterHtml(footerNote: string): string {
  const year = new Date().getFullYear();

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:20px 24px 28px;">
        ${footerNote}
        <p class="email-tagline" style="margin:0 0 8px;font-size:11px;line-height:1.5;letter-spacing:0.04em;color:${EMAIL_COLORS.muted};">${escapeHtml(BRAND_SECONDARY_SLOGAN)}</p>
        <p class="email-footer-copy" style="margin:0;font-size:10px;line-height:1.5;letter-spacing:0.04em;color:${EMAIL_COLORS.muted};opacity:0.7;">&copy; ${year} ${escapeHtml(getPlatformName())}</p>
      </td>
    </tr>
  </table>`;
}

export function buildEmailDocument(options: EmailDocumentOptions): string {
  const eyebrow = options.eyebrow
    ? buildEyebrowHtml(
        options.eyebrow,
        options.eyebrowColor ?? EMAIL_COLORS.success,
        options.icon,
      )
    : '';
  const footerNote = options.footerNoteHtml ?? '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(options.subject)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { margin: 0 !important; padding: 0 !important; }
  </style>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; }
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }
    .email-brand-name { color: ${EMAIL_COLORS.brand} !important; }
    body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    table { border-collapse: collapse; border-spacing: 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }

    @media (prefers-color-scheme: dark) {
      body, .email-card { background-color: ${EMAIL_COLORS.cardDark} !important; }
      .email-brand-header { border-bottom-color: ${EMAIL_COLORS.borderDark} !important; }
      .email-brand-name { color: ${EMAIL_COLORS.brandDark} !important; }
      .email-tagline, .email-muted, .email-footer-copy { color: ${EMAIL_COLORS.mutedDark} !important; }
      .email-heading { color: ${EMAIL_COLORS.foregroundDark} !important; }
      .email-text { color: ${EMAIL_COLORS.bodyTextDark} !important; }
      .email-eyebrow { color: ${EMAIL_COLORS.successDark} !important; }
      .email-button { background-color: ${EMAIL_COLORS.brandBright} !important; }
      .email-button a { color: #ffffff !important; }
      .email-code-box { background-color: #1a1a1e !important; border-color: ${EMAIL_COLORS.borderDark} !important; }
      .email-divider { border-color: ${EMAIL_COLORS.borderDark} !important; }
    }

    @media (prefers-color-scheme: light) {
      .email-code-box { background-color: #f8f8fa !important; }
    }
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;width:100%;background-color:${EMAIL_COLORS.card};font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${EMAIL_COLORS.foreground};line-height:1.6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:100%;max-width:100%;margin:0;padding:0;background-color:${EMAIL_COLORS.card};border:0;border-radius:0;">
    <tr>
      <td style="margin:0;padding:0;">${buildBrandHeaderHtml()}</td>
    </tr>
    <tr>
      <td style="padding:32px 24px 8px;">
        ${eyebrow}
        <h1 class="email-heading" style="margin:0 0 20px;font-size:26px;line-height:1.3;font-weight:700;color:${EMAIL_COLORS.foreground};letter-spacing:-0.02em;">${escapeHtml(options.heading)}</h1>
        <div style="margin-bottom:16px;">${options.bodyHtml}</div>
      </td>
    </tr>
    <tr>
      <td class="email-footer" style="border-top:1px solid ${EMAIL_COLORS.border};">
        ${buildBrandFooterHtml(footerNote)}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text twin of an HTML email. Sign-in links stay on emails that already have their own URL. */
export function finishEmailText(lines: string[]): string {
  return lines.join('\n');
}

export function buildParagraph(text: string): string {
  return `<p class="email-text" style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${EMAIL_COLORS.bodyText};letter-spacing:0.01em;">${text}</p>`;
}

export function buildDetailRows(rows: EmailDetailRow[]): string {
  const visible = rows.filter((row) => row.value.trim().length > 0);
  if (visible.length === 0) {
    return '';
  }

  const body = visible
    .map(
      (row) => `<tr>
      <td class="email-muted" style="padding:10px 12px 10px 0;width:40%;font-size:13px;line-height:1.5;color:${EMAIL_COLORS.muted};vertical-align:top;">${escapeHtml(row.label)}</td>
      <td class="email-text" style="padding:10px 0;font-size:14px;line-height:1.5;font-weight:600;color:${EMAIL_COLORS.foreground};vertical-align:top;">${escapeHtml(row.value)}</td>
    </tr>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-divider" style="margin:0 0 22px;border-top:1px solid ${EMAIL_COLORS.border};border-bottom:1px solid ${EMAIL_COLORS.border};">
    ${body}
  </table>`;
}

export function buildPrimaryButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
    <tr>
      <td class="email-button" style="border-radius:8px;background-color:${EMAIL_COLORS.brandAccent};box-shadow:0 2px 8px rgba(11,37,69,0.25);">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;border-radius:8px;background-color:${EMAIL_COLORS.brandAccent};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.02em;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function buildInfoPanel(
  contentHtml: string,
  variant: EmailPanelVariant = 'neutral',
): string {
  const palette = {
    neutral: {
      background: '#f8f8fa',
      border: EMAIL_COLORS.border,
      text: EMAIL_COLORS.bodyText,
    },
    success: { background: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    warning: { background: '#fffbeb', border: '#fde68a', text: '#92400e' },
    security: { background: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
  }[variant];

  const icon = buildEmailIconMarkup(variant, 36);

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background-color:${palette.background};border:1px solid ${palette.border};border-radius:10px;">
    <tr>
      <td style="padding:16px 18px;">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-right:14px;vertical-align:top;width:36px;">${icon}</td>
            <td>
              <p style="margin:0;font-size:14px;line-height:1.6;color:${palette.text};">${contentHtml}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

export function buildVerificationCodeBlock(
  code: string,
  label = 'Your verification code',
): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-code-box" style="margin:0 0 24px;background-color:#f8f8fa;border:2px dashed ${EMAIL_COLORS.border};border-radius:10px;">
    <tr>
      <td align="center" style="padding:20px 16px;">
        <p class="email-muted" style="margin:0 0 12px;font-size:11px;line-height:1.4;letter-spacing:0.2em;text-transform:uppercase;color:${EMAIL_COLORS.muted};font-weight:600;">${escapeHtml(label)}</p>
        <p class="email-code" style="margin:0;font-size:34px;font-weight:700;letter-spacing:0.4em;color:${EMAIL_COLORS.foreground};font-family:'SF Mono','Menlo','Monaco',monospace;">${escapeHtml(code)}</p>
      </td>
    </tr>
  </table>`;
}

export function buildUrlFallback(url: string): string {
  return `<p class="email-muted" style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.muted};font-weight:500;">If the button doesn't work, copy this link to your browser:</p>
  <p class="email-text" style="margin:0 0 16px;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.bodyText};word-break:break-all;background-color:#f8f8fa;padding:8px 12px;border-radius:4px;font-family:'SF Mono','Menlo','Monaco',monospace;letter-spacing:0.01em;">${escapeHtml(url)}</p>`;
}

export function buildBulletList(items: string[]): string {
  const listItems = items
    .map(
      (item) =>
        `<li class="email-text" style="margin:0 0 10px;font-size:15px;line-height:1.7;color:${EMAIL_COLORS.bodyText};padding-left:4px;">${escapeHtml(item)}</li>`,
    )
    .join('');

  return `<ul style="margin:0 0 20px;padding-left:24px;list-style-type:disc;">${listItems}</ul>`;
}
