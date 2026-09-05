export const CATEGORY_LABELS = {
  home_appliance: 'Home Appliance',
  home_essentials: 'Home Essentials',
  phone_accessories: 'Phone Accessories',
  toys: 'Kids & Toys',
  new_gadgets: 'New Gadgets',
  must_have: 'Must Have',
  beauty_care: 'Beauty Care',
  fans: 'Fans',
  shavers: 'Shavers',
  silkapils: 'Silkapils',
  hair_care: 'Hair Care',
};

export const PRIMARY_CATEGORIES = [
  { key: 'all', label: 'All', keys: null },
  { key: 'home', label: 'Home & Kitchen', keys: ['home_appliance', 'home_essentials', 'fans'] },
  { key: 'electronics', label: 'Electronics', keys: ['phone_accessories'] },
  { key: 'beauty', label: 'Beauty & Personal Care', keys: ['beauty_care', 'shavers', 'silkapils', 'hair_care'] },
  { key: 'toys', label: 'Kids & Toys', keys: ['toys'] },
];

export const MORE_CATEGORIES = [
  { key: 'new_gadgets', label: 'New Gadgets', keys: ['new_gadgets'] },
  { key: 'must_have', label: 'Must Have', keys: ['must_have'] },
  { key: 'home_appliance', label: 'Home Appliance', keys: ['home_appliance'] },
  { key: 'home_essentials', label: 'Home Essentials', keys: ['home_essentials'] },
  { key: 'phone_accessories', label: 'Phone Accessories', keys: ['phone_accessories'] },
  { key: 'beauty_care', label: 'Beauty Care', keys: ['beauty_care'] },
  { key: 'fans', label: 'Fans', keys: ['fans'] },
  { key: 'shavers', label: 'Shavers', keys: ['shavers'] },
  { key: 'silkapils', label: 'Silkapils', keys: ['silkapils'] },
  { key: 'hair_care', label: 'Hair Care', keys: ['hair_care'] },
];

const ALL_FILTERS = [...PRIMARY_CATEGORIES, ...MORE_CATEGORIES];

export function categoryLabel(key) {
  if (!key) return '';
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  const group = ALL_FILTERS.find((item) => item.key === key);
  return group?.label || String(key).replace(/_/g, ' ');
}

export function categoryMatches(productCategory, filterKey) {
  if (!filterKey || filterKey === 'all') return true;
  const filter = ALL_FILTERS.find((item) => item.key === filterKey);
  if (filter?.keys) return filter.keys.includes(productCategory);
  return productCategory === filterKey;
}

export function matchesSearch(product, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    product?.name,
    product?.description,
    product?.category,
    categoryLabel(product?.category),
    product?.brand,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export function sortProducts(products, sort) {
  const items = Array.isArray(products) ? [...products] : [];
  if (sort === 'newest') {
    return items.sort(
      (a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime(),
    );
  }
  if (sort === 'price_asc') {
    return items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  }
  if (sort === 'price_desc') {
    return items.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }
  return items;
}
