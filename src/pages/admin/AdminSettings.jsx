import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { store } from '@/api/store';
import AdminLayout from '@/components/admin/AdminLayout';
import { useSettings } from '@/lib/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Phone, Lock, Palette, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const qc = useQueryClient();
  const { settings, getSetting, isLoading } = useSettings();
  const [whatsapp, setWhatsapp] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [bgColor, setBgColor] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setWhatsapp(getSetting('whatsapp_number', ''));
      setAdminPass(getSetting('admin_password', ''));
      setBgColor(getSetting('background_color', '#FFF8F0'));
      setAdminEmail(getSetting('admin_email', ''));
    }
  }, [isLoading]);

  async function updateSetting(key, value) {
    const existing = settings[key];
    await store.settings.upsert(key, value);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await updateSetting('whatsapp_number', whatsapp);
    await updateSetting('admin_password', adminPass);
    await updateSetting('background_color', bgColor);
    await updateSetting('admin_email', adminEmail);
    qc.invalidateQueries({ queryKey: ['appSettings'] });
    setSaving(false);
    toast.success('Settings saved!');
  }

  if (isLoading) return <AdminLayout><p>Loading...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-heading font-bold text-2xl mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <Settings className="w-5 h-5 text-primary" /> App Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <Label className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4" /> WhatsApp Number
              </Label>
              <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="0096181629538" />
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4" /> Admin Email (receives signup notifications)
              </Label>
              <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4" /> Admin Password
              </Label>
              <Input value={adminPass} onChange={e => setAdminPass(e.target.value)} />
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-1">
                <Palette className="w-4 h-4" /> Background Color
              </Label>
              <div className="flex gap-3 items-center">
                <Input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-16 h-10 p-1 cursor-pointer" />
                <Input value={bgColor} onChange={e => setBgColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}