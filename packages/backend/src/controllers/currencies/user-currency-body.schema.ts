import { currencyCode } from '@common/lib/zod/custom-types';
import { isIdrOnlyBetaEnabled } from '@services/currencies/idr-beta-policy';
import { z } from 'zod';

/**
 * The bodies of the user-currency writes (`POST /user/currencies`, `PUT /user/currency`,
 * `DELETE /user/currency`), shared by the REST controllers and the MCP currency tools so the two
 * paths accept exactly the same input.
 */

export const addUserCurrenciesBodySchema = z
  .object({
    currencies: z
      .array(
        z
          .object({
            currencyCode: currencyCode(),
            exchangeRate: z.number().positive().optional(),
            liveRateUpdate: z.boolean().optional(),
          })
          .strict(),
      )
      .nonempty(),
  })
  .strict()
  .superRefine(({ currencies }, ctx) => {
    if (!isIdrOnlyBetaEnabled()) return;
    currencies.forEach(({ currencyCode: code }, index) => {
      if (code !== 'IDR') {
        ctx.addIssue({
          code: 'custom',
          path: ['currencies', index, 'currencyCode'],
          message: 'The Lajur. private beta accepts only IDR for newly added currencies.',
        });
      }
    });
  });

export const editUserCurrencyBodySchema = z.object({
  currencyCode: currencyCode(),
  exchangeRate: z.number().optional(),
  liveRateUpdate: z.boolean().optional(),
});

export const deleteUserCurrencyBodySchema = z.object({
  currencyCode: currencyCode(),
});
