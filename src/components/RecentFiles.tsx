import { Box, Button, Text, VStack } from "@chakra-ui/react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/useAppStore";

export function RecentFiles() {
  const { recentFiles, setMarkdown } = useAppStore();

  const handleOpenRecent = async (path: string, name: string) => {
    try {
      const content = await readTextFile(path);
      setMarkdown(content, path, name);
    } catch (err) {
      console.error("Failed to open recent file:", err);
    }
  };

  if (recentFiles.length === 0) {
    return null;
  }

  return (
    <Box
      position="absolute"
      top="50px"
      left={4}
      bg="white"
      borderRadius="md"
      boxShadow="lg"
      p={3}
      zIndex={50}
      minW="250px"
      maxW="400px"
    >
      <Text fontWeight="bold" fontSize="sm" color="gray.600" mb={2}>
        Recent Files
      </Text>

      <VStack align="stretch" gap={1}>
        {recentFiles.map((file) => (
          <Button
            key={file.path}
            variant="ghost"
            size="sm"
            justifyContent="flex-start"
            onClick={() => handleOpenRecent(file.path, file.name)}
            py={2}
          >
            <VStack align="start" gap={0}>
              <Text fontSize="sm" fontWeight="medium">
                {file.name}
              </Text>
              <Text fontSize="xs" color="gray.400" truncate maxW="350px">
                {file.path}
              </Text>
            </VStack>
          </Button>
        ))}
      </VStack>
    </Box>
  );
}
