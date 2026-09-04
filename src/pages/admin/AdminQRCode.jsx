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
        <h1 className="text-2xl font-bold font-heading">App QR Code</h1>
        <p className="text-muted-foreground text-center text-sm">
          Share this QR code with customers — scanning it will open the app directly.
        </p>

        <div ref={wrapperRef} className="bg-white p-6 rounded-2xl shadow-lg border">
          <QRCodeCanvas
            value={APP_URL}
            size={250}
            bgColor="#ffffff"
            fgColor="#1a1a2e"
            level="H"
          />
        </div>

        <p className="text-xs text-muted-foreground break-all text-center px-4">{APP_URL}</p>

        <div className="flex gap-3">
          <Button onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" /> Download PNG
          </Button>
          <Button variant="outline" onClick={handleCopyLink} className="gap-2">
            <Share2 className="w-4 h-4" /> Copy Link
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}