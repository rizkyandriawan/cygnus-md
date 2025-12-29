import { useEffect, useRef, useCallback, useState } from "react";
import { Box, VStack } from "@chakra-ui/react";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";
import { useAppStore, TocItem } from "../store/useAppStore";
import { api } from "../lib/api";
import { FolioPages, FolioPagesRef } from "./FolioPages";
import { htmlToDocx } from "../lib/docx";
import { processDiagrams } from "../lib/diagrams";

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

// Slugify heading text for IDs (matches GitHub-style markdown link format)
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function Reader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const folioRef = useRef<FolioPagesRef>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [html, setHtml] = useState<string>('');
  const [toc, setTocState] = useState<TocItem[]>([]);

  const {
    tabs,
    activeTabId,
    styleTemplate,
    viewMode,
    zoom,
    searchQuery,
    searchMatchIndex,
    setTotalPages,
    setToc,
    setCurrentPage,
    clearScrollTarget,
    setSearchMatchCount,
    showLoading,
    hideLoading,
  } = useAppStore();

  const currentTab = tabs.find((t) => t.id === activeTabId);
  const markdown = currentTab?.markdown || '';
  const filePath = currentTab?.filePath || null;
  const scrollTarget = currentTab?.scrollTarget || null;
  const contentType = currentTab?.contentType || 'markdown';

  // Parse markdown and prepare HTML
  useEffect(() => {
    if (!markdown) {
      setHtml('');
      return;
    }

    (async () => {
      // For HTML content (EPUB), skip markdown parsing
      let parsedHtml = contentType === 'html' ? markdown : await marked(markdown);

      // Process mermaid and plantuml diagrams
      if (contentType === 'markdown') {
        parsedHtml = await processDiagrams(parsedHtml);
      }

      // Convert relative image paths to absolute paths
      if (filePath && filePath.includes("/") && api.isDesktop) {
        const baseDir = filePath.substring(0, filePath.lastIndexOf("/"));
        const imgRegex = /<img\s+([^>]*?)src=["'](?!https?:\/\/|data:|local-file:\/\/|asset:\/\/)([^"']+)["']/gi;
        const matches = [...parsedHtml.matchAll(imgRegex)];

        for (const match of matches) {
          const [fullMatch, prefix, src] = match;
          const absolutePath = src.startsWith("/")
            ? src
            : `${baseDir}/${src}`.replace(/\/\.\//g, "/");
          const fileUrl = await api.getFileUrl(absolutePath);
          parsedHtml = parsedHtml.replace(fullMatch, `<img ${prefix}src="${fileUrl}"`);
        }
      }

      // Build TOC from parsed HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = parsedHtml;
      const headings = tempDiv.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const tocItems: TocItem[] = [];
      const usedIds = new Set<string>();

      headings.forEach((heading) => {
        const text = (heading.textContent || "").trim();
        if (!text) {
          // Remove empty headings from DOM
          heading.remove();
          return;
        }

        let id = slugify(text);
        if (!id) {
          heading.remove();
          return;
        }

        if (usedIds.has(id)) {
          let counter = 1;
          while (usedIds.has(`${id}-${counter}`)) counter++;
          id = `${id}-${counter}`;
        }
        usedIds.add(id);

        heading.id = id;
        tocItems.push({ id, text, level: parseInt(heading.tagName[1]) });
      });

      setTocState(tocItems);
      setHtml(tempDiv.innerHTML);
    })();
  }, [markdown, filePath, contentType]);

  // Update store with TOC
  useEffect(() => {
    setToc(toc);
  }, [toc, setToc]);

  // Set up scroll observer for page tracking
  const setupScrollObserver = useCallback(() => {
    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!containerRef.current) {
      console.warn('[Reader] setupScrollObserver: containerRef is null');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            const pageNum = parseInt(entry.target.getAttribute("data-page") || "1");
            setCurrentPage(pageNum);
          }
        });
      },
      { threshold: 0.3 }
    );

    const pageElements = containerRef.current.querySelectorAll("[data-page]");
    console.log('[Reader] setupScrollObserver: found', pageElements.length, 'pages');
    pageElements.forEach((el) => observer.observe(el));

    observerRef.current = observer;
  }, [setCurrentPage]);

  // Handle pagination event from FolioPages
  const handlePaginated = useCallback((detail: { totalPages: number; pages?: any[] }) => {
    console.log('[Reader] handlePaginated:', detail.totalPages, 'pages');
    setTotalPages(detail.totalPages);
    setCurrentPage(1);

    // Map TOC items to page numbers by querying DOM
    if (toc.length > 0 && folioRef.current?.element) {
      const folio = folioRef.current.element;
      const pages = folio.querySelectorAll('.folio-page');
      console.log('[Reader] TOC mapping: found', pages.length, 'folio pages,', toc.length, 'TOC items');

      const updatedToc = toc.map((item) => {
        let pageNum = 1;
        // Skip if no valid ID
        if (!item.id) return { ...item, page: pageNum };

        // Find which page contains this heading
        for (let i = 0; i < pages.length; i++) {
          const heading = pages[i].querySelector(`#${CSS.escape(item.id)}`);
          if (heading) {
            pageNum = i + 1;
            break;
          }
        }
        return { ...item, page: pageNum };
      });
      setToc(updatedToc);
    }

    // Setup scroll observer after pagination is complete
    setupScrollObserver();
  }, [toc, setTotalPages, setCurrentPage, setToc, setupScrollObserver]);

  const scrollToPage = useCallback((pageNum: number) => {
    if (!containerRef.current) return;
    const pageEl = containerRef.current.querySelector(`[data-page="${pageNum}"]`);
    console.log('[Reader] scrollToPage:', pageNum, 'found:', !!pageEl);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Handle navigation (paginated mode)
  useEffect(() => {
    if (viewMode === 'paginated' && scrollTarget !== null) {
      scrollToPage(scrollTarget);
      clearScrollTarget();
    }
  }, [viewMode, scrollTarget, scrollToPage, clearScrollTarget]);

  // Scroll mode: set totalPages to 1 and update TOC
  useEffect(() => {
    if (viewMode === 'scroll' && html) {
      setTotalPages(1);
      setCurrentPage(1);
      // Update TOC without page numbers
      if (toc.length > 0) {
        const updatedToc = toc.map((item) => ({ ...item, page: 1 }));
        setToc(updatedToc);
      }
    }
  }, [viewMode, html, toc.length, setTotalPages, setCurrentPage, setToc]);

  // Handle scroll-to-heading event (for scroll mode TOC clicks)
  useEffect(() => {
    const handleScrollToHeading = (e: CustomEvent<{ id: string }>) => {
      if (viewMode === 'scroll' && containerRef.current) {
        const heading = containerRef.current.querySelector(`#${CSS.escape(e.detail.id)}`);
        if (heading) {
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    window.addEventListener('scroll-to-heading', handleScrollToHeading as EventListener);
    return () => window.removeEventListener('scroll-to-heading', handleScrollToHeading as EventListener);
  }, [viewMode]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Handle PDF export request
  useEffect(() => {
    const handleExportRequest = async () => {
      const folio = folioRef.current?.element as any;
      if (!folio || typeof folio.toPrintHTML !== 'function') {
        console.error('Folio element not ready or toPrintHTML not available');
        return;
      }

      showLoading('Exporting PDF...');
      try {
        const title = currentTab?.title || 'document';
        const pdfName = title.replace(/\.[^.]+$/, '.pdf');

        let printHTML = folio.toPrintHTML({ title });

        // Add template class to each page for styling
        printHTML = printHTML.replace(
          /class="folio-print-page"/g,
          `class="folio-print-page template-${styleTemplate}"`
        );

        await api.exportPdf({ html: printHTML, fileName: pdfName });
      } finally {
        hideLoading();
      }
    };

    window.addEventListener('export-pdf-request', handleExportRequest);
    return () => window.removeEventListener('export-pdf-request', handleExportRequest);
  }, [currentTab?.title, styleTemplate, showLoading, hideLoading]);

  // Handle DOCX export request
  useEffect(() => {
    const handleDocxExport = async () => {
      const folio = folioRef.current?.element as any;
      if (!folio || typeof folio.toPrintHTML !== 'function') {
        console.error('Folio element not ready or toPrintHTML not available');
        return;
      }

      showLoading('Exporting DOCX...');
      try {
        const title = currentTab?.title || 'document';
        const docxName = title.replace(/\.[^.]+$/, '.docx');

        let printHTML = folio.toPrintHTML({ title });

        // Add template class to each page for styling
        printHTML = printHTML.replace(
          /class="folio-print-page"/g,
          `class="folio-print-page template-${styleTemplate}"`
        );

        const blob = await htmlToDocx(printHTML, title, styleTemplate);
        const arrayBuffer = await blob.arrayBuffer();
        await api.exportDocx({ data: arrayBuffer, fileName: docxName });
      } catch (err) {
        console.error('DOCX export failed:', err);
      } finally {
        hideLoading();
      }
    };

    window.addEventListener('export-docx-request', handleDocxExport);
    return () => window.removeEventListener('export-docx-request', handleDocxExport);
  }, [currentTab?.title, styleTemplate, showLoading, hideLoading]);

  // Handle HTML export request
  useEffect(() => {
    const handleHtmlExport = async () => {
      if (!html) {
        console.error('No HTML content to export');
        return;
      }

      showLoading('Exporting HTML...');
      try {
        const title = currentTab?.title || 'document';
        const htmlName = title.replace(/\.[^.]+$/, '.html');

        // Extract data URL images as assets
        const assets: { name: string; data: string }[] = [];
        const dataUrlRegex = /src="(data:image\/([^;]+);base64,[^"]+)"/g;
        let match;
        let assetIndex = 0;

        while ((match = dataUrlRegex.exec(html)) !== null) {
          const dataUrl = match[1];
          const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
          const assetName = `image_${assetIndex++}.${ext}`;
          assets.push({ name: assetName, data: dataUrl });
        }

        // Generate standalone HTML with folio
        const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script type="module" src="https://unpkg.com/@rizkyandriawan/foliojs@0.2.2/dist/index.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      background: #f5f0e5;
      font-family: Georgia, 'Times New Roman', serif;
    }
    folio-pages {
      display: block;
      margin: 0 auto;
    }
    .folio-page {
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    img { max-width: 100%; height: auto; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    p { margin: 0.8em 0; line-height: 1.6; }
    blockquote { margin: 1em 2em; font-style: italic; color: #555; }
    pre { background: #f4f4f4; padding: 1em; overflow-x: auto; }
    code { font-family: 'Consolas', monospace; }
  </style>
</head>
<body>
  <folio-pages page-width="794" page-height="1123" padding="80" algorithm="v2">
${html}
  </folio-pages>
</body>
</html>`;

        await api.exportHtml({ html: standaloneHtml, fileName: htmlName, assets });
      } catch (err) {
        console.error('HTML export failed:', err);
      } finally {
        hideLoading();
      }
    };

    window.addEventListener('export-html-request', handleHtmlExport);
    return () => window.removeEventListener('export-html-request', handleHtmlExport);
  }, [html, currentTab?.title, showLoading, hideLoading]);

  // Handle internal link clicks
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (anchor) {
      const href = anchor.getAttribute('href');

      if (href?.startsWith('#')) {
        e.preventDefault();
        const targetId = href.slice(1);

        if (viewMode === 'scroll') {
          // Scroll mode: just scroll to the heading
          const heading = containerRef.current?.querySelector(`#${CSS.escape(targetId)}`);
          if (heading) {
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else {
          // Paginated mode: find page with this heading
          const folio = folioRef.current?.element;
          if (folio) {
            const pages = folio.querySelectorAll('[data-page]');
            for (let i = 0; i < pages.length; i++) {
              const heading = pages[i].querySelector(`#${CSS.escape(targetId)}`);
              if (heading) {
                scrollToPage(i + 1);
                return;
              }
            }
          }
        }
      }
    }
  }, [viewMode, scrollToPage]);

  // Search highlighting
  useEffect(() => {
    const folio = folioRef.current?.element;
    if (!folio) return;

    // Clear previous highlights
    folio.querySelectorAll('mark.search-highlight').forEach((mark: Element) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });

    if (!searchQuery || searchQuery.length < 2) {
      setSearchMatchCount(0);
      return;
    }

    // Find and highlight matches
    const walker = document.createTreeWalker(folio, NodeFilter.SHOW_TEXT, null);
    const matches: { node: Text; index: number }[] = [];
    const query = searchQuery.toLowerCase();

    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      const text = node.textContent?.toLowerCase() || '';
      let idx = text.indexOf(query);
      while (idx !== -1) {
        matches.push({ node, index: idx });
        idx = text.indexOf(query, idx + 1);
      }
    }

    setSearchMatchCount(matches.length);

    // Apply highlights
    const highlightedNodes: Element[] = [];
    matches.forEach(({ node, index }, i) => {
      const text = node.textContent || '';
      const before = text.slice(0, index);
      const match = text.slice(index, index + searchQuery.length);
      const after = text.slice(index + searchQuery.length);

      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = match;
      mark.style.backgroundColor = i === searchMatchIndex ? '#fbbf24' : '#fef08a';
      mark.style.color = '#1f2937';
      mark.style.padding = '0 2px';
      mark.style.borderRadius = '2px';
      if (i === searchMatchIndex) {
        mark.dataset.current = 'true';
      }

      const parent = node.parentNode;
      if (parent) {
        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        frag.appendChild(mark);
        if (after) frag.appendChild(document.createTextNode(after));
        parent.replaceChild(frag, node);
        highlightedNodes.push(mark);
      }
    });

    // Scroll to current match
    const currentMark = folio.querySelector('mark[data-current="true"]');
    if (currentMark) {
      currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchQuery, searchMatchIndex, html, setSearchMatchCount]);

  if (!markdown) {
    return null;
  }

  // Scroll view mode
  if (viewMode === 'scroll') {
    return (
      <Box h="100%" overflow="auto" bg="#f5f0e5" py={8}>
        <Box
          ref={containerRef}
          maxW={`${PAGE_WIDTH}px`}
          mx="auto"
          bg="white"
          p={`${PAGE_PADDING}px`}
          boxShadow="0 2px 8px rgba(0,0,0,0.1)"
          className={`md-content template-${styleTemplate}`}
          onClick={handleContentClick}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 0.2s ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Box>
    );
  }

  // Paginated view mode
  return (
    <Box h="100%" overflow="auto" bg="#f5f0e5" py={8}>
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
        {html && (
          <FolioPages
            ref={folioRef}
            html={html}
            className={`md-content template-${styleTemplate}`}
            pageHeight={PAGE_HEIGHT}
            pageWidth={PAGE_WIDTH}
            padding={PAGE_PADDING}
            onPaginated={handlePaginated}
          />
        )}
      </VStack>
    </Box>
  );
}
