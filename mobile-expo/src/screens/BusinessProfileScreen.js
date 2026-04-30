import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { api } from "../api/client";
import {
  COLORS,
  CATEGORIES,
  CATEGORY_GROUPS,
  CURRENCIES,
  getSubcategoriesForCategory,
  SUBCATEGORY_ICON_MAP,
  normalizeBusinessCategories,
  normalizeBusinessClassification
} from "../constants";
import { formatTime } from "../utils/format";
import { AppButton, BottomTabs, Card, CategoryPill, Field, GalleryUploadBox, IconButton, ImageUploadBox, Screen, SectionTitle, Title, styles } from "../components/ui";

const tabs = [
  { label: "Dashboard", value: "dashboard" },
  { label: "Bookings", value: "bookings" },
  { label: "Slots", value: "slots" },
  { label: "Settings", value: "settings" }
];

const defaultCategory = CATEGORIES[0];

const defaultForm = {
  name: "",
  display_tag: "",
  categories: [defaultCategory],
  category: defaultCategory,
  subcategory: "",
  custom_category: "",
  location: "",
  phone: "",
  description: "",
  price_per_hour: "",
  currency_code: "INR",
  opening_time: "09:00",
  closing_time: "18:00",
  closed_days: "sunday",
  min_booking_hours: "1",
  max_booking_hours: "",
  buffer_time_between_slots: "0",
  image_url: "",
  gallery_images: [],
  services: []
};

function normalizeServices(value) {
  let services = value || [];
  if (typeof services === "string") {
    try {
      services = JSON.parse(services);
    } catch (_error) {
      services = [];
    }
  }
  if (!Array.isArray(services)) return [];
  return services
    .filter((service) => service && typeof service === "object")
    .map((service) => {
      const media = Array.isArray(service.media) ? service.media : Array.isArray(service.images) ? service.images : [];
      return {
        id: service.id || null,
        business_id: service.business_id || null,
        name: service.name || "",
        description: service.description || "",
        price: service.price !== undefined && service.price !== null ? String(service.price) : "",
        booking_type: service.booking_type === "daily" ? "daily" : "hourly",
        images: media,
        media
      };
    });
}

function businessToForm(business) {
  const classification = normalizeBusinessClassification(business);
  const categories = normalizeBusinessCategories(business);
  const category = categories[0] || classification.category || defaultCategory;

  return {
    ...defaultForm,
    ...business,
    categories: categories.length ? categories : [category],
    category,
    subcategory: business.subcategory || classification.subcategory || "",
    price_per_hour: business.price_per_hour ? String(business.price_per_hour) : "",
    min_booking_hours: String(business.min_booking_hours || 1),
    max_booking_hours: business.max_booking_hours ? String(business.max_booking_hours) : "",
    buffer_time_between_slots: String(business.buffer_time_between_slots || 0),
    closed_days: (business.closed_days || []).join(", "),
    gallery_images: business.gallery_images || [],
    services: normalizeServices(business.services),
    currency_code: business.currency_code || business.currency || "INR"
  };
}

function generateDisplayTag() {
  const nextValue = Math.floor(Date.now() % 10000);
  return `#${String(nextValue).padStart(4, "0")}`;
}

function formatMediaDuration(durationMillis) {
  if (!durationMillis || Number.isNaN(Number(durationMillis))) return "";
  const totalSeconds = Math.max(0, Math.round(Number(durationMillis) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizePersistedMediaItem(item) {
  if (typeof item === "string") {
    const isVideo = /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(item) || /^data:video\//i.test(item);
    return { uri: item, type: isVideo ? "video" : "image", duration: "" };
  }

  if (item && typeof item === "object" && item.uri) {
    const isVideo = item.type === "video" || /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(item.uri) || /^data:video\//i.test(item.uri);
    return {
      uri: item.uri,
      type: isVideo ? "video" : "image",
      duration: item.duration || ""
    };
  }

  return null;
}

function convert24HourTo12Hour(value) {
  const [rawHour = "09", rawMinute = "00"] = String(value || "09:00").split(":");
  const parsedHour = Number(rawHour);
  const parsedMinute = Number(rawMinute);
  if (Number.isNaN(parsedHour) || Number.isNaN(parsedMinute)) {
    return { meridiem: "AM", time: "9:00" };
  }

  const meridiem = parsedHour >= 12 ? "PM" : "AM";
  const normalizedHour = parsedHour % 12 || 12;
  return {
    meridiem,
    time: `${String(normalizedHour)}:${String(parsedMinute).padStart(2, "0")}`
  };
}

function split12HourDisplay(value) {
  const [hour = "9", minute = "00"] = String(value || "9:00").split(":");
  return {
    hour: String(hour || "").replace(/[^0-9]/g, "").slice(0, 2),
    minute: String(minute || "").replace(/[^0-9]/g, "").slice(0, 2)
  };
}

function convert12HourTo24Hour(value, meridiem) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  let nextHour = hour % 12;
  if (String(meridiem || "AM").toUpperCase() === "PM") {
    nextHour += 12;
  }

  return `${String(nextHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

async function preparePickedMedia(asset) {
  const mediaType = asset.type || (asset.mimeType || "").split("/")[0] || "image";
  const mimeType = asset.mimeType || (mediaType === "video" ? "video/mp4" : "image/jpeg");
  const uri = asset.base64 && mediaType !== "video" ? `data:${mimeType};base64,${asset.base64}` : asset.uri;

  return {
    uri,
    type: mediaType === "video" ? "video" : "image",
    duration: mediaType === "video" ? formatMediaDuration(asset.duration) : ""
  };
}

const CATEGORY_CARD_META = {
  "Sports & Turfs": {
    description: "Turf, courts and sports facilities",
    color: "#22C55E",
    icon: "soccer"
  },
  "Events & Venues": {
    description: "Halls, venues and event spaces",
    color: "#8B5CF6",
    icon: "office-building-outline"
  },
  "Equipment Rental": {
    description: "Sound, lights, instruments, vehicles and more",
    color: "#243B63",
    icon: "speaker"
  },
  "Stay & Dining": {
    description: "Hotels, homestays and restaurants",
    color: "#F59E0B",
    icon: "bed-outline"
  },
  "Wellness & Lifestyle": {
    description: "Salons, spa, fitness and personal care",
    color: "#EC4899",
    icon: "spa-outline"
  },
  "Entertainment & Leisure": {
    description: "Gaming, activities and entertainment",
    color: "#14B8A6",
    icon: "gamepad-variant-outline"
  }
};

function ProfileInputField({
  label,
  description,
  value,
  onChangeText,
  placeholder,
  icon,
  multiline,
  keyboardType,
  maxLength,
  rightAdornment,
  optional,
  onFocus
}) {
  const displayLabel = optional ? `${label} (optional)` : label;
  return (
    <View style={styles.profileFieldBlock}>
      <Text style={styles.profileFieldLabel}>{displayLabel}</Text>
      {description ? <Text style={styles.profileFieldDescription}>{description}</Text> : null}
      <View style={[styles.profileInputShell, multiline && styles.profileTextareaShell]}>
        <MaterialCommunityIcons color="#22314C" name={icon} size={22} style={styles.profileInputIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={onFocus}
          style={[styles.profileInputText, multiline && styles.profileTextareaText]}
        />
        {rightAdornment}
      </View>
      {multiline && maxLength ? <Text style={styles.profileFieldCounter}>{`${value.length}/${maxLength}`}</Text> : null}
    </View>
  );
}

export function BusinessProfileScreen({ activeTab, onBack, onTabChange, onError }) {
  const [businessId, setBusinessId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [openingDisplayTime, setOpeningDisplayTime] = useState("9:00");
  const [openingMeridiem, setOpeningMeridiem] = useState("AM");
  const [closingDisplayTime, setClosingDisplayTime] = useState("6:00");
  const [closingMeridiem, setClosingMeridiem] = useState("PM");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSearched, setLocationSearched] = useState(false);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState("");
  const [selectedLocationCoords, setSelectedLocationCoords] = useState(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(true);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [highlightedServiceIndex, setHighlightedServiceIndex] = useState(null);
  const [serviceFeedback, setServiceFeedback] = useState("");
  const [refreshingCategories, setRefreshingCategories] = useState(false);
  const [categoryWarning, setCategoryWarning] = useState("");
  const locationRequestId = useRef(0);
  const servicePulse = useRef(new Animated.Value(0)).current;
  const openingParts = split12HourDisplay(openingDisplayTime);
  const closingParts = split12HourDisplay(closingDisplayTime);
  const subcategoryOptions = Array.from(
    new Map(
      (form.categories || []).flatMap((category) => getSubcategoriesForCategory(category)).map((item) => [item.value, item])
    ).values()
  );

  function toggleCategoryPickerVisibility() {
    if (showCategoryPicker) {
      setShowCategoryPicker(false);
      setShowSubcategoryPicker(false);
      return;
    }
    setShowCategoryPicker(true);
  }

  useEffect(() => {
    loadBusiness();
  }, []);

  useEffect(() => {
    const opening = convert24HourTo12Hour(form.opening_time);
    setOpeningDisplayTime(opening.time);
    setOpeningMeridiem(opening.meridiem);

    const closing = convert24HourTo12Hour(form.closing_time);
    setClosingDisplayTime(closing.time);
    setClosingMeridiem(closing.meridiem);
  }, [form.opening_time, form.closing_time]);

  useEffect(() => {
    const query = form.location.trim();
    if (query.length < 2 || query === selectedLocationLabel) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      setLocationSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      searchLocations(query);
    }, 700);

    return () => clearTimeout(timer);
  }, [form.location, selectedLocationLabel]);

  async function loadBusiness() {
    try {
      const payload = await api("/businesses/mine");
      const business = payload.data.business;
      if (business) {
        setBusinessId(business.id);
        setForm(businessToForm(business));
        setSelectedLocationLabel(business.location || "");
      }
    } catch (error) {
      onError(error);
    }
  }

  function update(key, value) {
    if (key === "display_tag") {
      const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
      setForm({ ...form, display_tag: digits ? `#${digits}` : "" });
      return;
    }
    if (key === "location") {
      setSelectedLocationLabel("");
      setSelectedLocationCoords(null);
    }
    setForm({ ...form, [key]: value });
  }

  function updateBusinessTimePart(field, part, nextValue, meridiemOverride) {
    const currentDisplay = field === "opening_time" ? openingDisplayTime : closingDisplayTime;
    const currentMeridiem = field === "opening_time" ? openingMeridiem : closingMeridiem;
    const currentParts = split12HourDisplay(currentDisplay);
    const cleanDigits = String(nextValue || "").replace(/[^0-9]/g, "").slice(0, 2);
    const nextHour = part === "hour" ? cleanDigits : currentParts.hour;
    const nextMinute = part === "minute" ? cleanDigits : currentParts.minute;
    const nextMeridiem = meridiemOverride || currentMeridiem;
    const nextDisplay = `${nextHour || ""}:${nextMinute || ""}`;

    if (field === "opening_time") {
      setOpeningDisplayTime(nextDisplay);
      setOpeningMeridiem(nextMeridiem);
    } else {
      setClosingDisplayTime(nextDisplay);
      setClosingMeridiem(nextMeridiem);
    }

    const normalizedMinute = nextMinute.length === 1 ? `0${nextMinute}` : nextMinute;
    const converted = convert12HourTo24Hour(`${nextHour}:${normalizedMinute}`, nextMeridiem);
    if (converted) {
      setForm((current) => ({ ...current, [field]: converted }));
    }
  }

  function toggleCategorySelection(categoryValue) {
    const current = form.categories || [];
    const exists = current.includes(categoryValue);
    const nextCategories = exists
      ? current.filter((item) => item !== categoryValue)
      : [...current, categoryValue];
    const nextPrimaryCategory = nextCategories[0] || "";
    const nextSubcategoryOptions = Array.from(
      new Map(
        nextCategories.flatMap((category) => getSubcategoriesForCategory(category)).map((item) => [item.value, item])
      ).values()
    );
    const nextSubcategory = nextSubcategoryOptions.some((item) => item.value === form.subcategory) ? form.subcategory : "";

    setForm({
      ...form,
      categories: nextCategories,
      category: nextPrimaryCategory,
      subcategory: nextSubcategory
    });
    if (nextCategories.length) {
      setCategoryWarning("");
    }
  }

  async function refreshCategorySelection() {
    setRefreshingCategories(true);
    setForm((current) => ({
      ...current,
      categories: [],
      category: "",
      subcategory: "",
      custom_category: ""
    }));
    setShowCategoryPicker(true);
    setShowSubcategoryPicker(false);
    setShowCurrencyPicker(false);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setRefreshingCategories(false);
  }

  async function searchLocations(query) {
    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5"
    });

    try {
      setLocationLoading(true);
      setLocationSearched(false);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "BookifyAI-Expo/1.0"
        }
      });
      const results = await response.json();
      if (locationRequestId.current !== requestId) return;
      setLocationSuggestions(Array.isArray(results) ? results : []);
      setLocationSearched(true);
    } catch (_error) {
      if (locationRequestId.current === requestId) {
        setLocationSuggestions([]);
        setLocationSearched(true);
      }
    } finally {
      if (locationRequestId.current === requestId) {
        setLocationLoading(false);
      }
    }
  }

  function selectLocation(item) {
    const label = item.display_name || "";
    setForm({ ...form, location: label });
    setSelectedLocationLabel(label);
    setSelectedLocationCoords({ lat: item.lat, lon: item.lon });
    setLocationSuggestions([]);
    setLocationSearched(false);
  }

  function updateMainImage(value) {
    setForm({ ...form, image_url: value, profile_image: value });
  }

  function addService() {
    const nextIndex = (form.services || []).length;
    setForm({
      ...form,
      services: [...(form.services || []), { name: "", description: "", price: "", booking_type: "hourly", media: [] }]
    });
    setHighlightedServiceIndex(nextIndex);
    setServiceFeedback(`Service ${nextIndex + 1} added. Fill in the details below.`);
    servicePulse.setValue(0);
    Animated.sequence([
      Animated.timing(servicePulse, { duration: 160, toValue: 1, useNativeDriver: true }),
      Animated.timing(servicePulse, { duration: 520, toValue: 0, useNativeDriver: true })
    ]).start();
    setTimeout(() => {
      setHighlightedServiceIndex(null);
      setServiceFeedback("");
    }, 1600);
  }

  function updateService(index, key, value) {
    const services = [...(form.services || [])];
    services[index] = { ...services[index], [key]: value };
    setForm({ ...form, services });
  }

  function removeService(index) {
    setForm({ ...form, services: (form.services || []).filter((_service, serviceIndex) => serviceIndex !== index) });
  }

  async function saveBusiness() {
    if (!(form.categories || []).length) {
      setShowCategoryPicker(true);
      setShowSubcategoryPicker(true);
      setCategoryWarning("Choose at least one category. If the listed categories do not suit your business, select Custom Service.");
      return;
    }

    const safeDisplayTag = /^#[0-9]{4}$/.test(form.display_tag || "") ? form.display_tag : generateDisplayTag();
    const currency = CURRENCIES.find((item) => item.code === form.currency_code) || CURRENCIES[0];
    const submittedServices = normalizeServices(form.services).map((service) => ({
      id: service.id || null,
      business_id: service.business_id || businessId || null,
      name: service.name,
      description: service.description,
      price: service.price,
      booking_type: service.booking_type === "daily" ? "daily" : "hourly",
      images: (service.media || service.images || []).map(normalizePersistedMediaItem).filter(Boolean),
      media: (service.media || service.images || []).map(normalizePersistedMediaItem).filter(Boolean)
    }));
    const payload = {
      ...form,
      categories: form.categories || [],
      category: (form.categories || [])[0] || form.category || "",
      display_tag: safeDisplayTag,
      currency_symbol: currency.symbol,
      closed_days: form.closed_days.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
      gallery_images: form.gallery_images.map(normalizePersistedMediaItem).filter(Boolean),
      services: submittedServices,
      custom_category: form.custom_category || "",
      price_per_hour: form.price_per_hour || null,
      max_booking_hours: form.max_booking_hours || null,
      min_booking_hours: form.min_booking_hours || 1,
      buffer_time_between_slots: form.buffer_time_between_slots || 0,
      is_booking_active: true
    };

    try {
      const response = businessId
        ? await api(`/businesses/${businessId}`, { method: "PUT", body: payload })
        : await api("/businesses", { method: "POST", body: payload });
      const savedBusiness = response.data.business;
      const returnedServices = normalizeServices(savedBusiness.services);
      const businessForForm = {
        ...savedBusiness,
        services: returnedServices.length || !submittedServices.length ? returnedServices : submittedServices
      };
      setBusinessId(savedBusiness.id);
      setForm(businessToForm(businessForForm));
      onError(new Error("Business profile saved."));
    } catch (error) {
      onError(error);
    }
  }

  async function pickMainImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError(new Error("Please allow photo access to upload a business image."));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [16, 9],
      base64: true,
      mediaTypes: ["images"],
      quality: 0.7
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    const uploadedValue = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;
    updateMainImage(uploadedValue);
  }

  async function pickGalleryMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError(new Error("Please allow photo access to upload gallery media."));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      base64: true,
      mediaTypes: ["images", "videos"],
      quality: 0.7,
      selectionLimit: 10
    });

    if (result.canceled || !result.assets?.length) return;

    const selected = await Promise.all(result.assets.map(preparePickedMedia));

    setForm({ ...form, gallery_images: [...(form.gallery_images || []), ...selected] });
  }

  async function pickServiceMedia(serviceIndex) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError(new Error("Please allow photo access to upload service media."));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      base64: true,
      mediaTypes: ["images", "videos"],
      quality: 0.7,
      selectionLimit: 10
    });

    if (result.canceled || !result.assets?.length) return;

    const selected = await Promise.all(result.assets.map(preparePickedMedia));

    const services = [...(form.services || [])];
    const service = services[serviceIndex] || { media: [] };
    services[serviceIndex] = { ...service, media: [...(service.media || []), ...selected] };
    setForm({ ...form, services });
  }

  function removeGalleryMedia(index) {
    setForm({
      ...form,
      gallery_images: (form.gallery_images || []).filter((_item, itemIndex) => itemIndex !== index)
    });
  }

  function removeServiceMedia(serviceIndex, mediaIndex) {
    const services = [...(form.services || [])];
    const service = services[serviceIndex] || { media: [] };
    services[serviceIndex] = {
      ...service,
      media: (service.media || []).filter((_item, itemIndex) => itemIndex !== mediaIndex)
    };
    setForm({ ...form, services });
  }

  return (
    <Screen bottomTabs={<BottomTabs tabs={tabs} active={activeTab} onChange={onTabChange} />} onRefresh={refreshCategorySelection} refreshing={refreshingCategories}>
      <Title right={onBack ? <IconButton accessibilityLabel="Back" name="arrow-back-outline" onPress={onBack} /> : null}>Business profile</Title>
      <Text style={styles.profileSubtitle}>Add your business details to get started</Text>
      <Card>
        <ProfileInputField
          label="Business name"
          value={form.name}
          onChangeText={(value) => update("name", value)}
          placeholder="Lamka Sound Reinforcement"
          icon="storefront-outline"
        />
        <SectionTitle action={
          <AppButton variant="secondary" style={styles.profileHideButton} onPress={toggleCategoryPickerVisibility}>
            {showCategoryPicker ? "Hide categories" : "Show categories"}
          </AppButton>
        }>
          Category
        </SectionTitle>
        <Text style={styles.profileFieldDescription}>Choose the categories that match your business.</Text>
        {categoryWarning ? (
          <View style={screenStyles.categoryWarningBox}>
            <Text style={screenStyles.categoryWarningTitle}>Choose a category first</Text>
            <Text style={screenStyles.categoryWarningText}>{categoryWarning}</Text>
          </View>
        ) : null}
        {showCategoryPicker ? (
          <View style={styles.profileCategoryGrid}>
            {CATEGORY_GROUPS.map((item) => (
              <Pressable
                key={item.value}
                style={({ pressed }) => [
                  styles.profileCategoryCard,
                  (form.categories || []).includes(item.value) && styles.profileCategoryCardActive,
                  pressed && styles.pressed
                ]}
                onPress={() => toggleCategorySelection(item.value)}
              >
                <View style={[styles.profileCategoryIconBox, { backgroundColor: CATEGORY_CARD_META[item.value]?.color || COLORS.accent }]}>
                  <MaterialCommunityIcons color="#FFFFFF" name={CATEGORY_CARD_META[item.value]?.icon || item.icon} size={22} />
                </View>
                <View style={styles.profileCategoryTextWrap}>
                  <Text style={styles.profileCategoryTitle}>{item.label}</Text>
                  <Text style={styles.profileCategoryDescription}>{CATEGORY_CARD_META[item.value]?.description || ""}</Text>
                </View>
                {(form.categories || []).includes(item.value) ? (
                  <View style={styles.profileCategoryCheck}>
                    <Ionicons color="#FFFFFF" name="checkmark" size={13} />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.profileSectionDivider} />
        <View style={styles.profileFieldBlock}>
          <SectionTitle action={
            <AppButton variant="secondary" style={styles.profileHideButton} onPress={() => setShowSubcategoryPicker(!showSubcategoryPicker)}>
              {showSubcategoryPicker ? "Hide subcategories" : "Show subcategories"}
            </AppButton>
          }>
            Subcategory
          </SectionTitle>
          <Text style={styles.profileFieldDescription}>Optional: pick a type from your selected categories.</Text>
          {showSubcategoryPicker ? (
            <View style={styles.profileSubcategoryGrid}>
              {subcategoryOptions.map((item) => {
                const active = form.subcategory === item.value;
                return (
                  <View key={item.value} style={styles.profileSubcategoryItem}>
                    <CategoryPill
                      active={active}
                      compact
                      icon={SUBCATEGORY_ICON_MAP[item.value] || item.icon || "shape-outline"}
                      label={item.label}
                      onPress={() => update("subcategory", item.value)}
                      style={{ flexBasis: "auto", width: "100%" }}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
        <ProfileInputField
          label="Custom category"
          optional
          description="Add a custom label if your business doesn’t fit subcategory."
          value={form.custom_category || ""}
          onChangeText={(value) => update("custom_category", value)}
          placeholder="E.g. Drone Services, Event Support, etc."
          icon="tag-outline"
        />
        <ProfileInputField
          label="Location"
          value={form.location}
          onChangeText={(value) => update("location", value)}
          placeholder="Manipur, India"
          icon="map-marker-outline"
          rightAdornment={<Ionicons color="#22314C" name="locate-outline" size={22} style={styles.profileInputTrailingIcon} />}
        />
        {locationLoading ? (
          <View style={styles.locationSuggestionBox}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.locationHelperText}>Loading locations...</Text>
          </View>
        ) : null}
        {!locationLoading && locationSuggestions.length ? (
          <View style={styles.locationSuggestionBox}>
            {locationSuggestions.map((item) => (
              <Pressable key={`${item.place_id}-${item.lat}-${item.lon}`} style={styles.locationSuggestionItem} onPress={() => selectLocation(item)}>
                <Text style={styles.locationSuggestionTitle} numberOfLines={1}>{item.name || item.display_name}</Text>
                <Text style={styles.locationSuggestionSubtitle} numberOfLines={2}>{item.display_name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {!locationLoading && locationSearched && form.location.trim().length >= 2 && !locationSuggestions.length ? (
          <View style={styles.locationSuggestionBox}>
            <Text style={styles.locationHelperText}>No matching locations found</Text>
          </View>
        ) : null}
        {selectedLocationCoords ? <Text style={styles.fieldHint}>Location selected for future map support.</Text> : null}
        <ProfileInputField
          label="Phone"
          value={form.phone}
          onChangeText={(value) => update("phone", value)}
          placeholder="9366168895"
          icon="phone-outline"
          keyboardType="phone-pad"
        />
        <ProfileInputField
          label="Short description"
          optional
          value={form.description}
          onChangeText={(value) => update("description", value)}
          placeholder="Tell customers about your business"
          icon="text-box-outline"
          multiline
          maxLength={120}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Price/hour" value={form.price_per_hour} onChangeText={(value) => update("price_per_hour", value)} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Currency</Text>
            <View style={screenStyles.currencyFieldWrap}>
              <Pressable
                style={({ pressed }) => [
                  screenStyles.currencyButton,
                  showCurrencyPicker && screenStyles.currencyButtonOpen,
                  pressed && styles.pressed
                ]}
                onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
              >
                <Text numberOfLines={1} style={screenStyles.currencyButtonText}>
                  {CURRENCIES.find((item) => item.code === form.currency_code)?.label || "INR ₹"}
                </Text>
                <Ionicons color="#4B5563" name={showCurrencyPicker ? "chevron-up-outline" : "chevron-down-outline"} size={18} />
              </Pressable>
              {showCurrencyPicker ? (
                <View style={screenStyles.currencyMenu}>
                  {CURRENCIES.map((item, index) => {
                    const active = form.currency_code === item.code;
                    return (
                      <Pressable
                        key={item.code}
                        style={({ pressed }) => [
                          screenStyles.currencyOption,
                          index !== CURRENCIES.length - 1 && screenStyles.currencyOptionBorder,
                          active && screenStyles.currencyOptionActive,
                          pressed && styles.pressed
                        ]}
                        onPress={() => {
                          update("currency_code", item.code);
                          setShowCurrencyPicker(false);
                        }}
                      >
                        <Text style={[screenStyles.currencyOptionText, active && screenStyles.currencyOptionTextActive]}>{item.label}</Text>
                        {active ? <Ionicons color={COLORS.accent} name="checkmark-outline" size={16} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Opening</Text>
            <View style={screenStyles.timeFieldWrap}>
              <View style={screenStyles.timeInputShell}>
                <TextInput
                  value={openingParts.hour}
                  onChangeText={(value) => updateBusinessTimePart("opening_time", "hour", value)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="9"
                  placeholderTextColor="#98A2B3"
                  style={screenStyles.timeHourInput}
                />
                <Text style={screenStyles.timeColon}>:</Text>
                <TextInput
                  value={openingParts.minute}
                  onChangeText={(value) => updateBusinessTimePart("opening_time", "minute", value)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor="#98A2B3"
                  style={screenStyles.timeMinuteInput}
                />
              </View>
              <Pressable
                style={({ pressed }) => [screenStyles.timeMeridiemButton, pressed && styles.pressed]}
                onPress={() => updateBusinessTimePart("opening_time", "hour", openingParts.hour, openingMeridiem === "AM" ? "PM" : "AM")}
              >
                <Text style={screenStyles.timeMeridiemText}>{openingMeridiem}</Text>
              </Pressable>
            </View>
            <Text style={[styles.fieldHint, screenStyles.timeHint]}>Shows as {openingParts.hour || "--"}:{openingParts.minute || "--"} {openingMeridiem}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Closing</Text>
            <View style={screenStyles.timeFieldWrap}>
              <View style={screenStyles.timeInputShell}>
                <TextInput
                  value={closingParts.hour}
                  onChangeText={(value) => updateBusinessTimePart("closing_time", "hour", value)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="6"
                  placeholderTextColor="#98A2B3"
                  style={screenStyles.timeHourInput}
                />
                <Text style={screenStyles.timeColon}>:</Text>
                <TextInput
                  value={closingParts.minute}
                  onChangeText={(value) => updateBusinessTimePart("closing_time", "minute", value)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor="#98A2B3"
                  style={screenStyles.timeMinuteInput}
                />
              </View>
              <Pressable
                style={({ pressed }) => [screenStyles.timeMeridiemButton, pressed && styles.pressed]}
                onPress={() => updateBusinessTimePart("closing_time", "hour", closingParts.hour, closingMeridiem === "AM" ? "PM" : "AM")}
              >
                <Text style={screenStyles.timeMeridiemText}>{closingMeridiem}</Text>
              </Pressable>
            </View>
            <Text style={[styles.fieldHint, screenStyles.timeHint]}>Shows as {closingParts.hour || "--"}:{closingParts.minute || "--"} {closingMeridiem}</Text>
          </View>
        </View>
        <Field label="Closed days" value={form.closed_days} onChangeText={(value) => update("closed_days", value)} placeholder="sunday, monday" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Min hours" value={form.min_booking_hours} onChangeText={(value) => update("min_booking_hours", value)} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Max hours" value={form.max_booking_hours} onChangeText={(value) => update("max_booking_hours", value)} keyboardType="numeric" />
          </View>
        </View>
        <ImageUploadBox
          label="Business cover image"
          value={form.image_url || form.profile_image || ""}
          onPress={pickMainImage}
          onRemove={() => updateMainImage("")}
        />
        <GalleryUploadBox
          label="Gallery images and videos"
          values={form.gallery_images || []}
          onAdd={pickGalleryMedia}
          onRemove={removeGalleryMedia}
          enableAllMedia
        />
        <SectionTitle action={<AppButton variant="secondary" style={{ minHeight: 36 }} onPress={addService}>Add</AppButton>}>Services</SectionTitle>
        <Text style={styles.fieldHint}>Leave this empty if your business has one main bookable service. Add services only for different services such as separate sound equipment, different projects, or other multi-service offerings.</Text>
        {serviceFeedback ? <Text style={styles.successText}>{serviceFeedback}</Text> : null}
        {(form.services || []).length ? (
          (form.services || []).map((service, index) => {
            const isNewService = highlightedServiceIndex === index;
            const pulseStyle = isNewService
              ? {
                  transform: [
                    {
                      scale: servicePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.015]
                      })
                    }
                  ]
                }
              : null;

            return (
              <Animated.View key={`service-${index}`} style={[styles.serviceEditorCard, isNewService && styles.serviceEditorCardNew, pulseStyle]}>
                <View style={styles.sectionTitle}>
                  <Text style={styles.businessName}>Service {index + 1}</Text>
                  <Pressable onPress={() => removeService(index)} hitSlop={10}>
                    <Text style={styles.uploadRemoveText}>Remove</Text>
                  </Pressable>
                </View>
                <Text style={styles.label}>Booking Type</Text>
                <View style={styles.serviceBookingTypeRow}>
                  {[
                    { value: "hourly", label: "Hourly", description: "Booked by hour", icon: "time-outline" },
                    { value: "daily", label: "Daily", description: "Booked by day", icon: "calendar-outline" }
                  ].map((option) => {
                    const active = (service.booking_type || "hourly") === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={({ pressed }) => [
                          styles.serviceBookingTypeCard,
                          active && styles.serviceBookingTypeCardActive,
                          pressed && styles.pressed
                        ]}
                        onPress={() => updateService(index, "booking_type", option.value)}
                      >
                        <View style={[styles.serviceBookingTypeIcon, active && styles.serviceBookingTypeIconActive]}>
                          <Ionicons color={active ? COLORS.surface : COLORS.text} name={option.icon} size={18} />
                        </View>
                        <View style={styles.serviceBookingTypeText}>
                          <Text style={styles.serviceBookingTypeTitle}>{option.label}</Text>
                          <Text style={styles.serviceBookingTypeDescription}>{option.description}</Text>
                        </View>
                        {active ? (
                          <View style={styles.serviceBookingTypeCheck}>
                            <Ionicons color="#FFFFFF" name="checkmark" size={14} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                {(service.booking_type || "hourly") === "daily" ? (
                  <View style={styles.serviceBookingTypeHintBox}>
                    <Text style={styles.fieldHint}>Daily services use date plus number of days during booking.</Text>
                  </View>
                ) : null}
                <Field label="Service name" value={service.name || ""} onChangeText={(value) => updateService(index, "name", value)} placeholder="Mixer, Speaker, Lights" />
                <Field label="Service description" value={service.description || ""} onChangeText={(value) => updateService(index, "description", value)} placeholder="What is included?" multiline />
                <Field label="Service price" value={String(service.price || "")} onChangeText={(value) => updateService(index, "price", value)} placeholder="Optional" keyboardType="numeric" />
                <GalleryUploadBox
                  label="Service images and videos"
                  values={service.media || []}
                  onAdd={() => pickServiceMedia(index)}
                  onRemove={(mediaIndex) => removeServiceMedia(index, mediaIndex)}
                />
              </Animated.View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Only add services if customers need to choose between different bookable items.</Text>
          </View>
        )}
        <AppButton style={styles.profileSaveButton} onPress={saveBusiness}>Save & Continue  →</AppButton>
      </Card>
    </Screen>
  );
}

const screenStyles = StyleSheet.create({
  categoryWarningBox: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  categoryWarningTitle: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4
  },
  categoryWarningText: {
    color: "#555555",
    fontSize: 13,
    lineHeight: 19
  },
  currencyButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D9E0EA",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14
  },
  currencyButtonOpen: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8
  },
  currencyButtonText: {
    color: "#22314C",
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    marginRight: 8
  },
  currencyFieldWrap: {
    marginTop: 7,
    position: "relative",
    zIndex: 30
  },
  currencyMenu: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D9E0EA",
    borderRadius: 15,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    elevation: 8,
    left: 0,
    marginTop: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    top: 54
  },
  currencyOption: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  currencyOptionActive: {
    backgroundColor: "#F3F5F9"
  },
  currencyOptionBorder: {
    borderBottomColor: "#E5EAF1",
    borderBottomWidth: 1
  },
  currencyOptionText: {
    color: "#22314C",
    fontSize: 14,
    fontWeight: "600"
  },
  currencyOptionTextActive: {
    color: COLORS.accent,
    fontWeight: "800"
  },
  timeFieldWrap: {
    flexDirection: "row",
    gap: 8,
    marginTop: 7
  },
  timeInputShell: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D9E0EA",
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: 14
  },
  timeHourInput: {
    color: "#22314C",
    fontSize: 15,
    fontWeight: "700",
    minWidth: 18,
    paddingVertical: 0,
    textAlign: "right"
  },
  timeColon: {
    color: "#22314C",
    fontSize: 16,
    fontWeight: "800",
    marginHorizontal: 2
  },
  timeMinuteInput: {
    color: "#22314C",
    fontSize: 15,
    fontWeight: "700",
    minWidth: 28,
    paddingVertical: 0
  },
  timeMeridiemButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D9E0EA",
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 68,
    paddingHorizontal: 10
  },
  timeHint: {
    marginTop: 2
  },
  timeMeridiemText: {
    color: "#22314C",
    fontSize: 14,
    fontWeight: "800"
  }
});
