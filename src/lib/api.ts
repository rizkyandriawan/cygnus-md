// Unified API for both Electron and Tauri

const isElectron = !!(window as any).electronAPI;
const isTauri = !!(window as any).__TAURI__;

// Lazy load Tauri modules
let tauriDialog: typeof import('@tauri-apps/plugin-dialog') | null = null;
let tauriFs: typeof import('@tauri-apps/plugin-fs') | null = null;
let tauriWindow: typeof import('@tauri-apps/api/window') | null = null;

async function loadTauriModules() {
  if (isTauri && !tauriDialog) {
    console.log('[api] Loading Tauri modules...');
    tauriDialog = await import('@tauri-apps/plugin-dialog');
    tauriFs = await import('@tauri-apps/plugin-fs');
    tauriWindow = await import('@tauri-apps/api/window');
    console.log('[api] Tauri modules loaded');
  }
}

export const api = {
  async openFile(): Promise<{ filePath: string; content: string; fileName: string } | null> {
    console.log('[api] openFile called, isElectron:', isElectron, 'isTauri:', isTauri);

    if (isElectron) {
      return (window as any).electronAPI.openFile();
    }

    if (isTauri) {
      try {
        console.log('[api] Loading Tauri modules...');
        await loadTauriModules();
        console.log('[api] Opening dialog...');
        const selected = await tauriDialog!.open({
          multiple: false,
          filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
        });
        console.log('[api] Dialog result:', selected);

        if (!selected || typeof selected !== 'string') return null;

        console.log('[api] Reading file...');
        const content = await tauriFs!.readTextFile(selected);
        const fileName = selected.split('/').pop() || 'Untitled';

        return { filePath: selected, content, fileName };
      } catch (err) {
        console.error('[api] Tauri openFile error:', err);
        return null;
      }
    }

    return null;
  },

  async readFile(filePath: string): Promise<string | null> {
    if (isElectron) {
      return (window as any).electronAPI.readFile(filePath);
    }

    if (isTauri) {
      await loadTauriModules();
      try {
        return await tauriFs!.readTextFile(filePath);
      } catch {
        return null;
      }
    }

    return null;
  },

  async exists(filePath: string): Promise<boolean> {
    if (isElectron) {
      return (window as any).electronAPI.exists(filePath);
    }

    if (isTauri) {
      await loadTauriModules();
      try {
        return await tauriFs!.exists(filePath);
      } catch {
        return false;
      }
    }

    return false;
  },

  async getFileUrl(filePath: string): Promise<string> {
    if (isElectron) {
      return (window as any).electronAPI.getFileUrl(filePath);
    }

    // Tauri uses convertFileSrc
    if (isTauri) {
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      return convertFileSrc(filePath);
    }

    return `file://${filePath}`;
  },

  async setTitle(title: string): Promise<void> {
    if (isElectron) {
      (window as any).electronAPI.setTitle(title);
      return;
    }

    if (isTauri) {
      await loadTauriModules();
      const win = tauriWindow!.getCurrentWindow();
      await win.setTitle(title);
    }
  },

  async minimize(): Promise<void> {
    console.log('[api] minimize called');
    if (isElectron) {
      (window as any).electronAPI.minimize();
      return;
    }

    if (isTauri) {
      try {
        await loadTauriModules();
        const win = tauriWindow!.getCurrentWindow();
        console.log('[api] Tauri window:', win);
        await win.minimize();
      } catch (err) {
        console.error('[api] minimize error:', err);
      }
    }
  },

  async maximize(): Promise<void> {
    console.log('[api] maximize called');
    if (isElectron) {
      (window as any).electronAPI.maximize();
      return;
    }

    if (isTauri) {
      try {
        await loadTauriModules();
        const win = tauriWindow!.getCurrentWindow();
        const isMax = await win.isMaximized();
        console.log('[api] isMaximized:', isMax);
        if (isMax) {
          await win.unmaximize();
        } else {
          await win.maximize();
        }
      } catch (err) {
        console.error('[api] maximize error:', err);
      }
    }
  },

  async close(): Promise<void> {
    console.log('[api] close called');
    if (isElectron) {
      (window as any).electronAPI.close();
      return;
    }

    if (isTauri) {
      try {
        await loadTauriModules();
        const win = tauriWindow!.getCurrentWindow();
        await win.close();
      } catch (err) {
        console.error('[api] close error:', err);
      }
    }
  },

  async isMaximized(): Promise<boolean> {
    if (isElectron) {
      return (window as any).electronAPI.isMaximized();
    }

    if (isTauri) {
      await loadTauriModules();
      const win = tauriWindow!.getCurrentWindow();
      return await win.isMaximized();
    }

    return false;
  },

  isElectron,
  isTauri,
  isDesktop: isElectron || isTauri,
};
