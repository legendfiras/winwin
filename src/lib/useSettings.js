import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useSettings() {
  const { data: settingsRaw = [], isLoading } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const settings = {};
  settingsRaw.forEach(s => {
    settings[s.setting_key] = s;
  });

  const getSetting = (key, fallback = '') => {
    return settings[key]?.setting_value || fallback;
  };

  return { settings, getSetting, isLoading, settingsRaw };
}