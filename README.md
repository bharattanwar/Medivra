# 🩺 Medivra — Next-Generation AI Healthcare, Telemedicine & Emergency Dispatch Platform

[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Payment%20Gateway-0C2340?style=for-the-badge&logo=razorpay&logoColor=blue)](https://razorpay.com/)

**Medivra** is an enterprise-grade, modular digital healthcare ecosystem that bridges the gap between patients, doctors, pharmacies, and emergency response teams. Built with a robust **Spring Boot 3 multi-module backend** and a high-performance **React 19 / TypeScript / Vite frontend**, Medivra integrates state-of-the-art **Google Gemini AI** for clinical report interpretation, prescription digitisation, doctor matching, and continuous post-consultation recovery monitoring.

---

## 🌟 Key Capabilities & Feature Modules

```
                              ┌──────────────────────────────────┐
                              │         MEDIVRA ECOSYSTEM        │
                              └─────────────────┬────────────────┘
                                                │
         ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
         │                  │                   │                   │                  │
         ▼                  ▼                   ▼                   ▼                  ▼
┌─────────────────┐ ┌───────────────┐ ┌───────────────────┐ ┌───────────────┐ ┌────────────────┐
│   Telemedicine  │ │  AI Clinical  │ │   Emergency SOS   │ │ Smart Pharmacy│ │ Payments & Real-│
│  & Appointments │ │   Assistant   │ │& Ambulance Network│ │   & Delivery  │ │Time Messaging│
└─────────────────┘ └───────────────┘ └───────────────────┘ └───────────────┘ └────────────────┘
```

### 1. 🩺 Doctor Consultations & Smart Appointments
- **Multi-Mode Scheduling**: Seamless support for both **Online Video Consultations** and **In-Clinic Visits**.
- **Lifecycle Management**: Real-time slot reservation, booking approval, cancellation with automated refunds, and 2-way reschedule proposals.
- **Fair-Usage Protection**: Built-in anti-abuse and rate-limiting guard preventing slot spamming.

### 2. 🤖 AI Clinical Assistant (Google Gemini Powered)
- **Lab Report Explainer**: Upload complex lab reports (PDF / images) to receive structured, plain-language summaries, highlighted normal vs. abnormal findings, confidence ratings, and suggested questions for doctors.
- **Prescription OCR & Matching**: Digitises handwritten prescription images using multimodal vision, extracting medicine names, dosages, and schedules with fuzzy **Levenshtein distance catalog matching** ($\ge 60\%$ confidence threshold).
- **Intelligent Doctor Recommender**: Natural language symptom triaging that prioritises specialist expertise, budget brackets, patient preferences, and consultation modes.
- **Continuous Recovery Tracker**: Automated daily check-ins for prescribed follow-up plans, symptom trajectory analysis (`IMPROVING` vs. `WORSENING`), and instant escalation notifications to treating physicians.

### 3. 🚑 Emergency SOS & Ambulance Fleet Dispatch
- **Instant 1-Tap SOS**: Triggers geo-tagged emergency alerts with live GPS tracking telemetry and dynamic Haversine ETA computation.
- **Concurrency-Safe Dispatch**: Real-time driver broadcast over WebSocket with JPA `@Version` optimistic locking to guarantee single-driver ride assignments.
- **Emergency Contact Alerting**: Immediate SMS and push notification broadcast to designated emergency contacts upon SOS activation.
- **Hospital Emergency Dashboard**: Live triage board for emergency rooms to monitor incoming ambulance fleets.

### 4. 💊 Smart Pharmacy Network & Medicine Allocation
- **Smart Greedy Multi-Pharmacy Matching**:
  - *Phase 1 (Single Pharmacy)*: Attempts full order fulfilment from a single store with highest score:
    $$\text{Score} = (\text{Medicines Found} \times 100) - (\text{Distance in km} \times 5)$$
  - *Phase 2 (Greedy Split)*: Splits unfulfilled items across optimal nearby pharmacies to minimise transit time.
  - *Phase 3 (Radius Expansion)*: Extends search radius up to 50 km for rare medications.
- **Order Fulfillment & Tracking**: Real-time order milestones (`PENDING` $\to$ `PROCESSING` $\to$ `SHIPPED` $\to$ `DELIVERED`), automatic stock deduction upon dispatch, and automated refill reminders.

### 5. 💳 Payment Processing, Invoicing & Real-time Messaging
- **Dual Payment Modes**: Live **Razorpay** integration (Card, UPI, NetBanking) with SHA-256 webhook signature verification and sandbox/mock fallback mode for local development.
- **E-Prescription & Invoicing**: Automated rendering of digital Rx prescription graphics and downloadable PDF-ready invoice generation.
- **WebSockets & STOMP**: Low-latency bi-directional messaging for active consultations, presence detection, and instant notification toasts.

---

## 🏗️ Architecture & Modular Project Structure

The project is structured as a cleanly decoupled Maven multi-module architecture:

```
medivra/
├── backend/
│   ├── ai-module/             # Google Gemini AI integrations (Reports, OCR, Triage, Follow-ups)
│   ├── appointment-module/    # Booking engine, slot management & scheduling state machine
│   ├── auth-module/           # Spring Security 6, JWT generation, validation & auth filters
│   ├── chat-module/           # WebSocket STOMP real-time consultation chat & video signaling
│   ├── common-module/         # Shared DTOs, base entities, enum definitions & global exceptions
│   ├── doctor-module/         # Doctor profiles, specialties, availability schedules & ratings
│   ├── emergency-module/      # SOS dispatcher, ambulance telemetry tracking & hospital triage
│   ├── notification-module/   # Multi-channel notifications (WebSocket queues & SMTP mail)
│   ├── payment-module/        # Razorpay integration, payment verification & automated refunds
│   ├── pharmacy-module/       # Inventory management, smart matching algorithm & medicine orders
│   ├── record-module/         # Electronic medical records (EMR) & digital Rx canvas rendering
│   ├── user-module/           # User accounts, patient records, roles (PATIENT, DOCTOR, PHARMACY, etc.)
│   ├── application/           # Spring Boot application runner, Flyway DB migrations & configurations
│   ├── pom.xml                # Parent Maven POM with dependency management
│   └── start.sh               # Local backend start script with env loading
│
└── frontend/
    ├── src/
    │   ├── components/        # Reusable UI components, modals, auth shells & chat windows
    │   ├── context/           # WebSocket STOMP & global application state providers
    │   ├── pages/             # 25+ role-based views (Patient, Doctor, Admin, Pharmacy, Ambulance, Hospital)
    │   ├── services/          # Typed API clients for AI, Emergency, Payments, Orders & Appointments
    │   ├── utils/             # Helper utilities, date formatters, geo-math
    │   ├── App.tsx            # Protected client-side routing & navigation guard
    │   └── main.tsx           # React DOM entrypoint
    ├── package.json           # React 19, Vite, TailwindCSS v4 dependencies
    └── vite.config.ts         # Vite build configuration with API reverse proxy
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend Framework** | Java 21, Spring Boot 3.2.5, Spring Security 6, Spring Data JPA |
| **Artificial Intelligence** | Google Gemini 3.6 / Flash API, Apache PDFBox, Apache Commons Text (Levenshtein) |
| **Real-time & Messaging** | Spring WebSocket, STOMP protocol, SockJS client, Spring ApplicationEvent |
| **Payment Gateway** | Razorpay Java SDK, Razorpay Checkout JS |
| **Database & Migrations** | PostgreSQL, Hibernate 6, Flyway Migrations |
| **Frontend Framework** | React 19, TypeScript 6, Vite 8, React Router v7 |
| **Styling & Icons** | Tailwind CSS v4, Lucide React |
| **HTTP Client** | Axios (with token & 401 response interceptors) |

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your system:
- **Java 21 JDK** (e.g. Eclipse Temurin or OpenJDK 21)
- **Node.js 20+** & **npm**
- **PostgreSQL 14+** (running locally or cloud instance)
- **Maven 3.9+** (or use the included `./mvnw` wrapper)

---

### 1. Database Setup
Create a PostgreSQL database for Medivra:
```sql
CREATE DATABASE medivra;
```

---

### 2. Backend Configuration & Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Configure environment variables. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

3. Update your `.env.local` file with your credentials:
   ```bash
   # PostgreSQL Connection
   export LOCAL_DB_URL=jdbc:postgresql://localhost:5432/medivra
   export LOCAL_DB_USERNAME=postgres
   export LOCAL_DB_PASSWORD=your_postgres_password

   # Google Gemini AI Key
   export GEMINI_API_KEY=your_gemini_api_key

   # Razorpay Credentials (set RAZORPAY_ENABLED=false for offline mock mode)
   export RAZORPAY_ENABLED=false
   export RAZORPAY_KEY_ID=your_razorpay_key_id
   export RAZORPAY_KEY_SECRET=your_razorpay_key_secret

   # SMTP Mail (Optional - defaults to Brevo relay)
   export SPRING_MAIL_USERNAME=your_email@domain.com
   export SPRING_MAIL_PASSWORD=your_email_app_password
   ```

4. Build and start the backend service:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
   *The backend will run on `http://localhost:8080` with automatic Flyway database migrations.*

---

### 3. Frontend Setup & Launch

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   *The frontend will launch on `http://localhost:5173` with hot-module reloading and proxying `/api` to the backend.*

---

## 🔑 Default Roles & Access

Medivra features granular Role-Based Access Control (RBAC):

| Role | Portal / Key Routes | Description |
|---|---|---|
| **PATIENT** | `/patient/dashboard`, `/patient/ai/*`, `/patient/pharmacy`, `/patient/emergency` | Consultations, AI lab analysis, prescription OCR, medicine delivery, SOS activations. |
| **DOCTOR** | `/doctor/appointments`, `/doctor/availability`, `/consultation/:id` | Availability scheduling, appointment approvals, digital Rx generation, consultation chat. |
| **PHARMACY** | `/pharmacy/dashboard`, `/pharmacy/register` | Real-time inventory pricing, stock level management, prescription order fulfilment. |
| **AMBULANCE**| `/ambulance/dashboard` | Dispatch notifications, ride acceptance, live GPS telemetry, transit milestones. |
| **HOSPITAL** | `/hospital/emergencies` | Live emergency triage dashboard, fleet readiness, incoming patient alerts. |
| **ADMIN**    | `/admin/dashboard`, `/admin/users`, `/admin/doctors`, `/admin/appointments` | Doctor verification, user management, appointment audit logs, platform analytics. |

---

## 🛡️ Security & Reliability Best Practices

- **JWT Authentication**: Stateless authentication utilizing standard Bearer tokens across REST endpoints and WebSocket handshake interceptors.
- **Optimistic Concurrency Control**: Emergency ride acceptances utilize database version checks to eliminate race conditions.
- **Clean Architecture & Scalability**: Service-oriented modular isolation guarantees that independent modules (e.g. pharmacy matching vs. AI analysis) do not introduce circular dependencies.
- **Zero-Crash Event Publishing**: Background notification and email events are executed asynchronously with safety wrappers, ensuring transaction integrity.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
