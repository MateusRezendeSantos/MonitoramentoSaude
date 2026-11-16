/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

(() => {
  const canvas = document.querySelector("#heartbeat-canvas");
  const valueElement = document.querySelector("#heart-rate-value");

  if (!canvas || !valueElement) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const monitor = canvas.closest(".heartbeat-monitor");
  const label = monitor.querySelector(".heartbeat-monitor__label");

  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const SWEEP_SECONDS = 6;
  const SIGNAL_COLOR = "#00e5ed";

  let width = 0;
  let height = 0;
  let bpm = null;

  let animationId = null;
  let previousTimestamp = null;

  let signalTime = 0;
  let writeX = 0;
  let previousPoint = null;
  let beatPhase = 0;

  /*
   * Stylized P-QRS-T components.
   * These shapes are visual illustrations, not reconstructed ECG data.
   */

  function gaussian(phase, center, spread) {
    const distance = (phase - center) / spread;
    return Math.exp(-0.5 * distance * distance);
  }

  function waveform(phase) {
    const p = 0.11 * gaussian(phase, 0.14, 0.025);
    const q = -0.16 * gaussian(phase, 0.285, 0.009);
    const r = 1.0 * gaussian(phase, 0.31, 0.008);
    const s = -0.3 * gaussian(phase, 0.34, 0.012);
    const t = 0.24 * gaussian(phase, 0.57, 0.055);

    return p + q + r + s + t;
  }

  function signalY(phase, time) {
    const baseline = height * 0.64;
    const amplitude = height * 0.47;

    /* Small, deterministic baseline movement for visual texture. */

    const baselineMovement =
      Math.sin(time * 1.8) * height * 0.008;

    return baseline - waveform(phase) * amplitude + baselineMovement;
  }

  function clearTrace() {
    context.clearRect(0, 0, width, height);
    writeX = 0;
    signalTime = 0;
    beatPhase = 0;
    previousPoint = null;
  }

  function drawSegment(first, second) {
    context.beginPath();
    context.moveTo(first.x, first.y);
    context.lineTo(second.x, second.y);
    context.stroke();
  }

  function prepareStroke() {
    context.strokeStyle = SIGNAL_COLOR;
    context.lineWidth = 1.6;
    context.lineJoin = "round";
    context.lineCap = "round";

    context.shadowColor = SIGNAL_COLOR;
    context.shadowBlur = 4;
  }

  function drawStaticTrace() {
    clearTrace();
    if (bpm === null || width === 0) return;

    prepareStroke();

    context.beginPath();

    for (let x = 0; x <= width; x += 0.5) {
      const time = (x / width) * SWEEP_SECONDS;
      const phase = (time * bpm / 60) % 1;
      const y = signalY(phase, time);

      if (x === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
    context.shadowBlur = 0;
  }

  function advanceTrace(delta) {
    const pixelsPerSecond = width / SWEEP_SECONDS;

    /*
     * Subdivide each frame to preserve the narrow peaks
     * instead of skipping them between screen refreshes.
     */

    const steps = Math.max(
      1,
      Math.ceil(Math.max(
        pixelsPerSecond * delta / 0.5,
        delta * bpm / 60 / 0.003
      ))
    );

    const stepTime = delta / steps;

    prepareStroke();

    for (let index = 0; index < steps; index += 1) {
      signalTime += stepTime;
      beatPhase = (beatPhase + stepTime * bpm / 60) % 1;
      writeX += pixelsPerSecond * stepTime;

      if (writeX >= width) {
        writeX %= width;
        previousPoint = null;
      }

      /*
       * Erase just ahead of the drawing tip.
       * The gap separates the new trace from the previous sweep.
       */

      const eraseStart = Math.floor(writeX);
      const eraseWidth = 18;

      context.clearRect(eraseStart, 0, eraseWidth, height);

      if (eraseStart + eraseWidth > width) {
        context.clearRect(
          0,
          0,
          eraseStart + eraseWidth - width,
          height
        );
      }

      const point = {
        x: writeX,
        y: signalY(beatPhase, signalTime)
      };

      if (previousPoint) {
        drawSegment(previousPoint, point);
      }

      previousPoint = point;
    }

    if (previousPoint) {
      context.fillStyle = "#c8ffff";
      context.shadowBlur = 7;

      context.beginPath();
      context.arc(
        previousPoint.x,
        previousPoint.y,
        1.7,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    context.shadowBlur = 0;
  }

  function frame(timestamp) {
    animationId = null;

    if (
      document.hidden ||
      motionPreference.matches ||
      bpm === null
    ) {
      return;
    }

    const delta = previousTimestamp === null
      ? 0
      : Math.min((timestamp - previousTimestamp) / 1000, 0.1);

    previousTimestamp = timestamp;

    if (delta > 0 && width > 0) {
      advanceTrace(delta);
    }

    animationId = window.requestAnimationFrame(frame);
  }

  function synchronizeAnimation() {
    if (animationId !== null) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
    }

    previousTimestamp = null;

    if (bpm === null) {
      clearTrace();
      return;
    }

    if (motionPreference.matches) {
      drawStaticTrace();
      return;
    }

    if (!document.hidden) {
      animationId = window.requestAnimationFrame(frame);
    }
  }

  function readHeartRate() {
    const text = valueElement.textContent.trim();
    const value = Number(text);

    /*
     * This range bounds rendering input only.
     * It does not define a medically normal heart rate.
     */

    bpm = text && Number.isFinite(value) && value > 0 && value <= 400
      ? value
      : null;

    label.textContent = bpm === null
      ? "Heart rate reading unavailable"
      : `Heartbeat visualization · ${bpm} bpm`;

    clearTrace();
    synchronizeAnimation();
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    width = bounds.width;
    height = bounds.height;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    clearTrace();
    synchronizeAnimation();
  }

  const valueObserver = new MutationObserver(readHeartRate);

  valueObserver.observe(valueElement, {
    childList: true,
    characterData: true,
    subtree: true
  });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  motionPreference.addEventListener("change", synchronizeAnimation);
  document.addEventListener("visibilitychange", synchronizeAnimation);

  readHeartRate();
})();