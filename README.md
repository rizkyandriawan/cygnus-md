# Cygnus MD

A lightweight, paginated Markdown reader for desktop.

## Why Cygnus MD?

With the rise of LLMs, Markdown has become one of the most widely used formats for documentation, notes, and technical writing. Yet, there's a surprising lack of decent, lightweight, and free Markdown readers for desktop.

Most existing options are either:
- Full-blown editors when you just want to *read*
- Web-based with no offline support
- Bloated with features you don't need
- Paid or subscription-based

**Cygnus MD** fills this gap: a fast, free, and focused Markdown reader that renders your documents as clean, paginated A4 pages.

## Download

| Platform | Download |
|----------|----------|
| Linux (AppImage) | [cygnus-md-0.1.0-linux-x86_64.AppImage](https://github.com/rizkyandriawan/cygnus-md/releases/download/v0.1.0/cygnus-md-0.1.0-linux-x86_64.AppImage) |
| Linux (deb) | [cygnus-md-0.1.0-linux-amd64.deb](https://github.com/rizkyandriawan/cygnus-md/releases/download/v0.1.0/cygnus-md-0.1.0-linux-amd64.deb) |
| Linux (rpm) | [cygnus-md-0.1.0-linux-x86_64.rpm](https://github.com/rizkyandriawan/cygnus-md/releases/download/v0.1.0/cygnus-md-0.1.0-linux-x86_64.rpm) |
| Windows (MSI) | [cygnus-md-0.1.0-win-x64.msi](https://github.com/rizkyandriawan/cygnus-md/releases/download/v0.1.0/cygnus-md-0.1.0-win-x64.msi) |
| Windows (Portable) | [cygnus-md-0.1.0-win-x64.exe](https://github.com/rizkyandriawan/cygnus-md/releases/download/v0.1.0/cygnus-md-0.1.0-win-x64.exe) |

## Features

- **Paginated A4 View** - Renders markdown as paginated A4 documents
- **11 Style Templates** - Default, Academic, Minimal, Streamline, Focus, Swiss, Paperback, Coral, Slate, Luxe, Geometric
- **Table of Contents** - Auto-generated from headings with page numbers
- **Multi-tab Support** - Open multiple documents in tabs
- **Recent Files** - Quick access to recently opened files
- **Frameless Window** - Custom titlebar with integrated tabs
- **Zoom Controls** - Ctrl +/- to zoom, Ctrl+0 to reset
- **Keyboard Navigation** - Arrow keys, Page Up/Down, Home/End
- **LaTeX Support** - Render math equations with KaTeX

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl` + `O` | Open file |
| `Ctrl` + `W` | Close tab |
| `Ctrl` + `Tab` | Next tab |
| `←` `→` | Previous/Next page |
| `Page Up` `Page Down` | Previous/Next page |
| `Home` `End` | First/Last page |
| `Ctrl` + `+` | Zoom in |
| `Ctrl` + `-` | Zoom out |
| `Ctrl` + `0` | Reset zoom |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production
npm run electron:build
```

## Tech Stack

- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://react.dev/) - UI framework
- [Chakra UI](https://chakra-ui.com/) - Component library
- [Marked](https://marked.js.org/) - Markdown parser
- [KaTeX](https://katex.org/) - LaTeX rendering
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Vite](https://vitejs.dev/) - Build tool

## License

MIT
