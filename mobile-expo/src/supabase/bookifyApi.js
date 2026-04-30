import { isSupabaseConfigured, supabase } from "./client";

function success(message, data = {}) {
  return { message, data, errors: [] };
}

function fail(message) {
  throw new Error(message);
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    fail("Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile-expo/.env.");
  }
}

function normalizeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    profile_image: profile.profile_image,
    account_type: profile.account_type,
    created_at: profile.created_at
  };
}

function normalizeBusiness(business, reviews = []) {
  if (!business) return null;
  const relatedReviews = reviews.filter((review) => Number(review.business_id) === Number(business.id));
  const ratingTotal = relatedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  const average = relatedReviews.length ? Math.round((ratingTotal / relatedReviews.length) * 10) / 10 : 0;
  return {
    ...business,
    gallery_images: business.gallery_images || [],
    closed_days: business.closed_days || [],
    currency: business.currency_code || "INR",
    review_count: relatedReviews.length,
    average_rating: average
  };
}

function normalizeBooking(booking, businessName) {
  return {
    ...booking,
    business_name: booking.business_name || businessName || booking.businesses?.name || null
  };
}

function currentDateTimeFromBooking(booking) {
  return new Date(`${booking.slot_date}T${booking.end_time}:00`);
}

async function getProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) fail(authError.message);
  if (!authData.user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  if (error) fail(error.message);
  return data;
}

async function requireProfile(role) {
  const profile = await getProfile();
  if (!profile) fail("Please login to continue.");
  if (role && profile.account_type !== role) fail(`Only ${role} accounts can do this.`);
  return profile;
}

async function getReviewsForBusinessIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("reviews").select("*").in("business_id", ids);
  if (error) fail(error.message);
  return data || [];
}

function parseQuery(path) {
  const [route, queryText = ""] = path.split("?");
  return [route, new URLSearchParams(queryText)];
}

function addHours(time, hours) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour + Number(hours), minute, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function eachDate(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function weekdayIndex(dateText) {
  const day = new Date(`${dateText}T00:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

function minutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(total) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

async function handleAuth(path, method, body) {
  if (path === "/auth/signup" && method === "POST") {
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: { data: { name: body.name, phone: body.phone } }
    });
    if (error) fail(error.message);
    if (!data.user) fail("Signup did not return a user.");

    const profile = {
      id: data.user.id,
      name: body.name,
      email: body.email,
      phone: body.phone || "",
      account_type: null
    };
    const { error: profileError } = await supabase.from("profiles").upsert(profile);
    if (profileError) fail(profileError.message);
    return success("Signup successful.", { user: normalizeProfile(profile) });
  }

  if (path === "/auth/login" && method === "POST") {
    const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
    if (error) fail(error.message);
    const profile = await requireProfile();
    return success("Login successful.", { user: normalizeProfile(profile) });
  }

  if (path === "/auth/logout" && method === "POST") {
    const { error } = await supabase.auth.signOut();
    if (error) fail(error.message);
    return success("Logged out successfully.");
  }

  if (path === "/auth/me" && method === "GET") {
    const profile = await getProfile();
    return success("Current user fetched.", { user: normalizeProfile(profile) });
  }

  if (path === "/auth/role" && method === "PATCH") {
    const profile = await requireProfile();
    const { data, error } = await supabase
      .from("profiles")
      .update({ account_type: body.account_type })
      .eq("id", profile.id)
      .select()
      .single();
    if (error) fail(error.message);
    return success("Account type updated.", { user: normalizeProfile(data) });
  }

  if (path === "/auth/profile" && method === "PATCH") {
    const profile = await requireProfile();
    const { data, error } = await supabase
      .from("profiles")
      .update({ name: body.name, email: body.email, phone: body.phone || "", profile_image: body.profile_image || null })
      .eq("id", profile.id)
      .select()
      .single();
    if (error) fail(error.message);
    return success("Profile updated successfully.", { user: normalizeProfile(data) });
  }

  return null;
}

async function listBusinesses(query) {
  let request = supabase
    .from("businesses")
    .select("*")
    .eq("is_active", true)
    .eq("is_booking_active", true)
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true });

  if (query.get("search")) request = request.ilike("name", `%${query.get("search")}%`);
  if (query.get("category")) request = request.eq("category", query.get("category"));
  if (query.get("location")) request = request.ilike("location", `%${query.get("location")}%`);
  if (query.get("featured") === "true") request = request.eq("is_featured", true);

  const { data, error } = await request;
  if (error) fail(error.message);
  const reviews = await getReviewsForBusinessIds((data || []).map((business) => business.id));
  return success("Businesses fetched successfully.", {
    businesses: (data || []).map((business) => normalizeBusiness(business, reviews))
  });
}

async function handleBusinesses(path, method, body, query) {
  if (path === "/businesses" && method === "GET") return listBusinesses(query);

  if (path === "/businesses/mine" && method === "GET") {
    const profile = await requireProfile("Business");
    const { data, error } = await supabase.from("businesses").select("*").eq("owner_user_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) fail(error.message);
    const reviews = data ? await getReviewsForBusinessIds([data.id]) : [];
    return success("Business fetched successfully.", { business: normalizeBusiness(data, reviews) });
  }

  if (path === "/businesses" && method === "POST") {
    const profile = await requireProfile("Business");
    const { data: existing, error: existingError } = await supabase.from("businesses").select("id").eq("owner_user_id", profile.id).eq("is_active", true).maybeSingle();
    if (existingError) fail(existingError.message);
    if (existing) fail("Business already exists.");

    const { data, error } = await supabase
      .from("businesses")
      .insert({ ...body, owner_user_id: profile.id, currency_code: body.currency_code || body.currency || "INR" })
      .select()
      .single();
    if (error) fail(error.message);
    return success("Business created successfully.", { business: normalizeBusiness(data) });
  }

  const updateMatch = path.match(/^\/businesses\/(\d+)$/);
  if (updateMatch && method === "PUT") {
    const profile = await requireProfile("Business");
    const { data, error } = await supabase
      .from("businesses")
      .update({ ...body, currency_code: body.currency_code || body.currency || "INR" })
      .eq("id", updateMatch[1])
      .eq("owner_user_id", profile.id)
      .select()
      .single();
    if (error) fail(error.message);
    return success("Business updated successfully.", { business: normalizeBusiness(data) });
  }

  const detailMatch = path.match(/^\/businesses\/(\d+)$/);
  if (detailMatch && method === "GET") {
    const { data, error } = await supabase.from("businesses").select("*").eq("id", detailMatch[1]).eq("is_active", true).maybeSingle();
    if (error) fail(error.message);
    if (!data) fail("Business not found.");

    const { data: reviews, error: reviewsError } = await supabase.from("reviews").select("*").eq("business_id", data.id).order("created_at", { ascending: false });
    if (reviewsError) fail(reviewsError.message);
    const profile = await getProfile();
    let isFavorite = false;
    if (profile?.account_type === "Customer") {
      const { data: favorite } = await supabase.from("favorites").select("id").eq("user_id", profile.id).eq("business_id", data.id).maybeSingle();
      isFavorite = Boolean(favorite);
    }
    return success("Business fetched successfully.", {
      business: {
        ...normalizeBusiness(data, reviews || []),
        is_favorite: isFavorite,
        reviews_preview: (reviews || []).slice(0, 5).map((review) => ({ ...review, user_name: "Customer" }))
      }
    });
  }

  return null;
}

async function handleSlots(path, method, body, query) {
  const listMatch = path.match(/^\/businesses\/(\d+)\/slots$/);
  if (listMatch && method === "GET") {
    const businessId = listMatch[1];
    let request = supabase.from("slots").select("*").eq("business_id", businessId).order("slot_date").order("start_time");
    if (query.get("date")) request = request.eq("slot_date", query.get("date"));
    if (query.get("all") !== "true") request = request.eq("status", "available");
    const { data, error } = await request;
    if (error) fail(error.message);
    const message = query.get("date") && (!data || !data.length) ? "No slots available for this date. Please choose another date." : "Slots fetched successfully.";
    return success(message, { slots: data || [] });
  }

  const generateMatch = path.match(/^\/businesses\/(\d+)\/slots\/generate$/);
  if (generateMatch && method === "POST") {
    const profile = await requireProfile("Business");
    const { data: business, error } = await supabase.from("businesses").select("*").eq("id", generateMatch[1]).eq("owner_user_id", profile.id).single();
    if (error) fail(error.message);

    const selectedWeekdays = body.weekdays || [];
    const rows = [];
    for (const slotDate of eachDate(body.start_date, body.end_date)) {
      if (!selectedWeekdays.includes(weekdayIndex(slotDate))) continue;
      const start = minutes(business.opening_time);
      const end = minutes(business.closing_time);
      let cursor = start;
      while (cursor + 60 <= end) {
        rows.push({
          business_id: business.id,
          slot_date: slotDate,
          start_time: timeFromMinutes(cursor),
          end_time: timeFromMinutes(cursor + 60),
          status: "available"
        });
        cursor += 60 + Number(business.buffer_time_between_slots || 0);
      }
    }

    if (!rows.length) return success("No slots generated.", { slots: [] }, 201);
    const { data, error: insertError } = await supabase.from("slots").insert(rows).select();
    if (insertError) fail(insertError.message.includes("duplicate") ? "Duplicate slot generation detected for the selected date and time." : insertError.message);
    return success("Slots generated successfully.", { slots: data || [] }, 201);
  }

  const patchMatch = path.match(/^\/slots\/(\d+)$/);
  if (patchMatch && method === "PATCH") {
    await requireProfile("Business");
    const { data, error } = await supabase.from("slots").update({ status: body.status, block_reason: body.block_reason || null }).eq("id", patchMatch[1]).neq("status", "booked").select().single();
    if (error) fail(error.message);
    return success("Slot updated successfully.", { slot: data });
  }

  const closureMatch = path.match(/^\/businesses\/(\d+)\/closures$/);
  if (closureMatch && method === "POST") {
    await requireProfile("Business");
    const { data, error } = await supabase.from("slots").update({ status: "blocked", block_reason: "Temporary closure" }).eq("business_id", closureMatch[1]).in("slot_date", body.dates || []).neq("status", "booked").select();
    if (error) fail(error.message);
    return success("Closure applied successfully.", { updated_slots: (data || []).length });
  }

  return null;
}

async function handleBookings(path, method, body) {
  if (path === "/bookings" && method === "POST") {
    const profile = await requireProfile("Customer");
    const { data: business, error: businessError } = await supabase.from("businesses").select("*").eq("id", body.business_id).eq("is_active", true).eq("is_booking_active", true).single();
    if (businessError) fail(businessError.message);
    const duration = Number(body.duration_hours);
    if (duration < Number(business.min_booking_hours || 1)) fail(`Minimum booking duration is ${business.min_booking_hours || 1} hour(s).`);
    if (business.max_booking_hours && duration > Number(business.max_booking_hours)) fail(`Maximum booking duration is ${business.max_booking_hours} hour(s).`);

    const { data: slots, error: slotError } = await supabase
      .from("slots")
      .select("*")
      .eq("business_id", business.id)
      .eq("slot_date", body.slot_date)
      .eq("status", "available")
      .gte("start_time", body.start_time)
      .order("start_time")
      .limit(duration);
    if (slotError) fail(slotError.message);
    if (!slots || slots.length < duration || slots[0].start_time !== body.start_time) fail("Selected slot is no longer available.");

    const bookingPayload = {
      business_id: business.id,
      customer_user_id: profile.id,
      slot_date: body.slot_date,
      start_time: body.start_time,
      end_time: slots[slots.length - 1].end_time,
      duration_hours: duration,
      customer_name: body.customer_name || profile.name,
      customer_email: body.customer_email || profile.email,
      customer_phone: body.customer_phone || profile.phone || "",
      customer_profile_image: body.customer_profile_image || profile.profile_image || "",
      status: "confirmed"
    };
    const { data: booking, error: bookingError } = await supabase.from("bookings").insert(bookingPayload).select().single();
    if (bookingError) fail(bookingError.message);

    const { error: updateError } = await supabase.from("slots").update({ status: "booked", booking_id: booking.id }).in("id", slots.map((slot) => slot.id));
    if (updateError) fail(updateError.message);
    return success("Booking created successfully.", { booking: normalizeBooking(booking, business.name) }, 201);
  }

  if (path === "/bookings/customer" && method === "GET") {
    const profile = await requireProfile("Customer");
    const { data, error } = await supabase.from("bookings").select("*, businesses(name)").eq("customer_user_id", profile.id).order("slot_date", { ascending: false });
    if (error) fail(error.message);
    return success("Customer bookings fetched.", { bookings: (data || []).map((booking) => normalizeBooking(booking)) });
  }

  if (path === "/bookings/business" && method === "GET") {
    const profile = await requireProfile("Business");
    const { data: business, error: businessError } = await supabase.from("businesses").select("id").eq("owner_user_id", profile.id).eq("is_active", true).maybeSingle();
    if (businessError) fail(businessError.message);
    if (!business) return success("No business found.", { bookings: [] });
    const { data, error } = await supabase.from("bookings").select("*").eq("business_id", business.id).order("slot_date");
    if (error) fail(error.message);
    return success("Business bookings fetched.", { bookings: data || [] });
  }

  const cancelMatch = path.match(/^\/bookings\/(\d+)\/cancel$/);
  if (cancelMatch && method === "PATCH") {
    await requireProfile();
    const { data, error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", cancelMatch[1]).select().single();
    if (error) fail(error.message);
    await supabase.from("slots").update({ status: "available", booking_id: null }).eq("booking_id", data.id).neq("status", "blocked");
    return success("Booking cancelled successfully.", { booking: data });
  }

  return null;
}

async function handleFavorites(path, method) {
  if (path === "/favorites" && method === "GET") {
    const profile = await requireProfile("Customer");
    const { data, error } = await supabase.from("favorites").select("businesses(*)").eq("user_id", profile.id);
    if (error) fail(error.message);
    const businesses = (data || []).map((item) => normalizeBusiness(item.businesses)).filter(Boolean);
    return success("Favorites fetched successfully.", { businesses });
  }

  const match = path.match(/^\/favorites\/(\d+)$/);
  if (match && method === "POST") {
    const profile = await requireProfile("Customer");
    const { error } = await supabase.from("favorites").upsert({ user_id: profile.id, business_id: Number(match[1]) }, { onConflict: "user_id,business_id" });
    if (error) fail(error.message);
    return success("Business saved successfully.", { saved: true }, 201);
  }

  if (match && method === "DELETE") {
    const profile = await requireProfile("Customer");
    const { error } = await supabase.from("favorites").delete().eq("user_id", profile.id).eq("business_id", Number(match[1]));
    if (error) fail(error.message);
    return success("Business removed from saved list.", { saved: false });
  }

  return null;
}

async function handleReviews(path, method, body) {
  const match = path.match(/^\/businesses\/(\d+)\/reviews$/);
  if (!match) return null;

  if (method === "GET") {
    const { data, error } = await supabase.from("reviews").select("*").eq("business_id", match[1]).order("created_at", { ascending: false });
    if (error) fail(error.message);
    return success("Reviews fetched successfully.", { reviews: (data || []).map((review) => ({ ...review, user_name: "Customer" })) });
  }

  if (method === "POST") {
    const profile = await requireProfile("Customer");
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", match[1])
      .eq("customer_user_id", profile.id)
      .in("status", ["confirmed", "completed"])
      .limit(1)
      .maybeSingle();
    if (bookingError) fail(bookingError.message);
    if (!booking) fail("You need at least one booking for this business before reviewing.");

    const { data, error } = await supabase
      .from("reviews")
      .insert({ business_id: Number(match[1]), user_id: profile.id, booking_id: booking.id, rating: Number(body.rating), review_text: body.review_text })
      .select()
      .single();
    if (error) fail(error.message);
    return success("Review submitted successfully.", { review: { ...data, user_name: profile.name } }, 201);
  }

  return null;
}

async function handleDashboard(path, method) {
  if (path !== "/dashboard/summary" || method !== "GET") return null;
  const profile = await requireProfile("Business");
  const { data: business, error: businessError } = await supabase.from("businesses").select("*").eq("owner_user_id", profile.id).eq("is_active", true).maybeSingle();
  if (businessError) fail(businessError.message);
  if (!business) return success("No business found.", { summary: null });

  const { data: bookings, error: bookingsError } = await supabase.from("bookings").select("*").eq("business_id", business.id).order("slot_date");
  if (bookingsError) fail(bookingsError.message);
  const { data: reviews, error: reviewsError } = await supabase.from("reviews").select("*").eq("business_id", business.id);
  if (reviewsError) fail(reviewsError.message);

  const now = new Date();
  const confirmed = (bookings || []).filter((booking) => booking.status === "confirmed");
  const upcoming = confirmed.filter((booking) => currentDateTimeFromBooking(booking) >= now);
  const today = new Date().toISOString().slice(0, 10);
  const ratingTotal = (reviews || []).reduce((sum, review) => sum + Number(review.rating || 0), 0);
  const estimated = (bookings || [])
    .filter((booking) => ["confirmed", "completed"].includes(booking.status))
    .reduce((sum, booking) => sum + Number(booking.duration_hours || 0) * Number(business.price_per_hour || 0), 0);

  return success("Dashboard fetched successfully.", {
    business: normalizeBusiness(business, reviews || []),
    summary: {
      next_upcoming_booking: upcoming[0] || null,
      todays_bookings: (bookings || []).filter((booking) => booking.slot_date === today),
      todays_booking_count: (bookings || []).filter((booking) => booking.slot_date === today).length,
      total_bookings: (bookings || []).length,
      recent_bookings: [...(bookings || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5),
      total_reviews: (reviews || []).length,
      average_rating: reviews?.length ? Math.round((ratingTotal / reviews.length) * 10) / 10 : 0,
      estimated_earnings: estimated,
      currency: business.currency_code,
      currency_code: business.currency_code,
      currency_symbol: business.currency_symbol
    }
  });
}

async function handleNotifications(path, method) {
  if (path === "/notifications" && method === "GET") {
    const profile = await requireProfile();
    const { data, error } = await supabase.from("notifications").select("*").eq("recipient_user_id", profile.id).order("created_at", { ascending: false });
    if (error) fail(error.message);
    return success("Notifications fetched successfully.", {
      notifications: data || [],
      unread_count: (data || []).filter((item) => !item.is_read).length
    });
  }

  const match = path.match(/^\/notifications\/(\d+)\/read$/);
  if (match && method === "PATCH") {
    const profile = await requireProfile();
    const { data, error } = await supabase.from("notifications").update({ is_read: true }).eq("id", match[1]).eq("recipient_user_id", profile.id).select().single();
    if (error) fail(error.message);
    return success("Notification marked as read.", { notification: data });
  }

  return null;
}

export async function supabaseApi(rawPath, options = {}) {
  ensureConfigured();
  const method = (options.method || "GET").toUpperCase();
  const body = options.body || {};
  const [path, query] = parseQuery(rawPath);

  const handlers = [
    () => handleAuth(path, method, body),
    () => handleBusinesses(path, method, body, query),
    () => handleSlots(path, method, body, query),
    () => handleBookings(path, method, body),
    () => handleFavorites(path, method),
    () => handleReviews(path, method, body),
    () => handleDashboard(path, method),
    () => handleNotifications(path, method)
  ];

  for (const handler of handlers) {
    const result = await handler();
    if (result) return result;
  }

  fail(`Supabase adapter does not support ${method} ${path} yet.`);
}
