import { Box, HStack, Text, Flex } from "@chakra-ui/react";
import { useAppStore } from "../store/useAppStore";
import { api } from "../lib/api";

export function TabBar() {
  const { tabs, activeTabId, switchTab, closeTab } = useAppStore();

  const handleMinimize = () => api.minimize();
  const handleMaximize = () => api.maximize();
  const handleClose = () => api.close();

  return (
    <Flex
      bg="#1e1b4b"
      borderBottom="1px solid"
      borderColor="#3b327a"
      css={{ WebkitAppRegion: "drag" }}
    >
      <HStack
        gap={0}
        overflowX="auto"
        flex={1}
        css={{
          "&::-webkit-scrollbar": { display: "none" },
          WebkitAppRegion: "no-drag",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isHome = tab.type === 'home';

          return (
            <HStack
              key={tab.id}
              gap={1}
              px={4}
              py={2}
              bg={isActive ? "#2e1065" : "transparent"}
              color={isActive ? "white" : "#a78bfa"}
              borderRight="1px solid"
              borderColor="#3b327a"
              cursor="pointer"
              _hover={{ bg: isActive ? "#2e1065" : "#252058", color: "white" }}
              transition="all 0.15s"
              onClick={() => switchTab(tab.id)}
              minW="120px"
              maxW="200px"
            >
              {/* Home icon or document icon */}
              {isHome ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}

              <Text fontSize="xs" truncate flex={1}>
                {tab.title}
              </Text>

              {/* Close button (not for home) */}
              {!isHome && (
                <Box
                  as="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  p={1}
                  borderRadius="sm"
                  _hover={{ bg: "#7c3aed" }}
                  color="#8b5cf6"
                  _groupHover={{ color: "#c4b5fd" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Box>
              )}
            </HStack>
          );
        })}
      </HStack>

      {/* Window controls */}
      {api.isDesktop && (
        <HStack gap={0} css={{ WebkitAppRegion: "no-drag" }}>
          <Box
            as="button"
            px={4}
            py={2}
            color="#a78bfa"
            _hover={{ bg: "#3b327a", color: "white" }}
            transition="all 0.15s"
            onClick={handleMinimize}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
          </Box>
          <Box
            as="button"
            px={4}
            py={2}
            color="#a78bfa"
            _hover={{ bg: "#3b327a", color: "white" }}
            transition="all 0.15s"
            onClick={handleMaximize}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </Box>
          <Box
            as="button"
            px={4}
            py={2}
            color="#a78bfa"
            _hover={{ bg: "#dc2626", color: "white" }}
            transition="all 0.15s"
            onClick={handleClose}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Box>
        </HStack>
      )}
    </Flex>
  );
}
