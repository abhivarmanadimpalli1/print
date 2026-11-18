import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function UpiQrCode({ uri, downloadable = false }: { uri: string; downloadable?: boolean }) {
  const [image, setImage] = useState<{ uri: string; data: string } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(uri, { width: 512, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(data => { if (active) { setImage({ uri, data }); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [uri]);
  if (error) return <p role="alert" className="text-xs text-[#ff8278]">Could not generate the QR. Use the UPI ID shown below.</p>;
  if (!image || image.uri !== uri) return <p role="status" className="text-xs text-[#bcbcbc]">Generating payment QR…</p>;
  return <div className="flex flex-col items-center gap-3">
    <img src={image.data} width={256} height={256} alt="UPI payment QR code" className="w-64 max-w-full h-auto aspect-square bg-white" />
    {downloadable && <a href={image.data} download="upi-payment-qr.png" className="text-xs text-[#ff8278] underline underline-offset-4 py-2">Download QR image</a>}
  </div>;
}
