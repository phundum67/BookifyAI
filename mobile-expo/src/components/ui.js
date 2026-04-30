import React, { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Building2, CalendarDays, Clock3, House, Search, User } from "lucide-react-native";
import { Image as ExpoImage } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";

import { CATEGORY_ICON_MAP, COLORS, FALLBACK_IMAGE, SUBCATEGORY_ICON_MAP, normalizeBusinessClassification } from "../constants";
import { formatDate, formatPrice, formatTime } from "../utils/format";

const BUSINESS_CATEGORY_COLORS = {
  "Sports & Turfs": "#22C55E",
  "Events & Venues": "#8B5CF6",
  "Equipment Rental": "#243B63",
  "Stay & Dining": "#F59E0B",
  "Wellness & Lifestyle": "#EC4899",
  "Entertainment & Leisure": "#14B8A6"
};

const SCREEN_TOP_PADDING = 12;

export function Screen({ children, bottomTabs, onRefresh, refreshing = false }) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoiding}>
        <ScrollView
          alwaysBounceVertical
          bounces
          contentContainerStyle={[styles.scrollContent, bottomTabs ? styles.withTabs : null]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          overScrollMode="always"
          refreshControl={onRefresh ? <RefreshControl colors={[COLORS.accent]} refreshing={refreshing} tintColor={COLORS.accent} onRefresh={onRefresh} /> : undefined}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {bottomTabs}
    </SafeAreaView>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ eyebrow, children, onPress, right, titleStyle, titleNumberOfLines }) {
  const compactHomeTitle = typeof children === "string" && children === "Let's find your next place today";
  const homeBrandTitle = compactHomeTitle ? (
    <Text style={[styles.title, styles.homeBrandTitle, titleStyle]}>
      Booklify <Text style={styles.homeBrandAiText}>AI</Text>
    </Text>
  ) : null;
  const Content = (
    <View style={{ flex: 1 }}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {homeBrandTitle || (
        <Text
          numberOfLines={titleNumberOfLines || (compactHomeTitle ? 1 : undefined)}
          style={[styles.title, compactHomeTitle && styles.compactHomeTitle, titleStyle]}
        >
          {children}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.titleRow}>
      {onPress ? (
        <Pressable style={({ pressed }) => [styles.titlePressable, pressed && styles.pressed]} onPress={onPress}>
          {Content}
        </Pressable>
      ) : Content}
      {right}
    </View>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{children}</Text>
      {action}
    </View>
  );
}

export function BodyText({ children, style }) {
  return <Text style={[styles.bodyText, style]}>{children}</Text>;
}

export function AppButton({ children, variant = "primary", style, textStyle, ...props }) {
  return (
    <Pressable style={({ pressed }) => [styles.button, styles[`${variant}Button`], pressed && styles.pressed, style]} {...props}>
      <Text style={[styles.buttonText, styles[`${variant}ButtonText`], textStyle]}>{children}</Text>
    </Pressable>
  );
}

export function LogoutConfirmSheet({ visible, onClose, onConfirm, accountLabel = "account" }) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.confirmBackdrop}>
        <Pressable style={styles.confirmDismissArea} onPress={onClose} />
        <View style={styles.confirmSheet}>
          <View style={styles.confirmHandle} />
          <View style={styles.confirmIconWrap}>
            <View style={styles.confirmIconCircle}>
              <Ionicons color="#FFFFFF" name="log-out-outline" size={20} />
            </View>
          </View>
          <Text style={styles.confirmTitle}>Log out?</Text>
          <Text style={styles.confirmText}>
            {`Are you sure you want to log out of your ${accountLabel}? You can sign back in anytime.`}
          </Text>
          <View style={styles.confirmActions}>
            <AppButton
              variant="secondary"
              style={[styles.confirmActionButton, styles.confirmStayButton]}
              textStyle={styles.confirmActionText}
              onPress={onClose}
            >
              Stay here
            </AppButton>
            <AppButton
              variant="secondary"
              style={[styles.confirmActionButton, styles.confirmLogoutButton]}
              textStyle={styles.confirmActionText}
              onPress={onConfirm}
            >
              Log out
            </AppButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function IconButton({ name, onPress, style, size = 20, color = COLORS.text, accessibilityLabel }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, style]}
      onPress={onPress}
    >
      <Ionicons color={color} name={name} size={size} />
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, multiline }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A0A0A0"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={[styles.input, multiline ? styles.textarea : null]}
      />
    </View>
  );
}

export function ImageUploadBox({ label, value, onPress, onRemove }) {
  return (
    <View style={styles.uploadField}>
      <View style={styles.sectionTitle}>
        <Text style={styles.label}>{label}</Text>
        {value ? (
          <Pressable onPress={onRemove} hitSlop={10}>
            <Text style={styles.uploadRemoveText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable style={({ pressed }) => [styles.uploadBox, value && styles.uploadBoxFilled, pressed && styles.pressed]} onPress={onPress}>
        {value ? (
          <Image source={{ uri: value }} style={styles.uploadPreview} />
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Text style={styles.uploadIcon}>+</Text>
            <Text style={styles.uploadTitle}>Tap to upload image</Text>
            <Text style={styles.uploadHint}>Use a clear cover photo for your business</Text>
          </View>
        )}
      </Pressable>
      {value ? <AppButton variant="secondary" style={{ marginTop: 10 }} onPress={onPress}>Change image</AppButton> : null}
    </View>
  );
}

function normalizeUploadMedia(items) {
  return (items || [])
    .map((item) => {
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
    })
    .filter(Boolean);
}

export function GalleryPreviewImage({ uri, style }) {
  const [loading, setLoading] = useState(true);

  return (
    <>
      <Image
        resizeMode="cover"
        source={{ uri }}
        style={style}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading ? (
        <View style={styles.galleryImageLoader}>
          <ActivityIndicator color={COLORS.accent} size="small" />
        </View>
      ) : null}
    </>
  );
}

export function GalleryVideoPlayer({ uri, onOpenExternal, shouldPlay = true }) {
  const videoRef = useRef(null);
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  async function openVideoFullscreen() {
    try {
      await videoRef.current?.enterFullscreen();
    } catch (_error) {
      onOpenExternal?.();
    }
  }

  return (
    <View style={styles.galleryViewerVideoCard}>
      <VideoView
        ref={videoRef}
        style={styles.galleryViewerVideoSurface}
        player={player}
        nativeControls
        allowsFullscreen
        contentFit="contain"
      />
      <AppButton variant="secondary" style={styles.galleryViewerExternalButton} onPress={openVideoFullscreen}>
        Open in full screen
      </AppButton>
    </View>
  );
}

export function GalleryVideoThumbnail({ uri, duration, style }) {
  const player = useVideoPlayer(uri);
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadThumbnail() {
      try {
        setLoading(true);
        const thumbnails = await player.generateThumbnailsAsync([0.1], {
          maxWidth: 320,
          maxHeight: 320
        });
        if (active) {
          setThumbnail(thumbnails?.[0] || null);
        }
      } catch (_error) {
        if (active) {
          setThumbnail(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadThumbnail();

    return () => {
      active = false;
    };
  }, [player]);

  return (
    <View style={[styles.videoPreviewTile, style]}>
      {thumbnail ? <ExpoImage source={thumbnail} style={styles.galleryMediaImage} contentFit="cover" /> : null}
      {!thumbnail ? (
        <View style={styles.videoThumbnailFallback}>
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="film-outline" size={24} />}
        </View>
      ) : null}
      <View style={styles.videoThumbnailOverlay}>
        <Ionicons color="#FFFFFF" name="play-circle-outline" size={24} />
        {duration ? <Text style={styles.videoPreviewDuration}>{duration}</Text> : null}
        <Text style={styles.videoPreviewText}>Video</Text>
      </View>
    </View>
  );
}

export function GalleryUploadBox({ label, values = [], onAdd, onRemove, enableAllMedia = false }) {
  const { width: screenWidth } = useWindowDimensions();
  const viewerWidth = Math.max(screenWidth - 32, 1);
  const [allMediaOpen, setAllMediaOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState("media");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const mediaItems = normalizeUploadMedia(values);
  const previewItems = mediaItems.length > 6
    ? [...mediaItems.slice(0, 5), { ...mediaItems[5], type: "more", count: mediaItems.length - 5 }]
    : mediaItems;

  async function openVideo(item) {
    if (!item?.uri) return;
    try {
      await Linking.openURL(item.uri);
    } catch (_error) {
      Alert.alert("Video unavailable", "This video could not be opened right now.");
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
      Alert.alert("Share unavailable", "This media could not be shared right now.");
    }
  }

  function openViewer(index) {
    setSelectedMediaIndex(index);
    setViewerOpen(true);
  }

  function handleViewerScroll(event) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / viewerWidth);
    if (nextIndex >= 0 && nextIndex < mediaItems.length) {
      setSelectedMediaIndex(nextIndex);
    }
  }

  return (
    <View style={styles.uploadField}>
      <View style={styles.sectionTitle}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.galleryCount}>{values.length} selected</Text>
      </View>
      <Pressable style={({ pressed }) => [styles.galleryUploadButton, pressed && styles.pressed]} onPress={onAdd}>
        <Text style={styles.uploadIcon}>+</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.uploadTitle}>Tap to upload</Text>
          <Text style={styles.uploadHint}>Add images or videos from your phone</Text>
        </View>
      </Pressable>
      {values.length ? (
        <View style={styles.galleryGrid}>
          {(enableAllMedia ? previewItems : mediaItems).map((item, index) => {
            const isMoreTile = item.type === "more";
            const uri = item.uri;
            const isVideo = item.type === "video";
            return (
              <Pressable
                key={isMoreTile ? `more-${mediaItems.length}` : `${uri}-${index}`}
                style={({ pressed }) => [styles.galleryPreviewTile, pressed && styles.pressed]}
                onPress={() => {
                  if (isMoreTile) {
                    setMediaTab("media");
                    setAllMediaOpen(true);
                    return;
                  }
                  if (enableAllMedia) {
                    openViewer(index);
                    return;
                  }
                }}
              >
                {isVideo ? (
                  <GalleryVideoThumbnail uri={uri} duration={item.duration} />
                ) : (
                  <GalleryPreviewImage uri={uri} style={styles.galleryPreviewImage} />
                )}
                {isMoreTile ? (
                  <View style={styles.galleryMoreTileOverlay}>
                    <View style={styles.galleryMoreTileContent}>
                      <Text style={styles.galleryMoreTileTitle}>+ More</Text>
                      <Text style={styles.galleryMoreTileSubtitle}>Photos & Videos</Text>
                    </View>
                  </View>
                ) : null}
                {!isMoreTile ? (
                  <Pressable style={styles.galleryRemoveButton} onPress={() => onRemove(index)} hitSlop={8}>
                    <Text style={styles.galleryRemoveText}>x</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No gallery media yet. Add a few images or videos to help customers decide.</Text>
        </View>
      )}
      {enableAllMedia ? (
        <>
          <Modal animationType="slide" visible={allMediaOpen} onRequestClose={() => setAllMediaOpen(false)}>
            <View style={styles.screen}>
              <View style={[styles.scrollContent, { flex: 1 }]}>
                <View style={styles.galleryPageHeader}>
                  <IconButton
                    accessibilityLabel="Back"
                    color={COLORS.text}
                    name="arrow-back-outline"
                    size={20}
                    onPress={() => setAllMediaOpen(false)}
                  />
                  <View style={styles.galleryPageHeaderText}>
                    <Text style={styles.title}>All media</Text>
                  </View>
                </View>
                <View style={styles.allMediaTabs}>
                  {["media", "links"].map((tab) => {
                    const active = mediaTab === tab;
                    return (
                      <Pressable
                        key={tab}
                        style={({ pressed }) => [styles.allMediaTabButton, active && styles.allMediaTabButtonActive, pressed && styles.pressed]}
                        onPress={() => setMediaTab(tab)}
                      >
                        <Text style={[styles.allMediaTabText, active && styles.allMediaTabTextActive]}>
                          {tab === "media" ? "Media" : "Links"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {mediaTab === "media" ? (
                  <FlatList
                    data={mediaItems}
                    keyExtractor={(item, index) => `${item.uri}-${index}-all`}
                    numColumns={3}
                    initialNumToRender={6}
                    windowSize={5}
                    removeClippedSubviews
                    columnWrapperStyle={styles.galleryFlatListRow}
                    contentContainerStyle={styles.galleryFlatListContent}
                    renderItem={({ item, index }) => (
                      <Pressable
                        style={({ pressed }) => [styles.galleryMediaButton, styles.galleryMediaTile, styles.galleryPageTile, pressed && styles.pressed]}
                        onPress={() => openViewer(index)}
                      >
                        {item.type === "video" ? (
                          <GalleryVideoThumbnail uri={item.uri} duration={item.duration} style={styles.galleryMediaImage} />
                        ) : (
                          <GalleryPreviewImage uri={item.uri} style={styles.galleryMediaImage} />
                        )}
                        <Pressable style={styles.galleryRemoveButton} onPress={() => onRemove(index)} hitSlop={8}>
                          <Text style={styles.galleryRemoveText}>x</Text>
                        </Pressable>
                      </Pressable>
                    )}
                  />
                ) : (
                  <Card>
                    <EmptyState>No links yet.</EmptyState>
                  </Card>
                )}
              </View>
            </View>
          </Modal>
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
                <Text style={styles.galleryViewerCount}>{selectedMediaIndex + 1} / {mediaItems.length}</Text>
                <IconButton
                  accessibilityLabel="Share media"
                  color="#FFFFFF"
                  name="share-social-outline"
                  size={20}
                  style={styles.galleryViewerShareButton}
                  onPress={() => shareMediaItem(mediaItems[selectedMediaIndex])}
                />
              </View>
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.galleryViewerScroll}
                data={mediaItems}
                keyExtractor={(item, index) => `${item.uri}-${index}-viewer`}
                initialScrollIndex={selectedMediaIndex}
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
                      index === selectedMediaIndex ? (
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
        </>
      ) : null}
    </View>
  );
}

export function Chip({ label, active, onPress, style }) {
  return (
    <Pressable style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed, style]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ items, selected, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {items.map((item) => {
        const value = typeof item === "string" ? item : item.value;
        const label = typeof item === "string" ? item : item.label;
        return <Chip key={value} label={label} active={selected === value} onPress={() => onSelect(value)} />;
      })}
    </ScrollView>
  );
}

export function EmptyState({ children }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

export function BottomTabs({ tabs, active, onChange }) {
  const icons = {
    home: House,
    browse: Search,
    bookings: CalendarDays,
    settings: User,
    dashboard: House,
    profile: Building2,
    slots: Clock3
  };

  return (
    <View style={styles.bottomTabs}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.value}
          accessibilityLabel={tab.label}
          style={[styles.tab, active === tab.value && styles.tabActive]}
          onPress={() => onChange(tab.value)}
        >
          <View style={[styles.tabIconWrap, active === tab.value && styles.tabIconWrapActive]}>
            {React.createElement(icons[tab.value] || House, {
              color: active === tab.value ? COLORS.accent : "#888888",
              size: 22,
              strokeWidth: 2,
              style: styles.tabIcon
            })}
          </View>
          <Text style={[styles.tabLabel, active === tab.value && styles.tabLabelActive]} numberOfLines={1}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CategoryPill({ label, icon, onPress, active = false, style, compact = false, iconWrapStyle, iconColor }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.homeCategoryChip,
        compact && styles.homeCategoryChipCompact,
        active && styles.homeCategoryChipActive,
        pressed && styles.homeCategoryChipPressed,
        style
      ]}
      onPress={onPress}
    >
      <View style={[styles.homeCategoryIconWrap, compact && styles.homeCategoryIconWrapCompact, iconWrapStyle]}>
        <MaterialCommunityIcons
          color={iconColor || (active ? COLORS.surface : COLORS.accent)}
          name={icon}
          size={compact ? 18 : 22}
          style={styles.homeCategoryIcon}
        />
      </View>
      <Text numberOfLines={2} style={[styles.homeCategoryText, compact && styles.homeCategoryTextCompact, active && styles.homeCategoryTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusBadge({ status }) {
  const label = status === "confirmed" ? "upcoming" : status;
  return (
    <View style={[styles.status, styles[`status_${status}`]]}>
      <Text style={[styles.statusText, styles[`statusText_${status}`]]}>{label}</Text>
    </View>
  );
}

export function CustomerAvatar({ uri, name, size = 30, style }) {
  const initial = String(name || "U").trim().charAt(0).toUpperCase() || "U";
  return (
    <View style={[styles.customerAvatar, { height: size, width: size, borderRadius: size / 2 }, style]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.customerAvatarImage, { borderRadius: size / 2 }]} />
      ) : (
        <Ionicons color={COLORS.accent} name="person-outline" size={Math.max(16, Math.round(size * 0.58))} />
      )}
    </View>
  );
}

export function BusinessCard({ business, onPress, enhanced = false, compact = false, dense = false }) {
  const image = business.image_url || business.profile_image || business.gallery_images?.[0] || FALLBACK_IMAGE;
  const classification = normalizeBusinessClassification(business);
  const businessTag = classification.subcategory || business.custom_category || business.subcategory || business.category;
  const categoryColor = BUSINESS_CATEGORY_COLORS[classification.category] || COLORS.accent;
  const categoryIcon = SUBCATEGORY_ICON_MAP[classification.subcategory] || CATEGORY_ICON_MAP[classification.category] || "shape-outline";
  const reviewCount = business.review_count || 0;
  const ratingValue = business.average_rating ? Number(business.average_rating).toFixed(1) : "0.0";
  return (
    <Pressable style={({ pressed }) => [styles.businessCard, compact && styles.businessCardCompact, dense && styles.businessCardDense, pressed && styles.pressed]} onPress={() => onPress(business.id, business)}>
      <View style={styles.businessImageWrap}>
        <Image source={{ uri: image }} style={[styles.businessImage, compact && styles.businessImageCompact, dense && styles.businessImageDense]} />
      </View>
      <View style={[styles.businessBody, compact && styles.businessBodyCompact, dense && styles.businessBodyDense]}>
        <View style={styles.categoryPillChip}>
          <View style={[styles.categoryPillIconWrap, { backgroundColor: categoryColor }]}>
            <MaterialCommunityIcons color="#FFFFFF" name={categoryIcon} size={12} />
          </View>
          <Text style={styles.categoryPillText}>{businessTag}</Text>
        </View>
        <Text style={[styles.businessName, compact && styles.businessNameCompact, dense && styles.businessNameDense]} numberOfLines={1}>{business.name}</Text>
        {enhanced ? (
          <View style={styles.businessLocationRow}>
            <Ionicons color={COLORS.light} name="location-outline" size={14} />
            <Text style={styles.businessLocation} numberOfLines={1}>{business.location}</Text>
          </View>
        ) : (
          <Text style={styles.businessLocation} numberOfLines={1}>{business.location}</Text>
        )}
        <View style={styles.metaRow}>
          <View style={styles.businessMetaInline}>
            <Ionicons color="#F59E0B" name="star" size={14} />
            <Text style={styles.businessMetaText}>{`${ratingValue} (${reviewCount})`}</Text>
          </View>
          <Text style={styles.businessPriceText}>{formatPrice(business)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function BookingCard({ booking, showCustomer, onCancel, onPress, showChevron = false, showStatusIcon = false }) {
  const isDaily = (booking.booking_type || "hourly") === "daily";
  const durationDays = booking.duration_days || 1;
  const normalizedStatus = String(booking.status || "confirmed").toLowerCase();
  const bookingIconName = normalizedStatus === "cancelled" ? "calendar-clear-outline" : "calendar-outline";
  const bookingMetaIcon = normalizedStatus === "cancelled" ? "close-circle" : "checkmark-circle";
  const bookingDateText = isDaily
    ? `${formatDate(booking.slot_date)}${durationDays > 1 ? ` • ${durationDays} day${durationDays > 1 ? "s" : ""}` : ""}`
    : `${formatDate(booking.slot_date)} - ${formatTime(booking.start_time)} to ${formatTime(booking.end_time)}`;
  const content = (
    <View style={showStatusIcon ? styles.bookingCardRow : null}>
      {showStatusIcon ? (
        <View style={[styles.bookingStatusBubble, styles[`bookingStatusBubble_${normalizedStatus}`]]}>
          <Ionicons color={styles[`bookingStatusBubbleGlyph_${normalizedStatus}`]?.color || COLORS.accent} name={bookingIconName} size={28} />
          <Ionicons
            color={styles[`bookingStatusBubbleGlyph_${normalizedStatus}`]?.color || COLORS.accent}
            name={bookingMetaIcon}
            size={16}
            style={styles.bookingStatusBubbleMeta}
          />
        </View>
      ) : null}
      <View style={showStatusIcon ? styles.bookingCardMain : null}>
        <View style={styles.bookingCardHeader}>
          <Text numberOfLines={2} style={styles.bookingCardTitle}>{showCustomer ? booking.customer_name : booking.business_name}</Text>
          <View style={styles.bookingCardHeaderRight}>
            <StatusBadge status={normalizedStatus} />
            {showChevron ? <Ionicons color={COLORS.light} name="chevron-forward" size={18} /> : null}
          </View>
        </View>
        <Text style={styles.businessLocation}>{bookingDateText}</Text>
        {booking.service_name ? <Text style={styles.businessLocation}>{booking.service_name}</Text> : null}
        {showCustomer ? <Text style={styles.businessLocation}>{booking.customer_phone}</Text> : null}
        {normalizedStatus === "confirmed" && onCancel ? <AppButton variant="secondary" style={{ marginTop: 10 }} onPress={() => onCancel(booking.id)}>Cancel</AppButton> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => onPress(booking)}>
        {content}
      </Pressable>
    );
  }

  return <Card>{content}</Card>;
}

function formatBusinessBookingAmount(symbol, value) {
  if (value === null || value === undefined || value === "") {
    return `${symbol || "₹"} 0`;
  }
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(amount)) {
    return `${symbol || "₹"} 0`;
  }
  return `${symbol || "₹"} ${amount.toLocaleString()}`;
}

function businessBookingStatusTone(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "confirmed" || normalized === "upcoming" || normalized === "available") {
    return { backgroundColor: "#E8F7EC", color: "#22A35A", label: normalized === "available" ? "Available" : normalized === "upcoming" ? "Upcoming" : "Confirmed" };
  }
  if (normalized === "pending") return { backgroundColor: "#FFF4DD", color: "#E39A12", label: "Pending" };
  if (normalized === "completed") return { backgroundColor: "#EEF4FF", color: "#4B83F5", label: "Completed" };
  if (normalized === "cancelled") return { backgroundColor: "#FEECEC", color: "#E25757", label: "Cancelled" };
  console.warn("Unknown business booking status:", status);
  return { backgroundColor: "#F3F4F6", color: "#6B7280", label: "Unknown" };
}

export function BusinessBookingStatusBadge({ status }) {
  const tone = businessBookingStatusTone(status);
  return (
    <View style={[styles.businessBookingStatusBadge, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.businessBookingStatusBadgeText, { color: tone.color }]}>{tone.label}</Text>
    </View>
  );
}

export function BusinessBookingCard({ booking, onPress }) {
  const image = booking.service_image || FALLBACK_IMAGE;
  const amount = formatBusinessBookingAmount(booking.currency_symbol, booking.total_price);
  const isDaily = (booking.booking_type || "hourly") === "daily";

  return (
    <Pressable style={({ pressed }) => [styles.businessBookingCard, pressed && styles.pressed]} onPress={() => onPress?.(booking)}>
      <View style={styles.businessBookingTopRow}>
        <Image source={{ uri: image }} style={styles.businessBookingImage} />
        <View style={styles.businessBookingMain}>
          <Text numberOfLines={2} style={styles.businessBookingTitle}>{booking.service_name || booking.business_name}</Text>
          <View style={styles.businessBookingInfoRow}>
            <Ionicons color="#93A0B4" name="calendar-outline" size={15} />
            <Text style={styles.businessBookingInfoText}>{formatDate(booking.slot_date)}</Text>
          </View>
          <View style={styles.businessBookingInfoRow}>
            <Ionicons color="#93A0B4" name="time-outline" size={15} />
            <Text style={styles.businessBookingInfoText}>
              {isDaily
                ? `${booking.duration_days || 1} Day${(booking.duration_days || 1) > 1 ? "s" : ""}`
                : `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`}
            </Text>
          </View>
        </View>
        <View style={styles.businessBookingAside}>
          <BusinessBookingStatusBadge status={booking.status} />
          <View style={styles.businessBookingAmountWrap}>
            <Text style={styles.businessBookingAmount}>{amount}</Text>
            <Ionicons color="#B1BAC8" name="chevron-forward" size={18} />
          </View>
        </View>
      </View>
      <View style={styles.businessBookingFooterRow}>
        <View style={styles.businessBookingFooterItem}>
          <CustomerAvatar name={booking.customer_name} size={22} uri={booking.customer_profile_image} />
          <Text numberOfLines={1} style={styles.businessBookingFooterText}>{booking.customer_name}</Text>
        </View>
        <View style={styles.businessBookingFooterItem}>
          <Ionicons color="#93A0B4" name="call-outline" size={15} />
          <Text numberOfLines={1} style={styles.businessBookingFooterText}>{booking.customer_phone}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function CustomerBookingCard({ booking, onPress }) {
  const image = booking.service_image || FALLBACK_IMAGE;
  const amount = formatBusinessBookingAmount(booking.currency_symbol, booking.total_price);
  const isDaily = (booking.booking_type || "hourly") === "daily";
  const title = booking.service_name || booking.business_name || "Booking";
  const footerText = booking.business_name && booking.business_name !== title
    ? booking.business_name
    : booking.location || booking.business_location || "Booking details";

  return (
    <Pressable style={({ pressed }) => [styles.businessBookingCard, pressed && styles.pressed]} onPress={() => onPress?.(booking)}>
      <View style={styles.businessBookingTopRow}>
        <Image source={{ uri: image }} style={styles.businessBookingImage} />
        <View style={styles.businessBookingMain}>
          <Text numberOfLines={2} style={styles.businessBookingTitle}>{title}</Text>
          <View style={styles.businessBookingInfoRow}>
            <Ionicons color="#93A0B4" name="calendar-outline" size={15} />
            <Text style={styles.businessBookingInfoText}>{formatDate(booking.slot_date)}</Text>
          </View>
          <View style={styles.businessBookingInfoRow}>
            <Ionicons color="#93A0B4" name="time-outline" size={15} />
            <Text style={styles.businessBookingInfoText}>
              {isDaily
                ? `${booking.duration_days || 1} Day${(booking.duration_days || 1) > 1 ? "s" : ""}`
                : `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`}
            </Text>
          </View>
        </View>
        <View style={styles.businessBookingAside}>
          <BusinessBookingStatusBadge status={booking.status} />
          <View style={styles.businessBookingAmountWrap}>
            <Text style={styles.businessBookingAmount}>{amount}</Text>
            <Ionicons color="#B1BAC8" name="chevron-forward" size={18} />
          </View>
        </View>
      </View>
      <View style={styles.businessBookingFooterRow}>
        <View style={styles.businessBookingFooterItemWide}>
          <Ionicons color="#93A0B4" name="business-outline" size={15} />
          <Text numberOfLines={1} style={styles.businessBookingFooterText}>{footerText}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: {
    backgroundColor: COLORS.background,
    flex: 1
  },
  keyboardAvoiding: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingTop: SCREEN_TOP_PADDING
  },
  withTabs: {
    paddingBottom: 96
  },
  profileSubtitle: {
    color: "#667085",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: -6
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  detailHero: {
    marginBottom: 14,
    marginHorizontal: -8,
    marginTop: 0,
    position: "relative"
  },
  galleryPageHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 14
  },
  allMediaTabs: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16
  },
  allMediaTabButton: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 3,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 4
  },
  allMediaTabButtonActive: {
    borderBottomColor: COLORS.accent
  },
  allMediaTabText: {
    color: COLORS.light,
    fontSize: 16,
    fontWeight: "800"
  },
  allMediaTabTextActive: {
    color: COLORS.accent
  },
  galleryPageHeaderText: {
    flex: 1
  },
  detailHeroImage: {
    backgroundColor: COLORS.border,
    borderRadius: 18,
    height: 280,
    width: "100%"
  },
  heroIconButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderRadius: 16,
    borderWidth: 0,
    bottom: 14,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    width: 40
  },
  heroIconButtonActive: {
    backgroundColor: "transparent",
    borderColor: "transparent"
  },
  heroSaveButton: {
    left: 16
  },
  heroShareButton: {
    right: 16
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 14
  },
  titlePressable: {
    flex: 1
  },
  eyebrow: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1
  },
  compactHomeTitle: {
    fontSize: 24,
    letterSpacing: -0.6
  },
  homeBrandTitle: {
    fontSize: 23,
    letterSpacing: 0
  },
  homeBrandAiText: {
    color: COLORS.accent
  },
  confirmBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.38)",
    flex: 1,
    justifyContent: "flex-end"
  },
  confirmDismissArea: {
    flex: 1
  },
  confirmSheet: {
    backgroundColor: "#D1D5DB",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10
  },
  confirmHandle: {
    alignSelf: "center",
    backgroundColor: "#9CA3AF",
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    width: 42
  },
  confirmIconWrap: {
    alignItems: "center",
    marginBottom: 14
  },
  confirmIconCircle: {
    alignItems: "center",
    backgroundColor: "#6B7280",
    borderColor: "#9CA3AF",
    borderRadius: 999,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  confirmTitle: {
    color: "#111111",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  confirmText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center"
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20
  },
  confirmActionButton: {
    flex: 1
  },
  confirmStayButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderWidth: 1
  },
  confirmLogoutButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#9CA3AF",
    borderWidth: 1
  },
  confirmActionText: {
    color: "#111111"
  },
  sectionTitle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  sectionTitleText: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900"
  },
  bodyText: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22
  },
  button: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 18
  },
  primaryButton: {
    backgroundColor: COLORS.accent
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1
  },
  dangerButton: {
    backgroundColor: COLORS.danger
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "900"
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  primaryButtonText: {
    color: "#FFFFFF"
  },
  secondaryButtonText: {
    color: COLORS.text
  },
  dangerButtonText: {
    color: "#FFFFFF"
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }]
  },
  field: {
    gap: 7,
    marginBottom: 11
  },
  profileFieldBlock: {
    marginBottom: 18
  },
  profileFieldLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8
  },
  profileFieldDescription: {
    color: "#475467",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    marginBottom: 10
  },
  profileInputShell: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: "#D6DCE5",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 56,
    paddingHorizontal: 14
  },
  profileTextareaShell: {
    alignItems: "flex-start",
    minHeight: 108,
    paddingTop: 14
  },
  profileInputIcon: {
    marginRight: 12
  },
  profileInputTrailingIcon: {
    marginLeft: 12
  },
  profileInputText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    minHeight: 52,
    paddingVertical: 0
  },
  profileTextareaText: {
    minHeight: 80,
    paddingTop: 2,
    textAlignVertical: "top"
  },
  profileFieldCounter: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "right"
  },
  profileHideButton: {
    minHeight: 38,
    paddingHorizontal: 16
  },
  profileCategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
    rowGap: 12
  },
  profileCategoryCard: {
    backgroundColor: COLORS.surface,
    borderColor: "#DEE3EA",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 86,
    paddingHorizontal: 10,
    paddingVertical: 10,
    position: "relative",
    width: "48.5%"
  },
  profileCategoryCardActive: {
    borderColor: "#243B63",
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  profileCategoryIconBox: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  profileCategoryTextWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 0
  },
  profileCategoryTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
    marginBottom: 2
  },
  profileCategoryDescription: {
    color: "#344054",
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15
  },
  profileCategoryCheck: {
    alignItems: "center",
    backgroundColor: "#243B63",
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    top: 8,
    width: 20
  },
  profileSubcategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 4,
    rowGap: 12
  },
  profileSubcategoryItem: {
    width: "48.5%"
  },
  profileSectionDivider: {
    backgroundColor: "#EAEEF3",
    height: 1,
    marginBottom: 18,
    marginTop: 4
  },
  profileSaveButton: {
    borderRadius: 16,
    marginTop: 8,
    minHeight: 54
  },
  label: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  fieldHint: {
    color: COLORS.light,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: -5
  },
  successText: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  locationSuggestionBox: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    marginTop: -4,
    padding: 10
  },
  locationSuggestionItem: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  locationSuggestionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  locationSuggestionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3
  },
  locationHelperText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    color: COLORS.text,
    minHeight: 48,
    paddingHorizontal: 14
  },
  textarea: {
    minHeight: 94,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  uploadField: {
    gap: 8,
    marginBottom: 12
  },
  uploadBox: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 210,
    overflow: "hidden"
  },
  uploadBoxFilled: {
    backgroundColor: COLORS.surface,
    borderStyle: "solid"
  },
  uploadPreview: {
    height: 230,
    width: "100%"
  },
  uploadPlaceholder: {
    alignItems: "center",
    gap: 8,
    padding: 22
  },
  uploadIcon: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    color: COLORS.accent,
    fontSize: 26,
    fontWeight: "900",
    height: 48,
    lineHeight: 45,
    textAlign: "center",
    width: 48
  },
  uploadTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900"
  },
  uploadHint: {
    color: COLORS.light,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  uploadRemoveText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "900"
  },
  galleryUploadButton: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 12,
    minHeight: 92,
    padding: 14
  },
  galleryCount: {
    color: COLORS.light,
    fontSize: 12,
    fontWeight: "900"
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10
  },
  galleryPreviewTile: {
    backgroundColor: COLORS.border,
    borderRadius: 16,
    height: 96,
    overflow: "hidden",
    position: "relative",
    width: "30%"
  },
  galleryPreviewImage: {
    height: "100%",
    width: "100%"
  },
  galleryImageLoader: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  videoPreviewTile: {
    alignItems: "center",
    backgroundColor: "#111111",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
    padding: 8,
    position: "relative"
  },
  videoThumbnailFallback: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  videoThumbnailOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.32)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  videoPreviewDuration: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 6
  },
  videoPreviewIcon: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  videoPreviewText: {
    color: "#DDDDDD",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4
  },
  galleryRemoveButton: {
    alignItems: "center",
    backgroundColor: "rgba(17, 17, 17, 0.78)",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 6,
    width: 26
  },
  galleryRemoveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18
  },
  datePickerButton: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16
  },
  datePickerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  datePickerText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  datePickerHint: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5
  },
  bookingSectionGap: {
    marginBottom: 16
  },
  bookingSectionLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8
  },
  bookingSlotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16
  },
  bookingSlotChip: {
    height: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    width: "31.3%"
  },
  bookingDurationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16
  },
  bookingDurationChip: {
    height: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    width: 72
  },
  bookingSummary: {
    marginBottom: 16,
    padding: 16
  },
  bookingConfirmButton: {
    marginTop: 0
  },
  calendarBadge: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  calendarBadgeIcon: {
    color: COLORS.accent
  },
  calendarBadgeText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900"
  },
  slotDateTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginBottom: 12,
    marginTop: 4
  },
  slotLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  slotLegendItem: {
    alignItems: "center",
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  slotLegendDot: {
    borderRadius: 999,
    height: 9,
    width: 9
  },
  slotLegendDot_available: {
      backgroundColor: "#2F6B43"
    },
  slotLegendDot_blocked: {
      backgroundColor: "#8F4A3C"
    },
  slotLegendDot_booked: {
    backgroundColor: COLORS.light
  },
  slotLegendText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  slotHelperText: {
    color: COLORS.light,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 12
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  slotTile: {
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 72,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: "30%"
  },
  slotTile_available: {
      backgroundColor: "#DDEFE3",
      borderColor: "#8EB89A"
    },
  slotTile_blocked: {
      backgroundColor: "#F3E0DC",
      borderColor: "#C9897B"
    },
  slotTile_booked: {
    backgroundColor: "#EEEEEE",
    borderColor: "#D8D8D8"
  },
  slotTileTime: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900"
  },
  slotTileTime_available: {
      color: "#2F6B43"
    },
  slotTileTime_blocked: {
      color: "#8F4A3C"
    },
  slotTileTime_booked: {
    color: COLORS.muted
  },
  slotTileStatus: {
    fontSize: 11,
    fontWeight: "900",
    marginTop: 7,
    textTransform: "uppercase"
  },
  slotTileStatus_available: {
      color: "#2F6B43"
    },
  slotTileStatus_blocked: {
      color: "#8F4A3C"
    },
  slotTileStatus_booked: {
    color: COLORS.muted
  },
  chipRow: {
    gap: 12,
    paddingBottom: 8,
    paddingTop: 4
  },
  chip: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900"
  },
  chipTextActive: {
    color: "#FFFFFF"
  },
  emptyState: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    padding: 18
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center"
  },
  aiPanel: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
    borderRadius: 20,
    marginBottom: 24,
    padding: 16
  },
  aiPanelEyebrow: {
    color: "#BFE4C6",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  aiPanelTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 16,
    marginTop: 8
  },
  aiInputRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    padding: 8
  },
  aiInput: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 44,
    paddingHorizontal: 12
  },
  aiSendButton: {
    minHeight: 44,
    paddingHorizontal: 20
  },
  aiThinkingText: {
    color: "#DDDDDD",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 10
  },
  aiErrorText: {
    color: "#FFD0CA",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10
  },
  aiAnswerBox: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 14
  },
  aiAnswerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21
  },
  homeHeroCard: {
    marginBottom: 24,
    padding: 16
  },
  homeHeroButton: {
    minHeight: 56
  },
  homeHeroButtonText: {
    fontSize: 18,
    letterSpacing: 0.2
  },
  homeCategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 24
  },
  homeCategoryChip: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "48%",
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-start",
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8
  },
  homeCategoryChipCompact: {
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  homeCategoryChipPressed: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent
  },
  homeCategoryChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  homeCategoryIcon: {
    color: COLORS.accent,
    fontWeight: "900",
    textAlign: "center"
  },
  homeCategoryIconWrap: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  homeCategoryIconWrapCompact: {
    height: 30,
    width: 30
  },
  homeCategoryText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 0
  },
  homeCategoryTextCompact: {
    fontSize: 13,
    lineHeight: 17
  },
  homeCategoryTextActive: {
    color: COLORS.surface
  },
  bottomTabs: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    bottom: 12,
    flexDirection: "row",
    gap: 8,
    left: 16,
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: "absolute",
    right: 16,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  tab: {
      alignItems: "center",
      borderRadius: 18,
      flex: 1,
      gap: 4,
      justifyContent: "center",
      minHeight: 58,
      paddingTop: 2
    },
  tabActive: {
      backgroundColor: "transparent",
      borderBottomColor: COLORS.accent,
      borderBottomWidth: 3
    },
  tabIconWrap: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderRadius: 999,
      height: 26,
      justifyContent: "center",
      width: 26
    },
  tabIconWrapActive: {
      backgroundColor: "transparent"
    },
  tabIcon: {
      lineHeight: 24
    },
  tabLabel: {
      color: "#888888",
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center"
    },
  tabLabelActive: {
      color: COLORS.accent
    },
  businessCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  },
  businessCardCompact: {
    marginBottom: 0,
    width: 168
  },
  businessCardDense: {
    marginBottom: 10
  },
  businessImageWrap: {
    position: "relative"
  },
  businessImage: {
    backgroundColor: COLORS.border,
    height: 174,
    width: "100%"
  },
  businessImageCompact: {
    height: 136,
    width: "100%"
  },
  businessImageDense: {
    height: 150
  },
  businessBody: {
    gap: 8,
    padding: 14
  },
  businessBodyCompact: {
    padding: 12
  },
  businessBodyDense: {
    gap: 6,
    padding: 12
  },
  businessCardHeart: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 12,
    width: 34
  },
  businessCardHeartDense: {
    height: 30,
    right: 10,
    top: 10,
    width: 30
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.accentSoft,
    borderColor: "transparent",
    borderRadius: 999,
    borderWidth: 1,
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  categoryPillChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.accentSoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  categoryPillIconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  categoryPillText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "900"
  },
  categoryPillPressable: {
    alignSelf: "flex-start"
  },
  businessName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  businessNameCompact: {
    fontSize: 16
  },
  businessNameDense: {
    fontSize: 17
  },
  businessLocation: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  businessLocationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  businessMetaInline: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  businessMetaText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  businessPriceText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  metaPill: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 7,
    textAlign: "center"
  },
  browseCategoryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  browseCategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  browseCategoryButton: {
    minHeight: 38,
    paddingHorizontal: 12
  },
  browseCategoryButtonText: {
    fontSize: 12
  },
  settingDetailRow: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    gap: 6,
    paddingVertical: 12
  },
  serviceEditorCard: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  serviceBookingTypeRow: {
    gap: 12,
    marginBottom: 12,
    marginTop: 8
  },
  serviceBookingTypeCard: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  serviceBookingTypeCardActive: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 1
  },
  serviceBookingTypeIcon: {
    alignItems: "center",
    backgroundColor: "#EEF2F6",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    marginRight: 12,
    width: 36
  },
  serviceBookingTypeIconActive: {
    backgroundColor: COLORS.accent
  },
  serviceBookingTypeText: {
    flex: 1
  },
  serviceBookingTypeTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800"
  },
  serviceBookingTypeDescription: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2
  },
  serviceBookingTypeCheck: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  serviceBookingTypeHintBox: {
    backgroundColor: "#F6F8FA",
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  serviceEditorCardNew: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  serviceGrid: {
    gap: 12
  },
  serviceCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden"
  },
  serviceCardImage: {
    backgroundColor: COLORS.border,
    height: 150,
    width: "100%"
  },
  serviceCardBody: {
    gap: 7,
    padding: 12
  },
  serviceMediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  galleryMediaButton: {
    position: "relative"
  },
  galleryMediaFrame: {
    borderRadius: 16,
    height: 96,
    overflow: "hidden",
    width: "30%"
  },
  galleryMediaImage: {
    backgroundColor: COLORS.border,
    height: "100%",
    width: "100%"
  },
  galleryMediaTile: {
    borderRadius: 16,
    overflow: "hidden"
  },
  galleryPageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  galleryFlatListContent: {
    paddingBottom: 8
  },
  galleryFlatListRow: {
    justifyContent: "space-between",
    marginBottom: 12
  },
  galleryPageTile: {
    borderRadius: 18,
    height: 112,
    overflow: "hidden",
    width: "31%"
  },
  galleryMoreTile: {
    backgroundColor: COLORS.accentSoft,
    justifyContent: "center"
  },
  galleryMoreTileContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  galleryMoreTileOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(75, 85, 99, 0.42)",
    justifyContent: "center"
  },
  galleryMoreTileTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10
  },
  galleryMoreTileSubtitle: {
    color: "#F3F4F6",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center"
  },
  serviceMediaImage: {
    backgroundColor: COLORS.border,
    borderRadius: 16,
    height: 96,
    width: "30%"
  },
  galleryMoreOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(17, 17, 17, 0.52)",
    borderRadius: 16,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  galleryMoreText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900"
  },
  galleryCountText: {
    color: COLORS.light,
    fontSize: 12,
    fontWeight: "900"
  },
  galleryVideoHero: {
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    justifyContent: "center"
  },
  galleryVideoHeroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 12
  },
  galleryVideoHeroHint: {
    color: "#D6D6D6",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6
  },
  galleryMediaSelectedRing: {
    borderColor: COLORS.accent,
    borderRadius: 16,
    borderWidth: 2,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  galleryViewerOverlay: {
    backgroundColor: "rgba(10, 10, 10, 0.96)",
    flex: 1,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 20
  },
  galleryViewerTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  galleryViewerCloseButton: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.18)"
  },
  galleryViewerShareButton: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.18)"
  },
  galleryViewerCount: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900"
  },
  galleryViewerScroll: {
    flex: 1
  },
  galleryViewerSlide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  galleryViewerImage: {
    height: "82%",
    width: "100%"
  },
  galleryViewerVideoCard: {
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 28,
    width: "100%"
  },
  galleryViewerVideoSurface: {
    backgroundColor: "#000000",
    borderRadius: 18,
    height: 260,
    overflow: "hidden",
    width: "100%"
  },
  galleryViewerVideoTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 14
  },
  galleryViewerVideoMeta: {
    color: "#D6D6D6",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8
  },
  galleryViewerExternalButton: {
    marginTop: 16,
    minWidth: 160
  },
  galleryViewerVideoButton: {
    marginTop: 18,
    minWidth: 140
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  bookingCardHeaderRight: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 8
  },
  bookingCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  bookingCardTitle: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
    minWidth: 0,
    paddingRight: 8
  },
  bookingCardMain: {
    flex: 1
  },
  businessBookingCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2
  },
  businessBookingTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10
  },
  businessBookingImage: {
    backgroundColor: "#E8EDF4",
    borderRadius: 12,
    height: 64,
    width: 64
  },
  businessBookingMain: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  businessBookingTitle: {
    color: "#1B263B",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20
  },
  businessBookingAside: {
    alignItems: "flex-end",
    alignSelf: "stretch",
    minWidth: 84
  },
  businessBookingStatusBadge: {
    borderRadius: 999,
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  businessBookingStatusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  businessBookingInfoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  businessBookingInfoText: {
    color: "#7B8798",
    fontSize: 12,
    fontWeight: "600"
  },
  businessBookingAmountWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-end",
    marginTop: 14,
    minWidth: 82
  },
  businessBookingAmount: {
    color: "#1B263B",
    fontSize: 16,
    fontWeight: "800"
  },
  businessBookingFooterRow: {
    borderTopColor: "#EEF2F6",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 12,
    paddingTop: 10
  },
  businessBookingFooterItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 6
  },
  businessBookingFooterItemWide: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 6
  },
  businessBookingFooterText: {
    color: "#6E7B90",
    flex: 1,
    fontSize: 12,
    fontWeight: "600"
  },
  bookingCardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  bookingStatusBubble: {
    alignItems: "center",
    borderRadius: 999,
    height: 58,
    justifyContent: "center",
    position: "relative",
    width: 58
  },
  bookingStatusBubbleMeta: {
    bottom: 11,
    position: "absolute",
    right: 9
  },
  bookingStatusBubble_confirmed: {
    backgroundColor: "#E7F4EA"
  },
  bookingStatusBubbleGlyph_confirmed: {
    color: "#2E7D32"
  },
  bookingStatusBubble_cancelled: {
    backgroundColor: "#FDECEC"
  },
  bookingStatusBubbleGlyph_cancelled: {
    color: "#D93025"
  },
  bookingStatusBubble_completed: {
    backgroundColor: "#E8F6EA"
  },
  bookingStatusBubbleGlyph_completed: {
    color: "#1E7A34"
  },
  status: {
    alignItems: "center",
    borderRadius: 999,
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900"
  },
  status_confirmed: {
    backgroundColor: "#E7F4EA"
  },
  statusText_confirmed: {
    color: "#2E7D32"
  },
  status_cancelled: {
    backgroundColor: "#FDECEC"
  },
  statusText_cancelled: {
    color: "#D93025"
  },
  status_completed: {
    backgroundColor: "#E8F6EA"
  },
  statusText_completed: {
    color: "#1E7A34"
  },
  status_pending: {
    backgroundColor: "#FFF1D6"
  },
  statusText_pending: {
    color: "#C97A00"
  },
  customerAvatar: {
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    justifyContent: "center",
    overflow: "hidden"
  },
  customerAvatarImage: {
    height: "100%",
    width: "100%"
  }
});
