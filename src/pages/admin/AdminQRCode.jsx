import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';

const APP_URL = window.location.origin;

export default function AdminQRCode() {
  const wrapperRef = useRef(null);

  const handleDownload = () => {
    const canvas = wrapperRef.current?.querySelector('canvas');
    if (!canvas) { toast.error('QR code not ready yet, please try again.'); return; }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'winwin-leb-qrcode.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR code downloaded!');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(APP_URL);
    alert('Link copied! You can paste it and send to customers.');
  };

  return (
    <AdminLayout>
      <div className="max-w-md mx-auto py-12 flex flex-col items-center gap-6">
        <h1 className="text-center font-heading text-xl font-bold sm:text-2xl">App QR Code</h1>
        <p className="text-muted-foreground text-center text-sm">
          Share this QR code with customers — scanning it will open the app directly.
        </p>

        <div ref={wrapperRef} className="max-w-full overflow-hidden rounded-2xl border bg-white p-4 shadow-lg sm:p-6">
          <QRCodeCanvas
            value={APP_URL}
            size={220}
            bgColor="#ffffff"
            fgColor="#1a1a2e"
            level="H"
            className="h-auto max-w-full"
          />
        </div>

        <p className="text-xs text-muted-foreground break-all text-center px-4">{APP_URL}</p>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button onClick={handleDownload} className="h-11 w-full gap-2 sm:w-auto">
            <Download className="h-4 w-4" /> Download PNG
          </Button>
          <Button variant="outline" onClick={handleCopyLink} className="h-11 w-full gap-2 sm:w-auto">
            <Share2 className="h-4 w-4" /> Copy Link
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}