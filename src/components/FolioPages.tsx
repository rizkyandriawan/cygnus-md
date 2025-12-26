import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import "@rizkyandriawan/foliojs";

interface FolioPagesProps {
  html: string;
  className?: string;
  pageHeight?: number;
  pageWidth?: number;
  padding?: number;
  onPaginated?: (detail: { totalPages: number; pages: any[] }) => void;
}

export interface FolioPagesRef {
  element: HTMLElement | null;
}

export const FolioPages = forwardRef<FolioPagesRef, FolioPagesProps>(
  ({ html, className, pageHeight, pageWidth, padding, onPaginated }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const folioRef = useRef<HTMLElement | null>(null);

    useImperativeHandle(ref, () => ({
      get element() {
        return folioRef.current;
      },
    }));

    useEffect(() => {
      if (!html || !containerRef.current) return;

      // Clear previous
      containerRef.current.innerHTML = "";

      // Create folio-pages element with content already inside
      const folio = document.createElement("folio-pages");
      folio.className = className || "";
      if (pageHeight) folio.setAttribute("page-height", String(pageHeight));
      if (pageWidth) folio.setAttribute("page-width", String(pageWidth));
      if (padding) folio.setAttribute("padding", String(padding));

      // Set content BEFORE appending to DOM
      folio.innerHTML = html;

      // Listen for paginated event
      const handlePaginated = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        onPaginated?.(detail);
      };
      folio.addEventListener("paginated", handlePaginated);

      // Now append - connectedCallback will fire with content already there
      containerRef.current.appendChild(folio);
      folioRef.current = folio;

      return () => {
        folio.removeEventListener("paginated", handlePaginated);
        folioRef.current = null;
      };
    }, [html, className, pageHeight, pageWidth, padding, onPaginated]);

    return <div ref={containerRef} />;
  }
);

FolioPages.displayName = "FolioPages";
