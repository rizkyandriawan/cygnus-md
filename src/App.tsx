import { useEffect, useCallback } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { Reader } from "./components/Reader";
import { TableOfContents } from "./components/TableOfContents";
import { BottomBar } from "./components/BottomBar";
import { Home } from "./components/Home";
import { LoadingModal } from "./components/LoadingModal";
import { useAppStore } from "./store/useAppStore";
import { api } from "./lib/api";
import { parseEpub, isEpub } from "./lib/epub";

function App() {
  const { tabs, activeTabId, setMarkdown, toggleToc, nextPage, prevPage, loading, showLoading, hideLoading } = useAppStore();
  const currentTab = tabs.find((t) => t.id === activeTabId);
  const isDocumentTab = currentTab?.type === 'document';

  // Process file (handle EPUB vs Markdown)
  const processFile = useCallback(async (data: { filePath: string; content: string; fileName: string; type?: string }) => {
    const isEpubFile = data.type === 'epub' || isEpub(data.fileName);

    if (isEpubFile) {
      showLoading('Opening EPUB...');
      try {
        // Decode base64 to ArrayBuffer
        const binary = atob(data.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        // Parse EPUB
        const parsed = await parseEpub(arrayBuffer);
        setMarkdown(parsed.html, data.filePath, data.fileName, 'html');
      } catch (err) {
        console.error("Failed to parse EPUB:", err);
      } finally {
        hideLoading();
      }
    } else {
      setMarkdown(data.content, data.filePath, data.fileName, 'markdown');
    }
  }, [setMarkdown, showLoading, hideLoading]);

  // Listen for events from main process (Electron only)
  useEffect(() => {
    const electronApi = (window as any).electronAPI;
    if (!electronApi) return;

    // File open from CLI or menu
    if (electronApi.onOpenFile) {
      electronApi.onOpenFile((data: { filePath: string; content: string; fileName: string; type?: string }) => {
        processFile(data);
      });
    }

    // Toggle TOC from menu (Ctrl+T)
    if (electronApi.onToggleToc) {
      electronApi.onToggleToc(() => toggleToc());
    }

    // Page navigation from menu (Left/Right arrows)
    if (electronApi.onNavigatePage) {
      electronApi.onNavigatePage((direction: string) => {
        if (direction === 'next') nextPage();
        else if (direction === 'prev') prevPage();
      });
    }

    // Export to PDF from menu (Ctrl+E)
    if (electronApi.onExportPdf) {
      electronApi.onExportPdf(() => {
        // Dispatch event - Reader will handle getting HTML from folio
        window.dispatchEvent(new CustomEvent('export-pdf-request'));
      });
    }

    // Headless CLI export: cygnus-md export <input> <output> [--style ...] [--format ...]
    if (electronApi.onHeadlessExport) {
      electronApi.onHeadlessExport(async (req: any) => {
        const finishWith = (result: any) => {
          try { electronApi.headlessExportDone(result); }
          catch (e) { console.error('headlessExportDone failed:', e); }
        };

        try {
          const { input, output, format, style, fileName, content, contentType } = req;
          if (contentType !== 'markdown') {
            finishWith({ success: false, error: `Headless export currently supports markdown only (got: ${contentType})` });
            return;
          }

          // Apply style template, then load the file (this mounts <Reader/>).
          useAppStore.setState({ styleTemplate: style });
          useAppStore.getState().setMarkdown(content, input, fileName, 'markdown');

          // Poll for the folio web component to finish paginating.
          const startedAt = Date.now();
          const TIMEOUT_MS = 30000;
          let folio: any = null;
          while (Date.now() - startedAt < TIMEOUT_MS) {
            const f = document.querySelector('folio-pages') as any;
            if (f && typeof f.toPrintHTML === 'function') {
              try {
                const test = f.toPrintHTML({ title: 'test' });
                if (test && test.length > 200) { folio = f; break; }
              } catch { /* not ready */ }
            }
            await new Promise((r) => setTimeout(r, 200));
          }

          if (!folio) {
            finishWith({ success: false, error: 'Render did not complete in 30s' });
            return;
          }

          // Brief settle for async KaTeX/diagram rendering
          await new Promise((r) => setTimeout(r, 300));

          const title = fileName.replace(/\.[^.]+$/, '');
          let printHTML = folio.toPrintHTML({ title });
          printHTML = printHTML.replace(
            /class="folio-print-page"/g,
            `class="folio-print-page template-${style}"`
          );

          let result;
          if (format === 'pdf') {
            result = await api.exportPdf({ html: printHTML, fileName: `${title}.pdf`, outputPath: output });
          } else if (format === 'docx') {
            const { htmlToDocx } = await import('./lib/docx');
            const blob = await htmlToDocx(printHTML, title, style);
            const arrayBuffer = await blob.arrayBuffer();
            result = await api.exportDocx({ data: arrayBuffer, fileName: `${title}.docx`, outputPath: output });
          } else if (format === 'html') {
            result = { success: false, error: 'HTML headless export not yet implemented (use PDF or DOCX)' };
          } else {
            result = { success: false, error: `Unsupported format: ${format}` };
          }

          finishWith(result);
        } catch (err: any) {
          finishWith({ success: false, error: err?.message || String(err) });
        }
      });
    }
  }, [processFile, toggleToc, nextPage, prevPage]);

  // Set window title
  useEffect(() => {
    const title = currentTab?.type === 'document'
      ? `Cygnus MD - ${currentTab.title}`
      : 'Cygnus MD';
    document.title = title;
    api.setTitle(title);
  }, [currentTab]);

  return (
    <Flex direction="column" h="100vh">
      <TabBar />
      {isDocumentTab && <Toolbar />}

      <Flex flex={1} overflow="hidden">
        {isDocumentTab && <TableOfContents />}

        <Box flex={1} overflow="hidden">
          {currentTab?.type === 'home' ? <Home /> : <Reader />}
        </Box>
      </Flex>

      {isDocumentTab && currentTab?.markdown && <BottomBar />}

      <LoadingModal
        isOpen={loading.isLoading}
        message={loading.message}
        progress={loading.progress}
      />
    </Flex>
  );
}

export default App;
