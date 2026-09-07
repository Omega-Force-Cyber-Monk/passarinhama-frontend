# ARCHICOPRO — Extranet Frontend

Welcome to the **ARCHICOPRO Extranet** (`archicopro-frontend` / `passarinhama-frontend`). This repository is a React 19 web application built with TypeScript, Vite 6, Tailwind CSS v4, and Redux Toolkit with RTK Query. It powers the collaborative digital hub for the French professional association of co-ownership architects.

> 📘 **Developer Handover & System Architecture**:  
> For in-depth technical specifications, RBAC details, module directories, and the complete backend API endpoints inventory, please refer to **[HANDOVER.md](file:///Users/marjan/Documents/projects/passarinhama-frontend/HANDOVER.md)**.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** v18+ (v20 or v22 recommended)
- **npm** v9+

### 2. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```
Ensure `VITE_API_BASE_URL` points to your active backend API service:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```
The application will boot at `http://localhost:5173`.

---

## 🛠 Available Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `npm run dev` | Starts local Vite dev server with Hot Module Replacement (HMR) |
| `build` | `npm run build` | Compiles optimized production bundle in `dist/` |
| `preview` | `npm run preview` | Previews the compiled production build locally |
| `lint` | `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |

---

## 🏗 Technology Stack

- **Core**: React 19 (`^19.0.0`), TypeScript (`~5.8.2`), Vite 6 (`^6.2.0`)
- **State & Data Fetching**: Redux Toolkit (`^2.11.2`), RTK Query with automatic JWT re-authentication
- **Routing**: React Router v7 (`^7.14.2`) with lazy code-splitting and permission route guards
- **Styling**: Tailwind CSS v4 (`^4.1.14`) via `@tailwindcss/vite` and `@tailwindcss/typography`
- **Rich Text Editor**: Tiptap 3 (`^3.23.4`) with Tables, Media, and YouTube embeds
- **Motion & UI**: Motion (`^12.23.24`), Lucide React (`^0.546.0`), date-fns (`^4.1.0`)
- **Internationalization**: Bilingual (French `fr` / English `en`) via custom `I18nProvider`

---

## 🔐 Access Control & Roles

The system uses a combination of role slugs and direct per-member overrides:
- `admin`: Superuser with full access to the 8-tab Administration Panel, Executive Dashboard, and settings.
- `moderator`: Access to the Moderation Center (`/moderation`) to review, approve, or flag forum discussions.
- `membre`: Standard professional member with access to community forums, articles, calendar, trainings, and documents.
- `auditeur`, `partenaires_technicopro`, `comite_coproprietaire`: Specialized partnership and committee scopes.

For the role permission matrix and code usage, see **[RBAC_GUIDE.md](file:///Users/marjan/Documents/projects/passarinhama-frontend/RBAC_GUIDE.md)** and **[HANDOVER.md](file:///Users/marjan/Documents/projects/passarinhama-frontend/HANDOVER.md)**.

---

## 🐳 Docker Deployment

Build the multi-stage Docker container:
```bash
docker build --build-arg VITE_API_BASE_URL=https://api.yourdomain.com -t archicopro-frontend .
```
The resulting image packages the static `dist/` bundle ready to be mounted or served via Nginx.
