import { useQuery } from '@tanstack/react-query';
import { store } from '@/api/store';

export function useSettings() {
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => store.settings.list(),
  });
  const settingsRaw = Array.isArray(settingsData) ? settingsData : [];

  const settings = {};
  settingsRaw.forEach(s => {
    settings[s.setting_key] = s;
  });

  const getSetting = (key, fallback = '') => {
    return settings[key]?.setting_value || fallback;
  };

  return { settings, getSetting, isLoading, settingsRaw };
}