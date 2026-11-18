import { ValidationError } from '@js/errors';

/**
 * Private Indonesia-only beta gate. Disabled by default to preserve upstream
 * multi-currency self-hosts and existing financial records. This applies to
 * new currency selections, never to reading, deleting or migrating old data.
 */
export const isIdrOnlyBetaEnabled = (): boolean =>
  ['1', 'true'].includes((process.env.LAJUR_IDR_ONLY_BETA ?? '').toLowerCase());

export const enforceBetaIdrCurrency = (code: string): void => {
  if (!isIdrOnlyBetaEnabled() || code === 'IDR') return;
  throw new ValidationError({
    message: 'The Lajur. private beta currently allows new currency selections in IDR only.',
  });
};
