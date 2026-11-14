import { ACCOUNT_CATEGORIES, ACCOUNT_TYPES, CATEGORY_TYPES } from '@bt/shared/types';
import { ASSET_CLASS, SECURITY_PROVIDER } from '@bt/shared/types/investments';
import { recordId } from '@common/lib/zod/custom-types';
import { describe, expect, it } from '@jest/globals';

import { createAccountBodySchema, updateAccountBodySchema } from './accounts/account-body.schema';
import { createCategoryBodySchema } from './categories.controller/shared-schemas';
import { createHoldingBodySchema } from './investments/holdings/schemas';

const id = recordId().parse('00000000-0000-4000-8000-000000000001');
const searchResult = {
  symbol: 'SYNTH',
  providerSymbol: 'SYNTH',
  name: 'Synthetic security',
  assetClass: ASSET_CLASS.stocks,
  providerName: SECURITY_PROVIDER.polygon,
  currencyCode: 'USD',
};

describe('public request schemas with omitted JSON keys', () => {
  it('allows a root category without a parent but still requires its color', () => {
    const category = createCategoryBodySchema.parse({ name: 'Synthetic', color: '#112233' });
    expect(category.parentId).toBeUndefined();
    expect(category.type).toBe(CATEGORY_TYPES.custom);
    expect(createCategoryBodySchema.safeParse({ name: 'Synthetic' }).success).toBe(false);
  });

  it('allows a child category without a color but requires a valid parent', () => {
    expect(createCategoryBodySchema.parse({ name: 'Child', parentId: id }).parentId).toBe(id);
    expect(createCategoryBodySchema.safeParse({ name: 'Child', parentId: 'invalid' }).success).toBe(false);
  });

  it('requires exactly one holding security source, allowing the other key to be absent', () => {
    expect(createHoldingBodySchema.parse({ portfolioId: id, securityId: id })).toEqual({
      portfolioId: id,
      securityId: id,
    });
    expect(createHoldingBodySchema.parse({ portfolioId: id, searchResult })).toEqual({ portfolioId: id, searchResult });
    expect(createHoldingBodySchema.safeParse({ portfolioId: id }).success).toBe(false);
    expect(createHoldingBodySchema.safeParse({ portfolioId: id, securityId: id, searchResult }).success).toBe(false);
  });

  it('applies account defaults only during creation and preserves an omitted PATCH field', () => {
    const created = createAccountBodySchema.parse({ name: 'Synthetic', currencyCode: 'USD' });
    expect(created).toMatchObject({
      initialBalance: 0,
      creditLimit: 0,
      type: ACCOUNT_TYPES.system,
      accountCategory: ACCOUNT_CATEGORIES.general,
    });
    expect(updateAccountBodySchema.parse({ name: 'Updated' })).toEqual({ name: 'Updated' });
    expect(createAccountBodySchema.safeParse({ name: 'Synthetic' }).success).toBe(false);
  });
});
