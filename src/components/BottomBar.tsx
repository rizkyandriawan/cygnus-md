import { useEffect } from "react";
import { Box, Flex, HStack, IconButton, Text, Button } from "@chakra-ui/react";
import { useAppStore } from "../store/useAppStore";

export function BottomBar() {
  const {
    tabs,
    activeTabId,
    zoom,
    nextPage,
    prevPage,
    goToPage,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useAppStore();

  const currentTab = tabs.find((t) => t.id === activeTabId);
  const currentPage = currentTab?.currentPage || 1;
  const totalPages = currentTab?.totalPages || 1;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prevPage();
          break;
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          nextPage();
          break;
        case "Home":
          e.preventDefault();
          goToPage(1);
          break;
        case "End":
          e.preventDefault();
          goToPage(totalPages);
          break;
        case "+":
        case "=":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case "-":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetZoom();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPage, prevPage, goToPage, totalPages, zoomIn, zoomOut, resetZoom]);

  if (totalPages === 0) return null;

  return (
    <Box
      as="footer"
      bg="#1e1b4b"
      color="white"
      px={4}
      py={2}
      position="sticky"
      bottom={0}
      zIndex={100}
    >
      <Flex justify="space-between" align="center">
        {/* Left: Zoom controls */}
        <HStack gap={1}>
          <IconButton
            aria-label="Zoom out"
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#3b327a" }}
            disabled={zoom <= 0.5}
            onClick={zoomOut}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </IconButton>

          <Button
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#3b327a" }}
            onClick={resetZoom}
            minW="60px"
          >
            {Math.round(zoom * 100)}%
          </Button>

          <IconButton
            aria-label="Zoom in"
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#3b327a" }}
            disabled={zoom >= 2}
            onClick={zoomIn}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </IconButton>
        </HStack>

        {/* Center: Page navigation */}
        <HStack gap={2}>
          <IconButton
            aria-label="First page"
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#3b327a" }}
            disabled={currentPage <= 1}
            onClick={() => goToPage(1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="11,17 6,12 11,7" />
              <line x1="18" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>

          <IconButton
            aria-label="Previous page"
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#3b327a" }}
            disabled={currentPage <= 1}
            onClick={prevPage}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </IconButton>

          <Text fontSize="sm" minW="100px" textAlign="center" userSelect="none" color="#fcd34d">
            {currentPage} / {totalPages}
          </Text>

          <IconButton
            aria-label="Next page"
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#3b327a" }}
            disabled={currentPage >= totalPages}
            onClick={nextPage}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,6 15,12 9,18" />
            </svg>
          </IconButton>

          <IconButton
            aria-label="Last page"
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#3b327a" }}
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(totalPages)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="13,7 18,12 13,17" />
              <line x1="6" y1="6" x2="6" y2="18" />
            </svg>
          </IconButton>
        </HStack>

        {/* Right: Keyboard hints */}
        <Text fontSize="xs" color="#a78bfa" minW="180px" textAlign="right">
          ← → Home End | Ctrl +/-/0
        </Text>
      </Flex>
    </Box>
  );
}
