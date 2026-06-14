declare module 'pdfmake' {
  type FontDefinition = {
    normal: string;
    bold: string;
    italics: string;
    bolditalics: string;
  };

  type PdfDocument = {
    write(filename: string): Promise<void>;
    getBuffer(): Promise<Buffer>;
  };

  const pdfMake: {
    setFonts(fonts: Record<string, FontDefinition>): void;
    setLocalAccessPolicy(callback: (filePath: string) => boolean): void;
    setUrlAccessPolicy(callback: (url: string) => boolean): void;
    createPdf(
      docDefinition: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): PdfDocument;
  };

  export default pdfMake;
}
