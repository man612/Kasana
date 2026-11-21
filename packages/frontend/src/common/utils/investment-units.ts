import { ASSET_CLASS, type SecurityModel } from '@bt/shared/types/investments';

export const INVESTMENTS_DISPLAY_CURRENCY = 'IDR';

export const isBeiStock = (
  security?: Pick<SecurityModel, 'assetClass' | 'currencyCode' | 'exchangeMic' | 'providerSymbol'>,
) =>
  security?.assetClass === ASSET_CLASS.stocks &&
  security.currencyCode === INVESTMENTS_DISPLAY_CURRENCY &&
  (security.exchangeMic === 'XIDX' || /\.JK$/i.test(security.providerSymbol));

export const beiLotsToShares = (lots: string): string | null => {
  if (!/^\d{1,16}$/.test(lots) || BigInt(lots) === 0n) return null;
  return (BigInt(lots) * 100n).toString();
};
