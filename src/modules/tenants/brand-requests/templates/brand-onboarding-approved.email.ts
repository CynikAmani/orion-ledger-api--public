import { getPlatformName } from '../../../../core/email/templates/platform-name.util';
import {
  buildDetailRows,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
  finishEmailText,
} from '../../../../core/email/templates/email-template.util';

export function buildBrandOnboardingApprovedEmail(params: {
  fullname: string;
  brandName: string;
  slug: string;
  tenantCode: string;
}): { subject: string; html: string; text: string } {
  const platformName = getPlatformName();
  const subject = `Your brand onboarding request for ${params.brandName} has been approved`;

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Brand onboarding',
    icon: 'success',
    heading: 'Brand workspace approved',
    bodyHtml: [
      buildParagraph(
        `Dear ${escapeHtml(params.fullname)}, ${escapeHtml(platformName)} has approved your request to onboard ${escapeHtml(params.brandName)}.`,
      ),
      buildDetailRows([
        { label: 'Organization', value: params.brandName },
        { label: 'Workspace slug', value: params.slug },
        { label: 'Tenant code', value: params.tenantCode },
      ]),
      buildParagraph(
        'You are now the administrator for this organization. Sign in again to open the workspace.',
      ),
    ].join(''),
  });

  const text = finishEmailText([
    `Dear ${params.fullname},`,
    '',
    `${platformName} has approved your request to onboard ${params.brandName}.`,
    '',
    `Organization: ${params.brandName}`,
    `Workspace slug: ${params.slug}`,
    `Tenant code: ${params.tenantCode}`,
    '',
    'You are now the administrator for this organization. Sign in again to open the workspace.',
  ]);

  return { subject, html, text };
}
