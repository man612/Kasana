import { describe, expect, it } from 'vitest';

import { getEffectiveDashboardRowSpan } from './dashboard-widget-layout';

describe('getEffectiveDashboardRowSpan', () => {
  it('collapses an empty saved two-row Latest Transactions widget', () => {
    expect(getEffectiveDashboardRowSpan({ widgetId: 'latest-records', rowSpan: 2, isEditMode: false, isDataEmpty: true })).toBe(1);
  });

  it('respects the saved size during edit mode', () => {
    expect(getEffectiveDashboardRowSpan({ widgetId: 'latest-records', rowSpan: 2, isEditMode: true, isDataEmpty: true })).toBe(2);
  });

  it('retains the saved size when recorded or scheduled content exists', () => {
    expect(getEffectiveDashboardRowSpan({ widgetId: 'latest-records', rowSpan: 2, isEditMode: false, isDataEmpty: false })).toBe(2);
  });

  it('does not alter other widgets or an unspecified row span', () => {
    expect(getEffectiveDashboardRowSpan({ widgetId: 'balance-trend', rowSpan: 2, isEditMode: false, isDataEmpty: true })).toBe(2);
    expect(getEffectiveDashboardRowSpan({ widgetId: 'balance-trend', isEditMode: false, isDataEmpty: false })).toBe(1);
  });
});
