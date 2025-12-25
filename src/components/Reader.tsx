import { useEffect, useRef, useCallback, useState } from "react";
import { Box, VStack } from "@chakra-ui/react";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";
import { useAppStore, TocItem } from "../store/useAppStore";
import { isElectron } from "../lib/environment";

// Configure marked with KaTeX extension
marked.use(markedKatex({
  throwOnError: false,
  displayMode: true,
}));

// Import style templates
import "../styles/templates/default.css";
import "../styles/templates/academic.css";
import "../styles/templates/minimal.css";
import "../styles/templates/dark.css";
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
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING * 2;

interface Page {
  elements: HTMLElement[];
  height: number;
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
    if (filePath && filePath.includes("/")) {
      const baseDir = filePath.substring(0, filePath.lastIndexOf("/")); // Get directory of the MD file

      if (isElectron()) {
        // For Electron, use local-file:// protocol
        html = html.replace(
          /<img\s+([^>]*?)src=["'](?!https?:\/\/|data:|local-file:\/\/)([^"']+)["']/gi,
          (_match, prefix, src) => {
            // Handle relative paths
            const absolutePath = src.startsWith("/")
              ? src
              : `${baseDir}/${src}`.replace(/\/\.\//g, "/");
            const fileUrl = `local-file://${encodeURIComponent(absolutePath)}`;
            return `<img ${prefix}src="${fileUrl}"`;
          }
        );
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
    headings.forEach((heading, index) => {
      const id = `heading-${index}`;
      heading.id = id;
      tocItems.push({
        id,
        text: heading.textContent || "",
        level: parseInt(heading.tagName[1]),
      });
    });

    // Paginate: group elements into pages
    const allPages: Page[] = [];
    let currentPageElements: HTMLElement[] = [];
    let currentHeight = 0;

    const children = Array.from(tempDiv.children) as HTMLElement[];

    for (const child of children) {
      const childHeight = child.offsetHeight;
      const childMargin = parseInt(getComputedStyle(child).marginBottom) || 0;
      const totalHeight = childHeight + childMargin;

      // If element fits in current page, add it
      if (currentHeight + totalHeight <= CONTENT_HEIGHT) {
        currentPageElements.push(child.cloneNode(true) as HTMLElement);
        currentHeight += totalHeight;
      } else {
        // Save current page and start new one
        if (currentPageElements.length > 0) {
          allPages.push({ elements: currentPageElements, height: currentHeight });
        }
        currentPageElements = [child.cloneNode(true) as HTMLElement];
        currentHeight = totalHeight;
      }
    }

    // Don't forget last page
    if (currentPageElements.length > 0) {
      allPages.push({ elements: currentPageElements, height: currentHeight });
    }

    // Map headings to page numbers
    let elementIndex = 0;
    const updatedToc = tocItems.map((item) => {
      // Find which page this heading is on
      let pageNum = 1;
      let count = 0;
      for (let i = 0; i < allPages.length; i++) {
        count += allPages[i].elements.length;
        if (elementIndex < count) {
          pageNum = i + 1;
          break;
        }
      }

      // Find the heading in pages
      for (let i = 0; i < allPages.length; i++) {
        for (const el of allPages[i].elements) {
          if (el.id === item.id) {
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

  if (!markdown) {
    return null;
  }

  return (
    <Box h="100%" overflow="auto" bg="#f5f0e5" py={8}>
      {/* Hidden measure container */}
      <Box ref={measureRef} position="absolute" visibility="hidden" />

      {/* Visible pages */}
      <VStack
        ref={containerRef}
        gap={6}
        align="center"
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
              __html: page.elements.map((el) => el.outerHTML).join(""),
            }}
          />
        ))}
      </VStack>
    </Box>
  );
}
