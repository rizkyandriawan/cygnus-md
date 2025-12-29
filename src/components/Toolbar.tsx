import { useRef } from "react";
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Text,
  NativeSelect,
  Menu,
  Portal,
} from "@chakra-ui/react";
import { useAppStore, StyleTemplate } from "../store/useAppStore";
import { api, OpenedFile } from "../lib/api";
import { parseEpub, isEpub } from "../lib/epub";

const styleOptions: { value: StyleTemplate; label: string; description: string }[] = [
  { value: "default", label: "Default", description: "Clean, readable sans-serif" },
  { value: "academic", label: "Academic", description: "Formal serif, paper-like" },
  { value: "minimal", label: "Minimal", description: "Simple, spacious layout" },
  { value: "streamline", label: "Streamline", description: "Modern, blue accent" },
  { value: "focus", label: "Focus", description: "Bold, high contrast" },
  { value: "swiss", label: "Swiss", description: "Clean, grid-based design" },
  { value: "paperback", label: "Paperback", description: "Warm sepia, book-like" },
  { value: "coral", label: "Coral", description: "Friendly coral/pink accent" },
  { value: "slate", label: "Slate", description: "Professional gray/blue" },
  { value: "luxe", label: "Luxe", description: "Elegant serif, gold accents" },
  { value: "geometric", label: "Geometric", description: "Modern, vibrant shapes" },
];

// Consistent button style for toolbar (classic Word style)
const toolbarButtonStyle = {
  variant: "outline" as const,
  color: "#4c1d95",
  borderColor: "#c4b5fd",
  bg: "white",
  _hover: { bg: "#ede9fe", borderColor: "#7c3aed" },
};

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    tabs,
    activeTabId,
    styleTemplate,
    viewMode,
    tocVisible,
    setMarkdown,
    setStyleTemplate,
    toggleViewMode,
    toggleToc,
    showLoading,
    hideLoading,
  } = useAppStore();

  const currentTab = tabs.find((t) => t.id === activeTabId);
  const fileName = currentTab?.type === 'document' ? currentTab.title : null;

  // Process opened file (handle EPUB vs Markdown)
  const processFile = async (file: OpenedFile) => {
    const isEpubFile = file.type === 'epub' || isEpub(file.fileName);

    if (isEpubFile) {
      showLoading('Opening EPUB...');
      try {
        // Decode base64 to ArrayBuffer
        const binary = atob(file.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        // Parse EPUB
        const parsed = await parseEpub(arrayBuffer);
        // Use the parsed HTML as content (it will be rendered directly)
        setMarkdown(parsed.html, file.filePath, file.fileName, 'html');
      } catch (err) {
        console.error("Failed to parse EPUB:", err);
      } finally {
        hideLoading();
      }
    } else {
      setMarkdown(file.content, file.filePath, file.fileName, 'markdown');
    }
  };

  // Desktop file picker (Electron or Tauri)
  const handleDesktopOpen = async () => {
    try {
      const files = await api.openFile();
      if (files && files.length > 0) {
        for (const file of files) {
          await processFile(file);
        }
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  // Browser file input
  const handleBrowserOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const readFile = (file: File): Promise<OpenedFile> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        const fileIsEpub = isEpub(file.name);

        if (fileIsEpub) {
          reader.onload = (event) => {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            // Convert to base64
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
              binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
            }
            const content = btoa(binary);
            resolve({
              content,
              filePath: file.name,
              fileName: file.name,
              type: 'epub',
            });
          };
          reader.readAsArrayBuffer(file);
        } else {
          reader.onload = (event) => {
            resolve({
              content: event.target?.result as string,
              filePath: file.name,
              fileName: file.name,
              type: 'markdown',
            });
          };
          reader.readAsText(file);
        }
      });
    };

    const files = await Promise.all(Array.from(fileList).map(readFile));
    for (const file of files) {
      await processFile(file);
    }

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleOpenFile = api.isDesktop ? handleDesktopOpen : handleBrowserOpen;

  return (
    <Box
      as="header"
      bg="#ece8f4"
      color="#4c1d95"
      px={4}
      py={2}
      position="sticky"
      top={0}
      zIndex={100}
      borderBottom="1px solid"
      borderColor="#c4b5fd"
    >
      {/* Hidden file input for browser mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt,.epub"
        multiple
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <Flex justify="space-between" align="center">
        <HStack gap={2}>
          {/* Open/Upload file */}
          <IconButton
            aria-label={api.isDesktop ? "Open file" : "Upload file"}
            size="sm"
            {...toolbarButtonStyle}
            onClick={handleOpenFile}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </IconButton>

          {/* Toggle TOC */}
          <IconButton
            aria-label="Toggle TOC"
            size="sm"
            {...toolbarButtonStyle}
            bg={tocVisible ? "#c4b5fd" : "white"}
            onClick={toggleToc}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </IconButton>

          {/* Toggle View Mode */}
          <IconButton
            aria-label={viewMode === 'paginated' ? "Switch to scroll view" : "Switch to paginated view"}
            size="sm"
            {...toolbarButtonStyle}
            onClick={toggleViewMode}
          >
            {viewMode === 'paginated' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )}
          </IconButton>

          {/* Export Menu */}
          {api.isDesktop && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Export"
                  size="sm"
                  {...toolbarButtonStyle}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content
                    bg="white"
                    borderRadius="md"
                    boxShadow="lg"
                    border="1px solid"
                    borderColor="gray.200"
                    py={1}
                    minW="160px"
                  >
                    <Menu.Item
                      value="pdf"
                      onClick={() => window.dispatchEvent(new CustomEvent('export-pdf-request'))}
                      px={3}
                      py={2}
                      cursor="pointer"
                      _hover={{ bg: "purple.50" }}
                      display="flex"
                      alignItems="center"
                      gap={2}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <Text fontSize="sm">Export as PDF</Text>
                    </Menu.Item>
                    <Menu.Item
                      value="docx"
                      onClick={() => window.dispatchEvent(new CustomEvent('export-docx-request'))}
                      px={3}
                      py={2}
                      cursor="pointer"
                      _hover={{ bg: "purple.50" }}
                      display="flex"
                      alignItems="center"
                      gap={2}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <text x="7" y="17" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">W</text>
                      </svg>
                      <Text fontSize="sm">Export as DOCX</Text>
                    </Menu.Item>
                    <Menu.Item
                      value="html"
                      onClick={() => window.dispatchEvent(new CustomEvent('export-html-request'))}
                      px={3}
                      py={2}
                      cursor="pointer"
                      _hover={{ bg: "purple.50" }}
                      display="flex"
                      alignItems="center"
                      gap={2}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <text x="5" y="17" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">&lt;/&gt;</text>
                      </svg>
                      <Text fontSize="sm">Export as HTML</Text>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          )}

          {fileName && (
            <Text fontSize="sm" color="#6b21a8" ml={2}>
              {fileName}
            </Text>
          )}
        </HStack>

        {/* Style selector */}
        <NativeSelect.Root size="sm" w="180px">
          <NativeSelect.Field
            value={styleTemplate}
            onChange={(e) => {
              const newTemplate = e.target.value as StyleTemplate;
              showLoading('Applying theme...');
              // Delay to let loading modal appear before re-pagination
              setTimeout(() => {
                setStyleTemplate(newTemplate);
                // Hide after a short delay for re-pagination
                setTimeout(() => hideLoading(), 300);
              }, 50);
            }}
            bg="white"
            color="#4c1d95"
            borderColor="#c4b5fd"
            _hover={{ borderColor: "#7c3aed" }}
            cursor="pointer"
            px={3}
            py={1}
          >
            {styleOptions.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: "white" }}>
                {opt.label}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator color="#6b21a8" />
        </NativeSelect.Root>
      </Flex>
    </Box>
  );
}
