import { Box, Center, Text, VStack, HStack } from "@chakra-ui/react";
import { useAppStore } from "../store/useAppStore";
import { isElectron } from "../lib/environment";

export function Home() {
  const { recentFiles, setMarkdown } = useAppStore();

  const handleOpenRecent = async (filePath: string, fileName: string) => {
    if (isElectron()) {
      try {
        const content = await (window as any).electronAPI.readFile(filePath);
        if (content) {
          setMarkdown(content, filePath, fileName);
        }
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    }
  };

  const handleOpenFile = async () => {
    if (isElectron()) {
      try {
        const result = await (window as any).electronAPI.openFile();
        if (result) {
          setMarkdown(result.content, result.filePath, result.fileName);
        }
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    }
  };

  return (
    <Center h="100%" bg="gray.100">
      <VStack gap={8} maxW="500px" w="100%" px={4}>
        {/* Logo/Title */}
        <VStack gap={2}>
          <Text fontSize="4xl" fontWeight="bold" color="gray.700">
            CygnusReader
          </Text>
          <Text fontSize="md" color="gray.500">
            A beautiful Markdown reader
          </Text>
        </VStack>

        {/* Open File Button */}
        <Box
          as="button"
          onClick={handleOpenFile}
          bg="gray.800"
          color="white"
          px={6}
          py={3}
          borderRadius="lg"
          fontWeight="medium"
          _hover={{ bg: "gray.700" }}
          transition="background 0.2s"
        >
          <HStack gap={2}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <Text>Open Markdown File</Text>
          </HStack>
        </Box>

        {/* Recent Files */}
        {recentFiles.length > 0 && (
          <VStack gap={3} w="100%" align="stretch">
            <Text fontSize="sm" fontWeight="medium" color="gray.500" textTransform="uppercase">
              Recent Files
            </Text>
            <VStack gap={1} align="stretch">
              {recentFiles.slice(0, 5).map((file) => (
                <Box
                  key={file.path}
                  as="button"
                  onClick={() => handleOpenRecent(file.path, file.name)}
                  textAlign="left"
                  px={4}
                  py={3}
                  bg="white"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="gray.200"
                  _hover={{ bg: "gray.50", borderColor: "gray.300" }}
                  transition="all 0.15s"
                >
                  <Text fontWeight="medium" color="gray.700" truncate>
                    {file.name}
                  </Text>
                  <Text fontSize="xs" color="gray.400" truncate>
                    {file.path}
                  </Text>
                </Box>
              ))}
            </VStack>
          </VStack>
        )}

        {/* Keyboard hint */}
        <Text fontSize="xs" color="gray.400">
          Tip: Use the toolbar button or drag & drop a file
        </Text>
      </VStack>
    </Center>
  );
}
