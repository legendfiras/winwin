import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

export default function WhatsAppButton({ message = '' }) {
  const { getSetting } = useSettings();
  const number = getSetting('whatsapp_number', '0096178714472');
  
  // Remove all non-digits, then strip leading zeros for WhatsApp international format
  let cleanNumber = number.replace(/[^0-9]/g, '');
  cleanNumber = cleanNumber.replace(/^0+/, '');
  const defaultMsg = encodeURIComponent('Hi! I found you on WinWin.leb');
  const url = `https://wa.me/${cleanNumber}?text=${message ? encodeURIComponent(message) : defaultMsg}`;

  return (
    <button
      onClick={() => { window.open(url, '_blank'); }}
      className="fixed bottom-20 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
    >
      <MessageCircle className="w-7 h-7" />
    </button>
  );
}