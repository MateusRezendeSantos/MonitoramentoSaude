# Database layout

Existing collections: astronauts, heart_rate_logs, daily_check_ins, radiation_logs, radiation_daily, radiation_summary, exercise_plan, exercise_logs, equipment_status, health_ranges.

Additional V2 collections:
- companion_progress/{crewCode}: coins, owned, equipped, updated_at.
- reminders_data/{crewCode}: journal, notes, tasks, updated_at.
- memory_photos/{id}: crew_id, src, title, date, album, created_ms.
- dashboard_preferences/{crewCode}: widgets, photoCount, photoIds, updatedAt.
- daily_care/{crewCode}_{YYYY-MM-DD}: crew_id, date, mood, note, meals and update timestamps.

The old V2 daily_care/{date} documents are not loaded: they lack reliable ownership. No automatic migration is performed.
Client-side crew filters organize profile data; real access enforcement requires authenticated identities and Firestore rules.
