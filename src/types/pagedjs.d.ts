declare module 'pagedjs' {
  export class Previewer {
    preview(
      content: HTMLElement | string,
      stylesheets?: string[],
      container?: HTMLElement
    ): Promise<{
      total: number;
      pages: HTMLElement[];
    }>;
  }

  export class Chunker {
    constructor(content: HTMLElement, container: HTMLElement);
  }

  export class Polisher {
    constructor();
    add(...css: string[]): Promise<void>;
  }
}
