import type { BillingTier } from '@bt/shared/types';
import { logger } from '@js/utils/logger';
import { appName, buildEmailShell, escapeHtml, fromEmail } from '@services/email';
import { sendEmail } from '@services/email/send-email';
import { getEmailForUser } from '@services/sharing/find-user-by-email.service';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || null;
const supportContact = SUPPORT_EMAIL
  ? `<a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color: #17443d;">${escapeHtml(SUPPORT_EMAIL)}</a>`
  : '<a href="https://github.com/man612/Kasana/issues" style="color: #17443d;">Kasana GitHub Issues</a>';

const buildSubscriptionWelcomeHtml = ({ planName }: { planName: string }): string =>
  buildEmailShell({
    innerHtml: `
          <tr><td style="padding: 28px 40px 0 40px;"><h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">Welcome to ${escapeHtml(planName)}</h1></td></tr>
          <tr><td style="padding: 16px 40px 36px 40px; font-size: 15px; color: #1a1a1a; line-height: 1.5;">
            <p style="margin: 0 0 12px 0;">Thank you for supporting ${escapeHtml(appName)}.</p>
            <p style="margin: 0 0 12px 0;">If something is not working as expected, contact the operator of your Kasana instance or visit ${supportContact}. Never include private financial information in public issues.</p>
            <p style="margin: 0 0 12px 0;">Your subscription details are managed by the operator of this instance. Keep financial records and account credentials private.</p>
            <p style="margin: 0;">Thank you for using Kasana.</p>
          </td></tr>`,
  });

/** Best-effort: the subscription is already mirrored, so a failed send is only logged. */
export const sendSubscriptionWelcomeEmail = async ({
  userId,
  tier,
}: {
  userId: number;
  tier: BillingTier;
}): Promise<void> => {
  try {
    const to = await getEmailForUser({ userId });
    if (!to) {
      logger.warn('[SubscriptionWelcomeEmail] Skipped: no email on record', { userId, tier });
      return;
    }

    const planName = `${appName} ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
    const result = await sendEmail({
      from: `${appName} <${fromEmail}>`,
      to,
      replyTo: SUPPORT_EMAIL ?? undefined,
      subject: `Thank you for subscribing to ${planName}`,
      html: buildSubscriptionWelcomeHtml({ planName }),
    });
    if (result?.error) throw new Error(`${result.error.name}: ${result.error.message}`);
    if (result) logger.info(`[SubscriptionWelcomeEmail] Sent to user ${userId}, resendId: ${result.data?.id}`);
  } catch (error) {
    logger.error(
      { message: '[SubscriptionWelcomeEmail] Failed to send', error: error as Error },
      { code: 'SUBSCRIPTION_WELCOME_EMAIL_FAILED', userId, tier },
    );
  }
};
