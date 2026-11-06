export type ActionState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

export const initialActionState: ActionState = {
  error: null,
  fieldErrors: {},
};

export function actionError(
  message: string,
  field?: string
): ActionState {
  return {
    error: message,
    fieldErrors: field
      ? { [field]: message }
      : {},
  };
}