import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { FORM_TYPES } from '../types';
import TypeSelector from './type-selector.vue';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('transaction type segmented selector', () => {
  it('slides its selected surface between expense, income and transfer', async () => {
    const wrapper = mount(TypeSelector, { props: { selectedTransactionType: FORM_TYPES.expense } });
    const indicator = wrapper.get('[data-testid="transaction-type-indicator"]');
    expect(indicator.attributes('style')).toContain('translateX(0%)');

    await wrapper.setProps({ selectedTransactionType: FORM_TYPES.income });
    expect(indicator.attributes('style')).toContain('translateX(100%)');

    await wrapper.setProps({ selectedTransactionType: FORM_TYPES.transfer });
    expect(indicator.attributes('style')).toContain('translateX(200%)');
  });

  it('keeps selection semantics and emits only the requested form type', async () => {
    const wrapper = mount(TypeSelector, { props: { selectedTransactionType: FORM_TYPES.expense } });
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual(['true', 'false', 'false']);
    await buttons[1]!.trigger('click');
    expect(wrapper.emitted('change-tx-type')).toEqual([[FORM_TYPES.income]]);
  });

  it('disables other types when a saved transfer is locked', async () => {
    const wrapper = mount(TypeSelector, {
      props: { selectedTransactionType: FORM_TYPES.transfer, isTypeLocked: true },
    });
    const buttons = wrapper.findAll('button');
    expect(buttons[0]!.attributes('disabled')).toBeDefined();
    expect(buttons[1]!.attributes('disabled')).toBeDefined();
    expect(buttons[2]!.attributes('disabled')).toBeUndefined();
  });
});
