import type { IEmailLayoutInput } from "./types";

import { escapeEmailHtml } from "./components";
import { APP_NAME, EMAIL_COLORS, EMAIL_FONTS, EMAIL_RADIUS } from "./tokens";

function buildLogo(logoUrl?: string): string {
  const logo = logoUrl
    ? `<img src="${escapeEmailHtml(logoUrl)}" width="38" height="38" alt="${APP_NAME} logo" style="display: block; width: 38px; height: 38px; border: 0; border-radius: 9px; object-fit: cover;" />`
    : `<div style="display: inline-block; width: 38px; height: 38px; border-radius: 9px; background-color: ${EMAIL_COLORS.brand.orange2}; color: #ffffff; font-family: ${EMAIL_FONTS.sans}; font-size: 18px; font-weight: 900; line-height: 38px; text-align: center; vertical-align: middle;">H</div>`;

  return `
    <table border="0" cellspacing="0" cellpadding="0" role="presentation">
      <tr>
        <td style="vertical-align: middle;">
          ${logo}
        </td>
        <td style="padding-left: 10px; vertical-align: middle;">
          <span style="font-family: ${EMAIL_FONTS.sans}; font-size: 18px; font-weight: 800; color: ${EMAIL_COLORS.text.primary}; letter-spacing: 0;">${APP_NAME}</span>
        </td>
      </tr>
    </table>
  `;
}

function buildHeader(logoUrl?: string): string {
  return `
    <tr>
      <td style="padding: 28px 36px; border-bottom: 1px solid ${EMAIL_COLORS.card.border};">
        ${buildLogo(logoUrl)}
      </td>
    </tr>
  `;
}

function buildFooter(year: number): string {
  return `
    <tr>
      <td style="padding: 22px 36px; background-color: ${EMAIL_COLORS.card.bgMuted}; border-top: 1px solid ${EMAIL_COLORS.card.border};">
        <p style="font-family: ${EMAIL_FONTS.sans}; font-size: 12px; color: ${EMAIL_COLORS.text.muted}; margin: 0 0 4px 0;">&copy; ${year} ${APP_NAME}. All rights reserved.</p>
        <p style="font-family: ${EMAIL_FONTS.sans}; font-size: 12px; color: ${EMAIL_COLORS.text.muted}; margin: 0;">Freelance work, secured by Stellar smart contracts.</p>
      </td>
    </tr>
  `;
}

export function buildEmailLayout({
  title,
  previewText,
  content,
  logoUrl,
}: IEmailLayoutInput): string {
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
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapedTitle}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.page.bg}; font-family: ${EMAIL_FONTS.sans}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapedPreviewText}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="background-color: ${EMAIL_COLORS.page.bg};">
      <tr>
        <td align="center" style="padding: 44px 16px;">
          <table width="580" border="0" cellspacing="0" cellpadding="0" role="presentation" style="max-width: 580px; width: 100%; background-color: ${EMAIL_COLORS.card.bg}; border-radius: ${EMAIL_RADIUS.xl}; border: 1px solid ${EMAIL_COLORS.card.border}; overflow: hidden; box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.08);">
            ${buildHeader(logoUrl)}
            <tr>
              <td style="padding: 36px;">
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
