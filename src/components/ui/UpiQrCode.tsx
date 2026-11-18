import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function UpiQrCode({ uri, downloadable = false, alt = 'UPI payment QR code', size = 256 }: { uri: string; downloadable?: boolean; alt?: string; size?: number }) {
  const [image, setImage] = useState<{ uri: string; data: string } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(uri, { width: 512, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(data => { if (active) { setImage({ uri, data }); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [uri]);
  if (error) return <p role="alert" className="text-xs text-[#ff8278]">Could not generate the QR. Use the link or details shown.</p>;
  if (!image || image.uri !== uri) return <p role="status" className="text-xs text-[#bcbcbc]">Generating QR…</p>;
  return <div className="flex flex-col items-center gap-3">
    <img src={image.data} width={size} height={size} style={{ width: size }} alt={alt} className="max-w-full h-auto aspect-square bg-white" />
    {downloadable && <a href={image.data} download="upi-payment-qr.png" className="text-xs text-[#ff8278] underline underline-offset-4 py-2">Download QR image</a>}
  </div>;
}
