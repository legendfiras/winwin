import React, { useMemo } from 'react';
import { countryOptions, parseLocalPhone } from '@/lib/countries';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SELECT_CLASS =
  'flex h-9 w-full rounded-[10px] border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// Country picker plus phone field. Choosing a country fills in its calling
// code (+961 for Lebanon), so customers only type the local number.
export default function CountryPhoneInput({ country, localPhone, onChange, required = false, phoneLabel = 'Phone Number' }) {
  const countries = useMemo(() => countryOptions(), []);
  const selected = countries.find((c) => c.name === country) || null;
  const dial = selected?.dial || '';

  const onCountryChange = (name) => {
    const next = countries.find((c) => c.name === name);
    onChange({ country: name, localPhone: parseLocalPhone(localPhone, next?.dial || '') });
  };

  return (
    <>
      <div>
        <Label>Country</Label>
        <select
          className={SELECT_CLASS}
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          required={required}
          autoComplete="country-name"
        >
          <option value="" disabled>Select your country</option>
          {countries.map((c) => (
            <option key={c.iso} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>{phoneLabel}</Label>
        <div className="flex gap-2">
          <Input
            className="w-[5.5rem] shrink-0 text-center px-2"
            value={dial ? `+${dial}` : ''}
            readOnly
            tabIndex={-1}
            aria-label="Country calling code"
          />
          <Input
            value={localPhone}
            onChange={(e) => onChange({ country, localPhone: parseLocalPhone(e.target.value, dial) })}
            required={required}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={dial === '961' ? '71XXXXXX' : 'Phone number'}
          />
        </div>
      </div>
    </>
  );
}
