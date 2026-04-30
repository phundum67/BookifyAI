from app import create_app
from app.extensions import db
from app.models import Business


PUBLIC_BASE_URL = "https://phundum67.pythonanywhere.com"


SAMPLE_IMAGES = {
    "Green Hills Turf": "green-hills-turf.jpg",
    "Lamka Karaoke Hub": "lamka-karaoke-hub.jpg",
    "Blue Pool Resort": "blue-pool-resort.jpeg",
}


def image_url(filename):
    return f"{PUBLIC_BASE_URL}/static/images/{filename}"


def update_sample_images():
    app = create_app()
    with app.app_context():
        updated = 0
        for business_name, filename in SAMPLE_IMAGES.items():
            business = Business.query.filter_by(name=business_name).first()
            if not business:
                print(f"Skipped missing business: {business_name}")
                continue

            url = image_url(filename)
            business.image_url = url
            business.profile_image = url
            business.gallery_images_json = f'["{url}"]'
            updated += 1
            print(f"Updated {business_name}: {url}")

        db.session.commit()
        print(f"Done. Updated {updated} businesses.")


if __name__ == "__main__":
    update_sample_images()
