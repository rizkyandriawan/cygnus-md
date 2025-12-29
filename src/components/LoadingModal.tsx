import { Box, Text, VStack } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

interface LoadingModalProps {
  isOpen: boolean;
  message: string;
  progress?: number; // 0-100, optional
}

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

export function LoadingModal({ isOpen, message, progress }: LoadingModalProps) {
  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="blackAlpha.600"
      zIndex={9999}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        bg="white"
        borderRadius="xl"
        p={8}
        minW="280px"
        boxShadow="2xl"
        textAlign="center"
      >
        <VStack gap={4}>
          {/* Spinner */}
          <Box
            w="48px"
            h="48px"
            border="4px solid"
            borderColor="#e9d5ff"
            borderTopColor="#7c3aed"
            borderRadius="full"
            animation={`${spin} 0.8s linear infinite`}
          />

          {/* Message */}
          <Text
            color="#4c1d95"
            fontWeight="medium"
            fontSize="md"
            animation={`${pulse} 1.5s ease-in-out infinite`}
          >
            {message}
          </Text>

          {/* Progress bar (optional) */}
          {progress !== undefined && (
            <Box w="100%">
              <Box
                h="6px"
                bg="#e9d5ff"
                borderRadius="full"
                overflow="hidden"
              >
                <Box
                  h="100%"
                  bg="#7c3aed"
                  borderRadius="full"
                  transition="width 0.3s ease"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </Box>
              <Text fontSize="xs" color="#6b21a8" mt={1}>
                {Math.round(progress)}%
              </Text>
            </Box>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
