import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { store } from '@/api/store';
import { productImageSrc } from '@/lib/productImage';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSlideshow() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: slidesData } = useQuery({
    queryKey: ['slideshow'],
    queryFn: () => store.slides.list(),
  });
  const slides = Array.isArray(slidesData) ? slidesData : [];

  const deleteMut = useMutation({
    mutationFn: id => store.slides.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['slideshow'] }); toast.success('Slide removed!'); },
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!imageFile) return toast.error('Please select an image');
    setUploading(true);
    const { file_url } = await store.upload(imageFile);
    await store.slides.create({
      image_url: file_url,
      title,
      order: slides.length + 1,
    });
    qc.invalidateQueries({ queryKey: ['slideshow'] });
    setDialogOpen(false);
    setTitle('');
    setImageFile(null);
    setUploading(false);
    toast.success('Slide added!');
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-heading font-bold text-2xl">Slideshow</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Slide
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slides.map(slide => (
          <Card key={slide.id} className="overflow-hidden">
            <img src={productImageSrc(slide.image_url)} alt={slide.title} className="w-full h-48 object-cover" />
            <CardContent className="p-4 flex justify-between items-center">
              <span className="font-medium">{slide.title || 'No title'}</span>
              <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(slide.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Slide</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <Label>Title (optional)</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Image</Label>
              <div className="mt-1 p-3 rounded-lg bg-muted/50 border border-dashed border-border text-xs text-muted-foreground space-y-1 mb-2">
                <p className="font-medium text-foreground">📐 Recommended slideshow size:</p>
                <p>• <strong>1200×480 px</strong> (wide banner, 5:2 ratio)</p>
                <p>• Minimum: 800×320 px &nbsp;|&nbsp; Max: 5 MB</p>
                <p>• Formats: JPG, PNG, WEBP</p>
              </div>
              <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0])} required />
            </div>
            <Button type="submit" className="w-full" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Add Slide'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}