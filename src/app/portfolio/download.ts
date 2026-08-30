export const portfolioDownloadFilename = "musica-mathematica-portfolio.json";
export const portfolioDownloadMimeType = "application/json";

export function downloadPortfolioJson(json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: portfolioDownloadMimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = portfolioDownloadFilename;
  link.click();
  URL.revokeObjectURL(url);
}
