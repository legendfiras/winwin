import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { store, asProducts } from '@/api/store';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { pointsPriceFromUsd, formatPoints } from '@/lib/pointsTiers';
import { ADMIN_CATEGORIES, categoryLabel, productCategoryList, productTags } from '@/lib/categories';
import { productImageSrc, productImageFallback } from '@/lib/productImage';
import { uploadErrorMessage } from '@/lib/uploadError';
import { fileToWebp } from '@/lib/fileToWebp';

const emptyProduct = {
  name: '',
  description: '',
  price: 0,
  points_price: 0,
  category: 'home_appliance',
  categories: ['home_appliance'],
  tags: [],
  image_url: '',
  in_stock: true,
};

export default function AdminProducts() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [tagDraft, setTagDraft] = useState('');

  const { data: productsData } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => store.products.list(),
  });
  const products = asProducts(productsData);
  const q = search.trim().toLowerCase();
  const visible = products.filter((p) => {
    if (!q) return true;
    const categories = productCategoryList(p).map((key) => `${key} ${categoryLabel(key)}`).join(' ');
    return `${p.name || ''} ${categories} ${productTags(p).join(' ')}`.toLowerCase().includes(q);
  });

  const createMut = useMutation({
    mutationFn: d => store.products.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); qc.invalidateQueries({ queryKey: ['catalog'] }); close(); toast.success('Product added!'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => store.products.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); qc.invalidateQueries({ queryKey: ['catalog'] }); close(); toast.success('Product updated!'); },
  });

  const deleteMut = useMutation({
    mutationFn: id => store.products.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); qc.invalidateQueries({ queryKey: ['catalog'] }); toast.success('Product deleted!'); },
  });

  function close() {
    setTagDraft('');
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyProduct);
  }

  function openEdit(p) {
    const categories = productCategoryList(p);
    setEditing(p);
    setTagDraft('');
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      points_price: p.points_price || 0,
      category: categories[0],
      categories,
      tags: productTags(p),
      image_url: p.image_url || '',
      in_stock: p.in_stock !== false,
    });
    setDialogOpen(true);
  }

  function toggleCategory(key) {
    setForm((current) => {
      const selected = current.categories?.length ? current.categories : [current.category].filter(Boolean);
      const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key];
      if (!next.length) {
        toast.error('Choose at least one category');
        return current;
      }
      return { ...current, categories: next, category: next[0] };
    });
  }

  function addTag() {
    const tag = tagDraft.trim().replace(/\s+/g, ' ').slice(0, 32);
    if (!tag) return;
    if ((form.tags || []).length >= 10) {
      toast.error('Each product can have up to 10 tags');
      return;
    }
    if ((form.tags || []).some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setTagDraft('');
      return;
    }
    setForm((current) => ({ ...current, tags: [...(current.tags || []), tag].slice(0, 10) }));
    setTagDraft('');
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const webp = await fileToWebp(file);
      const { file_url } = await store.upload(webp);
      if (!file_url) throw new Error('Upload did not return an image');
      setForm((current) => ({ ...current, image_url: file_url }));
      toast.success('Image saved as WebP');
    } catch (err) {
      toast.error(uploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-xl font-bold sm:text-2xl">Products</h1>
        <Button className="h-11 w-full sm:w-auto" onClick={() => { setForm(emptyProduct); setTagDraft(''); setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products"
        className="mb-4 h-11 sm:max-w-sm"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map(p => (
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
                  <p className="text-sm text-muted-foreground">{productCategoryList(p).map(categoryLabel).join(' · ')}</p>
                  {productTags(p).length > 0 && (
                    <p className="text-xs text-muted-foreground">{productTags(p).join(' · ')}</p>
                  )}
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
                <Button size="sm" variant="destructive" onClick={() => { if (window.confirm(`Delete ${p.name}?`)) deleteMut.mutate(p.id); }}>
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
              <Label>Categories</Label>
              <p className="mb-2 text-xs text-muted-foreground">A product can belong to more than one category.</p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_CATEGORIES.map((category) => {
                  const on = (form.categories || []).includes(category.key);
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => toggleCategory(category.key)}
                      className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-[#9F1D35] bg-[#9F1D35] text-white' : 'border-border bg-white'}`}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Tags</Label>
              <p className="mb-2 text-xs text-muted-foreground">{(form.tags || []).length} of 10 tags</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {(form.tags || []).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="rounded-full bg-[#F5EDE1] px-3 py-1 text-sm"
                    onClick={() => setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))}
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag"
                  maxLength={32}
                />
                <Button type="button" variant="outline" onClick={addTag}>Add</Button>
              </div>
            </div>
            <div>
              <Label>Product Image</Label>
              <div className="mt-1 mb-2 rounded-lg border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Any photo is saved as WebP.</p>
                <p>Square 800×800 works best. Large photos are scaled down before upload.</p>
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