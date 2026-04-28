export interface ISignInEmailProps {
  readonly token: string;
}

export interface IPasswordResetEmailProps {
  readonly token: string;
}

export interface IAccountExistsEmailProps {
  readonly email: string;
  readonly siteUrl: string;
}

export interface IWorkspaceInviteEmailProps {
  readonly workspaceName: string;
  readonly inviterName: string;
  readonly role: string;
  readonly inviteUrl: string;
}

export interface IWorkspaceAdminAssignedEmailProps {
  readonly workspaceName: string;
  readonly assignedByName: string;
  readonly accessUrl: string;
}

export interface IPasswordChangedEmailProps {
  readonly name: string;
  readonly changedAt: string;
}

export interface IMaintenanceModeEmailProps {
  readonly recipientName?: string;
  readonly mode: "ENABLED" | "DISABLED";
  readonly siteUrl: string;
}

export interface INotificationEmailProps {
  readonly notificationType: string;
  readonly workspaceName: string;
  readonly message: string;
  readonly actionUrl: string;
  readonly actionLabel: string;
  readonly recipientName?: string;
  readonly issueIdentifier?: string;
  readonly issueTitle?: string;
}

export interface IEmailLayoutInput {
  readonly title: string;
  readonly previewText: string;
  readonly content: string;
}

export interface IInfoCardField {
  readonly label: string;
  readonly value: string;
  readonly accentColor?: string;
}
