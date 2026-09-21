import type { IEmailSocialLink, IInfoCardField } from "./types";

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

export function buildEyebrow(text: string): string {
  return `<p style="font-family: ${EMAIL_FONTS.mono}; font-size: 11px; font-weight: 700; color: ${EMAIL_COLORS.brand.accentText}; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px 0;">${escapeEmailHtml(text)}</p>`;
}

export function buildSectionHeading(text: string): string {
  return `<h1 style="font-family: ${EMAIL_FONTS.sans}; font-size: 30px; line-height: 1.08; font-weight: 800; color: ${EMAIL_COLORS.text.primary}; margin: 0 0 16px 0; letter-spacing: 0;">${escapeEmailHtml(text)}</h1>`;
}

export function buildBodyText(text: string): string {
  return `<p style="font-family: ${EMAIL_FONTS.sans}; font-size: 15px; color: ${EMAIL_COLORS.text.secondary}; line-height: 1.65; margin: 0 0 20px 0;">${text}</p>`;
}

export function buildPrimaryButton(label: string, url: string): string {
  const escapedLabel = escapeEmailHtml(label);
  const escapedUrl = escapeEmailHtml(url);

  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin: 28px 0 22px 0;">
      <tr>
        <td align="left">
          <a href="${escapedUrl}" style="display: inline-block; background-color: ${EMAIL_COLORS.brand.orange2}; color: #ffffff; font-family: ${EMAIL_FONTS.mono}; font-size: 12px; font-weight: 800; text-decoration: none; padding: 14px 22px; border-radius: ${EMAIL_RADIUS.md}; text-transform: uppercase; letter-spacing: 0.08em; box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.14);"> ${escapedLabel} </a>
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

export function buildFeatureList(items: string[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td width="18" style="padding: 7px 0; vertical-align: top;">
            <span style="display: inline-block; width: 6px; height: 6px; background-color: ${EMAIL_COLORS.brand.orange2}; border-radius: 999px; margin-top: 7px;"></span>
          </td>
          <td style="padding: 7px 0; vertical-align: top; font-family: ${EMAIL_FONTS.sans}; font-size: 14px; line-height: 1.55; color: ${EMAIL_COLORS.text.secondary};">
            ${escapeEmailHtml(item)}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="background-color: ${EMAIL_COLORS.card.bgAccent}; border: 1px solid ${EMAIL_COLORS.card.borderAccent}; border-radius: ${EMAIL_RADIUS.md}; padding: 12px 16px; margin: 22px 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
        ${rows}
      </table>
    </div>
  `;
}

export function buildSocialLinks(links: readonly IEmailSocialLink[]): string {
  const items = links
    .map(
      (link) =>
        `<a href="${escapeEmailHtml(link.href)}" style="display: inline-block; color: ${EMAIL_COLORS.text.primary}; font-family: ${EMAIL_FONTS.mono}; font-size: 11px; font-weight: 800; text-decoration: none; text-transform: uppercase; letter-spacing: 0.06em; padding: 9px 10px; border: 1px solid ${EMAIL_COLORS.card.border}; border-radius: ${EMAIL_RADIUS.sm}; background-color: ${EMAIL_COLORS.card.bg}; margin: 0 6px 8px 0;">${escapeEmailHtml(link.label)}</a>`,
    )
    .join("");

  return `
    <div style="margin: 26px 0 8px 0;">
      <p style="font-family: ${EMAIL_FONTS.mono}; font-size: 11px; font-weight: 700; color: ${EMAIL_COLORS.text.muted}; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px 0;">Follow Highrable</p>
      <div>${items}</div>
    </div>
  `;
}

export function buildDisclaimerText(text: string): string {
  return `<p style="font-family: ${EMAIL_FONTS.sans}; font-size: 12px; color: ${EMAIL_COLORS.text.muted}; line-height: 1.6; margin: 0;">${escapeEmailHtml(text)}</p>`;
}
