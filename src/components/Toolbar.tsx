import { useRef } from "react";
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Text,
  NativeSelect,
} from "@chakra-ui/react";
import { useAppStore, StyleTemplate } from "../store/useAppStore";
import { isElectron, isDesktop } from "../lib/environment";

const styleOptions: { value: StyleTemplate; label: string; description: string }[] = [
  { value: "default", label: "Default", description: "Clean, readable sans-serif" },
  { value: "academic", label: "Academic", description: "Formal serif, paper-like" },
  { value: "minimal", label: "Minimal", description: "Simple, spacious layout" },
  { value: "dark", label: "Dark", description: "Dark theme, easy on eyes" },
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
    fileName,
    styleTemplate,
    tocVisible,
    setMarkdown,
    setStyleTemplate,
    toggleToc,
  } = useAppStore();

  // Electron file picker
  const handleElectronOpen = async () => {
    try {
      const result = await (window as any).electronAPI.openFile();
      if (result) {
        setMarkdown(result.content, result.filePath, result.fileName);
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  // Browser file input
  const handleBrowserOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setMarkdown(content, file.name, file.name);
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleOpenFile = isElectron() ? handleElectronOpen : handleBrowserOpen;

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
        accept=".md,.markdown,.txt"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <Flex justify="space-between" align="center">
        <HStack gap={2}>
          {/* Open/Upload file */}
          <IconButton
            aria-label={isDesktop() ? "Open file" : "Upload file"}
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
            onChange={(e) => setStyleTemplate(e.target.value as StyleTemplate)}
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
