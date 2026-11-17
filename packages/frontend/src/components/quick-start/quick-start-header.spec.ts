import commonId from '@/i18n/locales/chunks/id/common.json';
import dashboardId from '@/i18n/locales/chunks/id/pages/dashboard.json';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { describe, expect, it } from 'vitest';

import QuickStartHeader from './quick-start-header.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'id',
  messages: { id: { ...commonId, ...dashboardId } },
});

describe('Quick Start accessible controls', () => {
  it('announces the progress and gives the close action a usable touch target', async () => {
    const wrapper = mount(QuickStartHeader, {
      props: { progress: 40, completedCount: 2, totalCount: 5 },
      global: { plugins: [i18n] },
    });

    const progressbar = wrapper.get('[role="progressbar"]');
    expect(progressbar.attributes('aria-valuenow')).toBe('40');
    expect(progressbar.attributes('aria-valuemin')).toBe('0');
    expect(progressbar.attributes('aria-valuemax')).toBe('100');
    expect(progressbar.attributes('aria-label')).toBeTruthy();

    const close = wrapper.get('button');
    expect(close.attributes('type')).toBe('button');
    expect(close.attributes('aria-label')).toBe('Tutup');
    expect(close.classes()).toContain('size-11');

    await close.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
