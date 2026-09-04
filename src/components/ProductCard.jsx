import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, Star, X } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';
import { getCustomer, isCardActive } from '@/lib/customerAuth';
import { pointsPriceFromUsd, formatPoints } from '@/lib/pointsTiers';
import SubmitPurchaseDialog from '@/components/SubmitPurchaseDialog';
import { productImageSrc, productImageFallback } from '@/lib/productImage';

export default function ProductCard({ product }) {
  const { getSetting } = useSettings();
  const customer = getCustomer();
  const [lightbox, setLightbox] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const number = getSetting('whatsapp_number', '0096181629538').replace(/[^0-9]/g, '').replace(/^0+/, '');
  const hasCard = isCardActive(customer);
  const discountedPrice = hasCard ? (product.price * 0.85).toFixed(2) : null;
  const pointsPrice = product.points_price > 0 ? product.points_price : pointsPriceFromUsd(product.price);

  const ambassadorInfo = customer?.ambassador_code ? `\nAmbassador Code: ${customer.ambassador_code}` : '';
  const waMessage = `Hi! I'm interested in: ${product.name} - $${discountedPrice || product.price}${ambassadorInfo}`;
  const waUrl = `https://wa.me/${number}?text=${encodeURIComponent(waMessage)}`;

  return (
    <>
      {lightbox && product.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80">
            <X className="w-6 h-6" />
          </button>
          <img
            src={productImageSrc(product.image_url)}
            alt={product.name}
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
            onError={(e) => productImageFallback(e, product.image_url)}
          />
        </div>
      )}
    <Card className="group overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.image_url ? (
          <img
            src={productImageSrc(product.image_url)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-zoom-in"
            onClick={() => setLightbox(true)}
            onError={(e) => productImageFallback(e, product.image_url)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        {!product.in_stock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-lg">Out of Stock</span>
          </div>
        )}
        {hasCard && (
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
            15% OFF
          </Badge>
        )}
        {pointsPrice > 0 && (
          <Badge variant="secondary" className="absolute top-2 right-2 gap-1">
            <Star className="w-3 h-3" /> {pointsPrice} pts
          </Badge>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-heading font-semibold text-sm line-clamp-1">{product.name}</h3>
        {product.description && (
          <p
            className={`text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors ${descExpanded ? '' : 'line-clamp-2'}`}
            onClick={() => setDescExpanded(!descExpanded)}
            title={descExpanded ? 'Click to collapse' : 'Click to read more'}
          >
            {product.description}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {hasCard && discountedPrice ? (
            <>
              <span className="font-heading font-bold text-primary text-lg">${discountedPrice}</span>
              <span className="text-sm text-muted-foreground line-through">${product.price}</span>
            </>
          ) : (
            <span className="font-heading font-bold text-lg">${product.price}</span>
          )}
          <span className="text-xs text-muted-foreground">{formatPoints(pointsPrice)}</span>
        </div>
        <Button size="sm" className="w-full gap-2 bg-green-500 hover:bg-green-600 text-white" onClick={() => { window.open(waUrl, '_blank'); }}>
          <MessageCircle className="w-4 h-4" /> Order via WhatsApp
        </Button>
        {customer && product.in_stock !== false && (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setSubmitOpen(true)}>
            Submit purchase
          </Button>
        )}
      </div>
    </Card>
    <SubmitPurchaseDialog open={submitOpen} onOpenChange={setSubmitOpen} product={product} />
    </>
  );
}
