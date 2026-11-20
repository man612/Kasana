export interface TransactionDialogSession {
  hasUnsavedChanges: () => boolean;
  isSaving: () => boolean;
}
