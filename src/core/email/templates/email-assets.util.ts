export type EmailGlyphIconVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'security'
  | 'welcome'
  | 'role'
  | 'password'
  | 'account';

interface GlyphIconSpec {
  background: string;
  color: string;
  glyph: string;
  fontSize: string;
}

const GLYPH_ICON_SPECS: Record<EmailGlyphIconVariant, GlyphIconSpec> = {
  neutral: { background: '#f4f4f5', color: '#71717a', glyph: 'i', fontSize: '18px' },
  success: { background: '#dcfce7', color: '#157f3c', glyph: '&#10003;', fontSize: '16px' },
  welcome: { background: '#dcfce7', color: '#157f3c', glyph: '&#10003;', fontSize: '16px' },
  warning: { background: '#fef3c7', color: '#92400e', glyph: '!', fontSize: '17px' },
  security: { background: '#ffedd5', color: '#9a3412', glyph: '&#9670;', fontSize: '15px' },
  password: { background: '#ffedd5', color: '#9a3412', glyph: '&#9670;', fontSize: '15px' },
  role: { background: '#e8eef5', color: '#1B365D', glyph: '&#9733;', fontSize: '15px' },
  account: { background: '#e8eef5', color: '#1B365D', glyph: '&#9679;', fontSize: '14px' },
};

export function buildGlyphIconBadge(
  variant: EmailGlyphIconVariant,
  size: number,
): string {
  const spec = GLYPH_ICON_SPECS[variant];
  const radius = Math.max(8, Math.round(size * 0.28));

  return `<table role="presentation" cellspacing="0" cellpadding="0">
    <tr>
      <td width="${size}" height="${size}" align="center" valign="middle" style="width:${size}px;height:${size}px;min-width:${size}px;background-color:${spec.background};border-radius:${radius}px;text-align:center;vertical-align:middle;">
        <span style="display:inline-block;font-size:${spec.fontSize};font-weight:700;color:${spec.color};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1;">${spec.glyph}</span>
      </td>
    </tr>
  </table>`;
}

export function buildEmailIconMarkup(
  variant: EmailGlyphIconVariant,
  size: number,
): string {
  return buildGlyphIconBadge(variant, size);
}
