export const PRODUCTS_PER_PAGE = 30;

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
  hair_care: 'Hair Care',
};

export const CANONICAL_CATEGORIES = [
  'home_appliance',
  'home_essentials',
  'phone_accessories',
  'toys',
  'new_gadgets',
  'must_have',
  'beauty_care',
  'fans',
  'shavers',
  'hair_care',
];

const CANONICAL_SET = new Set(CANONICAL_CATEGORIES);

/**
 * Real WinWin catalog aliases (imported/legacy values → canonical key).
 * Derived from Product_export.csv + D1/products.json — not invented names.
 * `silkapils` is a product line (Silk-épil), not a store category.
 */
export const CATEGORY_ALIASES = {
  silkapils: 'beauty_care',
  silkepil: 'beauty_care',
  silkapil: 'beauty_care',
  silk_epil: 'beauty_care',
  'silk epil': 'beauty_care',
  kids_toys: 'toys',
  kids: 'toys',
  'kids & toys': 'toys',
  kidstoys: 'toys',
  accessory: 'phone_accessories',
  accessories: 'phone_accessories',
  phone_accessory: 'phone_accessories',
  homeappliance: 'home_appliance',
  homeessentials: 'home_essentials',
  phoneaccessories: 'phone_accessories',
  newgadgets: 'new_gadgets',
  musthave: 'must_have',
  beautycare: 'beauty_care',
  haircare: 'hair_care',
  'home appliance': 'home_appliance',
  'home essentials': 'home_essentials',
  'phone accessories': 'phone_accessories',
  'new gadgets': 'new_gadgets',
  'must have': 'must_have',
  'beauty care': 'beauty_care',
  'hair care': 'hair_care',
  'kids and toys': 'toys',
};

/** Product ids whose stored category was clearly wrong (never delete the product). */
export const PRODUCT_CATEGORY_OVERRIDES = {
  '6a5a76d47374dd84909cd013': 'home_essentials', // spice rack imported as phone_accessories
};

export const PRIMARY_CATEGORIES = [
  { key: 'home', label: 'Home & Kitchen', keys: ['home_appliance', 'home_essentials', 'fans'] },
  { key: 'electronics', label: 'Electronics', keys: ['phone_accessories'] },
  { key: 'beauty', label: 'Beauty & Personal Care', keys: ['beauty_care', 'shavers', 'hair_care', 'silkapils'] },
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
  { key: 'hair_care', label: 'Hair Care', keys: ['hair_care'] },
];

export const ADMIN_CATEGORIES = CANONICAL_CATEGORIES.map((key) => ({
  key,
  label: CATEGORY_LABELS[key],
}));

const ALL_FILTERS = [...PRIMARY_CATEGORIES, ...MORE_CATEGORIES];

export function normalizeCategory(value) {
  if (value == null) return 'must_have';
  const trimmed = String(value).trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'must_have';
  const lower = trimmed.toLowerCase();
  const slug = lower.replace(/[\s-]+/g, '_');
  if (CATEGORY_ALIASES[trimmed]) return CATEGORY_ALIASES[trimmed];
  if (CATEGORY_ALIASES[lower]) return CATEGORY_ALIASES[lower];
  if (CATEGORY_ALIASES[slug]) return CATEGORY_ALIASES[slug];
  if (CANONICAL_SET.has(slug)) return slug;
  return slug;
}

export function resolveProductCategory(product) {
  const override = product?.id ? PRODUCT_CATEGORY_OVERRIDES[product.id] : null;
  if (override) return override;
  return normalizeCategory(product?.category);
}

export function categoryLabel(key) {
  if (!key) return '';
  const canonical = normalizeCategory(key);
  if (CATEGORY_LABELS[canonical]) return CATEGORY_LABELS[canonical];
  const group = ALL_FILTERS.find((item) => item.key === key || item.key === canonical);
  return group?.label || String(canonical).replace(/_/g, ' ');
}

export function categoryKeysForFilter(filterKey) {
  if (!filterKey || filterKey === 'all') return null;
  const filter = ALL_FILTERS.find((item) => item.key === filterKey);
  if (filter?.keys) return filter.keys;
  const canonical = normalizeCategory(filterKey);
  return canonical ? [canonical] : [filterKey];
}

export function categoryMatches(productCategory, filterKey) {
  const keys = categoryKeysForFilter(filterKey);
  if (!keys) return true;
  const canonical = normalizeCategory(productCategory);
  return keys.includes(productCategory) || keys.includes(canonical);
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
  if (sort === 'price_asc') {
    return items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  }
  if (sort === 'price_desc') {
    return items.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }
  return items.sort(
    (a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime(),
  );
}

export function countCategories(products) {
  const counts = {};
  for (const product of Array.isArray(products) ? products : []) {
    const key = resolveProductCategory(product);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function sameKeySet(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const left = [...a].sort().join('|');
  const right = [...b].sort().join('|');
  return left === right;
}

export function isEmptyCategory(filter, counts) {
  if (!filter?.keys?.length) return true;
  return !filter.keys.some((key) => (counts?.[normalizeCategory(key)] || counts?.[key] || 0) > 0);
}

export function visibleCategoryFilters(counts) {
  const loaded = counts && typeof counts === 'object';
  const primary = PRIMARY_CATEGORIES.filter((cat) => !loaded || !isEmptyCategory(cat, counts));
  const more = MORE_CATEGORIES.filter((cat) => {
    if (loaded && isEmptyCategory(cat, counts)) return false;
    return !PRIMARY_CATEGORIES.some(
      (group) => group.key === cat.key || sameKeySet(group.keys, cat.keys),
    );
  });
  return { primary, more };
}

export function applyCatalogQuery(products, { cat, q, sort, page, limit } = {}) {
  const source = (Array.isArray(products) ? products : []).map((product) => ({
    ...product,
    category: resolveProductCategory(product),
  }));
  const perPage = Math.min(100, Math.max(1, Number(limit) || PRODUCTS_PER_PAGE));
  const filtered = sortProducts(
    source.filter((product) => categoryMatches(product.category, cat) && matchesSearch(product, q)),
    sort,
  );
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage) || 1);
  let pageNum = Math.max(1, Number(page) || 1);
  if (pageNum > pageCount) pageNum = pageCount;
  const start = (pageNum - 1) * perPage;
  return {
    items: filtered.slice(start, start + perPage),
    total,
    page: pageNum,
    limit: perPage,
    page_count: pageCount,
    category_counts: countCategories(source),
  };
}

export function paginationItems(current, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1);
  const page = Math.min(Math.max(1, Number(current) || 1), total);
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [];
  const push = (value) => {
    if (items[items.length - 1] !== value) items.push(value);
  };
  push(1);
  if (page > 3) push('ellipsis-left');
  for (let n = Math.max(2, page - 1); n <= Math.min(total - 1, page + 1); n += 1) push(n);
  if (page < total - 2) push('ellipsis-right');
  push(total);
  return items;
}
