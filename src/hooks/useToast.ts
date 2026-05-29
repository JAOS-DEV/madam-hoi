import { useCallback, useEffect, useState } from "react";

export type ToastTone = "success" | "error";

export interface ToastState {
  message: string;
  tone: ToastTone;
}

const DEFAULT_DURATION_MS = 2800;

export function useToast(durationMs = DEFAULT_DURATION_MS): {
  toast: ToastState | null;
  showToast: (message: string, tone: ToastTone) => void;
} {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, durationMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast, durationMs]);

  const showToast = useCallback((message: string, tone: ToastTone) => {
    setToast({ message, tone });
  }, []);

  return { toast, showToast };
}
