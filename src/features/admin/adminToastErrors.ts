import type { Translation } from "../../i18n";

export function getAdminErrorMessage(error: unknown, t: Translation): string {
  if (error instanceof Error) {
    if (error.message.includes("Missing or insufficient permissions")) {
      return t.toastPermissionError;
    }
    return error.message;
  }
  return t.toastGenericError;
}
