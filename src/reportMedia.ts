export function isInlineReportImage(imageUrl?: string): boolean {
  return Boolean(imageUrl && /^data:image\/(png|jpe?g|webp);base64,/i.test(imageUrl));
}

export function getInlineReportImageExtension(imageUrl: string): string {
  const match = /^data:image\/(png|jpe?g|webp);base64,/i.exec(imageUrl);
  if (!match) return 'jpg';
  return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
}
