import { useRef, useState } from "react";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateImage(file) {
  if (!file.type.startsWith("image/")) {
    return "Please choose an image file.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Image must be 2MB or smaller.";
  }
  return "";
}

function validateGalleryMedia(file) {
  if (file.type.startsWith("image/")) {
    return validateImage(file);
  }
  if (!file.type.startsWith("video/")) {
    return "Please choose an image or video file.";
  }
  if (file.size > MAX_VIDEO_SIZE) {
    return "Videos must be 20MB or smaller.";
  }
  return "";
}

function isVideoSource(value) {
  return typeof value === "string" && (value.startsWith("data:video/") || /\.(mp4|webm|mov|m4v)$/i.test(value));
}

export function ImageUploadBox({ label, value, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    const dataUrl = await readFileAsDataUrl(file);
    onChange(dataUrl);
  };

  return (
    <div className="upload-field">
      <div className="section-heading">
        <span>{label}</span>
        {value ? (
          <button className="upload-link-button" type="button" onClick={() => onChange("")}>
            Remove
          </button>
        ) : null}
      </div>
      <button className={`upload-box ${value ? "has-image" : ""}`} type="button" onClick={() => inputRef.current?.click()}>
        {value ? (
          <img className="upload-preview" src={value} alt={`${label} preview`} />
        ) : (
          <span className="upload-placeholder">
            <span className="upload-icon" aria-hidden="true">
              +
            </span>
            <strong>Tap to upload image</strong>
            <small>JPG, PNG, or WebP up to 2MB</small>
          </span>
        )}
      </button>
      {value ? (
        <button className="button button-secondary compact-button upload-change-button" type="button" onClick={() => inputRef.current?.click()}>
          Change
        </button>
      ) : null}
      <input
        ref={inputRef}
        className="native-upload-input"
        type="file"
        accept="image/*"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}

export function GalleryUpload({ label, values = [], onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const handleFiles = async (files) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;

    const invalid = selectedFiles.map(validateGalleryMedia).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError("");
    const dataUrls = await Promise.all(selectedFiles.map(readFileAsDataUrl));
    onChange([...values, ...dataUrls]);
  };

  const removeImage = (index) => {
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="upload-field">
      <div className="section-heading">
        <span>{label}</span>
        <button className="upload-link-button" type="button" onClick={() => inputRef.current?.click()}>
          Add images
        </button>
      </div>
      <button className="upload-box gallery-upload-box" type="button" onClick={() => inputRef.current?.click()}>
        <span className="upload-placeholder">
          <span className="upload-icon" aria-hidden="true">
            +
          </span>
          <strong>Upload gallery media</strong>
          <small>Select images or videos</small>
        </span>
      </button>
      {values.length ? (
        <div className="gallery-preview-row">
          {values.map((image, index) => (
            <div key={`${image}-${index}`} className={`gallery-thumb ${isVideoSource(image) ? "is-video" : ""}`}>
              {isVideoSource(image) ? (
                <>
                  <video src={image} muted playsInline preload="metadata" />
                  <span className="gallery-media-badge">Video</span>
                </>
              ) : (
                <img src={image} alt={`Gallery preview ${index + 1}`} />
              )}
              <button type="button" onClick={() => removeImage(index)} aria-label="Remove gallery image">
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <input
        ref={inputRef}
        className="native-upload-input"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
      />
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}
