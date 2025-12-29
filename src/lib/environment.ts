// Detect if running inside Electron
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' &&
    'electronAPI' in window &&
    (window as any).electronAPI?.isElectron === true;
};

// Detect if running inside Tauri (legacy, keeping for reference)
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
};

// Check if running in any desktop environment
export const isDesktop = (): boolean => {
  return isElectron() || isTauri();
};
