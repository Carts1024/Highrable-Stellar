import type {
  IAccountExistsEmailProps,
  IMaintenanceModeEmailProps,
  INotificationEmailProps,
  IPasswordChangedEmailProps,
  IPasswordResetEmailProps,
  ISignInEmailProps,
  IWorkspaceAdminAssignedEmailProps,
  IWorkspaceInviteEmailProps,
} from "./types";

import {
  buildBodyText,
  buildDisclaimerText,
  buildInfoCard,
  buildOtpBlock,
  buildPrimaryButton,
  buildSectionHeading,
  buildSecurityAlert,
  escapeEmailHtml,
} from "./components";
import { buildEmailLayout } from "./layout";
import { EMAIL_COLORS } from "./tokens";

export function getSignInEmail(token: string): string {
  const props: ISignInEmailProps = { token };

  const content = [
    buildSectionHeading("Sign in to your account"),
    buildBodyText(
      "Use the verification code below to complete your sign-in. Do not share this code with anyone.",
    ),
    buildOtpBlock(props.token),
    buildDisclaimerText("If you didn't request this, you can safely ignore this email."),
  ].join("");

  return buildEmailLayout({
    title: "Sign in to TaskFlow",
    previewText: `Your sign-in code is ${props.token}`,
    content,
  });
}

export function getPasswordResetEmail(token: string): string {
  const props: IPasswordResetEmailProps = { token };

  const content = [
    buildSectionHeading("Reset your password"),
    buildBodyText(
      "We received a request to reset the password on your account. Enter the code below to proceed.",
    ),
    buildOtpBlock(props.token),
    buildDisclaimerText(
      "If you didn't request a password reset, you can safely ignore this email.",
    ),
  ].join("");

  return buildEmailLayout({
    title: "Reset your password — TaskFlow",
    previewText: `Your password reset code is ${props.token}`,
    content,
  });
}

export function getAccountExistsEmail(email: string, siteUrl: string): string {
  const props: IAccountExistsEmailProps = { email, siteUrl };
  const escapedEmail = escapeEmailHtml(props.email);

  const content = [
    buildSectionHeading("Account already exists"),
    buildBodyText(
      `You tried to create a new account using <strong style="color: ${EMAIL_COLORS.text.primary};">${escapedEmail}</strong>, but an account with that email is already registered.`,
    ),
    buildPrimaryButton("Sign in instead", `${props.siteUrl}/login`),
    buildDisclaimerText("If you didn't attempt to sign up, you can safely ignore this email."),
  ].join("");

  return buildEmailLayout({
    title: "Account already exists — TaskFlow",
    previewText: `An account already exists for ${props.email}`,
    content,
  });
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Workspace Admin",
  MEMBER: "Member",
};

function resolveRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function resolveRoleAccentColor(role: string): string {
  return role === "ADMIN" ? EMAIL_COLORS.role.admin : EMAIL_COLORS.role.member;
}

export function getWorkspaceInviteEmail(
  workspaceName: string,
  inviterName: string,
  role: string,
  inviteUrl: string,
): string {
  const props: IWorkspaceInviteEmailProps = { workspaceName, inviterName, role, inviteUrl };
  const roleLabel = resolveRoleLabel(props.role);
  const roleAccentColor = resolveRoleAccentColor(props.role);

  const content = [
    buildSectionHeading(`You've been invited to ${props.workspaceName}`),
    buildBodyText(
      `<strong style="color: ${EMAIL_COLORS.text.primary};">${escapeEmailHtml(props.inviterName)}</strong> has invited you to collaborate on their workspace.`,
    ),
    buildInfoCard([
      { label: "Workspace", value: props.workspaceName },
      { label: "Invited by", value: props.inviterName },
      { label: "Your role", value: roleLabel, accentColor: roleAccentColor },
    ]),
    buildPrimaryButton("Accept invitation", props.inviteUrl),
    buildDisclaimerText(
      "This invitation expires in 7 days. If you weren't expecting this, you can ignore it.",
    ),
  ].join("");

  return buildEmailLayout({
    title: `Invitation to join ${props.workspaceName} — TaskFlow`,
    previewText: `${props.inviterName} invited you to join ${props.workspaceName}`,
    content,
  });
}

export function getWorkspaceAdminAssignedEmail(
  workspaceName: string,
  assignedByName: string,
  accessUrl: string,
): string {
  const props: IWorkspaceAdminAssignedEmailProps = { workspaceName, assignedByName, accessUrl };

  const content = [
    buildSectionHeading("You're now a Workspace Admin"),
    buildBodyText(
      `<strong style="color: ${EMAIL_COLORS.text.primary};">${escapeEmailHtml(props.assignedByName)}</strong> has granted you admin access to the workspace below.`,
    ),
    buildInfoCard([
      { label: "Workspace", value: props.workspaceName },
      { label: "Role assigned", value: "Workspace Admin", accentColor: EMAIL_COLORS.role.admin },
    ]),
    buildPrimaryButton("Open workspace", props.accessUrl),
    buildDisclaimerText(
      "You can manage members, projects, and settings from your workspace dashboard.",
    ),
  ].join("");

  return buildEmailLayout({
    title: `Admin access granted — ${props.workspaceName}`,
    previewText: `You are now a Workspace Admin in ${props.workspaceName}`,
    content,
  });
}

export function getPasswordChangedEmail(name: string, changedAt: string): string {
  const props: IPasswordChangedEmailProps = { name, changedAt };

  const content = [
    buildSectionHeading("Your password was changed"),
    buildBodyText(
      `Hi <strong style="color: ${EMAIL_COLORS.text.primary};">${escapeEmailHtml(props.name)}</strong>, your TaskFlow account password was successfully updated.`,
    ),
    buildInfoCard([{ label: "Changed at", value: props.changedAt }]),
    buildSecurityAlert(
      "If you did not make this change, your account may be at risk. Reset your password immediately and contact support.",
    ),
    buildDisclaimerText("If you initiated this change, no further action is needed."),
  ].join("");

  return buildEmailLayout({
    title: "Your password was changed — TaskFlow",
    previewText: "Your TaskFlow account password was successfully changed.",
    content,
  });
}

export function getMaintenanceModeEmailSubject(mode: IMaintenanceModeEmailProps["mode"]): string {
  return mode === "ENABLED"
    ? "TaskFlow is temporarily in maintenance mode"
    : "TaskFlow access has been restored";
}

export function getMaintenanceModeEmail(props: IMaintenanceModeEmailProps): string {
  const greeting = props.recipientName ? `Hi ${props.recipientName},` : "Hi,";
  const isEnabled = props.mode === "ENABLED";
  const heading = isEnabled ? "Maintenance mode is active" : "TaskFlow access is restored";
  const body = isEnabled
    ? "TaskFlow is temporarily restricted while scheduled maintenance is in progress. Regular access will return once maintenance is complete."
    : "Maintenance mode has ended. You can sign in and continue using your workspaces normally.";
  const disclaimer = isEnabled
    ? "This is an operational notice about platform access."
    : "Thanks for your patience during the maintenance window.";

  const content = [
    buildSectionHeading(heading),
    buildBodyText(escapeEmailHtml(greeting)),
    buildBodyText(body),
    buildInfoCard([
      {
        label: "Platform status",
        value: isEnabled ? "Maintenance active" : "Access restored",
        accentColor: isEnabled ? EMAIL_COLORS.semantic.dangerFg : EMAIL_COLORS.role.member,
      },
    ]),
    buildPrimaryButton(isEnabled ? "Open TaskFlow" : "Sign in to TaskFlow", props.siteUrl),
    buildDisclaimerText(disclaimer),
  ].join("");

  return buildEmailLayout({
    title: `${heading} — TaskFlow`,
    previewText: isEnabled
      ? "TaskFlow is temporarily restricted during maintenance."
      : "TaskFlow access has been restored.",
    content,
  });
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  ASSIGNED: "Issue assignment",
  COMMENTED: "New comment",
  STATUS_CHANGED: "Status changed",
  MENTIONED: "Mention",
  WORKSPACE_INVITE: "Workspace invitation",
  WORKSPACE_ADMIN_ASSIGNED: "Workspace admin access",
  ISSUE_CREATED: "Issue created",
  PRIORITY_CHANGED: "Priority changed",
  LABEL_CHANGED: "Labels changed",
  DUE_DATE_SET: "Due date set",
  DUE_DATE_CLEARED: "Due date cleared",
  ISSUE_RENAMED: "Issue renamed",
  ISSUE_DESCRIPTION_UPDATED: "Description updated",
  ISSUE_DELETED: "Issue deleted",
  ISSUE_MARKED: "Issue marked",
  COMMENT_REPLY: "Comment reply",
  ISSUE_SUBSCRIBED: "Issue subscription",
  REMINDER: "Reminder",
  SPRINT_STARTED: "Sprint started",
  SPRINT_COMPLETED: "Sprint completed",
};

function resolveNotificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase();
}

export function getNotificationEmailSubject(props: INotificationEmailProps): string {
  const notificationLabel = resolveNotificationTypeLabel(props.notificationType);
  return `${notificationLabel} in ${props.workspaceName}`;
}

export function getNotificationEmail(props: INotificationEmailProps): string {
  const notificationLabel = resolveNotificationTypeLabel(props.notificationType);
  const greeting = props.recipientName ? `Hi ${props.recipientName},` : "Hi,";
  const issueValue = [props.issueIdentifier, props.issueTitle].filter(Boolean).join(": ");

  const infoFields = [
    { label: "Workspace", value: props.workspaceName },
    { label: "Notification", value: notificationLabel },
    ...(issueValue ? [{ label: "Issue", value: issueValue }] : []),
  ];

  const content = [
    buildSectionHeading(notificationLabel),
    buildBodyText(escapeEmailHtml(greeting)),
    buildBodyText(escapeEmailHtml(props.message)),
    buildInfoCard(infoFields),
    buildPrimaryButton(props.actionLabel, props.actionUrl),
    buildDisclaimerText("You are receiving this because this notification is in your inbox."),
  ].join("");

  return buildEmailLayout({
    title: `${notificationLabel} — TaskFlow`,
    previewText: props.message,
    content,
  });
}
