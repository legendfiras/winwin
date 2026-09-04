import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AdminLayout from '@/components/admin/AdminLayout';
import { useSettings } from '@/lib/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CreditCard, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminWinWinCard() {
  const qc = useQueryClient();
  const { settings, getSetting } = useSettings();
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const setting = settings['winwin_card_image'];
    if (setting) {
      await base44.entities.AppSettings.update(setting.id, { setting_value: file_url });
    } else {
      await base44.entities.AppSettings.create({ setting_key: 'winwin_card_image', setting_value: file_url });
    }
    qc.invalidateQueries({ queryKey: ['appSettings'] });
    setUploading(false);
    toast.success('WinWin Card image updated!');
  }

  const currentImage = getSetting('winwin_card_image');

  return (
    <AdminLayout>
      <h1 className="font-heading font-bold text-2xl mb-6">WinWin Card Image</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <CreditCard className="w-5 h-5 text-primary" /> Card Image
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentImage && (
            <div className="rounded-xl overflow-hidden border border-border">
              <img src={currentImage} alt="WinWin Card" className="w-full h-auto max-h-64 object-contain" />
            </div>
          )}
          <div>
            <Label>Upload New Card Image</Label>
            <div className="mt-1 p-3 rounded-lg bg-muted/50 border border-dashed border-border text-xs text-muted-foreground space-y-1 mb-2">
              <p className="font-medium text-foreground">📐 Recommended card image size:</p>
              <p>• <strong>900×500 px</strong> (credit card style, 9:5 ratio)</p>
              <p>• Minimum: 600×340 px &nbsp;|&nbsp; Max: 5 MB</p>
              <p>• Formats: JPG, PNG, WEBP</p>
            </div>
            <Input type="file" accept="image/*" onChange={handleImageUpload} />
            {uploading && <p className="text-sm text-primary mt-1 animate-pulse">⏳ Uploading...</p>}
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}