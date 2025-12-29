import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { useAppStore } from "../store/useAppStore";

export function TableOfContents() {
  const { tabs, activeTabId, tocVisible, viewMode, goToPage } = useAppStore();

  const currentTab = tabs.find((t) => t.id === activeTabId);
  const toc = currentTab?.toc || [];
  const currentPage = currentTab?.currentPage || 1;
  const markdown = currentTab?.markdown || '';

  const handleClick = (item: { id: string; page?: number }) => {
    if (viewMode === 'scroll') {
      // Scroll mode: dispatch event to scroll to heading
      window.dispatchEvent(new CustomEvent('scroll-to-heading', { detail: { id: item.id } }));
    } else if (item.page) {
      // Paginated mode: go to page
      goToPage(item.page);
    }
  };

  const isVisible = tocVisible && !!markdown;

  // Always render but animate visibility
  return (
    <Box
      as="aside"
      w={isVisible ? "280px" : "0px"}
      minW={isVisible ? "280px" : "0px"}
      bg="#faf8f0"
      borderRight="1px solid"
      borderColor="#e5e0d5"
      h="100%"
      overflow="hidden"
      opacity={isVisible ? 1 : 0}
      transition="all 0.25s ease-in-out"
    >
      <Box p={4} w="280px" h="100%" overflowY="auto">
        <Text fontWeight="bold" fontSize="sm" color="#4c1d95" mb={3}>
          Table of Contents
        </Text>

        {toc.length > 0 && (
          <VStack align="stretch" gap={1}>
            {toc.map((item) => {
              const indent = (item.level - 1) * 12;
              const isActive = item.page === currentPage;

              return (
                <HStack
                  key={item.id}
                  as="button"
                  justify="space-between"
                  py={1.5}
                  px={2}
                  pl={`${indent + 8}px`}
                  borderRadius="md"
                  bg={isActive ? "#ede9fe" : "transparent"}
                  color={isActive ? "#4c1d95" : "#581c87"}
                  fontSize="sm"
                  _hover={{ bg: isActive ? "#ede9fe" : "#f0ebe0" }}
                  transition="background 0.15s"
                  onClick={() => handleClick(item)}
                  cursor="pointer"
                >
                  <Text
                    truncate
                    textAlign="left"
                    fontWeight={item.level <= 2 ? "medium" : "normal"}
                    fontSize={item.level === 1 ? "sm" : "xs"}
                  >
                    {item.text}
                  </Text>
                  {viewMode === 'paginated' && item.page && (
                    <Text fontSize="xs" color="#7c3aed" flexShrink={0}>
                      {item.page}
                    </Text>
                  )}
                </HStack>
              );
            })}
          </VStack>
        )}
      </Box>
    </Box>
  );
}
