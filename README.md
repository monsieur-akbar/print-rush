# PrintRush ⚡ (Campus Xerox Queue Tracker)

> Sub-10-second real-time print center load monitor engineered for VIT Pune students. Zero authentication, zero app downloads, zero friction.

- **Live Deployment:** [https://print-rush-ecru.vercel.app](https://print-rush-ecru.vercel.app)
- **Tech Stack:** React (Vite), Tailwind CSS, Supabase (Postgres CDC Realtime WebSockets)

---

## 1. The Annoyance
Students rushing before an 8:00 AM lab or submission deadline face long, blind queues across campus Xerox centers (Central Hub, E-Building, and Backgate). Walking between centers to check lines wastes 10–15 minutes and often leads to jammed printers or running out of paper.

## 2. Your Constraint (<10s Utility)
**PRN ending in 5: Sub-10-Second Utility.**
Every product design choice was prioritized around instant decision-making:
- **Zero Authentication:** No sign-up, email verification, or login walls that consume time.
- **Instant Visual Hierarchy:** The `⚡ Best Pick Now` badge automatically flags the shortest line that has working hardware.
- **Real-Time WebSockets:** Uses Supabase Realtime (Postgres Change Data Capture) so queue counts and paper jam flags update across all devices in milliseconds without manual refreshes.

## 3. The Great Part
The auto-computing decision engine: on load, the client filters out jammed centers, parses wait estimates (~1.5 min/person), and highlights the optimal counter in under 2 seconds.

---

## 4. The Two Testers & Changes Made Later

### Tester 1: Multi-Queue Spoofing
- **Observation:** Tester opened the app and immediately tapped `+ I'm in line` across all three centers simultaneously.
- **Problem:** In reality, one person cannot stand in three physical lines at once. Unchecked check-ins degraded line integrity.
- **Change Made Later (Commit `173737e`):** Implemented a client-side device queue lock via `localStorage`. When a user joins one queue, the other two centers dynamically disable their join buttons and display `In Another Queue`.

### Tester 2: Rogue Decrement Exploitation
- **Observation:** Tester who had never checked in was able to click `Done / Left` on random centers, decrementing queues they were never part of.
- **Problem:** Malicious or careless passers-by could erase genuine line counts.
- **Change Made Later (Commit `0886bd3`):** Redesigned the card actions into a verified state machine. Unregistered users only see `+ I'm in line`. The `Done / Left Queue` decrement button only renders on the specific shop where the current device holds an active check-in ticket.

---

## 5. AI Usage
- Generated initial boilerplate schemas for Supabase and Vite.
- Collaborated on edge-case threat modeling (anti-spam cooldown algorithms without user auth).
- Crafted responsive Tailwind layout optimized for mobile viewports.

## 6. Not Done (Future Roadmap)
- Geofencing check-ins using campus Wi-Fi SSID / HTML5 Geolocation.
- Peak-hour predictive queue analytics using historical timestamps.