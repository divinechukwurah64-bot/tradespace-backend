export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

export type ToastType = 'success' | 'error' | 'info';

type HostHandlers = {
  onConfirm: (options: ConfirmOptions, resolve: (value: boolean) => void) => void;
  onToast: (type: ToastType, message: string) => void;
};

let host: HostHandlers | null = null;

// The DialogHost component registers itself here when it loads
export const registerDialogHost = (handlers: HostHandlers) => {
  host = handlers;
  return () => {
    if (host === handlers) host = null;
  };
};

// Use instead of window.confirm. Returns true if the person clicked the confirm button.
export const confirmDialog = (options: ConfirmOptions): Promise<boolean> =>
  new Promise((resolve) => {
    if (!host) {
      // Falls back to the browser box if the host is not on the page yet
      resolve(window.confirm(options.message));
      return;
    }
    host.onConfirm(options, resolve);
  });

const show = (type: ToastType, message: string) => {
  if (host) host.onToast(type, message);
};

export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  info: (message: string) => show('info', message),
};