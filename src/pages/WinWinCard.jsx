import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import MobileHeader from '@/components/MobileHeader';
import WhatsAppButton from '@/components/WhatsAppButton';
import MobileBottomTab from '@/components/MobileBottomTab';
import { useSettings } from '@/lib/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Truck, Percent, Gift, Trophy, CheckCircle, MessageCircle } from 'lucide-react';
import { getCustomer, invokeCustomer } from '@/lib/customerAuth';
import { toast } from 'sonner';

export default function WinWinCard() {
  const { getSetting } = useSettings();
  const customer = getCustomer();
  const [submitting, setSubmitting] = useState(false);
  const cardImage = getSetting('winwin_card_image');
  const rawNumber = getSetting('whatsapp_number', '0096181629538');
  const number = rawNumber.replace(/[^0-9]/g, '').replace(/^0+/, '');
  const waUrl = `https://wa.me/${number}?text=${encodeURIComponent("Hi! I'm interested in the WinWin Card membership!")}`;

  const handleSubmitCard = async () => {
    if (!customer) {
      toast.error('Sign in first, then submit your card purchase.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await invokeCustomer('submitLoyaltyCardPurchase', { amount_usd: 10 });
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success('Card purchase submitted. An admin will activate your membership after approval.');
    } catch (err) {
      toast.error(err.message || 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  };


  const benefits = [
    { icon: Truck, title: 'Free Delivery', desc: 'Free shipping on every order you place' },
    { icon: Percent, title: '15% Discount', desc: '15% off on every item in our store' },
    { icon: Gift, title: 'Draw Entries', desc: 'Enter our draw every 10 days automatically' },
    { icon: Trophy, title: 'More Purchases = More Chances', desc: 'Each purchase adds your name to the draw again' },
    { icon: Star, title: 'You Always Win', desc: 'Discounts + Free Delivery + Draw = WinWin!' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="hidden md:block"><Navbar /></div>
      <MobileHeader title="WinWin Card" backTo="/" />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Card Image */}
        {cardImage && (
          <div className="rounded-2xl overflow-hidden shadow-xl">
            <img src={cardImage} alt="WinWin Card" className="w-full h-auto" />
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
            <Star className="w-5 h-5 fill-primary" />
            <span className="font-heading font-bold">WinWin Card</span>
          </div>
          <h1 className="font-heading font-bold text-4xl">
            Only <span className="text-primary">$10</span>/month
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            The best deal for our loyal customers. Save more, win more!
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-4">
          {benefits.map((benefit, i) => (
            <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="bg-primary/10 rounded-xl p-3 shrink-0">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.desc}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-1 ml-auto" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How Draw Works */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-heading font-bold text-xl flex items-center gap-2">
              <Gift className="w-6 h-6 text-primary" /> How the Draw Works
            </h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                Get your WinWin Card for only $10/month
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                Your name enters the draw automatically
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                Each purchase = additional draw entry
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">4.</span>
                Draw happens every 10 days — more entries = more chances!
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* CTA — direct WhatsApp */}
        <Button size="lg" className="w-full text-lg font-heading gap-2 bg-green-500 hover:bg-green-600 text-white h-14" onClick={() => { window.open(waUrl, '_blank'); }}>
          <MessageCircle className="w-6 h-6" /> Get Your WinWin Card Now
        </Button>
        {customer ? (
          <Button size="lg" variant="outline" className="w-full h-12" disabled={submitting} onClick={handleSubmitCard}>
            {submitting ? 'Submitting...' : 'I purchased the card — submit for approval'}
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full h-12">
            <Link to="/auth">Sign in to submit a card purchase</Link>
          </Button>
        )}
      </div>
      <MobileBottomTab />
      <WhatsAppButton />
    </div>
  );
}