/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

import { db } from './firebase-init.js';
    import {
      addDoc, collection, doc, increment, serverTimestamp, writeBatch
    } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

    // Each record is saved under the astronaut code stored by index.html at sign-in.
    const crewCode = sessionStorage.getItem('crewCode');
    if (!crewCode) {
      window.location.replace('index.html');
      throw new Error('No crew code in session');
    }

    const measurementForm = document.getElementById('measurement-form');
    const measurementMessage = document.getElementById('measurement-message');
    const measurementSubmit = measurementForm.querySelector('button[type="submit"]');
    const measurementInputs = {
      bpm: {
        input: document.getElementById('heart-rate-input'),
        label: 'Heart rate'
      },
      spo2: {
        input: document.getElementById('spo2-input'),
        label: 'Oxygen saturation'
      },
      resp_rate: {
        input: document.getElementById('resp-rate-input'),
        label: 'Respiratory rate'
      }
    };

    measurementForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const measurementData = {};
      for (const [key, control] of Object.entries(measurementInputs)) {
        const value = control.input.valueAsNumber;
        const min = Number(control.input.min);
        const max = Number(control.input.max);
        if (!Number.isInteger(value) || value < min || value > max) {
          measurementMessage.textContent =
            `${control.label} must be a whole number between ${min} and ${max}.`;
          measurementMessage.dataset.state = 'error';
          control.input.focus();
          return;
        }
        measurementData[key] = value;
      }

      measurementSubmit.disabled = true;
      measurementMessage.textContent = 'Saving measurement...';
      measurementMessage.dataset.state = 'info';

      try {
        await addDoc(collection(db, 'heart_rate_logs'), {
          ...measurementData,
          crew_id: crewCode,
          recorded_at: serverTimestamp()
        });

        measurementForm.reset();
        measurementMessage.textContent = 'Measurements saved successfully.';
        measurementMessage.dataset.state = 'success';
      } catch (error) {
        console.error("Operation failed:", error);
        measurementMessage.textContent =
          'Could not save the measurements. Check your connection and try again.';
        measurementMessage.dataset.state = 'error';
      } finally {
        measurementSubmit.disabled = false;
      }
    });

    const checkInForm = document.getElementById('check-in-form');
    const checkInMessage = document.getElementById('check-in-message');
    const checkInSubmit = checkInForm.querySelector('button[type="submit"]');
    const sleepHoursInput = document.getElementById('sleep-hours-input');
    const sleepMinutesInput = document.getElementById('sleep-minutes-input');
    const fatigueInput = document.getElementById('fatigue-input');
    const sleepQualityInput = document.getElementById('sleep-quality-input');

    checkInForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const sleepHours = sleepHoursInput.valueAsNumber;
      const sleepMinutes = sleepMinutesInput.valueAsNumber;
      const sleepDuration = sleepHours * 60 + sleepMinutes;

      if (!Number.isInteger(sleepHours) || sleepHours < 0 || sleepHours > 24) {
        checkInMessage.textContent = 'Sleep hours must be a whole number between 0 and 24.';
        checkInMessage.dataset.state = 'error';
        sleepHoursInput.focus();
        return;
      }

      if (!Number.isInteger(sleepMinutes) || sleepMinutes < 0 || sleepMinutes > 59) {
        checkInMessage.textContent = 'Additional sleep minutes must be between 0 and 59.';
        checkInMessage.dataset.state = 'error';
        sleepMinutesInput.focus();
        return;
      }

      if (sleepDuration < 1 || sleepDuration > 1440) {
        checkInMessage.textContent = 'Sleep duration must be greater than 0 and no more than 24 hours.';
        checkInMessage.dataset.state = 'error';
        sleepHoursInput.focus();
        return;
      }

      const fatigueLevel = Number(fatigueInput.value);
      if (!Number.isInteger(fatigueLevel) || fatigueLevel < 1 || fatigueLevel > 5) {
        checkInMessage.textContent = 'Select a fatigue level from 1 to 5.';
        checkInMessage.dataset.state = 'error';
        fatigueInput.focus();
        return;
      }

      if (!sleepQualityInput.value) {
        checkInMessage.textContent = 'Select a sleep quality.';
        checkInMessage.dataset.state = 'error';
        sleepQualityInput.focus();
        return;
      }

      checkInSubmit.disabled = true;
      checkInMessage.textContent = 'Saving sleep and check-in...';
      checkInMessage.dataset.state = 'info';

      try {
        await addDoc(collection(db, 'daily_check_ins'), {
          sleep_duration_minutes: sleepDuration,
          fatigue_level: fatigueLevel,
          sleep_quality: sleepQualityInput.value,
          crew_id: crewCode,
          recorded_at: serverTimestamp()
        });

        checkInForm.reset();
        checkInMessage.textContent = 'Sleep and daily check-in saved successfully.';
        checkInMessage.dataset.state = 'success';
      } catch (error) {
        console.error("Operation failed:", error);
        checkInMessage.textContent =
          'Could not save sleep and check-in. Check your connection and try again.';
        checkInMessage.dataset.state = 'error';
      } finally {
        checkInSubmit.disabled = false;
      }
    });

    function localDateKey(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const radiationForm = document.getElementById('radiation-form');
    const radiationMessage = document.getElementById('radiation-message');
    const radiationSubmit = radiationForm.querySelector('button[type="submit"]');
    const radiationDoseInput = document.getElementById('radiation-dose-input');

    radiationForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const dose = radiationDoseInput.valueAsNumber;
      const min = Number(radiationDoseInput.min);
      const max = Number(radiationDoseInput.max);

      if (!Number.isFinite(dose) || dose < min || dose > max) {
        radiationMessage.textContent =
          `Dose must be a number between ${min} and ${max} mSv.`;
        radiationMessage.dataset.state = 'error';
        radiationDoseInput.focus();
        return;
      }

      radiationSubmit.disabled = true;
      radiationMessage.textContent = 'Saving radiation dose...';
      radiationMessage.dataset.state = 'info';

      try {
        // One batch keeps the reading, the day record and the mission total in sync.
        const dateKey = localDateKey();
        const batch = writeBatch(db);

        batch.set(doc(collection(db, 'radiation_logs')), {
          crew_id: crewCode,
          dose_msv: dose,
          recorded_at: serverTimestamp()
        });

        // One document per astronaut and day, and one running total per astronaut.
        batch.set(doc(db, 'radiation_daily', `${crewCode}_${dateKey}`), {
          crew_id: crewCode,
          date: dateKey,
          dose_msv: increment(dose),
          updated_at: serverTimestamp()
        }, { merge: true });

        batch.set(doc(db, 'radiation_summary', crewCode), {
          crew_id: crewCode,
          total_msv: increment(dose),
          updated_at: serverTimestamp()
        }, { merge: true });

        await batch.commit();

        radiationForm.reset();
        radiationMessage.textContent = 'Radiation dose saved successfully.';
        radiationMessage.dataset.state = 'success';
      } catch (error) {
        console.error("Operation failed:", error);
        radiationMessage.textContent =
          'Could not save the radiation dose. Check your connection and try again.';
        radiationMessage.dataset.state = 'error';
      } finally {
        radiationSubmit.disabled = false;
      }
    });
