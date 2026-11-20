import type { InjectionKey } from 'vue';

export const TRANSACTION_DIALOG_CLOSE: InjectionKey<{
  requestClose: () => void;
  register: (hasChanges: () => boolean) => () => void;
}> = Symbol('transaction-dialog-close');
