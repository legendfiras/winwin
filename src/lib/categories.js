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
  'must_have',
  'new_gadgets',
  'home_appliance',
  'home_essentials',
  'fans',
  'phone_accessories',
  'beauty_care',
  'hair_care',
  'shavers',
  'toys',
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

/** Unique shop chips, merchandising order. No overlapping group + child labels. */
export const SHOP_CATEGORIES = CANONICAL_CATEGORIES.map((key) => ({
  key,
  label: CATEGORY_LABELS[key],
  keys: [key],
}));

/** Navbar groups. Each product category appears once; group titles are labels only. */
export const NAV_CATEGORY_GROUPS = [
  {
    key: 'featured',
    label: 'Featured',
    items: [
      { key: 'must_have', label: CATEGORY_LABELS.must_have },
      { key: 'new_gadgets', label: CATEGORY_LABELS.new_gadgets },
    ],
  },
  {
    key: 'home',
    label: 'Home & Kitchen',
    items: [
      { key: 'home_appliance', label: CATEGORY_LABELS.home_appliance },
      { key: 'home_essentials', label: CATEGORY_LABELS.home_essentials },
      { key: 'fans', label: CATEGORY_LABELS.fans },
    ],
  },
  {
    key: 'electronics',
    label: 'Electronics',
    items: [{ key: 'phone_accessories', label: CATEGORY_LABELS.phone_accessories }],
  },
  {
    key: 'beauty',
    label: 'Beauty & Personal Care',
    items: [
      { key: 'beauty_care', label: CATEGORY_LABELS.beauty_care },
      { key: 'hair_care', label: CATEGORY_LABELS.hair_care },
      { key: 'shavers', label: CATEGORY_LABELS.shavers },
    ],
  },
  {
    key: 'kids',
    label: 'Kids & Toys',
    items: [{ key: 'toys', label: CATEGORY_LABELS.toys }],
  },
];

/** Old `/?cat=home` style group URLs still work. */
export const PRIMARY_CATEGORIES = NAV_CATEGORY_GROUPS.map((group) => ({
  key: group.key,
  label: group.label,
  keys: group.items.map((item) => item.key),
}));

export const MORE_CATEGORIES = [];

export const ADMIN_CATEGORIES = CANONICAL_CATEGORIES.map((key) => ({
  key,
  label: CATEGORY_LABELS[key],
}));

const ALL_FILTERS = [...PRIMARY_CATEGORIES, ...SHOP_CATEGORIES];

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

export function parseStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    /* plain text */
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function productCategoryList(product) {
  const list = [];
  const add = (value) => {
    if (value == null || String(value).trim() === '') return;
    const key = normalizeCategory(value);
    if (!key || list.includes(key)) return;
    list.push(key);
  };
  for (const value of parseStringList(product?.categories)) add(value);
  add(product?.category);
  const override = product?.id ? PRODUCT_CATEGORY_OVERRIDES[product.id] : null;
  if (override) return [override, ...list.filter((key) => key !== override)];
  return list.length ? list : ['must_have'];
}

export function productTags(product) {
  const seen = new Set();
  const tags = [];
  for (const raw of parseStringList(product?.tags)) {
    const tag = String(raw).replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
    if (!tag) continue;
    const id = tag.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    tags.push(tag);
    if (tags.length === 10) break;
  }
  return tags;
}

export function sanitizeProductMeta(input) {
  const categories = productCategoryList(input).filter((key) => CANONICAL_SET.has(key));
  const list = categories.length ? categories : ['must_have'];
  return {
    category: list[0],
    categories: list,
    tags: productTags(input),
  };
}

export function productMatchesCategory(product, filterKey) {
  const keys = categoryKeysForFilter(filterKey);
  if (!keys) return true;
  return productCategoryList(product).some((key) => keys.includes(key) || keys.includes(normalizeCategory(key)));
}

export function matchesSearch(product, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    product?.name,
    product?.description,
    product?.category,
    ...productCategoryList(product).map((key) => `${key} ${categoryLabel(key)}`),
    ...productTags(product),
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
    for (const key of productCategoryList(product)) {
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

export function isEmptyCategory(filter, counts) {
  if (!filter?.keys?.length) return true;
  return !filter.keys.some((key) => (counts?.[normalizeCategory(key)] || counts?.[key] || 0) > 0);
}

export function visibleCategoryFilters(counts) {
  const loaded = counts && typeof counts === 'object';
  const primary = SHOP_CATEGORIES.filter((cat) => !loaded || !isEmptyCategory(cat, counts));
  return { primary, more: [] };
}

export function applyCatalogQuery(products, { cat, q, sort, page, limit } = {}) {
  const source = (Array.isArray(products) ? products : []).map((product) => {
    const categories = productCategoryList(product);
    return {
      ...product,
      category: categories[0],
      categories,
      tags: productTags(product),
    };
  });
  const perPage = Math.min(100, Math.max(1, Number(limit) || PRODUCTS_PER_PAGE));
  const filtered = sortProducts(
    source.filter((product) => productMatchesCategory(product, cat) && matchesSearch(product, q)),
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
