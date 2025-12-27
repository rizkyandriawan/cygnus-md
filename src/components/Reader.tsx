import { useEffect, useRef, useCallback, useState } from "react";
import { Box, VStack } from "@chakra-ui/react";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";
import { useAppStore, TocItem } from "../store/useAppStore";
import { api } from "../lib/api";
import { FolioPages, FolioPagesRef } from "./FolioPages";
import { htmlToDocx } from "../lib/docx";

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
  const [html, setHtml] = useState<string>('');
  const [toc, setTocState] = useState<TocItem[]>([]);

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

  // Parse markdown and prepare HTML
  useEffect(() => {
    if (!markdown) {
      setHtml('');
      return;
    }

    (async () => {
      let parsedHtml = await marked(markdown);

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
        const text = heading.textContent || "";
        let id = slugify(text);

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
  }, [markdown, filePath]);

  // Update store with TOC
  useEffect(() => {
    setToc(toc);
  }, [toc, setToc]);

  // Handle pagination event from FolioPages
  const handlePaginated = useCallback((detail: { totalPages: number; pages: any[] }) => {
    setTotalPages(detail.totalPages);
    setCurrentPage(1);

    // Map TOC items to page numbers
    if (toc.length > 0 && detail.pages) {
      const updatedToc = toc.map((item) => {
        let pageNum = 1;
        for (let i = 0; i < detail.pages.length; i++) {
          const page = detail.pages[i];
          for (const frag of page.fragments) {
            if (frag.block.element.id === item.id) {
              pageNum = i + 1;
              break;
            }
          }
        }
        return { ...item, page: pageNum };
      });
      setToc(updatedToc);
    }
  }, [toc, setTotalPages, setCurrentPage, setToc]);

  const scrollToPage = useCallback((pageNum: number) => {
    if (!containerRef.current) return;
    const pageEl = containerRef.current.querySelector(`[data-page="${pageNum}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

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
  }, [html, setCurrentPage]);

  // Handle PDF export request
  useEffect(() => {
    const handleExportRequest = async () => {
      const folio = folioRef.current?.element as any;
      if (!folio || typeof folio.toPrintHTML !== 'function') {
        console.error('Folio element not ready or toPrintHTML not available');
        return;
      }

      const title = currentTab?.title || 'document';
      const pdfName = title.replace(/\.[^.]+$/, '.pdf');

      let printHTML = folio.toPrintHTML({ title });

      // Add template class to each page for styling
      printHTML = printHTML.replace(
        /class="folio-print-page"/g,
        `class="folio-print-page template-${styleTemplate}"`
      );

      await api.exportPdf({ html: printHTML, fileName: pdfName });
    };

    window.addEventListener('export-pdf-request', handleExportRequest);
    return () => window.removeEventListener('export-pdf-request', handleExportRequest);
  }, [currentTab?.title, styleTemplate]);

  // Handle DOCX export request
  useEffect(() => {
    const handleDocxExport = async () => {
      const folio = folioRef.current?.element as any;
      if (!folio || typeof folio.toPrintHTML !== 'function') {
        console.error('Folio element not ready or toPrintHTML not available');
        return;
      }

      const title = currentTab?.title || 'document';
      const docxName = title.replace(/\.[^.]+$/, '.docx');

      let printHTML = folio.toPrintHTML({ title });

      // Add template class to each page for styling
      printHTML = printHTML.replace(
        /class="folio-print-page"/g,
        `class="folio-print-page template-${styleTemplate}"`
      );

      try {
        const blob = await htmlToDocx(printHTML, title, styleTemplate);
        const arrayBuffer = await blob.arrayBuffer();
        await api.exportDocx({ data: arrayBuffer, fileName: docxName });
      } catch (err) {
        console.error('DOCX export failed:', err);
      }
    };

    window.addEventListener('export-docx-request', handleDocxExport);
    return () => window.removeEventListener('export-docx-request', handleDocxExport);
  }, [currentTab?.title, styleTemplate]);

  // Handle internal link clicks
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (anchor) {
      const href = anchor.getAttribute('href');

      if (href?.startsWith('#')) {
        e.preventDefault();
        const targetId = href.slice(1);

        // Find page with this heading
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
  }, [scrollToPage]);

  if (!markdown) {
    return null;
  }

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
