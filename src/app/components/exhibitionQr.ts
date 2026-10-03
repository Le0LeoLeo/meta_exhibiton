export async function generateExhibitionQr(url: string): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(url, {
    width: 768, margin: 4, errorCorrectionLevel: 'M',
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
}
