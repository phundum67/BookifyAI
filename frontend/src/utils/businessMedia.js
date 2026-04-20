export function getBusinessPrimaryImage(business) {
  if (business?.image_url) {
    return business.image_url;
  }

  if (business?.profile_image) {
    return business.profile_image;
  }

  if (business?.gallery_images?.length) {
    return business.gallery_images[0];
  }

  const fallbackLabel = encodeURIComponent(business?.category || business?.name || "Business");
  return `https://via.placeholder.com/800x520?text=${fallbackLabel}`;
}

export function isVideoSource(value) {
  return typeof value === "string" && (value.startsWith("data:video/") || /\.(mp4|webm|mov|m4v)$/i.test(value));
}

export function getBusinessGallery(business) {
  const images = [];

  if (business?.image_url) {
    images.push(business.image_url);
  }

  if (business?.profile_image) {
    if (!images.includes(business.profile_image)) {
      images.push(business.profile_image);
    }
  }

  if (Array.isArray(business?.gallery_images)) {
    business.gallery_images.forEach((image) => {
      if (image && !images.includes(image)) {
        images.push(image);
      }
    });
  }

  if (!images.length) {
    images.push(getBusinessPrimaryImage(business));
  }

  return images;
}
