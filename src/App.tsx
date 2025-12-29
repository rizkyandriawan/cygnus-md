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
