# Verification

The consolidated version was exercised in headless Microsoft Edge with a simulated Firestore adapter. The tests did not write to the team's real database.

Passed:
- Companion reactions, About Rise dialog, and accessory purchase.
- Journal and mood save and reload.
- Photo upload and cloud-backed gallery loading.
- Dashboard preferences and selected photos.
- Measurement entry followed by updated readings on Health.
- Meal save and separation of journal and mood between crew profiles.
- All six internal pages at a 390 px viewport without horizontal overflow.
- No uncaught JavaScript errors during these flows.
- Local HTML references, stylesheet image URLs, module imports, unique IDs, and JavaScript syntax.

External services were replaced by controlled responses during the automated suite. The APOD and DONKI error states were exercised; their live availability, quotas, and the real Firestore permissions must be checked at the event.

Before presenting:
1. Start Live Server from the consolidated folder.
2. Sign in with a configured demonstration crew code.
3. Verify the cloud collections are accessible under the team's rules.
4. Add a demonstration note, sign out, and confirm another crew profile cannot see it in the UI.
5. Check APOD and Space Weather with internet access.

UI profile separation does not replace authorization rules. No authentication or rule deployment was performed.
