import type { IInfoCardField } from "./types";

import { EMAIL_COLORS, EMAIL_FONTS, EMAIL_RADIUS } from "./tokens";

// Using table-based layout for all components to ensure maximum compatibility
// across email clients (Outlook, Gmail, Apple Mail, etc.).

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSectionHeading(text: string): string {
  return `<h2 style="font-family: ${EMAIL_FONTS.sans}; font-size: 22px; font-weight: 700; color: ${EMAIL_COLORS.text.primary}; margin: 0 0 10px 0; letter-spacing: -0.02em;">${escapeEmailHtml(text)}</h2>`;
}

export function buildBodyText(text: string): string {
  return `<p style="font-family: ${EMAIL_FONTS.sans}; font-size: 15px; color: ${EMAIL_COLORS.text.secondary}; line-height: 1.65; margin: 0 0 24px 0;">${text}</p>`;
}

export function buildOtpBlock(token: string): string {
  const escapedToken = escapeEmailHtml(token);

  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <div style="display: inline-block; background-color: ${EMAIL_COLORS.card.bgMuted}; border: 1px solid ${EMAIL_COLORS.card.border}; border-radius: ${EMAIL_RADIUS.lg}; padding: 22px 44px;">
            <span style="font-family: ${EMAIL_FONTS.mono}; font-size: 36px; font-weight: 700; letter-spacing: 10px; color: ${EMAIL_COLORS.text.primary}; line-height: 1;">${escapedToken}</span>
          </div>
          <p style="font-family: ${EMAIL_FONTS.sans}; color: ${EMAIL_COLORS.text.dimmed}; font-size: 12px; margin: 10px 0 0 0; text-align: center;">This code expires in 10 minutes.</p>
        </td>
      </tr>
    </table>
  `;
}

export function buildPrimaryButton(label: string, url: string): string {
  const escapedLabel = escapeEmailHtml(label);
  const escapedUrl = escapeEmailHtml(url);

  // Using a solid color (not gradient) for reliable rendering across email clients.
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin: 28px 0;">
      <tr>
        <td align="center">
          <a href="${escapedUrl}" style="display: inline-block; background-color: ${EMAIL_COLORS.brand.primary}; color: #ffffff; font-family: ${EMAIL_FONTS.sans}; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: ${EMAIL_RADIUS.md}; letter-spacing: -0.01em;">${escapedLabel}</a>
        </td>
      </tr>
    </table>
  `;
}

export function buildInfoCard(fields: IInfoCardField[]): string {
  const rows = fields
    .map(
      (field, index) => `
    <tr>
      <td style="padding: ${index === 0 ? "0" : "12px"} 0 ${index === fields.length - 1 ? "0" : "12px"} 0; ${index < fields.length - 1 ? `border-bottom: 1px solid ${EMAIL_COLORS.card.borderSubtle};` : ""}">
        <span style="font-family: ${EMAIL_FONTS.sans}; font-size: 11px; color: ${EMAIL_COLORS.text.dimmed}; text-transform: uppercase; letter-spacing: 0.07em; display: block; margin-bottom: 3px;">${escapeEmailHtml(field.label)}</span>
        <span style="font-family: ${EMAIL_FONTS.sans}; font-size: 15px; font-weight: 600; color: ${field.accentColor ?? EMAIL_COLORS.text.primary};">${escapeEmailHtml(field.value)}</span>
      </td>
    </tr>
  `,
    )
    .join("");

  return `
    <div style="background-color: ${EMAIL_COLORS.card.bgMuted}; border: 1px solid ${EMAIL_COLORS.card.border}; border-radius: ${EMAIL_RADIUS.md}; padding: 18px 20px; margin: 24px 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
        ${rows}
      </table>
    </div>
  `;
}

export function buildSecurityAlert(message: string): string {
  return `
    <div style="background-color: ${EMAIL_COLORS.semantic.dangerBg}; border: 1px solid ${EMAIL_COLORS.semantic.dangerBorder}; border-radius: ${EMAIL_RADIUS.md}; padding: 14px 16px; margin: 20px 0;">
      <p style="font-family: ${EMAIL_FONTS.sans}; color: ${EMAIL_COLORS.semantic.dangerFg}; font-size: 13px; margin: 0; line-height: 1.6;">
        <strong>Security notice:</strong> ${escapeEmailHtml(message)}
      </p>
    </div>
  `;
}

export function buildDisclaimerText(text: string): string {
  return `<p style="font-family: ${EMAIL_FONTS.sans}; font-size: 12px; color: ${EMAIL_COLORS.text.dimmed}; line-height: 1.6; margin: 0; text-align: center;">${escapeEmailHtml(text)}</p>`;
}
