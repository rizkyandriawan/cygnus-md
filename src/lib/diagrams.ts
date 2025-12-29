import mermaid from 'mermaid';
import pako from 'pako';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

let diagramCounter = 0;

/**
 * Process mermaid and plantuml code blocks in HTML
 */
export async function processDiagrams(html: string): Promise<string> {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Process mermaid diagrams
  const mermaidBlocks = tempDiv.querySelectorAll('pre > code.language-mermaid, code.language-mermaid');
  for (const block of mermaidBlocks) {
    const code = block.textContent || '';
    const pre = block.closest('pre') || block.parentElement;
    if (!pre || !code.trim()) continue;

    try {
      const id = `mermaid-${diagramCounter++}`;
      const { svg } = await mermaid.render(id, code.trim());

      const container = document.createElement('div');
      container.className = 'diagram-container mermaid-diagram';
      container.innerHTML = svg;

      pre.replaceWith(container);
    } catch (e) {
      console.warn('[diagrams] Mermaid render error:', e);
    }
  }

  // Process PlantUML diagrams in code blocks
  const plantumlBlocks = tempDiv.querySelectorAll('pre > code.language-plantuml, code.language-plantuml');
  for (const block of plantumlBlocks) {
    const code = block.textContent || '';
    const pre = block.closest('pre') || block.parentElement;
    if (!pre || !code.trim()) continue;

    try {
      const encoded = encodePlantUML(code.trim());

      const container = document.createElement('div');
      container.className = 'diagram-container plantuml-diagram';

      // Fetch SVG inline for proper sizing
      const svgContent = await fetchPlantUMLSvg(encoded);
      if (svgContent) {
        container.innerHTML = svgContent;
      } else {
        // Fallback to img tag
        const img = document.createElement('img');
        img.src = `https://www.plantuml.com/plantuml/svg/${encoded}`;
        img.alt = 'PlantUML Diagram';
        img.style.maxWidth = '100%';
        container.appendChild(img);
      }

      pre.replaceWith(container);
    } catch (e) {
      console.warn('[diagrams] PlantUML encode error:', e);
    }
  }

  // Process raw @startuml/@enduml blocks (not in code fences)
  let htmlStr = tempDiv.innerHTML;
  const rawPlantUMLRegex = /@start(uml|mindmap|wbs|gantt|salt|ditaa|json|yaml)([\s\S]*?)@end\1/gi;
  const rawMatches = [...htmlStr.matchAll(rawPlantUMLRegex)];

  for (const match of rawMatches) {
    const fullMatch = match[0];
    const diagramType = match[1];

    try {
      // Decode HTML entities and convert <br> to newlines
      const plainText = decodeHtmlToPlainText(fullMatch);
      const encoded = encodePlantUML(plainText);

      // Fetch SVG inline for proper sizing during pagination
      const svgContent = await fetchPlantUMLSvg(encoded);
      if (svgContent) {
        const replacement = `<div class="diagram-container plantuml-diagram">${svgContent}</div>`;
        htmlStr = htmlStr.replace(fullMatch, replacement);
      } else {
        // Fallback to img tag
        const imgUrl = `https://www.plantuml.com/plantuml/svg/${encoded}`;
        const replacement = `<div class="diagram-container plantuml-diagram"><img src="${imgUrl}" alt="PlantUML ${diagramType} Diagram" style="max-width: 100%;" /></div>`;
        htmlStr = htmlStr.replace(fullMatch, replacement);
      }
    } catch (e) {
      console.warn('[diagrams] Raw PlantUML encode error:', e);
    }
  }

  return htmlStr;
}

/**
 * Fetch PlantUML SVG content inline
 */
async function fetchPlantUMLSvg(encoded: string): Promise<string | null> {
  try {
    const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
    console.log('[diagrams] Fetching PlantUML:', url);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[diagrams] PlantUML fetch failed:', response.status);
      return null;
    }
    const svg = await response.text();
    console.log('[diagrams] PlantUML SVG fetched, length:', svg.length);
    // Add max-width style to SVG
    return svg.replace('<svg', '<svg style="max-width: 100%; height: auto;"');
  } catch (e) {
    console.error('[diagrams] PlantUML fetch error:', e);
    return null;
  }
}

/**
 * Decode HTML to plain text for PlantUML
 */
function decodeHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\\([+*])/g, '$1'); // unescape \+ \*
}

/**
 * Encode PlantUML diagram to URL-safe format
 * Uses deflate compression + PlantUML's custom base64
 */
function encodePlantUML(text: string): string {
  // Add @startuml/@enduml if not present
  let uml = text.trim();
  if (!uml.startsWith('@start')) {
    uml = `@startuml\n${uml}\n@enduml`;
  }

  // Deflate compress
  const data = new TextEncoder().encode(uml);
  const compressed = pako.deflate(data, { level: 9, raw: true });

  // Encode with PlantUML's base64 variant
  return encode64(compressed);
}

/**
 * Encode bytes to PlantUML's base64 variant
 */
function encode64(data: Uint8Array): string {
  let result = '';
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i];
    const b2 = i + 1 < data.length ? data[i + 1] : 0;
    const b3 = i + 2 < data.length ? data[i + 2] : 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 0x3) << 4) | (b2 >> 4)];
    result += chars[((b2 & 0xF) << 2) | (b3 >> 6)];
    result += chars[b3 & 0x3F];
  }

  return result;
}
