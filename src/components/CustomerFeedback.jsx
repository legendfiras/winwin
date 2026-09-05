import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { store } from '@/api/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function CustomerFeedback() {
  const { data: settingsData } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => store.settings.list(),
  });
  const settings = Array.isArray(settingsData) ? settingsData : [];

  const fb = settings.find(s => s.setting_key === 'customer_feedback');
  const text = fb?.setting_value?.trim();

  if (!text) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <MessageSquare className="w-5 h-5 text-primary" />
          Announcement
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{text}</p>
      </CardContent>
    </Card>
  );
}