import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronDown, Grid2x2, MapPin, Search as SearchIcon, SlidersHorizontal } from "lucide-react-native";

import { api } from "../api/client";
import {
  CATEGORY_GROUPS,
  CATEGORY_ICON_MAP,
  COLORS,
  getSubcategoriesForCategory,
  normalizeBusinessCategories,
  normalizeBusinessClassification,
  PRICE_FILTERS,
  SUBCATEGORY_ICON_MAP
} from "../constants";
import { AppButton, BottomTabs, BusinessCard, Card, CategoryPill, ChipRow, EmptyState, styles } from "../components/ui";

const tabs = [
  { label: "Home", value: "home" },
  { label: "Browse", value: "browse" },
  { label: "Bookings", value: "bookings" },
  { label: "Settings", value: "settings" }
];

const SORT_OPTIONS = [
  { label: "Most relevant", value: "relevant" },
  { label: "Newest added", value: "newest" },
  { label: "Top rated", value: "rating" },
  { label: "Most reviewed", value: "reviews" },
  { label: "Price: low to high", value: "price-low" },
  { label: "Price: high to low", value: "price-high" }
];

const CATEGORY_CARD_META = {
  "Sports & Turfs": "#22C55E",
  "Events & Venues": "#8B5CF6",
  "Equipment Rental": "#243B63",
  "Stay & Dining": "#F59E0B",
  "Wellness & Lifestyle": "#EC4899",
  "Entertainment & Leisure": "#14B8A6"
};

const SUBCATEGORY_COLOR_MAP = {
  "Football Turf": "#22C55E",
  Badminton: "#10B981",
  Basketball: "#F97316",
  Volleyball: "#EAB308",
  "Swimming Pool": "#06B6D4",
  "Event Hall": "#8B5CF6",
  Karaoke: "#A855F7",
  Camping: "#84CC16",
  "Sound Systems": "#243B63",
  "Chair Rentals": "#64748B",
  "Wedding Decoration Services": "#EC4899",
  "Musical Instruments": "#7C3AED",
  "Bike Rentals": "#0F766E",
  "Car Rentals": "#2563EB",
  "Lighting Equipment": "#F59E0B",
  "Photography Equipment": "#DC2626",
  "Catering Services": "#F97316",
  Hotel: "#F59E0B",
  Resort: "#14B8A6",
  Restaurant: "#EA580C",
  "Barber Shop": "#3B82F6",
  Salon: "#EC4899",
  Spa: "#8B5CF6",
  Gym: "#EF4444",
  "Gaming Zone": "#14B8A6",
  "Photography Studio": "#6366F1",
  "Pool / Snooker": "#0EA5E9"
};

export function BrowseScreen({ activeTab, initialCategory = "", initialSubcategory = "", onTabChange, onOpenBusiness, onError }) {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [price, setPrice] = useState("all");
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showSearchControls, setShowSearchControls] = useState(false);
  const [sortBy, setSortBy] = useState("relevant");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null);
  const requestId = useRef(0);
  const sortChipRef = useRef(null);
  const searchInputRef = useRef(null);

  const subcategoryOptions = useMemo(() => getSubcategoriesForCategory(category), [category]);

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    setCategory(initialCategory || "");
    setSubcategory(initialSubcategory || "");
    setShowCategories(false);
  }, [initialCategory, initialSubcategory]);

  useEffect(() => {
    if (!showSearchControls) return undefined;
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [showSearchControls]);

  async function loadBusinesses(options = {}) {
    Keyboard.dismiss();
    const nextSearch = options.search ?? search;
    const nextLocation = options.location ?? location;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    const query = new URLSearchParams();
    if (options.resetView) {
      setHasLoaded(false);
    }
    if (nextSearch.trim()) query.set("search", nextSearch.trim());
    if (nextLocation.trim()) query.set("location", nextLocation.trim());
    try {
      setLoading(true);
      const payload = await api(`/businesses${query.toString() ? `?${query}` : ""}`);
      if (requestId.current !== currentRequest) return;
      setBusinesses(payload.data.businesses || []);
    } catch (error) {
      if (requestId.current === currentRequest) onError(error);
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  }

  const filtered = useMemo(() => {
    const activeRange = PRICE_FILTERS.find((item) => item.value === price);
    const searchTerm = search.trim().toLowerCase();
    const locationTerm = location.trim().toLowerCase();

    const results = businesses.filter((business) => {
      const classification = normalizeBusinessClassification(business);
      const categories = normalizeBusinessCategories(business);

      if (category && !categories.includes(category)) return false;
      if (subcategory && classification.subcategory !== subcategory) return false;

      const matchesSearch = !searchTerm || [
        business.name,
        business.display_tag,
        ...categories,
        classification.subcategory,
        business.custom_category
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm));

      const matchesLocation = !locationTerm || String(business.location || "").toLowerCase().includes(locationTerm);

      if (!matchesSearch || !matchesLocation) return false;
      if (!activeRange || activeRange.value === "all") return true;
      const amount = Number(business.price_per_hour || 0);
      if (activeRange.min !== undefined && amount < activeRange.min) return false;
      if (activeRange.max !== undefined && amount > activeRange.max) return false;
      return true;
    });

    return [...results].sort((left, right) => {
      if (sortBy === "newest") {
        return String(right.created_at || "").localeCompare(String(left.created_at || ""));
      }
      if (sortBy === "rating") {
        const ratingDiff = Number(right.average_rating || 0) - Number(left.average_rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return Number(right.review_count || 0) - Number(left.review_count || 0);
      }
      if (sortBy === "reviews") {
        const reviewDiff = Number(right.review_count || 0) - Number(left.review_count || 0);
        if (reviewDiff !== 0) return reviewDiff;
        return Number(right.average_rating || 0) - Number(left.average_rating || 0);
      }
      if (sortBy === "price-low") {
        return Number(left.price_per_hour || 0) - Number(right.price_per_hour || 0);
      }
      if (sortBy === "price-high") {
        return Number(right.price_per_hour || 0) - Number(left.price_per_hour || 0);
      }

      const featuredDiff = Number(Boolean(right.is_featured)) - Number(Boolean(left.is_featured));
      if (featuredDiff !== 0) return featuredDiff;
      const rightExact = searchTerm && String(right.name || "").toLowerCase() === searchTerm ? 1 : 0;
      const leftExact = searchTerm && String(left.name || "").toLowerCase() === searchTerm ? 1 : 0;
      const exactNameDiff = rightExact - leftExact;
      if (exactNameDiff !== 0) return exactNameDiff;
      const reviewDiff = Number(right.review_count || 0) - Number(left.review_count || 0);
      if (reviewDiff !== 0) return reviewDiff;
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }, [businesses, category, subcategory, location, price, search, sortBy]);

  function clearCategoryFilters() {
    setCategory("");
    setSubcategory("");
  }

  function resetBrowseView() {
    setSearch("");
    setLocation("");
    setCategory("");
    setSubcategory("");
    setPrice("all");
    setShowCategories(false);
    setShowSearchControls(false);
    loadBusinesses({ search: "", location: "", resetView: true });
  }

  function openSortMenu() {
    if (!sortChipRef.current?.measureInWindow) {
      setShowSortMenu((value) => !value);
      return;
    }

    sortChipRef.current.measureInWindow((x, y, width, height) => {
      setSortMenuAnchor({ x, y, width, height });
      setShowSortMenu((value) => !value);
    });
  }

  function toggleSearchControls() {
    setShowSearchControls((value) => !value);
  }

  const categorySummary = subcategory || category || "All Categories";
  const activeSortLabel = SORT_OPTIONS.find((item) => item.value === sortBy)?.label || "Most relevant";

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoiding}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, styles.withTabs]}
          initialNumToRender={6}
          windowSize={5}
          removeClippedSubviews={false}
          ListHeaderComponent={(
            <View>
              <View style={screenStyles.topHeader}>
                <Pressable style={({ pressed }) => [screenStyles.brandPressable, pressed && styles.pressed]} onPress={resetBrowseView}>
                  <Text style={screenStyles.brandText}>Booklify <Text style={screenStyles.brandAiText}>AI</Text></Text>
                </Pressable>
                <View style={screenStyles.headerActions}>
                  <Pressable
                    accessibilityLabel={showSearchControls ? "Hide search" : "Show search"}
                    style={({ pressed }) => [screenStyles.headerIconButton, showSearchControls && screenStyles.headerIconButtonActive, pressed && styles.pressed]}
                    onPress={toggleSearchControls}
                  >
                    <SearchIcon color={COLORS.accent} size={22} strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>
              {showSearchControls ? (
                <View style={screenStyles.searchControls}>
                  <View style={screenStyles.searchShell}>
                    <SearchIcon color={COLORS.light} size={18} strokeWidth={2} />
                    <TextInput
                      ref={searchInputRef}
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search business, category, or subcategory"
                      placeholderTextColor={COLORS.light}
                      returnKeyType="search"
                      onSubmitEditing={loadBusinesses}
                      style={screenStyles.searchInput}
                    />
                  </View>
                  <View style={screenStyles.locationRow}>
                    <View style={screenStyles.locationFieldWrap}>
                      <Text style={styles.label}>Location</Text>
                      <View style={screenStyles.locationShell}>
                        <MapPin color={COLORS.light} size={18} strokeWidth={2} />
                        <TextInput
                          value={location}
                          onChangeText={setLocation}
                          placeholder="Location"
                          placeholderTextColor={COLORS.light}
                          returnKeyType="search"
                          onSubmitEditing={loadBusinesses}
                          style={screenStyles.locationInput}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
              <Card style={screenStyles.categoryCard}>
                <View style={screenStyles.categoryCardHeader}>
                  <View style={screenStyles.categoryCardIcon}>
                    <Grid2x2 color={COLORS.accent} size={18} strokeWidth={2} />
                  </View>
                  <View style={screenStyles.categoryCardCopy}>
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                      numberOfLines={1}
                      style={screenStyles.categorySummaryText}
                    >
                      {categorySummary}
                    </Text>
                    <Text numberOfLines={1} style={screenStyles.categorySubtitle}>Explore venues and services</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [screenStyles.browseCategoriesButton, pressed && styles.pressed]}
                    onPress={() => setShowCategories(!showCategories)}
                  >
                    <Text numberOfLines={1} style={screenStyles.browseCategoriesButtonText}>{showCategories ? "Hide" : "Browse categories"} ›</Text>
                  </Pressable>
                </View>
                {showCategories ? (
                  <>
                    <Text style={[styles.label, screenStyles.categoriesLabel]}>Main categories</Text>
                    <View style={screenStyles.twoColumnGrid}>
                      {CATEGORY_GROUPS.map((item) => (
                        <View key={item.value} style={screenStyles.gridItem}>
                          <CategoryPill
                            active={category === item.value}
                            compact
                            icon={CATEGORY_ICON_MAP[item.value] || "shape-outline"}
                            iconColor="#FFFFFF"
                            iconWrapStyle={{ backgroundColor: CATEGORY_CARD_META[item.value] || COLORS.accentSoft }}
                            label={item.label}
                            onPress={() => {
                              setCategory(item.value);
                              setSubcategory("");
                            }}
                            style={screenStyles.gridPill}
                          />
                        </View>
                      ))}
                    </View>
                    {category ? (
                      <>
                        <View style={[styles.browseCategoryHeader, screenStyles.subcategoryHeader]}>
                          <Text style={styles.businessName}>Subcategories</Text>
                          <AppButton variant="secondary" style={screenStyles.clearButton} onPress={clearCategoryFilters}>Clear</AppButton>
                        </View>
                        <View style={screenStyles.twoColumnGrid}>
                          {subcategoryOptions.map((item) => (
                            <View key={item.value} style={screenStyles.gridItem}>
                              <CategoryPill
                                active={subcategory === item.value}
                                compact
                                icon={SUBCATEGORY_ICON_MAP[item.value] || "shape-outline"}
                                iconColor="#FFFFFF"
                                iconWrapStyle={{ backgroundColor: SUBCATEGORY_COLOR_MAP[item.value] || CATEGORY_CARD_META[category] || COLORS.accentSoft }}
                                label={item.label}
                                onPress={() => setSubcategory(item.value)}
                                style={screenStyles.gridPill}
                              />
                            </View>
                          ))}
                        </View>
                      </>
                    ) : null}
                  </>
                ) : null}
              </Card>
              <ChipRow items={PRICE_FILTERS} selected={price} onSelect={setPrice} />
              <View style={screenStyles.resultsHeader}>
                <Text numberOfLines={1} style={[styles.sectionTitleText, screenStyles.resultsTitle]}>{loading && !hasLoaded ? "Finding places" : `${filtered.length} places found`}</Text>
                <View style={screenStyles.sortWrap}>
                  <Pressable ref={sortChipRef} style={({ pressed }) => [screenStyles.sortChip, pressed && styles.pressed]} onPress={openSortMenu}>
                    <SlidersHorizontal color={COLORS.light} size={14} strokeWidth={2} />
                    <Text style={screenStyles.sortChipText}>{activeSortLabel}</Text>
                    <ChevronDown color={COLORS.light} size={14} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
              {loading && !hasLoaded ? (
                <Card>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={[styles.emptyText, { marginTop: 10 }]}>Loading businesses...</Text>
                </Card>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => <BusinessCard business={item} enhanced onPress={onOpenBusiness} />}
          ListEmptyComponent={!loading && hasLoaded ? <EmptyState>No businesses found for these filters.</EmptyState> : null}
        />
      </KeyboardAvoidingView>
      <Modal animationType="fade" transparent visible={showSortMenu} onRequestClose={() => setShowSortMenu(false)}>
        <Pressable style={screenStyles.sortModalOverlay} onPress={() => setShowSortMenu(false)}>
          {sortMenuAnchor ? (
            <View
              style={[
                screenStyles.sortMenuCard,
                {
                  left: Math.max(16, sortMenuAnchor.x + sortMenuAnchor.width - Math.max(180, sortMenuAnchor.width)),
                  top: sortMenuAnchor.y + sortMenuAnchor.height + 6,
                  width: Math.max(180, sortMenuAnchor.width)
                }
              ]}
            >
              {SORT_OPTIONS.map((item) => {
                const active = item.value === sortBy;
                return (
                  <Pressable
                    key={item.value}
                    style={({ pressed }) => [screenStyles.sortMenuItem, active && screenStyles.sortMenuItemActive, pressed && styles.pressed]}
                    onPress={() => {
                      setSortBy(item.value);
                      setShowSortMenu(false);
                    }}
                  >
                    <Text style={[screenStyles.sortMenuText, active && screenStyles.sortMenuTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
      <BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  brandAiText: {
    color: COLORS.accent
  },
  brandPressable: {
    flex: 1,
    minWidth: 0
  },
  brandText: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900"
  },
  browseCategoriesButton: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
    flexShrink: 0
  },
  browseCategoriesButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900"
  },
  categoryCard: {
    borderRadius: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  categoryCardCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  categoryCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 58
  },
  categorySummaryText: {
    color: COLORS.text,
    flexShrink: 1,
    fontSize: 19,
    fontWeight: "900",
    includeFontPadding: false,
    lineHeight: 24
  },
  categoryCardIcon: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  categorySubtitle: {
    color: COLORS.light,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  categoriesLabel: {
    marginBottom: 10,
    marginTop: 16
  },
  clearButton: {
    minHeight: 36
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14
  },
  headerIconButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    position: "relative",
    width: 38
  },
  headerIconButtonActive: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999
  },
  headerNotificationDot: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    height: 6,
    position: "absolute",
    right: 7,
    top: 7,
    width: 6
  },
  gridItem: {
    width: "48.5%"
  },
  gridPill: {
    flexBasis: "auto",
    width: "100%"
  },
  locationFieldWrap: {
    flex: 1,
    gap: 8
  },
  locationInput: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 54
  },
  locationRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 12,
    marginBottom: 16
  },
  locationShell: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 14
  },
  resultsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    marginTop: 4
  },
  resultsTitle: {
    flex: 1,
    minWidth: 0
  },
  searchButton: {
    alignSelf: "flex-end",
    minHeight: 54,
    minWidth: 116,
    paddingHorizontal: 16
  },
  searchControls: {
    marginTop: 12
  },
  searchInput: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 56
  },
  searchShell: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    minHeight: 60,
    paddingHorizontal: 16
  },
  sortChip: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  sortMenuCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 12,
    overflow: "hidden",
    padding: 0,
    position: "absolute",
    zIndex: 30
  },
  sortMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sortMenuItemActive: {
    backgroundColor: COLORS.accentSoft
  },
  sortMenuText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800"
  },
  sortMenuTextActive: {
    color: COLORS.accent
  },
  sortChipText: {
    color: COLORS.light,
    fontSize: 12,
    fontWeight: "800"
  },
  sortWrap: {
    flexShrink: 0,
    zIndex: 40
  },
  sortModalOverlay: {
    backgroundColor: "transparent",
    flex: 1
  },
  subcategoryHeader: {
    marginTop: 8
  },
  topHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  twoColumnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12
  }
});
