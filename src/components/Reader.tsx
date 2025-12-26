import { useEffect, useRef, useCallback, useState } from "react";
import { Box, VStack } from "@chakra-ui/react";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";
import { useAppStore, TocItem } from "../store/useAppStore";
import { api } from "../lib/api";

// Configure marked with KaTeX extension
marked.use(markedKatex({
  throwOnError: false,
  displayMode: true,
}));

// Import style templates
import "../styles/templates/default.css";
import "../styles/templates/academic.css";
import "../styles/templates/minimal.css";
import "../styles/templates/streamline.css";
import "../styles/templates/focus.css";
import "../styles/templates/swiss.css";
import "../styles/templates/paperback.css";
import "../styles/templates/coral.css";
import "../styles/templates/slate.css";
import "../styles/templates/luxe.css";
import "../styles/templates/geometric.css";

// A4 dimensions at 96 DPI (screen)
const PAGE_WIDTH = 794; // 210mm
const PAGE_HEIGHT = 1123; // 297mm
const PAGE_PADDING = 80; // padding inside page
const PAGE_BOTTOM_BUFFER = 32; // extra space at bottom to prevent content touching edge
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING * 2 - PAGE_BOTTOM_BUFFER;

// Pagination rules
const MIN_LINES_TO_SPLIT = 8; // Only split paragraphs with 8+ lines
const ORPHAN_LINES = 2; // Min lines at bottom of page
const WIDOW_LINES = 2; // Min lines at top of next page

interface PageBlock {
  element: HTMLElement;
  isPartial?: boolean;
  clipTop?: number;
  clipHeight?: number;
}

interface Page {
  blocks: PageBlock[];
  height: number;
}

// Detect lines in a paragraph by scanning character positions
function getLineBreaks(element: HTMLElement): { count: number; heights: number[] } {
  const text = element.textContent || '';
  if (!text.trim()) return { count: 0, heights: [] };

  // Create a range to measure character positions
  const range = document.createRange();
  const textNodes: Text[] = [];

  // Collect all text nodes
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  if (textNodes.length === 0) return { count: 1, heights: [element.offsetHeight] };

  const lines: { top: number; height: number }[] = [];
  let lastTop = -Infinity;

  for (const textNode of textNodes) {
    for (let i = 0; i < textNode.length; i++) {
      range.setStart(textNode, i);
      range.setEnd(textNode, Math.min(i + 1, textNode.length));
      const rect = range.getBoundingClientRect();

      // New line detected when Y position changes significantly
      if (rect.top > lastTop + 2) {
        lines.push({ top: rect.top, height: rect.height });
        lastTop = rect.top;
      }
    }
  }

  return {
    count: lines.length,
    heights: lines.map(l => l.height)
  };
}

// Slugify heading text for IDs (matches GitHub-style markdown link format)
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars (& becomes nothing, leaves gap)
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing dashes only
}

// Split paragraph element at a specific line
function splitParagraphAtLine(
  element: HTMLElement,
  splitAtLine: number,
  totalLines: number,
  _lineHeight: number
): { first: PageBlock; second: PageBlock } {
  const fullHeight = element.offsetHeight;
  const avgLineHeight = fullHeight / totalLines;

  const firstHeight = splitAtLine * avgLineHeight;
  const secondHeight = fullHeight - firstHeight;

  return {
    first: {
      element: element.cloneNode(true) as HTMLElement,
      isPartial: true,
      clipTop: 0,
      clipHeight: firstHeight,
    },
    second: {
      element: element.cloneNode(true) as HTMLElement,
      isPartial: true,
      clipTop: firstHeight,
      clipHeight: secondHeight,
    },
  };
}

export function Reader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Page[]>([]);

  const {
    tabs,
    activeTabId,
    styleTemplate,
    zoom,
    setTotalPages,
    setToc,
    setCurrentPage,
    clearScrollTarget,
  } = useAppStore();

  const currentTab = tabs.find((t) => t.id === activeTabId);
  const markdown = currentTab?.markdown || '';
  const filePath = currentTab?.filePath || null;
  const scrollTarget = currentTab?.scrollTarget || null;

  const scrollToPage = useCallback((pageNum: number) => {
    if (!containerRef.current) return;
    const pageEl = containerRef.current.querySelector(`[data-page="${pageNum}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const paginateContent = useCallback(async () => {
    if (!measureRef.current || !markdown) return;

    // Parse markdown to HTML
    let html = await marked(markdown);

    // Convert relative image paths to absolute paths
    if (filePath && filePath.includes("/") && api.isDesktop) {
      const baseDir = filePath.substring(0, filePath.lastIndexOf("/")); // Get directory of the MD file

      // Find all local image sources and convert them
      const imgRegex = /<img\s+([^>]*?)src=["'](?!https?:\/\/|data:|local-file:\/\/|asset:\/\/)([^"']+)["']/gi;
      const matches = [...html.matchAll(imgRegex)];

      for (const match of matches) {
        const [fullMatch, prefix, src] = match;
        const absolutePath = src.startsWith("/")
          ? src
          : `${baseDir}/${src}`.replace(/\/\.\//g, "/");

        const fileUrl = await api.getFileUrl(absolutePath);
        html = html.replace(fullMatch, `<img ${prefix}src="${fileUrl}"`);
      }
    }

    // Create temp container to measure elements
    const tempDiv = document.createElement("div");
    tempDiv.className = `md-content template-${styleTemplate}`;
    tempDiv.style.width = `${PAGE_WIDTH - PAGE_PADDING * 2}px`;
    tempDiv.style.position = "absolute";
    tempDiv.style.visibility = "hidden";
    tempDiv.innerHTML = html;
    measureRef.current.appendChild(tempDiv);

    // Build TOC from headings
    const headings = tempDiv.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const tocItems: TocItem[] = [];
    const usedIds = new Set<string>();

    headings.forEach((heading) => {
      const text = heading.textContent || "";
      let id = slugify(text);

      // Handle duplicate IDs
      if (usedIds.has(id)) {
        let counter = 1;
        while (usedIds.has(`${id}-${counter}`)) counter++;
        id = `${id}-${counter}`;
      }
      usedIds.add(id);

      heading.id = id;
      tocItems.push({
        id,
        text,
        level: parseInt(heading.tagName[1]),
      });
    });

    // Paginate: group elements into pages with smart breaking
    const allPages: Page[] = [];
    let currentPageBlocks: PageBlock[] = [];
    let currentHeight = 0;

    const children = Array.from(tempDiv.children) as HTMLElement[];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const nextChild = children[i + 1];
      const tagName = child.tagName.toUpperCase();

      const childHeight = child.offsetHeight;
      const childMargin = parseInt(getComputedStyle(child).marginBottom) || 0;
      const totalHeight = childHeight + childMargin;
      const remainingSpace = CONTENT_HEIGHT - currentHeight;

      // Rule 1: Break before H1 only (major sections)
      // H2+ just use keep-with-next, no forced break
      if (tagName === 'H1' && currentPageBlocks.length > 0) {
        allPages.push({ blocks: currentPageBlocks, height: currentHeight });
        currentPageBlocks = [];
        currentHeight = 0;
      }

      // Rule 2: Keep heading with its content
      const isHeading = /^H[1-6]$/.test(tagName);

      if (isHeading && nextChild && currentPageBlocks.length > 0) {
        const spaceAfterHeading = remainingSpace - totalHeight;
        const nextHeight = nextChild.offsetHeight + (parseInt(getComputedStyle(nextChild).marginBottom) || 0);
        const nextTagName = nextChild.tagName.toUpperCase();
        const nextIsAlsoHeading = /^H[1-6]$/.test(nextTagName);
        const nextIsSplittable = nextTagName === 'P' || nextTagName === 'PRE';

        // Move heading to next page if:
        // 1. Next element doesn't fit AND is not splittable, OR
        // 2. Next element is also a heading and THAT one's content won't fit
        let shouldMove = false;

        if (totalHeight <= remainingSpace) {
          if (nextHeight > spaceAfterHeading && !nextIsSplittable) {
            // Next element doesn't fit and can't be split → move heading
            shouldMove = true;
          } else if (nextIsAlsoHeading) {
            // Next is also heading - check if there's room for content after both
            const spaceAfterBothHeadings = spaceAfterHeading - nextHeight;
            const MIN_CONTENT_SPACE = CONTENT_HEIGHT * 0.10; // ~96px, ~3 lines
            if (spaceAfterBothHeadings < MIN_CONTENT_SPACE) {
              shouldMove = true;
            }
          }
        }

        if (shouldMove) {
          allPages.push({ blocks: currentPageBlocks, height: currentHeight });
          currentPageBlocks = [];
          currentHeight = 0;
        }
      }

      // Check if element fits
      if (totalHeight <= CONTENT_HEIGHT - currentHeight) {
        // Fits in current page
        currentPageBlocks.push({ element: child.cloneNode(true) as HTMLElement });
        currentHeight += totalHeight;
      } else {
        // Doesn't fit - try to split if it's a paragraph or code block with many lines
        const isSplittable = tagName === 'P' || tagName === 'PRE';
        const lineInfo = isSplittable ? getLineBreaks(child) : { count: 1, heights: [] };

        if (isSplittable && lineInfo.count >= MIN_LINES_TO_SPLIT && remainingSpace > 0) {
          // Calculate how many lines fit
          const avgLineHeight = childHeight / lineInfo.count;
          let linesFit = Math.floor(remainingSpace / avgLineHeight);

          // Apply orphan rule: need at least ORPHAN_LINES at bottom
          if (linesFit < ORPHAN_LINES) {
            linesFit = 0; // Move whole block to next page
          }

          // Apply widow rule: leave at least WIDOW_LINES for next page
          const linesRemaining = lineInfo.count - linesFit;
          if (linesRemaining > 0 && linesRemaining < WIDOW_LINES) {
            linesFit = Math.max(0, lineInfo.count - WIDOW_LINES);
          }

          if (linesFit >= ORPHAN_LINES && linesFit < lineInfo.count) {
            // Split the block
            const { first, second } = splitParagraphAtLine(child, linesFit, lineInfo.count, avgLineHeight);

            // Add first part to current page
            currentPageBlocks.push(first);
            currentHeight += first.clipHeight || 0;

            // Start new page with second part
            allPages.push({ blocks: currentPageBlocks, height: currentHeight });
            currentPageBlocks = [second];
            currentHeight = second.clipHeight || 0;

            // If second part is still too big for a page, keep splitting
            while (currentHeight > CONTENT_HEIGHT && lineInfo.count > MIN_LINES_TO_SPLIT) {
              // This block spans multiple pages
              allPages.push({ blocks: currentPageBlocks, height: CONTENT_HEIGHT });
              const remainingLines = Math.ceil((currentHeight - CONTENT_HEIGHT) / avgLineHeight);
              currentPageBlocks = [{
                element: child.cloneNode(true) as HTMLElement,
                isPartial: true,
                clipTop: (lineInfo.count - remainingLines) * avgLineHeight,
                clipHeight: remainingLines * avgLineHeight,
              }];
              currentHeight = remainingLines * avgLineHeight;
            }
            continue;
          }
        }

        // Can't split or shouldn't - move to next page
        if (currentPageBlocks.length > 0) {
          allPages.push({ blocks: currentPageBlocks, height: currentHeight });
        }
        currentPageBlocks = [{ element: child.cloneNode(true) as HTMLElement }];
        currentHeight = totalHeight;

        // If element is taller than page, let it overflow (close page immediately)
        if (totalHeight >= CONTENT_HEIGHT) {
          allPages.push({ blocks: currentPageBlocks, height: currentHeight });
          currentPageBlocks = [];
          currentHeight = 0;
        }
      }
    }

    // Don't forget last page
    if (currentPageBlocks.length > 0) {
      allPages.push({ blocks: currentPageBlocks, height: currentHeight });
    }

    // Map headings to page numbers
    const updatedToc = tocItems.map((item) => {
      let pageNum = 1;
      // Find the heading in pages
      for (let i = 0; i < allPages.length; i++) {
        for (const block of allPages[i].blocks) {
          if (block.element.id === item.id) {
            pageNum = i + 1;
            break;
          }
        }
      }
      return { ...item, page: pageNum };
    });

    // Cleanup
    measureRef.current.removeChild(tempDiv);

    setPages(allPages);
    setTotalPages(allPages.length);
    setToc(updatedToc);
    setCurrentPage(1);
  }, [markdown, filePath, activeTabId, styleTemplate, setTotalPages, setToc, setCurrentPage]);

  useEffect(() => {
    paginateContent();
  }, [paginateContent]);

  // Handle navigation
  useEffect(() => {
    if (scrollTarget !== null) {
      scrollToPage(scrollTarget);
      clearScrollTarget();
    }
  }, [scrollTarget, scrollToPage, clearScrollTarget]);

  // Track current page on scroll
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const pageNum = parseInt(entry.target.getAttribute("data-page") || "1");
            setCurrentPage(pageNum);
          }
        });
      },
      { threshold: 0.5 }
    );

    const pageElements = containerRef.current.querySelectorAll("[data-page]");
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [pages, setCurrentPage]);

  // Handle internal link clicks
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (anchor) {
      const href = anchor.getAttribute('href');

      // Internal link (starts with #)
      if (href?.startsWith('#')) {
        e.preventDefault();
        const targetId = href.slice(1);

        // Find which page has this heading
        for (let i = 0; i < pages.length; i++) {
          for (const block of pages[i].blocks) {
            // Check block's own ID
            if (block.element.id === targetId) {
              scrollToPage(i + 1);
              return;
            }
            // Check children IDs (for nested elements)
            const allElements = block.element.querySelectorAll('[id]');
            for (const el of allElements) {
              if (el.id === targetId) {
                scrollToPage(i + 1);
                return;
              }
            }
          }
        }
      }
    }
  }, [pages, scrollToPage]);

  if (!markdown) {
    return null;
  }

  // Render a block, handling partial (clipped) blocks
  const renderBlock = (block: PageBlock, _isFirst: boolean, _isLast: boolean): string => {
    if (!block.isPartial) {
      return block.element.outerHTML;
    }

    const isCodeBlock = block.element.tagName.toUpperCase() === 'PRE';
    const SPLIT_TOP_PADDING = isCodeBlock ? 16 : 0; // px padding at top of continuation
    const SPLIT_BOTTOM_PADDING = isCodeBlock ? 8 : 0; // px padding at bottom of each chunk

    const isContinuation = (block.clipTop || 0) > 0;
    const clipHeight = block.clipHeight || 0;

    // For partial blocks, wrap in a clipping container
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      height: ${clipHeight}px;
      overflow: hidden;
      position: relative;
      ${isCodeBlock ? `padding-bottom: ${SPLIT_BOTTOM_PADDING}px;` : ''}
    `;

    const inner = block.element.cloneNode(true) as HTMLElement;
    const topOffset = isContinuation ? (block.clipTop! - SPLIT_TOP_PADDING) : (block.clipTop || 0);

    inner.style.cssText = `
      margin-top: -${topOffset}px;
      margin-bottom: 0;
    `;

    wrapper.appendChild(inner);
    return wrapper.outerHTML;
  };

  return (
    <Box h="100%" overflow="auto" bg="#f5f0e5" py={8}>
      {/* Hidden measure container */}
      <Box ref={measureRef} position="absolute" visibility="hidden" />

      {/* Visible pages */}
      <VStack
        ref={containerRef}
        gap={6}
        align="center"
        onClick={handleContentClick}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "top center",
          transition: "transform 0.2s ease-out",
        }}
      >
        {pages.map((page, index) => (
          <Box
            key={index}
            data-page={index + 1}
            className={`md-content template-${styleTemplate}`}
            w={`${PAGE_WIDTH}px`}
            minH={`${PAGE_HEIGHT}px`}
            bg="white"
            p={`${PAGE_PADDING}px`}
            boxShadow="0 2px 8px rgba(0, 0, 0, 0.1)"
            dangerouslySetInnerHTML={{
              __html: page.blocks.map((block, idx) =>
                renderBlock(block, idx === 0, idx === page.blocks.length - 1)
              ).join(""),
            }}
          />
        ))}
      </VStack>
    </Box>
  );
}
