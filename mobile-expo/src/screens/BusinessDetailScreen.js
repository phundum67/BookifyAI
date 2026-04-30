import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { FlatList, Image, Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { api } from "../api/client";
import { CATEGORY_ICON_MAP, COLORS, FALLBACK_IMAGE, SUBCATEGORY_ICON_MAP, normalizeBusinessClassification } from "../constants";
import { addHours, formatDate, formatPrice, formatTime, todayISO, toLocalISODate } from "../utils/format";
import { AppButton, BodyText, Card, Chip, CustomerAvatar, EmptyState, GalleryPreviewImage, GalleryVideoPlayer, GalleryVideoThumbnail, IconButton, Screen, SectionTitle, styles } from "../components/ui";

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
    .filter((service) => service && typeof service === "object" && service.name)
    .map((service) => {
      const media = Array.isArray(service.media) ? service.media : Array.isArray(service.images) ? service.images : [];
      return {
        id: service.id || null,
        business_id: service.business_id || null,
        name: service.name,
        description: service.description || "",
        price: service.price,
        booking_type: service.booking_type === "daily" ? "daily" : "hourly",
        images: media,
        media
      };
    });
}

function normalizeGalleryMedia(value) {
  let items = value || [];
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch (_error) {
      items = [];
    }
  }
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") {
        const isVideo = /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(item) || /^data:video\//i.test(item);
        return { uri: item, type: isVideo ? "video" : "image" };
      }
      if (item && typeof item === "object" && item.uri) {
        return {
          uri: item.uri,
          type: item.type || (/\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(item.uri) || /^data:video\//i.test(item.uri) ? "video" : "image"),
          duration: item.duration || ""
        };
      }
      return null;
    })
    .filter(Boolean);
}

export function BusinessDetailScreen({ businessId, user, onBack, onBooked, onOpenCategory, onError }) {
  const { width: screenWidth } = useWindowDimensions();
  const viewerWidth = Math.max(screenWidth - 32, 1);
  const [business, setBusiness] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [duration, setDuration] = useState("1");
  const [dayCount, setDayCount] = useState("1");
  const [reviews, setReviews] = useState([]);
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState("5");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState("media");
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    loadBusiness();
  }, [businessId]);

  useEffect(() => {
    if (!business) return;
    const currentServices = normalizeServices(business.services);
    const currentService = selectedService || (currentServices.length === 1 ? currentServices[0] : null);
    if ((currentService?.booking_type || "hourly") === "daily") {
      setSlots([]);
      setSelectedSlot("");
      return;
    }
    loadSlots();
  }, [date, business, selectedService]);

  async function loadBusiness() {
    try {
      const payload = await api(`/businesses/${businessId}`);
      setBusiness(payload.data.business);
      setReviews(payload.data.business.reviews_preview || []);
      setDuration(String(payload.data.business.min_booking_hours || 1));
      setDayCount("1");
      setSelectedService(null);
      setGalleryOpen(false);
      setGalleryTab("media");
      setViewerOpen(false);
      setSelectedGalleryIndex(0);
    } catch (error) {
      onError(error);
    }
  }

  async function loadSlots() {
    setSelectedSlot("");
    try {
      setLoadingSlots(true);
      const activeServiceId = selectedService?.id || (normalizeServices(business?.services).length === 1 ? normalizeServices(business?.services)[0]?.id : null);
      const serviceQuery = activeServiceId ? `&service_id=${activeServiceId}` : "";
      const payload = await api(`/businesses/${businessId}/slots?date=${date}${serviceQuery}`);
      setSlots(payload.data.slots || []);
    } catch (error) {
      onError(error);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function toggleFavorite() {
    try {
      if (business.is_favorite) {
        await api(`/favorites/${businessId}`, { method: "DELETE" });
      } else {
        await api(`/favorites/${businessId}`, { method: "POST", body: {} });
      }
      setBusiness({ ...business, is_favorite: !business.is_favorite });
    } catch (error) {
      onError(error);
    }
  }

  async function createBooking() {
    try {
      const selectedServiceId = activeService?.id || null;
      if (isDailyBooking) {
        await api("/bookings", {
          method: "POST",
          body: {
            business_id: Number(businessId),
            service_id: selectedServiceId,
            booking_type: "daily",
            slot_date: date,
            duration_days: Number(dayCount || 1),
            customer_name: user.name,
            customer_email: user.email,
            customer_phone: user.phone || "",
            customer_profile_image: user.profile_image || ""
          }
        });
      } else {
        if (!selectedSlot) {
          onError(new Error("Choose an available time slot before confirming your booking."));
          return;
        }
        await api("/bookings", {
          method: "POST",
          body: {
            business_id: Number(businessId),
            service_id: selectedServiceId,
            booking_type: "hourly",
            slot_date: date,
            start_time: selectedSlot,
            duration_hours: Number(duration),
            customer_name: user.name,
            customer_email: user.email,
            customer_phone: user.phone || "",
            customer_profile_image: user.profile_image || ""
          }
        });
      }
      onBooked();
    } catch (error) {
      onError(error);
      if (!isDailyBooking) {
        loadSlots();
      }
    }
  }

  function selectedDateObject() {
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function handleDateChange(event, pickedDate) {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }
    if (event?.type === "dismissed" || !pickedDate) return;
    setDate(toLocalISODate(pickedDate));
  }

  async function submitReview() {
    if (!reviewText.trim()) {
      onError(new Error("Please write a short review."));
      return;
    }
    try {
      await api(`/businesses/${businessId}/reviews`, {
        method: "POST",
        body: { rating, review_text: reviewText }
      });
      setReviewText("");
      const payload = await api(`/businesses/${businessId}/reviews`);
      setReviews(payload.data.reviews || []);
    } catch (error) {
      onError(error);
    }
  }

  function setReviewRating(nextRating) {
    setRating(String(nextRating));
  }

  function renderStars({ value, onSelect, size = 24 }) {
    const numericValue = Number(value) || 0;
    return (
      <View style={screenStyles.reviewStarsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            hitSlop={8}
            disabled={!onSelect}
            style={({ pressed }) => [screenStyles.reviewStarButton, pressed && styles.pressed]}
            onPress={() => onSelect?.(star)}
          >
            <Ionicons
              color={COLORS.accent}
              name={star <= numericValue ? "star" : "star-outline"}
              size={size}
            />
          </Pressable>
        ))}
      </View>
    );
  }

  function renderReviewsCard() {
    const averageRating = Number(business.average_rating || 0);
    return (
      <Card style={screenStyles.reviewsCard}>
        <View style={screenStyles.reviewSummary}>
          <View style={screenStyles.reviewScorePanel}>
            <View style={screenStyles.reviewScoreRow}>
              <Ionicons color={COLORS.accent} name="star" size={18} />
              <Text style={screenStyles.reviewScoreText}>{averageRating.toFixed(1)}</Text>
            </View>
            <Text style={screenStyles.reviewMuted}>{reviews.length ? `${reviews.length} review${reviews.length > 1 ? "s" : ""}` : "No reviews yet"}</Text>
          </View>
          <View style={screenStyles.reviewSummaryDivider} />
          <View style={screenStyles.reviewPromptPanel}>
            <Text style={screenStyles.reviewPromptTitle}>{reviews.length ? "Share your thoughts" : "Be the first to review"}</Text>
            <Text style={screenStyles.reviewPromptText}>Your feedback helps others make better decisions.</Text>
          </View>
        </View>

        {reviews.length ? (
          <View style={screenStyles.reviewList}>
            {reviews.slice(0, 3).map((review) => (
              <View key={review.id} style={screenStyles.reviewItem}>
                <View style={screenStyles.reviewItemHeader}>
                  <View style={screenStyles.reviewUserRow}>
                    <CustomerAvatar
                      name={review.user_name || "Customer"}
                      size={28}
                      uri={review.user_profile_image}
                    />
                    <Text style={screenStyles.reviewUserText}>{review.user_name || "Customer"}</Text>
                  </View>
                  {renderStars({ value: review.rating, size: 14 })}
                </View>
                <Text style={screenStyles.reviewBodyText}>{review.review_text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={screenStyles.writeReviewTitle}>Write a review</Text>
        <Text style={screenStyles.reviewLabel}>Rating</Text>
        {renderStars({ value: rating, onSelect: setReviewRating })}
        <Text style={screenStyles.reviewLabel}>Review</Text>
        <TextInput
          multiline
          placeholder="Share your experience"
          placeholderTextColor="#9CA3AF"
          style={screenStyles.reviewInput}
          value={reviewText}
          onChangeText={setReviewText}
        />
        <AppButton style={screenStyles.submitReviewButton} onPress={submitReview}>Submit review</AppButton>
      </Card>
    );
  }

  function renderCategoryChip(label, iconName) {
    return (
      <Pressable style={({ pressed }) => [screenStyles.detailCategoryChip, pressed && styles.pressed]} onPress={openRelatedCategory}>
        <View style={screenStyles.detailCategoryIcon}>
          <MaterialCommunityIcons color={COLORS.accent} name={iconName} size={13} />
        </View>
        <Text style={screenStyles.detailCategoryText}>{label}</Text>
      </Pressable>
    );
  }

  function renderAboutPill(icon, label) {
    return (
      <View style={screenStyles.aboutInfoPill}>
        <Ionicons color={COLORS.accent} name={icon} size={18} />
        <Text style={screenStyles.aboutInfoText}>{label}</Text>
      </View>
    );
  }

  if (!business) {
    return (
      <Screen>
        <EmptyState>Loading business details...</EmptyState>
      </Screen>
    );
  }

  const image = business.image_url || business.profile_image || business.gallery_images?.[0] || FALLBACK_IMAGE;
  const classification = normalizeBusinessClassification(business);
  const businessTag = classification.subcategory || business.custom_category || business.subcategory || business.category;
  const businessTagIcon = SUBCATEGORY_ICON_MAP[businessTag] || CATEGORY_ICON_MAP[classification.category] || "shape-outline";
  const min = business.min_booking_hours || 1;
  const max = business.max_booking_hours || 5;
  const durationOptions = Array.from({ length: max - min + 1 }, (_, index) => String(min + index));
  const dayOptions = ["1", "2", "3", "5", "7", "10"];
  const savedServices = normalizeServices(business.services);
  const activeService = selectedService || (savedServices.length === 1 ? savedServices[0] : null);
  const isDailyBooking = (activeService?.booking_type || "hourly") === "daily";
  const galleryMedia = normalizeGalleryMedia(business.gallery_images);
  const hasMultipleServices = savedServices.length > 1;
  const services = hasMultipleServices ? savedServices : [];
  const previewGalleryMedia = galleryMedia.length > 6
    ? [...galleryMedia.slice(0, 5), { ...galleryMedia[5], type: "more", count: galleryMedia.length - 5 }]
    : galleryMedia;

  function serviceImage(service) {
    const media = service.media || service.images || [];
    const firstImage = media.find((item) => {
      const uri = typeof item === "string" ? item : item?.uri;
      const type = typeof item === "string" ? "" : item?.type;
      return uri && type !== "video" && !/\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(uri);
    });
    return (typeof firstImage === "string" ? firstImage : firstImage?.uri) || image;
  }

  function servicePrice(service) {
    return service.price !== undefined && service.price !== null && service.price !== "" ? formatPrice(business, service.price) : formatPrice(business);
  }

  function openRelatedCategory() {
    if (!onOpenCategory) return;
    onOpenCategory({
      category: classification.category || "",
      subcategory: classification.subcategory || business.subcategory || ""
    });
  }

  function openGallery(index) {
    setSelectedGalleryIndex(index);
    setGalleryTab("media");
    setGalleryOpen(true);
  }

  function openAllMedia() {
    setGalleryTab("media");
    setGalleryOpen(true);
  }

  function openViewer(index) {
    setSelectedGalleryIndex(index);
    setViewerOpen(true);
  }

  async function openVideo(item) {
    if (!item?.uri) return;
    try {
      await Linking.openURL(item.uri);
    } catch (_error) {
      onError(new Error("This video could not be opened right now."));
    }
  }

  async function shareMediaItem(item) {
    if (!item?.uri) return;
    try {
      await Share.share({
        message: item.type === "video" ? "Check out this video on Booklify." : "Check out this image on Booklify.",
        url: item.uri
      });
    } catch (_error) {
      onError(new Error("This media could not be shared right now."));
    }
  }

  function handleViewerScroll(event) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / viewerWidth);
    if (nextIndex >= 0 && nextIndex < galleryMedia.length) {
      setSelectedGalleryIndex(nextIndex);
    }
  }

  function renderMediaViewerModal() {
    return (
      <Modal animationType="fade" transparent visible={viewerOpen} onRequestClose={() => setViewerOpen(false)}>
        <View style={styles.galleryViewerOverlay}>
          <View style={styles.galleryViewerTopBar}>
            <IconButton
              accessibilityLabel="Close viewer"
              color="#FFFFFF"
              name="close-outline"
              size={22}
              style={styles.galleryViewerCloseButton}
              onPress={() => setViewerOpen(false)}
            />
            <IconButton
              accessibilityLabel="Share media"
              color="#FFFFFF"
              name="share-social-outline"
              size={20}
              style={styles.galleryViewerShareButton}
              onPress={() => shareMediaItem(galleryMedia[selectedGalleryIndex])}
            />
            <Text style={styles.galleryViewerCount}>{selectedGalleryIndex + 1} / {galleryMedia.length}</Text>
          </View>
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.galleryViewerScroll}
            data={galleryMedia}
            keyExtractor={(item, index) => `${item.uri}-${index}-viewer`}
            initialScrollIndex={selectedGalleryIndex}
            snapToInterval={viewerWidth}
            disableIntervalMomentum
            getItemLayout={(_data, index) => ({
              length: viewerWidth,
              offset: viewerWidth * index,
              index
            })}
            windowSize={2}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            removeClippedSubviews
            decelerationRate="fast"
            onMomentumScrollEnd={handleViewerScroll}
            renderItem={({ item, index }) => (
              <View style={[styles.galleryViewerSlide, { width: viewerWidth }]}>
                {item.type === "video" ? (
                  index === selectedGalleryIndex ? (
                    <GalleryVideoPlayer uri={item.uri} shouldPlay onOpenExternal={() => openVideo(item)} />
                  ) : (
                    <GalleryVideoThumbnail uri={item.uri} duration={item.duration} style={styles.galleryViewerImage} />
                  )
                ) : (
                  <Image resizeMode="contain" source={{ uri: item.uri }} style={styles.galleryViewerImage} />
                )}
              </View>
            )}
          />
        </View>
      </Modal>
    );
  }

  function renderBookingCard() {
    const dailySummary = `${formatDate(date)}${Number(dayCount || 1) > 1 ? ` • ${dayCount} days` : " • 1 day"}`;

    return (
      <Card>
        <SectionTitle>{isDailyBooking ? "Choose dates" : "Choose date and time"}</SectionTitle>
        <Pressable style={({ pressed }) => [styles.datePickerButton, styles.bookingSectionGap, pressed && styles.pressed]} onPress={() => setShowDatePicker(true)}>
          <View style={styles.datePickerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{isDailyBooking ? "Start date" : "Booking date"}</Text>
              <Text style={styles.datePickerText}>{formatDate(date)}</Text>
              <Text style={styles.datePickerHint}>{isDailyBooking ? "Tap to choose the first day" : "Tap to open calendar"}</Text>
            </View>
            <View style={styles.calendarBadge}>
              <Ionicons color={COLORS.accent} name="calendar-outline" size={20} style={styles.calendarBadgeIcon} />
            </View>
          </View>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            display={Platform.OS === "ios" ? "inline" : "calendar"}
            minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
            mode="date"
            onChange={handleDateChange}
            value={selectedDateObject()}
          />
        ) : null}
        {isDailyBooking ? (
          <>
            <Text style={styles.bookingSectionLabel}>Number of days</Text>
            <View style={styles.bookingDurationGrid}>
              {dayOptions.map((item) => (
                <Chip
                  key={item}
                  label={`${item}d`}
                  active={dayCount === item}
                  style={styles.bookingDurationChip}
                  onPress={() => setDayCount(item)}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.bookingSectionLabel}>Available slots</Text>
            <View style={styles.bookingSlotGrid}>
              {loadingSlots ? (
                <EmptyState>Loading available slots...</EmptyState>
              ) : slots.length ? (
                slots.map((slot) => (
                  <Chip
                    key={slot.id}
                    label={formatTime(slot.start_time)}
                    active={selectedSlot === slot.start_time}
                    style={styles.bookingSlotChip}
                    onPress={() => setSelectedSlot(slot.start_time)}
                  />
                ))
              ) : (
                <EmptyState>No slots available on this date. Pick another date from the calendar.</EmptyState>
              )}
            </View>
            <Text style={styles.bookingSectionLabel}>Duration</Text>
            <View style={styles.bookingDurationGrid}>
              {durationOptions.map((item) => (
                <Chip
                  key={item}
                  label={`${item}h`}
                  active={duration === item}
                  style={styles.bookingDurationChip}
                  onPress={() => setDuration(item)}
                />
              ))}
            </View>
          </>
        )}
        <View style={[styles.emptyState, styles.bookingSummary]}>
          <Text style={styles.emptyText}>
            {isDailyBooking
              ? dailySummary
              : selectedSlot
                ? `${formatDate(date)} - ${formatTime(selectedSlot)} to ${formatTime(addHours(selectedSlot, duration))}`
                : "Select a date and slot to see your booking summary."}
          </Text>
        </View>
        <AppButton style={styles.bookingConfirmButton} onPress={createBooking}>Confirm booking</AppButton>
      </Card>
    );
  }

  function renderGalleryCard() {
    if (!galleryMedia.length) return null;

    return (
      <Card>
        <SectionTitle action={<Text style={styles.galleryCountText}>{galleryMedia.length} items</Text>}>Gallery</SectionTitle>
        <View style={styles.serviceMediaGrid}>
          {previewGalleryMedia.map((item, index) => {
            const isMoreTile = item.type === "more";
            return (
              <Pressable
                key={isMoreTile ? `more-${galleryMedia.length}` : `${item.uri}-${index}`}
                style={({ pressed }) => [
                  styles.galleryMediaButton,
                  styles.galleryMediaFrame,
                  pressed && styles.pressed
                ]}
                onPress={() => {
                  if (isMoreTile) {
                    openAllMedia();
                    return;
                  }
                  openViewer(index);
                }}
              >
                {item.type === "video" ? (
                  <GalleryVideoThumbnail uri={item.uri} duration={item.duration} style={styles.galleryMediaImage} />
                ) : (
                  <GalleryPreviewImage uri={item.uri} style={styles.galleryMediaImage} />
                )}
                {isMoreTile ? (
                  <View style={styles.galleryMoreTileOverlay}>
                    <View style={styles.galleryMoreTileContent}>
                      <Text style={styles.galleryMoreTileTitle}>+ More</Text>
                      <Text style={styles.galleryMoreTileSubtitle}>Photos & Videos</Text>
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>
    );
  }

  function renderGalleryScreen() {
    if (!galleryMedia.length) return null;

    return (
      <View style={styles.screen}>
        <View style={[styles.scrollContent, { flex: 1 }]}>
        <View style={styles.galleryPageHeader}>
          <IconButton
            accessibilityLabel="Back"
            color={COLORS.text}
            name="arrow-back-outline"
            size={20}
            onPress={() => setGalleryOpen(false)}
          />
          <View style={styles.galleryPageHeaderText}>
            <Text style={styles.title}>All media</Text>
          </View>
        </View>
        <View style={styles.allMediaTabs}>
          {["media", "links"].map((tab) => {
            const active = galleryTab === tab;
            return (
              <Pressable
                key={tab}
                style={({ pressed }) => [styles.allMediaTabButton, active && styles.allMediaTabButtonActive, pressed && styles.pressed]}
                onPress={() => setGalleryTab(tab)}
              >
                <Text style={[styles.allMediaTabText, active && styles.allMediaTabTextActive]}>
                  {tab === "media" ? "Media" : "Links"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {galleryTab === "media" ? (
          <FlatList
            data={galleryMedia}
            keyExtractor={(item, index) => `${item.uri}-${index}`}
            numColumns={3}
            initialNumToRender={6}
            windowSize={5}
            removeClippedSubviews
            columnWrapperStyle={styles.galleryFlatListRow}
            contentContainerStyle={styles.galleryFlatListContent}
            renderItem={({ item, index }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.galleryMediaButton,
                  styles.galleryMediaTile,
                  styles.galleryPageTile,
                  pressed && styles.pressed
                ]}
                onPress={() => openViewer(index)}
              >
                {item.type === "video" ? (
                  <GalleryVideoThumbnail uri={item.uri} duration={item.duration} style={styles.galleryMediaImage} />
                ) : (
                  <GalleryPreviewImage uri={item.uri} style={styles.galleryMediaImage} />
                )}
              </Pressable>
            )}
          />
        ) : (
          <Card>
            <EmptyState>No links yet.</EmptyState>
          </Card>
        )}
        {renderMediaViewerModal()}
        </View>
      </View>
    );
  }

  if (galleryOpen && galleryMedia.length) {
    return renderGalleryScreen();
  }

  if (selectedService && hasMultipleServices) {
    const selectedImage = serviceImage(selectedService);
    const selectedMedia = selectedService.media || selectedService.images || [];
    return (
      <Screen>
        <View style={styles.detailHero}>
          <Image source={{ uri: selectedImage }} resizeMode="cover" style={styles.detailHeroImage} />
        <IconButton
          accessibilityLabel="Back"
            color="#FFFFFF"
            name="arrow-back-outline"
            size={20}
            style={{ backgroundColor: "transparent", borderColor: "transparent", left: 16, height: 42, position: "absolute", top: 16, width: 42 }}
            onPress={() => setSelectedService(null)}
          />
        </View>
        <Card>
          <Pressable style={({ pressed }) => [styles.categoryPillPressable, pressed && styles.pressed]} onPress={openRelatedCategory}>
            <Text style={styles.categoryPill}>{business.name}</Text>
          </Pressable>
          <Text style={[styles.title, { marginTop: 8 }]}>{selectedService.name}</Text>
          <Text style={[styles.businessName, { marginTop: 10 }]}>{servicePrice(selectedService)}</Text>
          <BodyText style={{ marginTop: 10 }}>{selectedService.description || "Service details will appear here soon."}</BodyText>
        </Card>
        {selectedMedia.length > 1 ? (
          <Card>
            <SectionTitle>Service media</SectionTitle>
            <View style={styles.serviceMediaGrid}>
              {selectedMedia.slice(0, 6).map((item, index) => {
                const uri = typeof item === "string" ? item : item.uri;
                const type = typeof item === "string" ? "" : item.type;
                const isVideo = type === "video" || /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(uri || "");
                return isVideo ? (
                  <View key={`${uri}-${index}`} style={[styles.serviceMediaImage, styles.videoPreviewTile]}>
                    <Ionicons color="#FFFFFF" name="play-circle-outline" size={26} />
                    <Text style={styles.videoPreviewText}>Video</Text>
                  </View>
                ) : (
                  <Image key={`${uri}-${index}`} source={{ uri }} style={styles.serviceMediaImage} />
                );
              })}
            </View>
          </Card>
        ) : null}
        {renderBookingCard()}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.detailHero}>
        <Image source={{ uri: image }} resizeMode="cover" style={styles.detailHeroImage} />
        <IconButton
          accessibilityLabel="Back"
          color="#FFFFFF"
          name="arrow-back-outline"
          size={20}
          style={{ backgroundColor: "transparent", borderColor: "transparent", left: 16, height: 42, position: "absolute", top: 16, width: 42 }}
          onPress={onBack}
        />
        <Pressable
          accessibilityLabel={business.is_favorite ? "Remove saved business" : "Save business"}
          style={({ pressed }) => [styles.heroIconButton, styles.heroSaveButton, business.is_favorite && styles.heroIconButtonActive, pressed && styles.pressed]}
          onPress={toggleFavorite}
        >
          <Ionicons
            color="#FFFFFF"
            name={business.is_favorite ? "bookmark" : "bookmark-outline"}
            size={21}
          />
        </Pressable>
        <Pressable
          accessibilityLabel="Share business"
          style={({ pressed }) => [styles.heroIconButton, styles.heroShareButton, pressed && styles.pressed]}
          onPress={() => onError(new Error("Share will be available soon."))}
        >
          <Ionicons color="#FFFFFF" name="share-social-outline" size={21} />
        </Pressable>
      </View>
      <Card>
        {renderCategoryChip(businessTag, businessTagIcon)}
        <Text style={screenStyles.detailBusinessTitle}>{business.name}</Text>
        <View style={screenStyles.detailLocationRow}>
          <Ionicons color={COLORS.muted} name="location-outline" size={15} />
          <Text style={screenStyles.detailLocationText}>{business.location}</Text>
        </View>
        <View style={screenStyles.detailPriceRatingRow}>
          <Text style={screenStyles.detailPriceText}>{formatPrice(business)}</Text>
          <View style={screenStyles.detailRatingRow}>
            <Ionicons color={COLORS.accent} name="star" size={16} />
            <Text style={screenStyles.detailRatingText}>
              {`${Number(business.average_rating || 0).toFixed(1)} (${business.review_count || reviews.length || 0} reviews)`}
            </Text>
          </View>
        </View>
      </Card>
      <Card>
        <SectionTitle>About this place</SectionTitle>
        <BodyText>{business.description}</BodyText>
        <View style={screenStyles.aboutInfoList}>
          {renderAboutPill("call-outline", business.phone)}
          {renderAboutPill("time-outline", `${formatTime(business.opening_time)} - ${formatTime(business.closing_time)}`)}
          {renderAboutPill("calendar-outline", `Closed: ${(business.closed_days || []).join(", ") || "None"}`)}
        </View>
      </Card>
      {renderGalleryCard()}
      {hasMultipleServices ? (
        <Card>
          <SectionTitle>Services</SectionTitle>
          <Text style={[styles.businessLocation, { marginBottom: 12 }]}>Choose what you want to book from this business.</Text>
          <View style={styles.serviceGrid}>
            {services.map((service, index) => (
              <Pressable key={service.id ? `service-${service.id}` : `${service.name}-${index}`} style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]} onPress={() => setSelectedService(service)}>
                <Image source={{ uri: serviceImage(service) }} style={styles.serviceCardImage} />
                <View style={styles.serviceCardBody}>
                  <Text style={styles.businessName} numberOfLines={1}>{service.name}</Text>
                  <Text style={styles.businessLocation} numberOfLines={2}>{service.description || "Tap to view details and book."}</Text>
                  <Text style={styles.metaPill}>{servicePrice(service)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
      {!hasMultipleServices ? renderBookingCard() : null}
      {renderReviewsCard()}
      {renderMediaViewerModal()}
    </Screen>
  );
}

const screenStyles = StyleSheet.create({
  aboutInfoList: {
    gap: 10,
    marginTop: 14
  },
  aboutInfoPill: {
    alignItems: "center",
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14
  },
  aboutInfoText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  detailBusinessTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 10
  },
  detailCategoryChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  detailCategoryIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  detailCategoryText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "900"
  },
  detailLocationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 8
  },
  detailLocationText: {
    color: COLORS.muted,
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  detailPriceRatingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16
  },
  detailPriceText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 22,
    fontWeight: "900"
  },
  detailRatingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  detailRatingText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  reviewBodyText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 4
  },
  reviewInput: {
    borderColor: "#E5E7EB",
    borderRadius: 14,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  reviewItem: {
    borderBottomColor: "#EEF2F6",
    borderBottomWidth: 1,
    paddingVertical: 9
  },
  reviewItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  reviewLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 10
  },
  reviewList: {
    marginBottom: 6,
    marginTop: 8
  },
  reviewMuted: {
    color: COLORS.light,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6
  },
  reviewPromptPanel: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 12
  },
  reviewPromptText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    marginTop: 3
  },
  reviewPromptTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900"
  },
  reviewScorePanel: {
    justifyContent: "center",
    minWidth: 92,
    paddingRight: 12
  },
  reviewScoreRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  reviewScoreText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900"
  },
  reviewStarButton: {
    paddingRight: 10
  },
  reviewStarsRow: {
    alignItems: "center",
    flexDirection: "row"
  },
  reviewSummary: {
    alignItems: "stretch",
    backgroundColor: "#FAFAFA",
    borderColor: "#E5E7EB",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  reviewSummaryDivider: {
    backgroundColor: "#E5E7EB",
    width: 1
  },
  reviewsCard: {
    paddingTop: 14
  },
  reviewUserText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900"
  },
  reviewUserRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0
  },
  submitReviewButton: {
    borderRadius: 12,
    marginTop: 12,
    minHeight: 44
  },
  writeReviewTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 8
  }
});
