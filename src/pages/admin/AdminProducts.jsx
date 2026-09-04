import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { pointsPriceFromUsd, formatPoints } from '@/lib/pointsTiers';
import { productImageSrc, productImageFallback } from '@/lib/productImage';

const CATEGORIES = [
  { key: 'home_appliance', label: 'Home Appliance' },
  { key: 'home_essentials', label: 'Home Essentials' },
  { key: 'phone_accessories', label: 'Phone Accessories' },
  { key: 'toys', label: 'Toys' },
  { key: 'new_gadgets', label: 'New Gadgets' },
  { key: 'must_have', label: 'Must Have' },
  { key: 'beauty_care', label: 'Beauty Care' },
  { key: 'fans', label: 'Fans' },
  { key: 'shavers', label: 'Shavers' },
  { key: 'silkapils', label: 'Silkapils' },
  { key: 'hair_care', label: 'Hair Care' },
];

const emptyProduct = { name: '', description: '', price: 0, points_price: 0, category: 'home_appliance', image_url: '', in_stock: true };

export default function AdminProducts() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [uploading, setUploading] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date'),
  });

  const createMut = useMutation({
    mutationFn: d => base44.entities.Product.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); close(); toast.success('Product added!'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); close(); toast.success('Product updated!'); },
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.Product.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product deleted!'); },
  });

  function close() {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyProduct);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', price: p.price, points_price: p.points_price || 0, category: p.category, image_url: p.image_url || '', in_stock: p.in_stock !== false });
    setDialogOpen(true);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, image_url: file_url }));
    setUploading(false);
    toast.success('Image uploaded!');
  }

  function handleSave(e) {
    e.preventDefault();
    const payload = {
      ...form,
      points_price: pointsPriceFromUsd(form.price),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-heading font-bold text-2xl">Products</h1>
        <Button onClick={() => { setForm(emptyProduct); setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <Card key={p.id} className="overflow-hidden">
            {p.image_url && (
              <img
                src={productImageSrc(p.image_url)}
                alt={p.name}
                className="w-full h-40 object-cover"
                onError={(e) => productImageFallback(e, p.image_url)}
              />
            )}
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-heading font-semibold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.category?.replace(/_/g, ' ')}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary">${p.price}</span>
                  <p className="text-xs text-muted-foreground">{formatPoints(p.points_price || pointsPriceFromUsd(p.price))}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(p.id)}>
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price ($)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})} required />
              </div>
              <div>
                <Label>Points Price (auto: $1 = 100 pts)</Label>
                <Input type="number" value={pointsPriceFromUsd(form.price)} readOnly />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product Image</Label>
              <div className="mt-1 p-3 rounded-lg bg-muted/50 border border-dashed border-border text-xs text-muted-foreground space-y-1 mb-2">
                <p className="font-medium text-foreground">📐 Recommended image size:</p>
                <p>• <strong>Square format: 800×800 px</strong> (best for products)</p>
                <p>• Minimum: 400×400 px &nbsp;|&nbsp; Max file size: 5 MB</p>
                <p>• Formats: JPG, PNG, WEBP</p>
              </div>
              <Input type="file" accept="image/*" onChange={handleImageUpload} />
              {uploading && (
                <p className="text-sm text-primary mt-1 animate-pulse">⏳ Uploading image...</p>
              )}
              {form.image_url && !uploading && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Preview (as shown in shop):</p>
                  <div className="w-40 h-40 rounded-xl overflow-hidden border border-border shadow-sm">
                    <img
                      src={productImageSrc(form.image_url)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => productImageFallback(e, form.image_url)}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.in_stock} onCheckedChange={v => setForm({...form, in_stock: v})} />
              <Label>In Stock</Label>
            </div>
            <Button type="submit" className="w-full" disabled={createMut.isPending || updateMut.isPending}>
              {editing ? 'Update Product' : 'Add Product'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}