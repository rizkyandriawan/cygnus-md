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

export interface OpenedFile {
  filePath: string;
  content: string;
  fileName: string;
  type?: 'markdown' | 'epub';
}

export const api = {
  // Opens file dialog, returns array of files (supports multi-select)
  async openFile(): Promise<OpenedFile[] | null> {
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
          multiple: true,
          filters: [
            { name: 'Documents', extensions: ['md', 'markdown', 'txt', 'epub'] },
            { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
            { name: 'EPUB', extensions: ['epub'] },
          ],
        });
        console.log('[api] Dialog result:', selected);

        if (!selected) return null;

        // Handle both single and multiple selection
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length === 0) return null;

        console.log('[api] Reading files...');
        const files = await Promise.all(paths.map(async (filePath) => {
          const fileName = filePath.split('/').pop() || 'Untitled';
          const isEpub = fileName.toLowerCase().endsWith('.epub');

          if (isEpub) {
            // Read EPUB as binary
            const bytes = await tauriFs!.readFile(filePath);
            // Convert to base64
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
              binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
            }
            const content = btoa(binary);
            return { filePath, content, fileName, type: 'epub' as const };
          } else {
            const content = await tauriFs!.readTextFile(filePath);
            return { filePath, content, fileName, type: 'markdown' as const };
          }
        }));

        return files;
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

  async openFilePath(filePath: string): Promise<OpenedFile | null> {
    if (isElectron) {
      return (window as any).electronAPI.openFilePath(filePath);
    }

    if (isTauri) {
      await loadTauriModules();
      try {
        const fileName = filePath.split('/').pop() || filePath;
        const isEpub = fileName.toLowerCase().endsWith('.epub');

        if (isEpub) {
          const bytes = await tauriFs!.readFile(filePath);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
          }
          return {
            filePath,
            content: btoa(binary),
            fileName,
            type: 'epub',
          };
        } else {
          const content = await tauriFs!.readTextFile(filePath);
          return {
            filePath,
            content,
            fileName,
            type: 'markdown',
          };
        }
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

  async exportPdf(options?: { html?: string; fileName?: string }): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }> {
    if (isElectron) {
      return (window as any).electronAPI.exportPdf(options);
    }

    // TODO: Tauri PDF export
    return { success: false, error: 'Not supported' };
  },

  async exportDocx(options: { data: ArrayBuffer; fileName?: string }): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }> {
    if (isElectron) {
      // Convert ArrayBuffer to base64 for IPC (chunked to avoid stack overflow)
      const bytes = new Uint8Array(options.data);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      const base64 = btoa(binary);
      return (window as any).electronAPI.exportDocx({ data: base64, fileName: options.fileName });
    }

    // Fallback: browser download
    const blob = new Blob([options.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.fileName || 'document.docx';
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  },

  onExportPdf(callback: () => void): void {
    if (isElectron) {
      (window as any).electronAPI.onExportPdf(callback);
    }
  },

  async exportHtml(options: {
    html: string;
    fileName?: string;
    assets?: { name: string; data: string }[]; // base64 data URLs
  }): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }> {
    if (isElectron) {
      return (window as any).electronAPI.exportHtml(options);
    }

    if (isTauri) {
      try {
        await loadTauriModules();
        const filePath = await tauriDialog!.save({
          defaultPath: options.fileName || 'document.html',
          filters: [{ name: 'HTML', extensions: ['html'] }],
        });

        if (!filePath) return { success: false, canceled: true };

        // Create assets folder
        const baseName = filePath.replace(/\.html$/i, '');
        const assetsDir = `${baseName}_assets`;

        // Process HTML to replace data URLs with asset paths
        let processedHtml = options.html;
        if (options.assets && options.assets.length > 0) {
          await tauriFs!.mkdir(assetsDir, { recursive: true });

          for (const asset of options.assets) {
            // Extract base64 data and save as file
            const base64Match = asset.data.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              const base64Data = base64Match[1];
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              await tauriFs!.writeFile(`${assetsDir}/${asset.name}`, bytes);
              // Replace data URL with relative path
              processedHtml = processedHtml.replace(asset.data, `${baseName.split('/').pop()}_assets/${asset.name}`);
            }
          }
        }

        await tauriFs!.writeTextFile(filePath, processedHtml);
        return { success: true, filePath };
      } catch (err) {
        console.error('[api] Tauri exportHtml error:', err);
        return { success: false, error: String(err) };
      }
    }

    // Fallback: browser download (no assets folder support)
    const blob = new Blob([options.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.fileName || 'document.html';
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  },

  isElectron,
  isTauri,
  isDesktop: isElectron || isTauri,
};
