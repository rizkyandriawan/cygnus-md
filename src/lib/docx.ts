import JSZip from 'jszip';

interface DocxImage {
  id: string;
  data: Uint8Array;
  width: number;
  height: number;
  ext: string;
}

interface TemplateStyle {
  body: { font: string; size: number; color: string; lineHeight: number };
  h1: { size: number; color: string; bold: boolean; italic: boolean; center: boolean };
  h2: { size: number; color: string; bold: boolean; italic: boolean };
  h3: { size: number; color: string; bold: boolean; italic: boolean };
  h4: { size: number; color: string; bold: boolean };
  quote: { color: string; borderColor: string; italic: boolean };
  code: { font: string; bgColor: string; textColor: string };
  link: { color: string };
  tableBorder: string;
  tableHeaderBg: string;
}

// Template styles mapping (CSS → DOCX)
const templateStyles: Record<string, TemplateStyle> = {
  default: {
    body: { font: 'Segoe UI', size: 22, color: '333333', lineHeight: 276 },
    h1: { size: 48, color: '1A1A1A', bold: true, italic: false, center: false },
    h2: { size: 36, color: '2563EB', bold: true, italic: false },
    h3: { size: 28, color: '374151', bold: true, italic: false },
    h4: { size: 24, color: '4B5563', bold: true },
    quote: { color: '6B7280', borderColor: '3B82F6', italic: true },
    code: { font: 'Consolas', bgColor: '1F2937', textColor: 'F3F4F6' },
    link: { color: '2563EB' },
    tableBorder: 'D1D5DB',
    tableHeaderBg: 'F3F4F6',
  },
  academic: {
    body: { font: 'Times New Roman', size: 24, color: '1A1A1A', lineHeight: 288 },
    h1: { size: 44, color: '000000', bold: true, italic: false, center: true },
    h2: { size: 32, color: '1A1A1A', bold: true, italic: false },
    h3: { size: 26, color: '333333', bold: true, italic: true },
    h4: { size: 24, color: '333333', bold: true },
    quote: { color: '444444', borderColor: '666666', italic: true },
    code: { font: 'Courier New', bgColor: 'F8F8F8', textColor: '000000' },
    link: { color: '1E40AF' },
    tableBorder: '333333',
    tableHeaderBg: 'F0F0F0',
  },
  minimal: {
    body: { font: 'Arial', size: 22, color: '444444', lineHeight: 304 },
    h1: { size: 56, color: '111111', bold: false, italic: false, center: false },
    h2: { size: 36, color: '222222', bold: false, italic: false },
    h3: { size: 28, color: '333333', bold: false, italic: false },
    h4: { size: 22, color: '444444', bold: true },
    quote: { color: '666666', borderColor: 'CCCCCC', italic: false },
    code: { font: 'Consolas', bgColor: 'FAFAFA', textColor: '333333' },
    link: { color: '111111' },
    tableBorder: 'EEEEEE',
    tableHeaderBg: 'FAFAFA',
  },
  streamline: {
    body: { font: 'Calibri', size: 22, color: '374151', lineHeight: 276 },
    h1: { size: 44, color: '1E40AF', bold: true, italic: false, center: false },
    h2: { size: 32, color: '3B82F6', bold: true, italic: false },
    h3: { size: 26, color: '1E40AF', bold: true, italic: false },
    h4: { size: 22, color: '374151', bold: true },
    quote: { color: '6B7280', borderColor: '3B82F6', italic: true },
    code: { font: 'Consolas', bgColor: 'EFF6FF', textColor: '1E3A5F' },
    link: { color: '2563EB' },
    tableBorder: 'BFDBFE',
    tableHeaderBg: 'DBEAFE',
  },
  focus: {
    body: { font: 'Arial', size: 24, color: '111111', lineHeight: 288 },
    h1: { size: 52, color: '000000', bold: true, italic: false, center: false },
    h2: { size: 36, color: '000000', bold: true, italic: false },
    h3: { size: 28, color: '333333', bold: true, italic: false },
    h4: { size: 24, color: '333333', bold: true },
    quote: { color: '333333', borderColor: '000000', italic: false },
    code: { font: 'Consolas', bgColor: '000000', textColor: 'FFFFFF' },
    link: { color: '000000' },
    tableBorder: '000000',
    tableHeaderBg: 'F0F0F0',
  },
  swiss: {
    body: { font: 'Helvetica', size: 22, color: '333333', lineHeight: 276 },
    h1: { size: 48, color: 'DC2626', bold: true, italic: false, center: false },
    h2: { size: 32, color: '1F2937', bold: true, italic: false },
    h3: { size: 24, color: '374151', bold: true, italic: false },
    h4: { size: 22, color: '4B5563', bold: true },
    quote: { color: '6B7280', borderColor: 'DC2626', italic: false },
    code: { font: 'Consolas', bgColor: 'F3F4F6', textColor: '1F2937' },
    link: { color: 'DC2626' },
    tableBorder: 'D1D5DB',
    tableHeaderBg: 'F9FAFB',
  },
  paperback: {
    body: { font: 'Georgia', size: 24, color: '3D3229', lineHeight: 288 },
    h1: { size: 44, color: '5D4E37', bold: false, italic: false, center: true },
    h2: { size: 32, color: '5D4E37', bold: true, italic: false },
    h3: { size: 26, color: '6B5D4D', bold: false, italic: true },
    h4: { size: 24, color: '6B5D4D', bold: true },
    quote: { color: '7D6E5D', borderColor: 'C4A77D', italic: true },
    code: { font: 'Courier New', bgColor: 'F5F0E8', textColor: '5D4E37' },
    link: { color: '8B7355' },
    tableBorder: 'C4A77D',
    tableHeaderBg: 'F5F0E8',
  },
  coral: {
    body: { font: 'Segoe UI', size: 22, color: '4A4A4A', lineHeight: 276 },
    h1: { size: 48, color: 'E85A71', bold: true, italic: false, center: false },
    h2: { size: 34, color: 'D94F63', bold: true, italic: false },
    h3: { size: 26, color: '4A4A4A', bold: true, italic: false },
    h4: { size: 22, color: '666666', bold: true },
    quote: { color: '666666', borderColor: 'F4A5B2', italic: true },
    code: { font: 'Consolas', bgColor: 'FFF5F7', textColor: 'D94F63' },
    link: { color: 'E85A71' },
    tableBorder: 'F4A5B2',
    tableHeaderBg: 'FFF0F3',
  },
  slate: {
    body: { font: 'Segoe UI', size: 22, color: '334155', lineHeight: 276 },
    h1: { size: 46, color: '1E293B', bold: true, italic: false, center: false },
    h2: { size: 32, color: '475569', bold: true, italic: false },
    h3: { size: 26, color: '64748B', bold: true, italic: false },
    h4: { size: 22, color: '64748B', bold: true },
    quote: { color: '64748B', borderColor: '94A3B8', italic: true },
    code: { font: 'Consolas', bgColor: '1E293B', textColor: 'E2E8F0' },
    link: { color: '3B82F6' },
    tableBorder: 'CBD5E1',
    tableHeaderBg: 'F1F5F9',
  },
  luxe: {
    body: { font: 'Georgia', size: 24, color: '1A1A1A', lineHeight: 288 },
    h1: { size: 64, color: '1A1A1A', bold: false, italic: false, center: true },
    h2: { size: 36, color: '8B7355', bold: false, italic: false },
    h3: { size: 28, color: '4A4A4A', bold: true, italic: true },
    h4: { size: 24, color: '666666', bold: true },
    quote: { color: '555555', borderColor: 'D4AF37', italic: true },
    code: { font: 'Courier New', bgColor: '2C2C2C', textColor: 'F5F5F5' },
    link: { color: '8B7355' },
    tableBorder: 'D4AF37',
    tableHeaderBg: 'F8F6F3',
  },
  geometric: {
    body: { font: 'Arial', size: 22, color: '2D3748', lineHeight: 276 },
    h1: { size: 48, color: '6B46C1', bold: true, italic: false, center: false },
    h2: { size: 32, color: 'D53F8C', bold: true, italic: false },
    h3: { size: 26, color: '2D3748', bold: true, italic: false },
    h4: { size: 22, color: '4A5568', bold: true },
    quote: { color: '718096', borderColor: '6B46C1', italic: false },
    code: { font: 'Consolas', bgColor: '2D3748', textColor: 'E2E8F0' },
    link: { color: 'D53F8C' },
    tableBorder: 'E2E8F0',
    tableHeaderBg: 'F7FAFC',
  },
};

let currentTemplate: TemplateStyle = templateStyles.default;

// Convert HTML to DOCX
export async function htmlToDocx(html: string, title: string = 'Document', template: string = 'default'): Promise<Blob> {
  currentTemplate = templateStyles[template] || templateStyles.default;

  const zip = new JSZip();
  const images: DocxImage[] = [];

  // Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Extract and process images first
  const imgElements = doc.querySelectorAll('img');
  for (let i = 0; i < imgElements.length; i++) {
    const img = imgElements[i];
    const src = img.getAttribute('src') || '';
    const imageData = await fetchImage(src);
    if (imageData) {
      const id = `image${i + 1}`;
      images.push({ id, ...imageData });
      img.setAttribute('data-docx-id', id);
    }
  }

  // Generate document content
  const body = doc.body;
  const content = processNodes(body.childNodes, images);

  // Build DOCX structure
  zip.file('[Content_Types].xml', generateContentTypes(images));
  zip.file('_rels/.rels', generateRels());
  zip.file('word/_rels/document.xml.rels', generateDocumentRels(images));
  zip.file('word/document.xml', generateDocument(content, title));
  zip.file('word/styles.xml', generateStyles());

  // Add images
  for (const img of images) {
    zip.file(`word/media/${img.id}.${img.ext}`, img.data);
  }

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

async function fetchImage(src: string): Promise<{ data: Uint8Array; width: number; height: number; ext: string } | null> {
  try {
    let blob: Blob;

    if (src.startsWith('data:')) {
      const res = await fetch(src);
      blob = await res.blob();
    } else if (src.startsWith('local-file://') || src.startsWith('file://')) {
      const path = decodeURIComponent(src.replace('local-file://', '').replace('file://', ''));
      const response = await fetch(`file://${path}`);
      if (!response.ok) return null;
      blob = await response.blob();
    } else if (src.startsWith('http')) {
      const res = await fetch(src);
      blob = await res.blob();
    } else {
      return null;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const ext = getImageExt(blob.type) || 'png';
    const dimensions = await getImageDimensions(blob);

    return { data, ext, ...dimensions };
  } catch (e) {
    console.warn('Failed to fetch image:', src, e);
    return null;
  }
}

function getImageExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'png';
}

async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const maxWidth = 550;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      resolve({
        width: Math.round(img.width * scale),
        height: Math.round(img.height * scale),
      });
    };
    img.onerror = () => resolve({ width: 400, height: 300 });
    img.src = URL.createObjectURL(blob);
  });
}

function processNodes(nodes: NodeListOf<ChildNode>, images: DocxImage[]): string {
  let xml = '';
  nodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        xml += `<w:p><w:r><w:rPr><w:color w:val="${currentTemplate.body.color}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      xml += processElement(node as HTMLElement, images);
    }
  });
  return xml;
}

function processElement(el: HTMLElement, images: DocxImage[]): string {
  const tag = el.tagName.toLowerCase();

  if (tag === 'div' && (el.className.includes('folio-') || el.className.includes('template-'))) {
    return processNodes(el.childNodes, images);
  }

  const t = currentTemplate;

  switch (tag) {
    case 'h1':
      return `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:pageBreakBefore/>${t.h1.center ? '<w:jc w:val="center"/>' : ''}</w:pPr>${processInline(el, { bold: t.h1.bold, italic: t.h1.italic, color: t.h1.color, size: t.h1.size })}</w:p>`;
    case 'h2':
      return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${processInline(el, { bold: t.h2.bold, italic: t.h2.italic, color: t.h2.color, size: t.h2.size })}</w:p>`;
    case 'h3':
      return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>${processInline(el, { bold: t.h3.bold, italic: t.h3.italic, color: t.h3.color, size: t.h3.size })}</w:p>`;
    case 'h4':
    case 'h5':
    case 'h6':
      return `<w:p><w:pPr><w:pStyle w:val="Heading4"/></w:pPr>${processInline(el, { bold: t.h4.bold, color: t.h4.color, size: t.h4.size })}</w:p>`;
    case 'p':
      return `<w:p>${processInline(el, { color: t.body.color })}</w:p>`;
    case 'blockquote':
      return `<w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr>${processInline(el, { italic: t.quote.italic, color: t.quote.color })}</w:p>`;
    case 'pre':
      return processCodeBlock(el);
    case 'ul':
      return processUnorderedList(el, images);
    case 'ol':
      return processOrderedList(el, images);
    case 'table':
      return processTable(el, images);
    case 'hr':
      return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${t.tableBorder}"/></w:pBdr></w:pPr></w:p>`;
    case 'img':
      return processImage(el, images);
    case 'br':
      return '<w:p></w:p>';
    case 'div':
    case 'section':
    case 'article':
      return processNodes(el.childNodes, images);
    default:
      if (el.textContent?.trim()) {
        return `<w:p>${processInline(el, { color: t.body.color })}</w:p>`;
      }
      return '';
  }
}

interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  size?: number;
}

function processInline(el: HTMLElement, style: InlineStyle = {}): string {
  let xml = '';
  const t = currentTemplate;

  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        let rPr = '<w:rPr>';
        if (style.bold) rPr += '<w:b/>';
        if (style.italic) rPr += '<w:i/>';
        if (style.color) rPr += `<w:color w:val="${style.color}"/>`;
        if (style.size) rPr += `<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>`;
        rPr += '</w:rPr>';
        xml += `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement;
      const tag = child.tagName.toLowerCase();

      switch (tag) {
        case 'strong':
        case 'b':
          xml += `<w:r><w:rPr><w:b/>${style.color ? `<w:color w:val="${style.color}"/>` : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(child.textContent || '')}</w:t></w:r>`;
          break;
        case 'em':
        case 'i':
          xml += `<w:r><w:rPr><w:i/>${style.color ? `<w:color w:val="${style.color}"/>` : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(child.textContent || '')}</w:t></w:r>`;
          break;
        case 'u':
          xml += `<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escapeXml(child.textContent || '')}</w:t></w:r>`;
          break;
        case 'code':
          xml += `<w:r><w:rPr><w:rFonts w:ascii="${t.code.font}" w:hAnsi="${t.code.font}"/><w:shd w:val="clear" w:fill="${t.code.bgColor}"/><w:color w:val="${t.code.textColor}"/></w:rPr><w:t xml:space="preserve">${escapeXml(child.textContent || '')}</w:t></w:r>`;
          break;
        case 'a':
          xml += `<w:r><w:rPr><w:color w:val="${t.link.color}"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escapeXml(child.textContent || '')}</w:t></w:r>`;
          break;
        case 'br':
          xml += `<w:r><w:br/></w:r>`;
          break;
        case 'span':
          if (child.classList.contains('katex')) {
            xml += `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${escapeXml(child.textContent || '')}</w:t></w:r>`;
          } else {
            xml += processInline(child, style);
          }
          break;
        default:
          xml += processInline(child, style);
      }
    }
  });

  return xml;
}

function processCodeBlock(el: HTMLElement): string {
  const t = currentTemplate;
  const code = el.querySelector('code') || el;
  const lines = (code.textContent || '').split('\n');

  let xml = '';
  for (const line of lines) {
    xml += `<w:p><w:pPr><w:pStyle w:val="Code"/><w:shd w:val="clear" w:fill="${t.code.bgColor}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${t.code.font}" w:hAnsi="${t.code.font}"/><w:color w:val="${t.code.textColor}"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
  }
  return xml;
}

function processUnorderedList(el: HTMLElement, images: DocxImage[]): string {
  let xml = '';
  const items = el.querySelectorAll(':scope > li');
  items.forEach(li => {
    xml += `<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>${processInline(li as HTMLElement, { color: currentTemplate.body.color })}</w:p>`;
    const nested = li.querySelectorAll(':scope > ul, :scope > ol');
    nested.forEach(n => { xml += processElement(n as HTMLElement, images); });
  });
  return xml;
}

function processOrderedList(el: HTMLElement, _images: DocxImage[]): string {
  let xml = '';
  const items = el.querySelectorAll(':scope > li');
  items.forEach((li, idx) => {
    xml += `<w:p><w:pPr><w:pStyle w:val="ListNumber"/></w:pPr><w:r><w:t>${idx + 1}. </w:t></w:r>${processInline(li as HTMLElement, { color: currentTemplate.body.color })}</w:p>`;
  });
  return xml;
}

function processTable(el: HTMLElement, _images: DocxImage[]): string {
  const t = currentTemplate;
  const rows = el.querySelectorAll('tr');
  if (rows.length === 0) return '';

  let xml = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/><w:left w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/><w:right w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/></w:tblBorders></w:tblPr>`;

  rows.forEach(row => {
    xml += '<w:tr>';
    const cells = row.querySelectorAll('th, td');
    cells.forEach(cell => {
      const isHeader = cell.tagName.toLowerCase() === 'th';
      xml += '<w:tc><w:tcPr>';
      if (isHeader) xml += `<w:shd w:val="clear" w:fill="${t.tableHeaderBg}"/>`;
      xml += '</w:tcPr>';
      xml += `<w:p>${isHeader ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : ''}`;
      xml += isHeader
        ? `<w:r><w:rPr><w:b/><w:color w:val="${t.body.color}"/></w:rPr><w:t>${escapeXml(cell.textContent || '')}</w:t></w:r>`
        : processInline(cell as HTMLElement, { color: t.body.color });
      xml += '</w:p></w:tc>';
    });
    xml += '</w:tr>';
  });

  xml += '</w:tbl>';
  return xml;
}

function processImage(el: HTMLElement, images: DocxImage[]): string {
  const imgId = el.getAttribute('data-docx-id');
  const image = images.find(i => i.id === imgId);
  if (!image) return '';

  const emuPerPx = 9525;
  const cx = image.width * emuPerPx;
  const cy = image.height * emuPerPx;
  const rId = `rId${images.indexOf(image) + 10}`;

  return `<w:p><w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:docPr id="${images.indexOf(image) + 1}" name="${image.id}"/>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr><pic:cNvPr id="${images.indexOf(image) + 1}" name="${image.id}"/><pic:cNvPicPr/></pic:nvPicPr>
              <pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
              <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r></w:p>`;
}

function escapeXml(str: string): string {
  // Remove invalid XML characters (control chars except tab, newline, carriage return)
  // Valid: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
  const cleanStr = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleanStr
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateContentTypes(images: DocxImage[]): string {
  let imageTypes = '';
  const exts = new Set(images.map(i => i.ext));
  exts.forEach(ext => {
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    imageTypes += `<Default Extension="${ext}" ContentType="${mime}"/>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageTypes}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function generateRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function generateDocumentRels(images: DocxImage[]): string {
  let imageRels = '';
  images.forEach((img, idx) => {
    imageRels += `<Relationship Id="rId${idx + 10}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.id}.${img.ext}"/>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${imageRels}
</Relationships>`;
}

function generateDocument(content: string, _title: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${content}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function generateStyles(): string {
  const t = currentTemplate;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="${t.body.font}" w:hAnsi="${t.body.font}"/><w:sz w:val="${t.body.size}"/><w:szCs w:val="${t.body.size}"/><w:color w:val="${t.body.color}"/></w:rPr>
    <w:pPr><w:spacing w:after="200" w:line="${t.body.lineHeight}" w:lineRule="auto"/></w:pPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="480" w:after="240"/>${t.h1.center ? '<w:jc w:val="center"/>' : ''}</w:pPr>
    <w:rPr>${t.h1.bold ? '<w:b/>' : ''}${t.h1.italic ? '<w:i/>' : ''}<w:sz w:val="${t.h1.size}"/><w:szCs w:val="${t.h1.size}"/><w:color w:val="${t.h1.color}"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="360" w:after="200"/></w:pPr>
    <w:rPr>${t.h2.bold ? '<w:b/>' : ''}${t.h2.italic ? '<w:i/>' : ''}<w:sz w:val="${t.h2.size}"/><w:szCs w:val="${t.h2.size}"/><w:color w:val="${t.h2.color}"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="280" w:after="160"/></w:pPr>
    <w:rPr>${t.h3.bold ? '<w:b/>' : ''}${t.h3.italic ? '<w:i/>' : ''}<w:sz w:val="${t.h3.size}"/><w:szCs w:val="${t.h3.size}"/><w:color w:val="${t.h3.color}"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="Heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr>${t.h4.bold ? '<w:b/>' : ''}<w:sz w:val="${t.h4.size}"/><w:szCs w:val="${t.h4.size}"/><w:color w:val="${t.h4.color}"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="12" w:color="${t.quote.borderColor}"/></w:pBdr><w:ind w:left="720"/></w:pPr>
    <w:rPr>${t.quote.italic ? '<w:i/>' : ''}<w:color w:val="${t.quote.color}"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Code">
    <w:name w:val="Code"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:shd w:val="clear" w:fill="${t.code.bgColor}"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="${t.code.font}" w:hAnsi="${t.code.font}"/><w:sz w:val="20"/><w:color w:val="${t.code.textColor}"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="720"/></w:pPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="ListNumber">
    <w:name w:val="List Number"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="720"/></w:pPr>
  </w:style>

  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr><w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${t.tableBorder}"/>
    </w:tblBorders></w:tblPr>
  </w:style>
</w:styles>`;
}
