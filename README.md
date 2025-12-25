# Cygnus MD

A lightweight, paginated Markdown reader with multiple style templates. Built with Electron + React.

## Features

- **Paginated A4 View** - Renders markdown as paginated A4 documents
- **12 Style Templates** - Default, Academic, Minimal, Dark, Streamline, Focus, Swiss, Paperback, Coral, Slate, Luxe, Geometric
- **Table of Contents** - Auto-generated from headings with page numbers
- **Multi-tab Support** - Open multiple documents in tabs
- **Recent Files** - Quick access to recently opened files
- **Frameless Window** - Custom titlebar with integrated tabs
- **Zoom Controls** - Ctrl +/- to zoom, Ctrl+0 to reset
- **Keyboard Navigation** - Arrow keys, Page Up/Down, Home/End

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
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

## Build

Production builds are output to the `release/` directory.

```bash
npm run electron:build
```

Supported targets:
- **Linux**: AppImage, deb
- **Windows**: NSIS installer, portable
- **macOS**: DMG

## Tech Stack

- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://react.dev/) - UI framework
- [Chakra UI](https://chakra-ui.com/) - Component library
- [Marked](https://marked.js.org/) - Markdown parser
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Vite](https://vitejs.dev/) - Build tool

## License

MIT
