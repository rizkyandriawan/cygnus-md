import { useEffect } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { Reader } from "./components/Reader";
import { TableOfContents } from "./components/TableOfContents";
import { BottomBar } from "./components/BottomBar";
import { Home } from "./components/Home";
import { useAppStore } from "./store/useAppStore";

function App() {
  const { tabs, activeTabId } = useAppStore();
  const currentTab = tabs.find((t) => t.id === activeTabId);
  const isDocumentTab = currentTab?.type === 'document';

  // Set initial window title
  useEffect(() => {
    const title = currentTab?.type === 'document'
      ? `CygnusReader - ${currentTab.title}`
      : 'CygnusReader';
    document.title = title;
    if ((window as any).electronAPI?.setTitle) {
      (window as any).electronAPI.setTitle(title);
    }
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
