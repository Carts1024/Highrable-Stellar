import type { IEmailLayoutInput } from "./types";

import { escapeEmailHtml } from "./components";
import { APP_NAME, EMAIL_COLORS, EMAIL_FONTS, EMAIL_RADIUS } from "./tokens";

// Logo is rendered as a pure CSS shape to avoid external asset dependencies.
// External images in emails are blocked by default in many clients.
function buildLogo(): string {
  return `
    <table border="0" cellspacing="0" cellpadding="0" role="presentation">
      <tr>
        <td style="vertical-align: middle;">
          <div style="display: inline-block; width: 30px; height: 30px; border-radius: ${EMAIL_RADIUS.sm}; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); vertical-align: middle;"></div>
        </td>
        <td style="padding-left: 10px; vertical-align: middle;">
          <span style="font-family: ${EMAIL_FONTS.sans}; font-size: 17px; font-weight: 700; color: ${EMAIL_COLORS.text.primary}; letter-spacing: -0.03em;">${APP_NAME}</span>
        </td>
      </tr>
    </table>
  `;
}

function buildHeader(): string {
  return `
    <tr>
      <td style="padding: 32px 40px; border-bottom: 1px solid ${EMAIL_COLORS.card.border};">
        ${buildLogo()}
      </td>
    </tr>
  `;
}

function buildFooter(year: number): string {
  return `
    <tr>
      <td style="padding: 24px 40px; background-color: ${EMAIL_COLORS.page.bg}; border-top: 1px solid ${EMAIL_COLORS.card.border};">
        <p style="font-family: ${EMAIL_FONTS.sans}; font-size: 12px; color: ${EMAIL_COLORS.text.dimmed}; margin: 0 0 4px 0;">&copy; ${year} ${APP_NAME}. All rights reserved.</p>
        <p style="font-family: ${EMAIL_FONTS.sans}; font-size: 12px; color: ${EMAIL_COLORS.text.dimmed}; margin: 0;">You're receiving this because you have an account on ${APP_NAME}.</p>
      </td>
    </tr>
  `;
}

export function buildEmailLayout({ title, previewText, content }: IEmailLayoutInput): string {
  const year = new Date().getFullYear();
  const escapedTitle = escapeEmailHtml(title);
  const escapedPreviewText = escapeEmailHtml(previewText);

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapedTitle}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.page.bg}; font-family: ${EMAIL_FONTS.sans}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapedPreviewText}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="background-color: ${EMAIL_COLORS.page.bg};">
      <tr>
        <td align="center" style="padding: 48px 16px;">
          <table width="560" border="0" cellspacing="0" cellpadding="0" role="presentation" style="max-width: 560px; width: 100%; background-color: ${EMAIL_COLORS.card.bg}; border-radius: ${EMAIL_RADIUS.xl}; border: 1px solid ${EMAIL_COLORS.card.border}; overflow: hidden;">
            ${buildHeader()}
            <tr>
              <td style="padding: 36px 40px;">
                ${content}
              </td>
            </tr>
            ${buildFooter(year)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
