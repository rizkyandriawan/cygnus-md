import JSZip from 'jszip';

interface EpubChapter {
  title: string;
  href: string;
  content: string;
}

interface EpubMetadata {
  title: string;
  author: string;
  language: string;
}

interface ParsedEpub {
  metadata: EpubMetadata;
  chapters: EpubChapter[];
  html: string;
}

/**
 * Parse EPUB file and extract HTML content
 */
export async function parseEpub(data: ArrayBuffer): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(data);

  // 1. Find the OPF file location from container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    throw new Error('Invalid EPUB: missing container.xml');
  }

  const opfPath = extractOpfPath(containerXml);
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  // 2. Parse the OPF file
  const opfContent = await zip.file(opfPath)?.async('text');
  if (!opfContent) {
    throw new Error('Invalid EPUB: missing OPF file');
  }

  const { metadata, manifest, spine } = parseOpf(opfContent);

  // 3. Extract all images to data URLs (max 30 for performance)
  const imageMap = await extractImages(zip, manifest, opfDir, 30);

  // 4. Extract chapters in spine order
  const chapters: EpubChapter[] = [];
  for (const itemRef of spine) {
    const item = manifest[itemRef];
    if (!item) continue;

    const filePath = opfDir + item.href;
    const chapterDir = item.href.substring(0, item.href.lastIndexOf('/') + 1);
    const content = await zip.file(filePath)?.async('text');
    if (content) {
      chapters.push({
        title: item.id,
        href: item.href,
        content: cleanHtml(content, imageMap, opfDir, chapterDir),
      });
    }
  }

  // 5. Combine chapters into single HTML
  const html = combineChapters(chapters, metadata);

  return { metadata, chapters, html };
}

/**
 * Extract images from EPUB to data URLs
 */
async function extractImages(
  zip: JSZip,
  manifest: Record<string, { id: string; href: string; mediaType: string }>,
  opfDir: string,
  maxImages: number
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  let count = 0;

  for (const item of Object.values(manifest)) {
    if (count >= maxImages) break;
    if (!item.mediaType.startsWith('image/')) continue;

    const fullPath = opfDir + item.href;
    const file = zip.file(fullPath);
    if (!file) continue;

    try {
      const base64 = await file.async('base64');
      const dataUrl = `data:${item.mediaType};base64,${base64}`;

      // Store with multiple path formats for lookup
      imageMap.set(item.href, dataUrl);
      imageMap.set(fullPath, dataUrl);

      // Also filename only
      const fileName = item.href.split('/').pop();
      if (fileName) imageMap.set(fileName, dataUrl);

      count++;
    } catch (e) {
      console.warn('[epub] Failed to extract image:', fullPath);
    }
  }

  return imageMap;
}

/**
 * Clean HTML - remove scripts/styles, resolve images, extract body content
 */
function cleanHtml(
  html: string,
  imageMap: Map<string, string>,
  opfDir: string,
  chapterDir: string
): string {
  const parser = new DOMParser();
  let doc = parser.parseFromString(html, 'application/xhtml+xml');

  // Check for parse errors, fallback to HTML parser
  if (doc.querySelector('parsererror')) {
    doc = parser.parseFromString(html, 'text/html');
  }

  // Remove scripts, styles, and link tags
  doc.querySelectorAll('script, style, link').forEach((el) => el.remove());

  // Strip style and class attributes from all elements
  doc.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('style');
    el.removeAttribute('class');
    // Also remove epub-specific attributes
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('epub:') || attr.name.startsWith('data-')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // Replace image sources with data URLs
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;

    // Try to resolve the image path
    const dataUrl = resolveImage(src, imageMap, opfDir, chapterDir);
    if (dataUrl) {
      img.setAttribute('src', dataUrl);
    } else {
      // Remove images we can't resolve
      img.remove();
    }
  });

  // Clean up links - keep internal anchors, remove external/file links
  doc.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;

    if (href.startsWith('#')) {
      // Internal anchor - keep as is
    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      // External link - keep but mark as external
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    } else {
      // Internal EPUB link (e.g., chapter.xhtml#section)
      // Convert to just the anchor part if it has one
      const hashIndex = href.indexOf('#');
      if (hashIndex !== -1) {
        a.setAttribute('href', href.substring(hashIndex));
      } else {
        // Link to another file without anchor - remove href, keep text
        a.removeAttribute('href');
      }
    }
  });

  // Get body content
  const body = doc.querySelector('body');
  if (!body) return '';

  let content = body.innerHTML;
  content = content
    .replace(/\s*xmlns[^=]*="[^"]*"/g, '')
    .replace(/\s*epub:[^=]*="[^"]*"/g, '');

  return content;
}

/**
 * Resolve image src to data URL from imageMap
 */
function resolveImage(
  src: string,
  imageMap: Map<string, string>,
  opfDir: string,
  chapterDir: string
): string | null {
  // Clean up src
  let normalized = src.replace(/^\.\//, '');

  // Handle ../ paths
  if (normalized.startsWith('../')) {
    const baseParts = chapterDir.split('/').filter(Boolean);
    const srcParts = normalized.split('/');

    while (srcParts[0] === '..' && baseParts.length > 0) {
      srcParts.shift();
      baseParts.pop();
    }
    normalized = [...baseParts, ...srcParts].join('/');
  }

  // Try different path combinations
  const pathsToTry = [
    normalized,
    opfDir + normalized,
    chapterDir + src.replace(/^\.\.\//, '').replace(/^\.\//, ''),
    src.split('/').pop() || '', // Just filename
  ];

  for (const path of pathsToTry) {
    const dataUrl = imageMap.get(path);
    if (dataUrl) return dataUrl;
  }

  return null;
}

function extractOpfPath(containerXml: string): string {
  const match = containerXml.match(/full-path="([^"]+)"/);
  if (!match) {
    throw new Error('Invalid container.xml: cannot find OPF path');
  }
  return match[1];
}

function parseOpf(opfContent: string): {
  metadata: EpubMetadata;
  manifest: Record<string, { id: string; href: string; mediaType: string }>;
  spine: string[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opfContent, 'application/xml');

  // Extract metadata
  const metadata: EpubMetadata = {
    title: doc.querySelector('metadata title, dc\\:title')?.textContent || 'Untitled',
    author: doc.querySelector('metadata creator, dc\\:creator')?.textContent || 'Unknown',
    language: doc.querySelector('metadata language, dc\\:language')?.textContent || 'en',
  };

  // Build manifest map
  const manifest: Record<string, { id: string; href: string; mediaType: string }> = {};
  doc.querySelectorAll('manifest item').forEach((item) => {
    const id = item.getAttribute('id') || '';
    const href = item.getAttribute('href') || '';
    const mediaType = item.getAttribute('media-type') || '';
    if (id && href) {
      manifest[id] = { id, href, mediaType };
    }
  });

  // Get spine order (only HTML/XHTML items)
  const spine: string[] = [];
  doc.querySelectorAll('spine itemref').forEach((itemref) => {
    const idref = itemref.getAttribute('idref');
    if (idref && manifest[idref]?.mediaType?.includes('html')) {
      spine.push(idref);
    }
  });

  return { metadata, manifest, spine };
}


function combineChapters(chapters: EpubChapter[], metadata: EpubMetadata): string {
  let html = '';

  // Add title as H1
  html += `<h1>${escapeHtml(metadata.title)}</h1>\n`;
  if (metadata.author && metadata.author !== 'Unknown') {
    html += `<p><em>by ${escapeHtml(metadata.author)}</em></p>\n`;
  }
  html += '<hr/>\n';

  // Add each chapter
  for (const chapter of chapters) {
    html += chapter.content + '\n';
  }

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Check if file is an EPUB based on extension
 */
export function isEpub(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.epub');
}
