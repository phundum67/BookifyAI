# Multi-Category Booking App

This project is a version 1 smart booking platform for local businesses such as turfs, karaoke rooms, pools, resorts, salons, rentals, and similar services. It includes a React frontend and a Flask backend with SQLite.

## Tech Stack
- Frontend: React with Vite
- Backend: Flask, Flask-CORS, Flask-SQLAlchemy
- Database: SQLite
- Auth: Cookie-based Flask session auth

## Project Structure
```text
backend/
  app/
    routes/          API endpoints grouped by feature
    services/        Booking, slot, notification, and dashboard logic
    utils/           Auth helpers, validation, response helpers
    __init__.py      Flask app factory and blueprint registration
    config.py        App configuration
    extensions.py    SQLAlchemy setup
    models.py        Database models
  tests/             Backend API tests
  run.py             Flask entrypoint
  seed.py            Resettable sample data loader
  requirements.txt   Python dependencies

frontend/
  src/
    api/             Fetch client and API wrappers
    components/      Reusable UI pieces
    context/         Auth state
    data/            Category lists and static options
    layouts/         Customer and Business app shells
    pages/           Customer, Business, and auth screens
    styles/          Shared CSS
    App.jsx          Route tree
    main.jsx         React entrypoint
  package.json       Frontend dependencies and scripts
```

## Key Files
- [backend/app/models.py](/d:/Testing%20tak2%201st%20version/backend/app/models.py) defines users, businesses, slots, bookings, reviews, favorites, and notifications.
- [backend/app/services/booking_service.py](/d:/Testing%20tak2%201st%20version/backend/app/services/booking_service.py) handles booking validation, slot reservation, request context capture, cancellation, and automatic completion refresh.
- [backend/app/services/slot_service.py](/d:/Testing%20tak2%201st%20version/backend/app/services/slot_service.py) generates slots, blocks dates, and prevents duplicate or overlapping ranges.
- [frontend/src/App.jsx](/d:/Testing%20tak2%201st%20version/frontend/src/App.jsx) defines the main route map.
- [frontend/src/pages/BusinessDetailPage.jsx](/d:/Testing%20tak2%201st%20version/frontend/src/pages/BusinessDetailPage.jsx) contains the booking flow, favorites, and reviews.
- [frontend/src/pages/BusinessProfilePage.jsx](/d:/Testing%20tak2%201st%20version/frontend/src/pages/BusinessProfilePage.jsx) manages business setup and edits.

## Features Included
- Signup, login, logout, and role selection
- Customer side:
  - Home, Browse, Bookings, Profile, Notifications
  - Search/filter businesses
  - View available slots by date
  - Instant booking on generated slots only
  - Favorites and reviews for logged-in customers only
- Business side:
  - Dashboard
  - Profile
  - Slot Management
  - Bookings
  - Notifications
- Booking rules:
  - Customer-only booking creation
  - Generated-slot-only booking
  - Duplicate and overlapping slot prevention
  - Booking statuses: `confirmed`, `cancelled`, `completed`
  - Automatic completion once booking end time has passed
- Business rules:
  - One business per Business account in version 1 UI
  - Soft-delete style `is_active` flag instead of hard delete
  - Optional pricing fields for display: `price_per_hour`, `currency`
  - Optional booking controls: `min_booking_hours`, `max_booking_hours`, `buffer_time_between_slots`

## Sample Data
Run the seed script to reset the database and insert:
- Green Hills Turf
- Lamka Karaoke Hub
- Blue Pool Resort

Sample credentials after seeding:
- Customer: `customer@example.com` / `password123`
- Business: `turfowner@example.com` / `password123`

## Setup
### Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py
python run.py
```

The backend runs on `http://localhost:5000`.

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Reset Test Data
```powershell
cd backend
python seed.py
```

This drops all tables, recreates the schema, and reloads sample data.

## How Frontend Connects to Backend
- The frontend uses `fetch` through [frontend/src/api/client.js](/d:/Testing%20tak2%201st%20version/frontend/src/api/client.js).
- Every request goes to `http://localhost:5000/api`.
- Requests include `credentials: "include"` so Flask session cookies work across the frontend and backend dev servers.
- Flask-CORS is enabled for `/api/*` and allows credentials from the configured frontend origin.

## Main API Routes
- Auth:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `PATCH /api/auth/role`
  - `PATCH /api/auth/profile`
- Businesses:
  - `POST /api/businesses`
  - `PUT /api/businesses/<id>`
  - `GET /api/businesses`
  - `GET /api/businesses/<id>`
  - `GET /api/businesses/mine`
- Slots:
  - `POST /api/businesses/<id>/slots/generate`
  - `GET /api/businesses/<id>/slots`
  - `PATCH /api/slots/<id>`
  - `POST /api/businesses/<id>/closures`
- Bookings:
  - `POST /api/bookings`
  - `GET /api/bookings/customer`
  - `GET /api/bookings/business`
  - `PATCH /api/bookings/<id>/cancel`
- Favorites:
  - `POST /api/favorites/<business_id>`
  - `DELETE /api/favorites/<business_id>`
  - `GET /api/favorites`
- Reviews:
  - `POST /api/businesses/<id>/reviews`
  - `GET /api/businesses/<id>/reviews`
- Notifications:
  - `GET /api/notifications`
  - `PATCH /api/notifications/<id>/read`
- Dashboard:
  - `GET /api/dashboard/summary`

## Notes for Future Expansion
- `Continue with Google` is already present as a placeholder button.
- Booking creation uses a dedicated booking service plus request-context helper so future rate limiting can be added cleanly.
- The schema already links businesses to owners in a way that can support multiple businesses per owner later.
- The slot-based version 1 flow can be extended into category-specific booking logic in later versions.
