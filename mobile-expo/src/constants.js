export const API_BASE_URL = "https://phundum67.pythonanywhere.com/api";
export const DATA_BACKEND = process.env.EXPO_PUBLIC_DATA_BACKEND || "flask";

export const COLORS = {
  background: "#F7F7F7",
  surface: "#FFFFFF",
  surfaceSoft: "#F8F8F8",
  border: "#E5E7EB",
  text: "#111111",
  muted: "#555555",
  light: "#888888",
  accent: "#4B5563",
  accentSoft: "#E5E7EB",
  danger: "#4B5563",
  dangerSoft: "#E5E7EB",
  shadow: "#111111"
};

export const CATEGORY_GROUPS = [
  {
    label: "Sports & Turfs",
    value: "Sports & Turfs",
    icon: "soccer-field",
    subcategories: [
      { label: "Football Turf", value: "Football Turf", icon: "soccer" },
      { label: "Badminton", value: "Badminton", icon: "badminton" },
      { label: "Basketball", value: "Basketball", icon: "basketball" },
      { label: "Volleyball", value: "Volleyball", icon: "volleyball" },
      { label: "Swimming Pool", value: "Swimming Pool", icon: "pool" }
    ]
  },
  {
    label: "Events & Venues",
    value: "Events & Venues",
    icon: "party-popper",
    subcategories: [
      { label: "Event Hall", value: "Event Hall", icon: "office-building-outline" },
      { label: "Karaoke", value: "Karaoke", icon: "microphone-outline" },
      { label: "Camping", value: "Camping", icon: "tent" }
    ]
  },
  {
    label: "Equipment Rental",
    value: "Equipment Rental",
    icon: "toolbox-outline",
    subcategories: [
      { label: "Sound Systems", value: "Sound Systems", icon: "speaker-wireless" },
      { label: "Chair Rentals", value: "Chair Rentals", icon: "chair-rolling" },
      { label: "Washing Service", value: "Washing Service", icon: "washing-machine" },
      { label: "Wedding Decoration Services", value: "Wedding Decoration Services", icon: "party-popper" },
      { label: "Musical Instruments", value: "Musical Instruments", icon: "music-clef-treble" },
      { label: "Bike Rentals", value: "Bike Rentals", icon: "motorbike" },
      { label: "Car Rentals", value: "Car Rentals", icon: "car-outline" },
      { label: "Lighting Equipment", value: "Lighting Equipment", icon: "lightbulb-outline" },
      { label: "Photography Equipment", value: "Photography Equipment", icon: "camera-outline" }
    ]
  },
  {
    label: "Stay & Dining",
    value: "Stay & Dining",
    icon: "bed-outline",
    subcategories: [
      { label: "Catering Services", value: "Catering Services", icon: "silverware-fork-knife" },
      { label: "Hotel", value: "Hotel", icon: "bed-outline" },
      { label: "Resort", value: "Resort", icon: "palm-tree" },
      { label: "Restaurant", value: "Restaurant", icon: "silverware-fork-knife" }
    ]
  },
  {
    label: "Wellness & Lifestyle",
    value: "Wellness & Lifestyle",
    icon: "spa-outline",
    subcategories: [
      { label: "Barber Shop", value: "Barber Shop", icon: "content-cut" },
      { label: "Salon", value: "Salon", icon: "hair-dryer-outline" },
      { label: "Spa", value: "Spa", icon: "spa-outline" },
      { label: "Gym", value: "Gym", icon: "dumbbell" }
    ]
  },
  {
    label: "Entertainment & Leisure",
    value: "Entertainment & Leisure",
    icon: "gamepad-variant-outline",
    subcategories: [
      { label: "Custom Service", value: "Custom Service", icon: "shape-outline" },
      { label: "Jamming", value: "Jamming", icon: "music-note-outline" },
      { label: "Sound Studio", value: "Sound Studio", icon: "microphone-outline" },
      { label: "Gaming Zone", value: "Gaming Zone", icon: "gamepad-variant-outline" },
      { label: "Photography Studio", value: "Photography Studio", icon: "image-outline" },
      { label: "Pool / Snooker", value: "Pool / Snooker", icon: "billiards-rack" }
    ]
  }
];

export const CATEGORIES = CATEGORY_GROUPS.map((item) => item.value);
export const CATEGORY_ICON_MAP = Object.fromEntries(CATEGORY_GROUPS.map((item) => [item.value, item.icon]));
export const CATEGORY_SUBCATEGORY_MAP = Object.fromEntries(
  CATEGORY_GROUPS.map((item) => [item.value, item.subcategories.map((subitem) => subitem.value)])
);
export const SUBCATEGORY_ICON_MAP = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((item) => item.subcategories.map((subitem) => [subitem.value, subitem.icon]))
);

const LEGACY_CATEGORY_MAP = {
  "Sports & Turf": {
    category: "Sports & Turfs",
    defaultSubcategory: "Football Turf",
    subcategoryMap: {
      Turf: "Football Turf",
      Badminton: "Badminton",
      Basketball: "Basketball",
      Volleyball: "Volleyball"
    }
  },
  Pool: { category: "Sports & Turfs", defaultSubcategory: "Swimming Pool" },
  "Event Hall": { category: "Events & Venues", defaultSubcategory: "Event Hall" },
  Karaoke: { category: "Events & Venues", defaultSubcategory: "Karaoke" },
  Camping: { category: "Events & Venues", defaultSubcategory: "Camping" },
  Sound: { category: "Equipment Rental", defaultSubcategory: "Sound Systems" },
  "Washing Service": { category: "Equipment Rental", defaultSubcategory: "Washing Service" },
  "Bike Rental": { category: "Equipment Rental", defaultSubcategory: "Bike Rentals" },
  "Car Rental": { category: "Equipment Rental", defaultSubcategory: "Car Rentals" },
  Hotel: { category: "Stay & Dining", defaultSubcategory: "Hotel" },
  Resort: { category: "Stay & Dining", defaultSubcategory: "Resort" },
  Restaurant: { category: "Stay & Dining", defaultSubcategory: "Restaurant" },
  "Barber Shop": { category: "Wellness & Lifestyle", defaultSubcategory: "Barber Shop" },
  Salon: { category: "Wellness & Lifestyle", defaultSubcategory: "Salon" },
  Spa: { category: "Wellness & Lifestyle", defaultSubcategory: "Spa" },
  Gym: { category: "Wellness & Lifestyle", defaultSubcategory: "Gym" },
  "Custom Service": { category: "Entertainment & Leisure", defaultSubcategory: "Custom Service" },
  Jamming: { category: "Entertainment & Leisure", defaultSubcategory: "Jamming" },
  "Sound Studio": { category: "Entertainment & Leisure", defaultSubcategory: "Sound Studio" },
  "Gaming Zone": { category: "Entertainment & Leisure", defaultSubcategory: "Gaming Zone" },
  "Photography Studio": { category: "Entertainment & Leisure", defaultSubcategory: "Photography Studio" }
};

export const SPORTS_SUBCATEGORIES = CATEGORY_SUBCATEGORY_MAP["Sports & Turfs"];

export function getSubcategoriesForCategory(category) {
  return CATEGORY_GROUPS.find((item) => item.value === category)?.subcategories || [];
}

function normalizeSingleCategory(rawCategory, rawSubcategory) {
  if (CATEGORY_SUBCATEGORY_MAP[rawCategory]) {
    return {
      category: rawCategory,
      subcategory: rawSubcategory || ""
    };
  }

  const legacy = LEGACY_CATEGORY_MAP[rawCategory];
  if (legacy) {
    const mappedSubcategory =
      legacy.subcategoryMap?.[rawSubcategory] ||
      (CATEGORY_SUBCATEGORY_MAP[legacy.category] || []).find((item) => item === rawSubcategory) ||
      legacy.defaultSubcategory ||
      "";

    return {
      category: legacy.category,
      subcategory: mappedSubcategory
    };
  }

  return {
    category: rawCategory || "",
    subcategory: rawSubcategory || ""
  };
}

export function normalizeBusinessCategories(input, explicitSubcategory) {
  const rawCategory = typeof input === "object" ? input?.category : input;
  const rawSubcategory = typeof input === "object" ? input?.subcategory : explicitSubcategory;
  const rawCategories = typeof input === "object" ? input?.categories : null;

  const normalized = [];

  if (Array.isArray(rawCategories)) {
    rawCategories.forEach((item) => {
      const resolved = normalizeSingleCategory(item, rawSubcategory).category;
      if (resolved && !normalized.includes(resolved)) {
        normalized.push(resolved);
      }
    });
  }

  if (!normalized.length) {
    const resolved = normalizeSingleCategory(rawCategory, rawSubcategory).category;
    if (resolved) {
      normalized.push(resolved);
    }
  }

  return normalized;
}

export function normalizeBusinessClassification(input, explicitSubcategory) {
  const rawCategory = typeof input === "object" ? input?.category : input;
  const rawSubcategory = typeof input === "object" ? input?.subcategory : explicitSubcategory;
  const categories = normalizeBusinessCategories(input, explicitSubcategory);
  const primaryCategory = categories[0] || rawCategory || "";
  const normalized = normalizeSingleCategory(primaryCategory, rawSubcategory);

  return {
    category: normalized.category || "",
    subcategory: normalized.subcategory || "",
    categories
  };
}

export const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "INR ₹" },
  { code: "USD", symbol: "$", label: "USD $" },
  { code: "EUR", symbol: "€", label: "EUR €" },
  { code: "GBP", symbol: "£", label: "GBP £" },
  { code: "AUD", symbol: "A$", label: "AUD A$" },
  { code: "CAD", symbol: "C$", label: "CAD C$" }
];

export const PRICE_FILTERS = [
  { label: "All prices", value: "all" },
  { label: "Below 1000", value: "below-1000", min: 0, max: 999 },
  { label: "1000-1500", value: "1000-1500", min: 1000, max: 1500 },
  { label: "1500-2000", value: "1500-2000", min: 1500, max: 2000 },
  { label: "Above 2000", value: "above-2000", min: 2001 }
];

export const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=70";
