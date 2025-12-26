import { useEffect } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { Reader } from "./components/Reader";
import { TableOfContents } from "./components/TableOfContents";
import { BottomBar } from "./components/BottomBar";
import { Home } from "./components/Home";
import { useAppStore } from "./store/useAppStore";
import { api } from "./lib/api";

function App() {
  const { tabs, activeTabId, setMarkdown, toggleToc, nextPage, prevPage } = useAppStore();
  const currentTab = tabs.find((t) => t.id === activeTabId);
  const isDocumentTab = currentTab?.type === 'document';

  // Listen for events from main process (Electron only)
  useEffect(() => {
    const electronApi = (window as any).electronAPI;
    if (!electronApi) return;

    // File open from CLI or menu
    if (electronApi.onOpenFile) {
      electronApi.onOpenFile((data: { filePath: string; content: string; fileName: string }) => {
        setMarkdown(data.content, data.filePath, data.fileName);
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
  }, [setMarkdown, toggleToc, nextPage, prevPage]);

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
    </Flex>
  );
}

export default App;
