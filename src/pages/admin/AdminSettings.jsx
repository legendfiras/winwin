import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { store } from '@/api/store';
import AdminLayout from '@/components/admin/AdminLayout';
import { useSettings } from '@/lib/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Settings, Phone, Lock, Palette, Mail, CreditCard, Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import PointsEarnSettings from '@/components/admin/PointsEarnSettings';

export default function AdminSettings() {
  const qc = useQueryClient();
  const { getSetting, isLoading } = useSettings();
  const [whatsapp, setWhatsapp] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [bgColor, setBgColor] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const qrRef = useRef(null);
  const appUrl = window.location.origin;

  useEffect(() => {
    if (!isLoading) {
      setWhatsapp(getSetting('whatsapp_number', ''));
      setBgColor(getSetting('background_color', '#FFF8F0'));
      setAdminEmail(getSetting('admin_email', ''));
      setAnnouncement(getSetting('customer_feedback', ''));
    }
  }, [isLoading]);

  async function handleSave(e) {
    e.preventDefault();
    if (adminPass.trim() && adminPass.trim().length < 4) {
      toast.error('Use at least 4 characters for the new password');
      return;
    }
    setSaving(true);
    await store.settings.upsert('whatsapp_number', whatsapp);
    await store.settings.upsert('background_color', bgColor);
    await store.settings.upsert('admin_email', adminEmail);
    await store.settings.upsert('customer_feedback', announcement);
    if (adminPass.trim()) {
      await store.settings.upsert('admin_password', adminPass.trim());
      setAdminPass('');
    }
    qc.invalidateQueries({ queryKey: ['appSettings'] });
    setSaving(false);
    toast.success(adminPass.trim() ? 'Settings saved and password updated.' : 'Settings saved.');
  }

  async function handleCardUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await store.upload(file);
    await store.settings.upsert('winwin_card_image', file_url);
    qc.invalidateQueries({ queryKey: ['appSettings'] });
    setUploading(false);
    toast.success('Card image updated.');
  }

  const cardImage = getSetting('winwin_card_image');

  if (isLoading) return <AdminLayout><p>Loading...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="mb-4 font-heading text-xl font-bold sm:mb-6 sm:text-2xl">Settings</h1>
      <div className="mb-4 max-w-3xl space-y-4 sm:mb-6">
        <PointsEarnSettings />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Settings className="h-5 w-5 text-primary" /> Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <Label className="mb-1 flex items-center gap-2">
                  <Phone className="h-4 w-4" /> WhatsApp number
                </Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="0096181629538" />
              </div>
              <div>
                <Label className="mb-1 flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Admin email
                </Label>
                <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1">Shop announcement</Label>
                <Textarea
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  rows={3}
                  placeholder="Shown to customers on the shop"
                />
              </div>
              <div>
                <Label className="mb-1 flex items-center gap-2">
                  <Lock className="h-4 w-4" /> New admin password
                </Label>
                <Input
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="Leave blank to keep the current password"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label className="mb-1 flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Background color
                </Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-16 cursor-pointer p-1" />
                  <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <Button type="submit" className="h-11 w-full" disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <CreditCard className="h-5 w-5 text-primary" /> Loyalty card image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cardImage ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <img src={cardImage} alt="WinWin Card" className="max-h-64 w-full object-contain" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No card image uploaded yet.</p>
            )}
            <Input type="file" accept="image/*" onChange={handleCardUpload} />
            {uploading && <p className="text-sm text-primary">Uploading...</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Shop QR code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <div ref={qrRef} className="rounded-xl border bg-white p-4">
              <QRCodeCanvas value={appUrl} size={180} bgColor="#ffffff" fgColor="#1a1a2e" level="H" />
            </div>
            <p className="break-all text-xs text-muted-foreground">{appUrl}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                onClick={() => {
                  const canvas = qrRef.current?.querySelector('canvas');
                  if (!canvas) return;
                  const a = document.createElement('a');
                  a.href = canvas.toDataURL('image/png');
                  a.download = 'winwin-qrcode.png';
                  a.click();
                }}
              >
                <Download className="h-4 w-4" /> Download
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(appUrl);
                  toast.success('Shop link copied');
                }}
              >
                <Share2 className="h-4 w-4" /> Copy link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
