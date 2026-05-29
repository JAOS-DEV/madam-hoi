import type { ToastState } from "../../hooks/useToast";
import { Toast } from "./Toast";

interface ToastHostProps {
  toast: ToastState | null;
}

export function ToastHost({ toast }: ToastHostProps): JSX.Element | null {
  if (!toast) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[1100] flex justify-center px-3">
      <div className="w-full max-w-md">
        <Toast message={toast.message} tone={toast.tone} />
      </div>
    </div>
  );
}
