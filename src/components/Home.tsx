import { Box, Center, Text, VStack, HStack } from "@chakra-ui/react";
import { useAppStore } from "../store/useAppStore";
import { api, OpenedFile } from "../lib/api";
import { parseEpub, isEpub } from "../lib/epub";

export function Home() {
  const { recentFiles, setMarkdown, showLoading, hideLoading } = useAppStore();

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

  const handleOpenRecent = async (filePath: string) => {
    try {
      const file = await api.openFilePath(filePath);
      if (file) {
        await processFile(file);
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  const handleOpenFile = async () => {
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

  return (
    <Center h="100%" bg="#f5f0e5">
      <VStack gap={8} maxW="500px" w="100%" px={4}>
        {/* Logo/Title */}
        <VStack gap={2}>
          <Text fontSize="4xl" fontWeight="bold" color="#4c1d95">
            CygnusReader
          </Text>
          <Text fontSize="md" color="#6b21a8">
            A beautiful Markdown & EPUB reader
          </Text>
        </VStack>

        {/* Open File Button */}
        <Box
          as="button"
          onClick={handleOpenFile}
          bg="#6b21a8"
          color="white"
          px={6}
          py={3}
          borderRadius="lg"
          fontWeight="medium"
          _hover={{ bg: "#581c87" }}
          transition="background 0.2s"
        >
          <HStack gap={2}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <Text>Open File</Text>
          </HStack>
        </Box>

        {/* Recent Files */}
        {recentFiles.length > 0 && (
          <VStack gap={3} w="100%" align="stretch">
            <Text fontSize="sm" fontWeight="medium" color="#7c3aed" textTransform="uppercase">
              Recent Files
            </Text>
            <VStack gap={1} align="stretch">
              {recentFiles.slice(0, 5).map((file) => (
                <Box
                  key={file.path}
                  as="button"
                  onClick={() => handleOpenRecent(file.path)}
                  textAlign="left"
                  px={4}
                  py={3}
                  bg="white"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="#c4b5fd"
                  _hover={{ bg: "#ede9fe", borderColor: "#7c3aed" }}
                  transition="all 0.15s"
                >
                  <Text fontWeight="medium" color="#4c1d95" truncate>
                    {file.name}
                  </Text>
                  <Text fontSize="xs" color="#7c3aed" truncate>
                    {file.path}
                  </Text>
                </Box>
              ))}
            </VStack>
          </VStack>
        )}

        {/* About */}
        <Text fontSize="xs" color="#a78bfa" textAlign="center">
          A lightweight, paginated Markdown & EPUB reader
          <br />
          v0.2.5
        </Text>
      </VStack>
    </Center>
  );
}
