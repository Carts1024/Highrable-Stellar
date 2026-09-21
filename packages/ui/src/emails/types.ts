export interface IWaitlistConfirmationEmailProps {
  readonly email: string;
  readonly siteUrl: string;
}

export interface IEmailLayoutInput {
  readonly title: string;
  readonly previewText: string;
  readonly content: string;
  readonly logoUrl?: string;
}

export interface IInfoCardField {
  readonly label: string;
  readonly value: string;
  readonly accentColor?: string;
}

export interface IEmailSocialLink {
  readonly label: string;
  readonly href: string;
}
