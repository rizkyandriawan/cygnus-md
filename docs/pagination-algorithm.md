# Pagination Algorithm for Cygnus MD

## Daftar Isi

1. [Masalah yang Mau Dipecahkan](#masalah-yang-mau-dipecahkan)
2. [Bagaimana Chromium Melakukannya](#bagaimana-chromium-melakukannya)
3. [Pendekatan Kita: Simplified Algorithm](#pendekatan-kita-simplified-algorithm)
4. [Langkah-Langkah Detail](#langkah-langkah-detail)
5. [Kasus-Kasus Khusus](#kasus-kasus-khusus)
6. [Limitasi dan Trade-offs](#limitasi-dan-trade-offs)
7. [Rencana Implementasi](#rencana-implementasi)

---

## Masalah yang Mau Dipecahkan

Cygnus MD adalah markdown reader yang menampilkan dokumen dalam format halaman (seperti buku atau PDF), bukan scroll panjang seperti web biasa. Ini berarti kita perlu memecah konten ke dalam halaman-halaman dengan ukuran tetap (misalnya A4: 210mm x 297mm).

### Kenapa Ini Sulit?

Bayangkan lo punya dokumen markdown seperti ini:

```markdown
# Judul Besar

Paragraf pertama yang cukup panjang, mungkin 5-6 baris kalau di-render.
Bla bla bla...

![Gambar Besar](image.png)

## Sub Judul

Paragraf lagi yang juga panjang...
```

Masalah yang muncul:

1. **Paragraf terpotong di tengah** - Gimana kalau paragraf gak muat di sisa halaman? Potong di mana?

2. **Heading sendirian di bawah halaman** - Jelek banget kalau "## Sub Judul" ada di baris terakhir halaman, terus paragrafnya di halaman berikutnya.

3. **Gambar gak muat** - Gambar 800px tingginya, halaman cuma 600px. Dipotong? Dikecilkan? Pindah halaman baru?

4. **Orphans dan Widows** - Istilah tipografi:
   - **Orphan**: 1-2 baris pertama paragraf sendirian di bawah halaman
   - **Widow**: 1-2 baris terakhir paragraf sendirian di atas halaman baru

   Keduanya terlihat jelek dan bikin susah baca.

5. **Tabel dan Code Block** - Ini "monolithic" content, gak bisa dipotong sembarangan.

---

## Bagaimana Chromium Melakukannya

Chromium punya engine layout bernama **LayoutNG** yang handle pagination untuk printing. Ini engine yang mature, dikembangkan bertahun-tahun oleh tim Google.

### Konsep Utama LayoutNG

#### 1. Fragment Tree

LayoutNG memecah dokumen jadi "fragments". Setiap elemen HTML bisa punya multiple fragments kalau dia terpotong across pages.

```
<p>Paragraf panjang...</p>

Menjadi:
├── ParagraphFragment (Page 1, lines 1-5)
└── ParagraphFragment (Page 2, lines 6-8)
```

#### 2. Constraint Space

Setiap layout operation dikasih "constraint space" - berapa ruang yang tersedia. Kalau konten melebihi constraint, dia akan "break" dan lanjut di fragmentainer (halaman) berikutnya.

#### 3. Break Token

Saat konten terpotong, LayoutNG bikin "break token" yang nyimpan state:
- Di mana break terjadi
- Berapa konten yang sudah di-layout
- State apa yang perlu dibawa ke halaman berikutnya

#### 4. Two-Pass Layout

LayoutNG kadang perlu 2 pass:

**Pass 1**: Layout normal, track semua potential breakpoints dan kasih score.

**Pass 2**: Kalau break di tempat jelek (misal orphan), backtrack dan layout ulang dengan breakpoint yang lebih baik.

#### 5. Breakpoint Scoring

Setiap potential breakpoint dikasih score:

| Score | Meaning |
|-------|---------|
| Perfect | Gak ada rule yang dilanggar |
| Good | Minor violation (misal slightly less than ideal spacing) |
| Avoid | Melanggar `break-before: avoid` atau sejenisnya |
| Last Resort | Akan bikin orphan/widow atau potong monolithic content |

### Kenapa Kita Gak Bisa Copy-Paste?

LayoutNG bukan standalone algorithm. Dia deeply integrated dengan:

- **CSS Parser** - Untuk resolve computed styles
- **DOM Tree** - Untuk traverse elements
- **Box Model** - Untuk calculate dimensions
- **Paint System** - Untuk actual rendering
- **100+ helper classes** - Yang masing-masing punya dependencies sendiri

Total codebase yang relevan: **ratusan ribu baris C++**.

Untuk porting ini ke JavaScript/TypeScript dengan proper testing dan edge case handling, butuh tim 5+ engineer selama 6-12 bulan.

---

## Pendekatan Kita: Simplified Algorithm

Kita akan implement subset dari LayoutNG's algorithm yang cover 80-90% use cases untuk markdown documents.

### Filosofi

1. **Markdown itu simpler than HTML** - Gak ada complex CSS layouts, floats, positioned elements, dll.

2. **Block-level focus** - Markdown mostly block elements: paragraphs, headings, images, code blocks, tables, lists.

3. **Good enough pagination** - Lebih baik punya pagination yang 90% bagus sekarang, daripada perfect pagination yang gak pernah selesai.

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     MARKDOWN SOURCE                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PARSE TO HTML                             │
│            (using marked.js, already done)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              RENDER TO HIDDEN CONTAINER                      │
│     (to get actual rendered heights of each block)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXTRACT BLOCK INFO                           │
│                                                              │
│  For each block element:                                     │
│  - Type (heading, paragraph, image, code, table, list)      │
│  - Rendered height                                           │
│  - Can it be split? (only paragraphs)                       │
│  - Should it break before? (H1, H2)                         │
│  - Should it stay with next? (all headings)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PAGINATION LOOP                            │
│                                                              │
│  For each block:                                             │
│  1. Check if fits in remaining space                        │
│  2. If yes, add to current page                             │
│  3. If no:                                                   │
│     a. If splittable → split with orphan/widow rules        │
│     b. If monolithic → move to next page                    │
│  4. Handle special rules (break-before, keep-with-next)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PAGE OBJECTS                              │
│                                                              │
│  Page 1: [Heading, Paragraph, Image]                        │
│  Page 2: [Paragraph (continued), Code Block]                │
│  Page 3: [Table, Paragraph, Paragraph]                      │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  RENDER EACH PAGE                            │
│                                                              │
│  Clone elements, position absolutely, clip if split         │
└─────────────────────────────────────────────────────────────┘
```

---

## Langkah-Langkah Detail

### Langkah 1: Parse Markdown ke HTML

Ini udah done pake `marked.js`. Output-nya HTML string.

```typescript
import { marked } from 'marked';

const html = marked.parse(markdownSource);
// <h1>Judul</h1><p>Paragraf...</p><img src="...">...
```

### Langkah 2: Render ke Hidden Container

Kita perlu tahu tinggi sebenarnya dari setiap element setelah di-render dengan font, spacing, dll.

```typescript
// Bikin hidden container dengan lebar yang sama dengan page
const measureContainer = document.createElement('div');
measureContainer.style.cssText = `
  position: absolute;
  visibility: hidden;
  width: ${PAGE_WIDTH}px;
  padding: ${PAGE_PADDING}px;
`;
measureContainer.innerHTML = html;
document.body.appendChild(measureContainer);
```

Kenapa hidden dan bukan `display: none`? Karena `display: none` gak di-layout sama browser, jadi gak bisa diukur.

### Langkah 3: Extract Block Information

Sekarang kita traverse children dan extract info:

```typescript
interface Block {
  // Identifikasi
  type: BlockType;
  element: HTMLElement;

  // Dimensi
  height: number;
  marginTop: number;
  marginBottom: number;

  // Pagination rules
  canBreak: boolean;      // Bisa dipotong across pages?
  breakBefore: boolean;   // Force page break sebelum block ini?
  keepWithNext: boolean;  // Harus stay dengan block berikutnya?

  // Untuk paragraf yang bisa dipotong
  lines?: LineInfo[];
}

type BlockType =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'  // Headings
  | 'p'                                        // Paragraph
  | 'pre'                                      // Code block
  | 'img'                                      // Image
  | 'table'                                    // Table
  | 'ul' | 'ol'                               // Lists
  | 'blockquote'                              // Blockquote
  | 'hr';                                      // Horizontal rule

function extractBlocks(container: HTMLElement): Block[] {
  const blocks: Block[] = [];

  for (const child of container.children) {
    const el = child as HTMLElement;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const type = getBlockType(el);

    const block: Block = {
      type,
      element: el,
      height: rect.height,
      marginTop: parseFloat(style.marginTop),
      marginBottom: parseFloat(style.marginBottom),
      canBreak: type === 'p',  // Hanya paragraf yang bisa dipotong
      breakBefore: type === 'h1' || type === 'h2',
      keepWithNext: type.startsWith('h'),  // Semua heading
    };

    // Kalau paragraf, extract line info untuk splitting nanti
    if (block.canBreak) {
      block.lines = extractLines(el);
    }

    blocks.push(block);
  }

  return blocks;
}
```

### Langkah 4: Extract Lines dari Paragraf

Ini tricky part. Browser gak expose "lines" secara langsung. Kita harus detect line breaks dari character positions.

```typescript
interface LineInfo {
  startOffset: number;  // Character offset dalam text
  endOffset: number;
  height: number;
  top: number;          // Posisi Y relatif ke paragraf
}

function extractLines(paragraph: HTMLElement): LineInfo[] {
  const lines: LineInfo[] = [];

  // Simplified: assume paragraf cuma punya text node
  // Real implementation perlu handle inline elements (bold, italic, links)
  const textNode = paragraph.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    // Fallback: treat as single unbreakable line
    return [{
      startOffset: 0,
      endOffset: paragraph.textContent?.length || 0,
      height: paragraph.getBoundingClientRect().height,
      top: 0,
    }];
  }

  const text = textNode.textContent || '';
  const range = document.createRange();

  let currentLineTop = -Infinity;
  let lineStart = 0;

  // Scan setiap karakter untuk detect line breaks
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length) {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
    }

    const rect = range.getBoundingClientRect();

    // Kalau Y position berubah, berarti new line
    if (rect.top > currentLineTop + 2) {  // +2 untuk tolerance
      if (currentLineTop !== -Infinity) {
        // Save previous line
        lines.push({
          startOffset: lineStart,
          endOffset: i,
          height: rect.height,
          top: currentLineTop - paragraph.getBoundingClientRect().top,
        });
      }
      lineStart = i;
      currentLineTop = rect.top;
    }
  }

  // Last line
  if (lineStart < text.length) {
    const lastRect = range.getBoundingClientRect();
    lines.push({
      startOffset: lineStart,
      endOffset: text.length,
      height: lastRect.height,
      top: currentLineTop - paragraph.getBoundingClientRect().top,
    });
  }

  return lines;
}
```

### Langkah 5: Main Pagination Loop

Ini jantung dari algorithm:

```typescript
interface PageContent {
  blocks: PlacedBlock[];
  usedHeight: number;
}

interface PlacedBlock {
  block: Block;
  offsetY: number;      // Posisi Y dalam halaman

  // Untuk split paragraf:
  partialStart?: number;  // Line index mulai
  partialEnd?: number;    // Line index akhir (exclusive)
}

function paginate(blocks: Block[], pageHeight: number): PageContent[] {
  const pages: PageContent[] = [];
  let currentPage: PageContent = { blocks: [], usedHeight: 0 };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const nextBlock = blocks[i + 1];

    // ═══════════════════════════════════════════════════════
    // RULE 1: Break Before
    // H1 dan H2 selalu mulai di halaman baru (kecuali halaman kosong)
    // ═══════════════════════════════════════════════════════
    if (block.breakBefore && currentPage.blocks.length > 0) {
      pages.push(currentPage);
      currentPage = { blocks: [], usedHeight: 0 };
    }

    const remainingSpace = pageHeight - currentPage.usedHeight;
    const blockHeight = block.height + block.marginTop + block.marginBottom;

    // ═══════════════════════════════════════════════════════
    // RULE 2: Block Fits Entirely
    // ═══════════════════════════════════════════════════════
    if (blockHeight <= remainingSpace) {
      // Check keep-with-next: heading shouldn't be alone at page bottom
      if (block.keepWithNext && nextBlock) {
        const spaceAfterThis = remainingSpace - blockHeight;
        const nextBlockHeight = nextBlock.height + nextBlock.marginTop + nextBlock.marginBottom;

        // Kalau next block gak muat dan sisa space < 20% halaman,
        // pindahkan heading ke halaman baru
        if (nextBlockHeight > spaceAfterThis && spaceAfterThis < pageHeight * 0.2) {
          pages.push(currentPage);
          currentPage = { blocks: [], usedHeight: 0 };
        }
      }

      // Add block to current page
      currentPage.blocks.push({
        block,
        offsetY: currentPage.usedHeight + block.marginTop,
      });
      currentPage.usedHeight += blockHeight;
      continue;
    }

    // ═══════════════════════════════════════════════════════
    // RULE 3: Block Doesn't Fit - Try to Split
    // ═══════════════════════════════════════════════════════
    if (block.canBreak && block.lines && block.lines.length > 1) {
      const splitResult = splitParagraph(
        block,
        remainingSpace - block.marginTop,
        { orphans: 2, widows: 2 }
      );

      if (splitResult.firstPart) {
        // Add first part to current page
        currentPage.blocks.push({
          block,
          offsetY: currentPage.usedHeight + block.marginTop,
          partialStart: 0,
          partialEnd: splitResult.splitAtLine,
        });
        currentPage.usedHeight += splitResult.firstPartHeight + block.marginTop;
      }

      // Start new page
      pages.push(currentPage);
      currentPage = { blocks: [], usedHeight: 0 };

      if (splitResult.secondPart) {
        // Add remainder to new page
        currentPage.blocks.push({
          block,
          offsetY: block.marginTop,
          partialStart: splitResult.splitAtLine,
          partialEnd: block.lines.length,
        });
        currentPage.usedHeight = splitResult.secondPartHeight + block.marginTop + block.marginBottom;
      }

      continue;
    }

    // ═══════════════════════════════════════════════════════
    // RULE 4: Monolithic Content - Move to Next Page
    // ═══════════════════════════════════════════════════════
    if (currentPage.blocks.length > 0) {
      pages.push(currentPage);
      currentPage = { blocks: [], usedHeight: 0 };
    }

    // Add monolithic block to new page
    currentPage.blocks.push({
      block,
      offsetY: block.marginTop,
    });

    // Kalau block lebih tinggi dari page, biarin overflow
    // (atau bisa di-scale down untuk images)
    currentPage.usedHeight = Math.min(blockHeight, pageHeight);

    // Kalau block >= pageHeight, langsung tutup halaman
    if (blockHeight >= pageHeight) {
      pages.push(currentPage);
      currentPage = { blocks: [], usedHeight: 0 };
    }
  }

  // Don't forget last page
  if (currentPage.blocks.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}
```

### Langkah 6: Split Paragraph with Orphans/Widows

```typescript
interface SplitResult {
  firstPart: boolean;       // Ada content di halaman ini?
  secondPart: boolean;      // Ada content di halaman berikutnya?
  splitAtLine: number;      // Split di line index ini
  firstPartHeight: number;
  secondPartHeight: number;
}

function splitParagraph(
  block: Block,
  availableHeight: number,
  rules: { orphans: number; widows: number }
): SplitResult {
  const lines = block.lines!;
  const totalLines = lines.length;

  // Find where we need to split based on height
  let splitAt = 0;
  let usedHeight = 0;

  for (let i = 0; i < lines.length; i++) {
    if (usedHeight + lines[i].height > availableHeight) {
      splitAt = i;
      break;
    }
    usedHeight += lines[i].height;
    splitAt = i + 1;
  }

  // ═══════════════════════════════════════════════════════
  // ORPHANS CHECK
  // "Orphan" = baris pertama paragraf yang sendirian di bawah halaman
  // Minimal harus ada `orphans` baris di halaman ini
  // ═══════════════════════════════════════════════════════
  if (splitAt > 0 && splitAt < rules.orphans) {
    // Gak cukup baris di halaman ini, pindahkan seluruh paragraf
    return {
      firstPart: false,
      secondPart: true,
      splitAtLine: 0,
      firstPartHeight: 0,
      secondPartHeight: block.height,
    };
  }

  // ═══════════════════════════════════════════════════════
  // WIDOWS CHECK
  // "Widow" = baris terakhir paragraf yang sendirian di atas halaman baru
  // Minimal harus ada `widows` baris di halaman berikutnya
  // ═══════════════════════════════════════════════════════
  const linesRemaining = totalLines - splitAt;
  if (linesRemaining > 0 && linesRemaining < rules.widows) {
    // Gak cukup baris untuk halaman berikutnya
    // Mundurkan split point supaya ada cukup widows
    const newSplitAt = totalLines - rules.widows;

    if (newSplitAt < rules.orphans) {
      // Gak bisa satisfy keduanya, pindahkan seluruh paragraf
      return {
        firstPart: false,
        secondPart: true,
        splitAtLine: 0,
        firstPartHeight: 0,
        secondPartHeight: block.height,
      };
    }

    splitAt = newSplitAt;
  }

  // Calculate heights
  const firstHeight = lines.slice(0, splitAt).reduce((sum, l) => sum + l.height, 0);
  const secondHeight = lines.slice(splitAt).reduce((sum, l) => sum + l.height, 0);

  return {
    firstPart: splitAt > 0,
    secondPart: splitAt < totalLines,
    splitAtLine: splitAt,
    firstPartHeight: firstHeight,
    secondPartHeight: secondHeight,
  };
}
```

### Langkah 7: Render Pages

Sekarang kita punya array of pages, render ke DOM:

```typescript
function renderPages(pages: PageContent[], container: HTMLElement) {
  container.innerHTML = '';

  pages.forEach((page, pageIndex) => {
    const pageEl = document.createElement('div');
    pageEl.className = 'page';
    pageEl.style.cssText = `
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      position: relative;
      overflow: hidden;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
      padding: ${PAGE_PADDING}px;
    `;

    for (const placed of page.blocks) {
      const clone = placed.block.element.cloneNode(true) as HTMLElement;

      // Position block
      clone.style.position = 'absolute';
      clone.style.top = `${placed.offsetY}px`;
      clone.style.left = `${PAGE_PADDING}px`;
      clone.style.right = `${PAGE_PADDING}px`;
      clone.style.margin = '0';

      // Handle partial paragraphs (split across pages)
      if (placed.partialStart !== undefined && placed.block.lines) {
        const lines = placed.block.lines;
        const startLine = lines[placed.partialStart];
        const endLine = lines[placed.partialEnd! - 1];

        // Clip to show only the relevant lines
        const clipTop = startLine.top;
        const clipHeight = (endLine.top + endLine.height) - startLine.top;

        clone.style.marginTop = `-${clipTop}px`;
        clone.style.height = `${clipHeight}px`;
        clone.style.overflow = 'hidden';
      }

      pageEl.appendChild(clone);
    }

    container.appendChild(pageEl);
  });
}
```

---

## Kasus-Kasus Khusus

### Kasus 1: Heading di Akhir Halaman

**Problem**: H2 ada di baris terakhir, paragrafnya di halaman baru. Jelek.

**Solution**: `keepWithNext` rule. Kalau heading dan sisa space < 20% halaman, pindahkan heading ke halaman baru.

```
SEBELUM:                    SESUDAH:
┌─────────────────┐         ┌─────────────────┐
│ ...content...   │         │ ...content...   │
│ ...content...   │         │                 │
│ ## Heading      │         │                 │
└─────────────────┘         └─────────────────┘
┌─────────────────┐         ┌─────────────────┐
│ Paragraf...     │         │ ## Heading      │
│                 │         │ Paragraf...     │
└─────────────────┘         └─────────────────┘
```

### Kasus 2: Paragraf Panjang

**Problem**: Paragraf 20 baris, sisa halaman cuma 5 baris.

**Solution**: Split dengan orphan/widow rules.

```
┌─────────────────┐
│ ...content...   │
│ Line 1 of para  │ ← Minimal 2 baris (orphans)
│ Line 2 of para  │
│ Line 3 of para  │
│ Line 4 of para  │
│ Line 5 of para  │
└─────────────────┘
┌─────────────────┐
│ Line 6 of para  │
│ Line 7 of para  │
│ ...             │
│ Line 19 of para │ ← Minimal 2 baris (widows)
│ Line 20 of para │
└─────────────────┘
```

### Kasus 3: Gambar Besar

**Problem**: Gambar 800px, halaman 600px.

**Solution Options**:

1. **Scale down** - Resize gambar supaya muat
2. **Overflow** - Biarin gambar overflow (terpotong)
3. **Dedicated page** - Gambar dapat halaman sendiri dengan scaling

Kita akan pakai option 1 (scale down):

```typescript
if (block.type === 'img' && block.height > pageHeight) {
  const scale = pageHeight / block.height;
  clone.style.transform = `scale(${scale})`;
  clone.style.transformOrigin = 'top left';
}
```

### Kasus 4: Tabel Panjang

**Problem**: Tabel 50 baris gak muat di satu halaman.

**Solution**: Untuk MVP, treat table as monolithic. Kalau gak muat, scale down atau overflow.

Future improvement: Split table by rows, repeat header di setiap halaman.

### Kasus 5: Code Block Panjang

**Problem**: Code block 100 baris.

**Solution**: Sama dengan tabel - monolithic untuk MVP.

Future improvement: Split by lines, tapi hati-hati dengan syntax highlighting yang mungkin span multiple lines.

---

## Limitasi dan Trade-offs

### Apa yang TIDAK di-handle (dibanding Blink):

| Feature | Blink | Kita |
|---------|-------|------|
| Inline element splitting | ✅ Bisa potong di tengah `<strong>` | ❌ Treat as atomic |
| Float handling | ✅ Full support | ❌ Not supported |
| Positioned elements | ✅ Full support | ❌ Not supported |
| CSS `break-inside: avoid` | ✅ Full support | ❌ Manual per block type |
| CSS `break-before/after` | ✅ Full support | ⚠️ Hardcoded for H1/H2 |
| Multi-column | ✅ Full support | ❌ Not supported |
| Margin collapsing | ✅ Full support | ❌ Simplified |
| Complex nested structures | ✅ Full support | ⚠️ Limited |

### Kenapa Ini OK untuk Markdown:

1. **Markdown gak punya floats** - Gak ada `float: left` di markdown
2. **Markdown gak punya positioned elements** - Gak ada `position: absolute`
3. **Inline elements simple** - Cuma bold, italic, code, links
4. **Structure predictable** - Heading, paragraph, image, code, table, list

### Trade-off yang Kita Ambil:

| Trade-off | Pro | Con |
|-----------|-----|-----|
| Paragraf only yang splittable | Simpler implementation | Tables dan code blocks bisa overflow |
| Hardcoded break rules | Predictable behavior | Less flexible |
| No inline splitting | Much simpler | Bold text di akhir baris bisa awkward |
| Scale down large images | Always fits | Might be too small |

---

## Rencana Implementasi

### Phase 1: Core Algorithm (MVP)

1. **Block extraction** - Parse HTML, extract blocks dengan heights
2. **Basic pagination** - Distribute blocks ke pages
3. **Monolithic handling** - Images, tables, code blocks
4. **Basic rendering** - Show pages

Estimated: 2-3 hari

### Phase 2: Paragraph Splitting

1. **Line detection** - Extract lines dari paragraphs
2. **Orphan/widow rules** - Implement split logic
3. **Partial rendering** - Clip split paragraphs

Estimated: 2-3 hari

### Phase 3: Polish

1. **Keep-with-next** - Heading + first paragraph
2. **Break-before** - H1/H2 new page
3. **Image scaling** - Handle oversized images
4. **Performance** - Optimize untuk large documents

Estimated: 2-3 hari

### Phase 4: Future Enhancements (Optional)

1. Table splitting with header repeat
2. Code block splitting
3. CSS break properties support
4. Smarter inline element handling

---

## Kesimpulan

Algorithm ini adalah "good enough" solution untuk markdown pagination. Dia gak se-powerful Blink, tapi untuk use case markdown reader, dia sufficient.

Key insight: **Markdown documents are predictable**. Kita gak perlu handle semua edge cases yang web browser harus handle. Dengan scope yang terbatas, kita bisa implement pagination yang solid dalam waktu reasonable.

Kalau nanti ketemu edge case yang gak ke-handle, kita bisa selalu fallback ke:
1. Treat problematic content as monolithic
2. Scale down kalau terlalu besar
3. Let user scroll within page untuk oversized content

The goal is **good reading experience**, bukan **pixel-perfect print output**. Untuk print, user bisa selalu Ctrl+P dan biarkan browser handle it dengan Blink's full algorithm.
