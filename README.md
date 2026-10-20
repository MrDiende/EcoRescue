# EcoRescue

**Barangay M.S. Garcia Waste Management System**  
Barangay M.S. Garcia, Cabanatuan City, Nueva Ecija (3100) · Purok 1–8

## What is EcoRescue?

EcoRescue is a role-based web application for coordinating barangay waste collection. It brings residents, garbage collectors, and barangay administrators together to manage collection schedules, report waste issues, and follow collection trucks during active routes.

The application uses Supabase for sign-in and shared data storage. Collector location sharing uses the device browser's GPS, with permission, while maps are provided by Leaflet and OpenStreetMap.

## Main features

### Administrator

- Review resident applications and approve, reject, reopen, edit, activate, or deactivate accounts.
- Create and manage collectors, routes, trucks, and collection schedules.
- Assign and manage resident waste reports.
- View the live collection map, operational issues, announcements, notifications, and activity log.
- Export report and activity data where available.

### Resident

- Register and track an application with its Resident ID.
- View collection schedules and announcements.
- Submit waste reports and follow their status.
- View live truck locations and estimated arrival information after residency approval.
- Manage a profile and receive notifications.

### Collector

- View assigned routes, collection schedules, and assigned waste reports.
- Start a scheduled route, share device GPS, mark Puroks visited, and complete or report a missed collection.
- Update truck capacity and submit operational issues.
- Receive notifications and view a collection history.

### Public site

- Learn about the service, collection process, and features.
- Track a resident application and access registration or sign-in.

## Technology stack

- **Frontend:** React 19, JavaScript (JSX), Vite 7
- **Styling:** Tailwind CSS 4 and project CSS
- **Navigation:** React Router
- **Backend and data:** Supabase Auth, PostgreSQL, Row Level Security (RLS), and Realtime
- **Privileged account operations:** Supabase Edge Function (`admin-manage-account`)
- **Maps:** Leaflet with OpenStreetMap tiles
- **Icons:** Lucide React

The browser app uses the Supabase publishable/anon key. Never put the Supabase service-role key in frontend code or the frontend environment file.

## Workflow

1. **Set up the service:** Create a Supabase project, configure the app's environment variables, and run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor.
2. **Create the administrator:** Create and confirm the initial Auth user, then run `public.bootstrap_initial_admin('admin@example.com')` in the SQL Editor with that user's email.
3. **Prepare collection operations:** The administrator creates routes and trucks, creates collector accounts, and generates or assigns schedules.
4. **Apply for residency:** A resident registers and receives a Resident ID. The account is pending until an administrator reviews and approves it.
5. **Collect waste:** The assigned collector signs in, opens a scheduled collection for that day, and starts the route. The browser requests location permission and shares GPS while the route is active and the app remains open.
6. **Follow collection:** Administrators can view the live map. Approved residents can view live tracking. Collectors mark Puroks as collected and then complete the route or report an issue/missed collection.
7. **Stay informed:** The app records status changes and distributes in-app notifications to affected residents, collectors, and administrators. When a collector starts a route or marks a Purok visited, residents in the next Purok receive a rough ETA based on the latest shared GPS position.

## Getting started

### Requirements

- Node.js and npm
- A Supabase project

### Configure Supabase

1. Copy `supabase/.env.example` to `supabase/.env` and set your project URL and publishable/anon key:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-publishable-key
   ```

2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. It creates the application tables, Auth profile triggers, tracking and collection-notification RPCs, initial-admin bootstrap function, and role-aware RLS policies. Re-run the complete schema after pulling updates so existing Supabase projects receive new functions and policies.
3. Create the initial administrator in **Supabase Dashboard → Authentication → Users → Add user**, confirm the account, then run:

   ```sql
   select public.bootstrap_initial_admin('admin@example.com');
   ```

   Replace the example address with the confirmed administrator's email. The bootstrap function promotes only a confirmed Auth user and is intended for initial setup.
4. Turn off **Confirm email** in **Authentication → Sign In / Providers → Email** so resident approval, rather than email confirmation, controls resident access. For a linked Supabase CLI project, the setting in `supabase/config.toml` can be applied with `npx supabase config push`.
5. Set the Supabase Auth **Site URL** and allowed redirect URLs for local development and the deployed site.

The administrator can create collector accounts and residents can submit applications without deploying the Edge Function. Deploy `admin-manage-account` for administrator actions that update Auth account details or delete resident accounts:

```bash
supabase functions deploy admin-manage-account
```

Keep `SUPABASE_SERVICE_ROLE_KEY` in the Edge Function's server-side environment only. Never add it to `supabase/.env` or frontend code.
If an account operation fails with “Could not verify administrator access,” inspect the `admin-manage-account` function logs in the Supabase Dashboard for the underlying database error. Confirm that `supabase/schema.sql` has been run in that same project and that the function is deployed there. The schema grants the function's service role permission to read and update user profiles.

### Install and run

```bash
npm install
npm run dev
```

For a production build and local preview:

```bash
npm run build
npm run preview
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider's build environment before building for deployment. Location access requires HTTPS (or `localhost`) and the user's permission.

### Deploy to Vercel

1. In Vercel, open the project's **Settings → Environment Variables**.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the URL and publishable/anon key from the same Supabase project. Select every environment where the app will run (Production, Preview, and/or Development).
3. Redeploy after saving the variables. Vite embeds `VITE_` variables at build time, so changing them does not update an already-built deployment.
4. Set the Supabase Auth **Site URL** to the deployed site URL and add that URL under allowed redirect URLs.

Accounts are shared through Supabase, not the browser that created them. To sign in, an account needs a Supabase Auth user and a matching `public.users` profile linked by `auth_user_id`; adding a row only to `public.users` does not create login credentials. Resident profiles must also be approved and active.

The actual `supabase/.env` file is ignored by Git. Do not commit credentials or the Supabase service-role key. GitHub Actions runs the production build on pushes and pull requests using placeholder Supabase values; it does not connect to a Supabase project.

## Project structure

```text
ecorescue/
├── .github/
│   └── workflows/
│       └── build.yml           # GitHub Actions production build check
├── public/
│   └── assets/
│       └── hero.jpg            # Home-page hero image
├── src/
│   ├── components/             # Shared layout, UI, maps, GPS and report components
│   │   ├── Layout.jsx
│   │   ├── LiveTracking.jsx
│   │   ├── OsmMap.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── ReportDetails.jsx
│   │   ├── RouteSharing.jsx
│   │   ├── ui.jsx
│   │   └── WasteCategoryPicker.jsx
│   ├── lib/                    # Authentication, data, storage and domain helpers
│   │   ├── auth.jsx
│   │   ├── db.js
│   │   ├── email.js
│   │   ├── geo.js
│   │   ├── geography.js
│   │   ├── storage.js
│   │   ├── store.jsx
│   │   ├── supabase.js
│   │   ├── supabaseData.js
│   │   ├── time.js
│   │   └── validation.js
│   ├── pages/
│   │   ├── admin/              # Administrator portal pages
│   │   │   ├── AdminActivity.jsx
│   │   │   ├── AdminAnnouncements.jsx
│   │   │   ├── AdminCollectors.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminGps.jsx
│   │   │   ├── AdminIssues.jsx
│   │   │   ├── AdminNotifications.jsx
│   │   │   ├── AdminReports.jsx
│   │   │   ├── AdminResidents.jsx
│   │   │   ├── AdminRoutes.jsx
│   │   │   ├── AdminSchedules.jsx
│   │   │   └── AdminTrucks.jsx
│   │   ├── collector/          # Collector portal pages
│   │   │   ├── AssignedReports.jsx
│   │   │   └── CollectorPages.jsx
│   │   ├── resident/           # Resident portal pages
│   │   │   ├── ResidentPages.jsx
│   │   │   └── ResidentTracking.jsx
│   │   ├── shared/             # Pages shared across roles
│   │   │   └── NotificationsPage.jsx
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── styles/                 # Global, map and animation styles
│   │   ├── animations.css
│   │   ├── base.css
│   │   ├── index.css
│   │   ├── map.css
│   │   └── scrollbars.css
│   ├── utils/                  # Small shared helpers
│   │   └── cn.js
│   ├── App.jsx                 # Routes and role-protected portal shells
│   └── main.jsx                # Frontend entry point
├── supabase/
│   ├── .env.example            # Safe template for local Supabase settings
│   ├── config.toml             # Supabase local/deployment configuration
│   ├── functions/
│   │   └── admin-manage-account/
│   │       └── index.ts        # Privileged Auth account operations
│   └── schema.sql              # Database, triggers, RPCs, grants and RLS policies
├── .gitignore
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

## Location and mapping notes

- GPS sharing uses the browser Geolocation API. The collector must allow location access and keep the app open during collection; mobile browsers may suspend location updates when the page is backgrounded.
- OpenStreetMap tiles require an internet connection. The map has a schematic view as a fallback if map tiles cannot load.
- The Barangay Hall and Purok coordinates are approximate. Update `BASE` and `PUROK_INFO` in [`src/lib/geography.js`](./src/lib/geography.js) if verified local coordinates are available.
- Truck records, capacity percentages, and arrival estimates are informational; the app is not connected to physical vehicles.

## Data and migration notes

- Supabase PostgreSQL is the shared source of application data. Existing data in an old browser's Local Storage is not uploaded automatically.
- Run `supabase/schema.sql` to set up or update the database and RLS policies. Existing application rows are preserved by the schema; older profiles may need to be linked to Auth users through `auth_user_id`.
- Proof-of-residency images are stored with the resident profile, which is subject to the profile's RLS access rules.

## Manual smoke-test workflow

1. Configure Supabase and create the initial administrator.
2. Sign in as administrator; add a route and truck, create a collector, and generate a schedule.
3. Register a resident, note the Resident ID, approve the application, and verify the resident can sign in.
4. Submit a waste report as the resident, assign it as administrator, and update it as the collector.
5. Start a collector route on its scheduled date with location permission enabled. Confirm that the administrator live map and approved resident tracking page show updates.
6. Complete the route and confirm sharing stops. Check notifications, announcements, and report/activity exports.
