import {
  buildBulletList,
  buildEmailDocument,
  buildParagraph,
  escapeHtml,
} from '../../../../core/email/templates/email-template.util';

export function buildRoleAssignmentsUpdatedEmail(params: {
  fullname: string;
  roleNames: string[];
}): { subject: string; html: string; text: string } {
  const subject = 'Your roles were updated';
  const roleListText = params.roleNames.map((role) => `- ${role}`).join('\n');

  const html = buildEmailDocument({
    subject,
    eyebrow: 'Role update',
    icon: 'role',
    heading: 'Your access roles changed',
    bodyHtml: [
      buildParagraph(
        `Hello ${escapeHtml(params.fullname)}, an administrator updated your roles.`,
      ),
      buildParagraph('Your current roles:'),
      buildBulletList(params.roleNames),
      buildParagraph(
        'If you did not expect this change, contact support.',
      ),
    ].join(''),
  });

  const text = [
    `Hello ${params.fullname},`,
    '',
    'An administrator updated your roles.',
    '',
    'Your current roles:',
    roleListText,
    '',
    'If you did not expect this change, contact support.',
  ].join('\n');

  return { subject, html, text };
}
