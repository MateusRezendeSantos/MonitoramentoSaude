<!-- This code was developed with the assistance of artificial intelligence, using GPT and Claude. -->

# Astro_Bytes — Consolidated Prototype

An independent Space Apps prototype combining the latest interface with the Firebase integrations from V2.

## Start the site

1. Open this entire folder in Visual Studio Code.
2. Install **Live Server** by Ritwick Dey.
3. Right-click `index.html` and select **Open with Live Server**.
4. Enter a crew code configured in the team's Firestore database.

Alternatively, with Node.js installed, run `node tools/server.cjs` and open http://127.0.0.1:5500/.
Do not open the HTML files directly through file://.

## Folder structure

- Root HTML files: application pages.
- `assets/css`: shared and page styles.
- `assets/js`: application logic and Firebase modules.
- `assets/images` and `assets/videos`: original media.
- `docs`: integration details and testing notes.
- `tools`: optional local development server.

## Included features

- Crew-code entry, profile display, session exit, and personalized dashboard.
- Saved measurements, sleep charts, fatigue, radiation, exercises, and demonstration health states.
- Animated BPM-synchronized illustrative waveform, not a measured ECG.
- Rise expressions, rest animation, timed coin game, accessories, and About Rise.
- Cloud-backed journal, notes, tasks, photos, and dashboard preferences per crew code.
- Mood and meal records separated by crew code and calendar date.
- APOD discovery card and NASA DONKI space-weather information.
- Responsive layouts and reduced-motion support.

## Important limits

Crew-code entry is a demonstration profile selector, not Firebase Authentication.
Firestore rules must be configured by the database owners. Never deploy unrestricted rules for personal data.
No real medical suitability or treatment is established by the demonstration ranges.
Mission day 24 remains illustrative because no mission start date is defined in the supplied profiles.
APOD and DONKI require an internet connection and use DEMO_KEY, which has request limits.
Personal images are compressed JPEG data URLs stored in Firestore for this prototype. Firebase Storage is a future improvement.
Existing browser-only content is not automatically uploaded to a profile. Original folders remain unchanged.
No generative AI chat is configured; Rise uses predefined interactions.

## Credits

Original interface and adaptations: Astro_Bytes team. Character reference: Rise, designed by Lucas Ye and selected by the Artemis II crew. Astronomy content: NASA APOD and DONKI; individual image rights and credits apply.
Development assisted by GPT and Claude; the project team should review and validate the final submission.
