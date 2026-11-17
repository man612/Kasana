import { mount } from '@vue/test-utils';

import DateField from './date-field.vue';

const CalendarStub = {
  name: 'CalendarStub',
  props: { modelValue: { type: Date, default: undefined } },
  emits: ['update:modelValue'],
  template: '<div data-testid="calendar-stub" />',
};
const SlotStub = { template: '<div><slot /></div>' };
const DialogStub = { name: 'DialogStub', props: { open: Boolean }, template: '<div><slot /></div>' };
const mountField = (props: {
  modelValue: Date;
  mode?: 'date' | 'dateTime';
  calendarOptions?: { minDate?: Date; maxDate?: Date };
  hideInputTime?: boolean;
  showWeekday?: boolean;
}) =>
  mount(DateField, {
    props,
    global: {
      stubs: {
        Dialog: DialogStub,
        DialogTrigger: SlotStub,
        DialogContent: SlotStub,
        DialogTitle: SlotStub,
        DialogDescription: SlotStub,
        Calendar: CalendarStub,
      },
    },
  });

describe('DateField with explicit calendar confirmation and 24-hour time input', () => {
  const initial = new Date(2026, 10, 12, 10, 2);

  it('keeps new calendar date as draft until Save, retaining the original clock time', async () => {
    const wrapper = mountField({ modelValue: initial });
    (wrapper.vm as unknown as { open: () => void }).open();
    await wrapper.vm.$nextTick();
    const calendar = wrapper.findComponent({ name: 'CalendarStub' });
    calendar.vm.$emit('update:modelValue', new Date(2026, 10, 11));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.findComponent({ name: 'DialogStub' }).props('open')).toBe(true);
    await wrapper.get('[data-testid="date-dialog-save"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([new Date(2026, 10, 11, 10, 2)]);
    expect(wrapper.findComponent({ name: 'DialogStub' }).props('open')).toBe(false);
  });

  it('can cancel a picked date without modifying the saved field', async () => {
    const wrapper = mountField({ modelValue: initial });
    (wrapper.vm as unknown as { open: () => void }).open();
    await wrapper.vm.$nextTick();
    wrapper.findComponent({ name: 'CalendarStub' }).vm.$emit('update:modelValue', new Date(2026, 9, 1));
    await wrapper.vm.$nextTick();
    await wrapper
      .findAll('button')
      .find((el) => el.text().includes('Batal') || el.text().includes('Cancel'))
      ?.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('displays a manual HH:mm field rather than a native AM/PM dropdown', async () => {
    const wrapper = mountField({ modelValue: initial });
    expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(false);
    const input = wrapper.get('[data-testid="date-field-time-input"]');
    expect((input.element as HTMLInputElement).value).toBe('10:02');
    await input.setValue('17:45');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([new Date(2026, 10, 12, 17, 45)]);
  });

  it('refuses invalid HH:mm and disables saving until fixed', async () => {
    const wrapper = mountField({ modelValue: initial });
    const input = wrapper.get('[data-testid="date-field-time-input"]');
    await input.setValue('26:90');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect((input.element as HTMLInputElement).value).toBe('10:02');
    (wrapper.vm as unknown as { open: () => void }).open();
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="date-dialog-time-input"]').setValue('25:60');
    expect(wrapper.get('[data-testid="date-dialog-save"]').attributes('disabled')).toBeDefined();
  });

  it('preserves time for direct date edits and rejects years before 2000', async () => {
    const wrapper = mountField({ modelValue: initial });
    const input = wrapper.get('input[type="date"]');
    await input.setValue('0026-11-12');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await input.setValue('2026-11-09');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([new Date(2026, 10, 9, 10, 2)]);
  });

  it('respects date-only mode and calendar date bounds', () => {
    const wrapper = mountField({
      modelValue: initial,
      mode: 'date',
      calendarOptions: { minDate: new Date(2026, 0, 5), maxDate: new Date(2026, 11, 24) },
    });
    expect(wrapper.find('[data-testid="date-field-time-input"]').exists()).toBe(false);
    const input = wrapper.get('input[type="date"]');
    expect(input.attributes('min')).toBe('2026-01-05');
    expect(input.attributes('max')).toBe('2026-12-24');
    expect(wrapper.findComponent({ name: 'CalendarStub' }).attributes('mode')).toBe('date');
  });

  it('ignores calendar deselection rather than clearing transaction time', async () => {
    const wrapper = mountField({ modelValue: initial });
    wrapper.findComponent({ name: 'CalendarStub' }).vm.$emit('update:modelValue', null);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.findComponent({ name: 'CalendarStub' }).props('modelValue')).toEqual(initial);
  });

  it('keeps a directly editable dd/MM/yyyy field with localized weekday and separate calendar icon', async () => {
    const wrapper = mountField({ modelValue: initial, showWeekday: true });
    const input = wrapper.get('[data-testid="date-field-numeric-input"]');
    expect((input.element as HTMLInputElement).value).toBe('12/11/2026');
    expect(wrapper.find('[data-testid="date-field-weekday-trigger"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="date-field-calendar-trigger"]').exists()).toBe(true);
    await input.setValue('13/11/2026');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([new Date(2026, 10, 13, 10, 2)]);
  });
});
