/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

/* Shared starfield with cursor glow and click interaction. */

(() => {
  const canvas = document.querySelector("#space-effects");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const colors = [
    "255,255,255",
    "190,235,255",
    "255,214,235",
    "225,210,255"
  ];

  const pointer = {
    x: -9999,
    y: -9999,
    active: false
  };

  let width = 0;
  let height = 0;
  let stars = [];
  let animationId = null;
  let previousTime = null;
  let elapsedTime = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const count = Math.min(
      220,
      Math.round((width * height) / 5500)
    );

    stars = Array.from({ length: count }, () => {
      const depth = Math.random();

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        velocityX: 0,
        velocityY: 0,
        driftX: (Math.random() - 0.5) * 0.12 * (0.4 + depth),
        driftY: (Math.random() - 0.5) * 0.12 * (0.4 + depth),
        radius: 0.5 + depth * 1.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });

    draw(0);
  }

  function clearPointer() {
    pointer.active = false;
    pointer.x = -9999;
    pointer.y = -9999;
  }

  function drawSparkle(x, y, radius) {
    context.beginPath();

    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      const length = index % 2 === 0
        ? radius * 2.4
        : radius * 0.45;

      const pointX = x + Math.cos(angle) * length;
      const pointY = y + Math.sin(angle) * length;

      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }

    context.closePath();
    context.fill();
  }

  function draw(step) {
    context.clearRect(0, 0, width, height);

    const reducedMotion = motionPreference.matches;
    const interactionRadius = 150;

    for (const star of stars) {
      if (!reducedMotion && step > 0) {
        const distanceX = star.x - pointer.x;
        const distanceY = star.y - pointer.y;
        const distance = Math.hypot(distanceX, distanceY);

        if (
          pointer.active &&
          distance > 0 &&
          distance < interactionRadius
        ) {
          const force = (1 - distance / interactionRadius) * 0.5;

          star.velocityX += (distanceX / distance) * force * step;
          star.velocityY += (distanceY / distance) * force * step;
        }

        const easing = 1 - Math.pow(0.98, step);

        star.velocityX += (star.driftX - star.velocityX) * easing;
        star.velocityY += (star.driftY - star.velocityY) * easing;

        star.x += star.velocityX * step;
        star.y += star.velocityY * step;

        if (star.x < -10) star.x = width + 10;
        if (star.x > width + 10) star.x = -10;
        if (star.y < -10) star.y = height + 10;
        if (star.y > height + 10) star.y = -10;
      }

      const opacity = reducedMotion
        ? 0.8
        : 0.55 + 0.45 * Math.sin(
            elapsedTime * star.speed + star.phase
          );

      context.fillStyle = `rgba(${star.color}, ${opacity})`;

      if (star.radius > 1.6) {
        drawSparkle(star.x, star.y, star.radius);
      } else {
        context.beginPath();
        context.arc(
          star.x,
          star.y,
          star.radius,
          0,
          Math.PI * 2
        );
        context.fill();
      }
    }

    if (pointer.active && !reducedMotion) {
      drawPointerGlow(interactionRadius);
    }
  }

  function drawPointerGlow(radius) {
    const threadRadius = radius * 1.25;

    context.lineWidth = 1;

    for (const star of stars) {
      const distance = Math.hypot(
        star.x - pointer.x,
        star.y - pointer.y
      );

      if (distance < threadRadius) {
        const opacity = (1 - distance / threadRadius) * 0.35;

        context.strokeStyle = `rgba(92, 225, 230, ${opacity})`;
        context.beginPath();
        context.moveTo(pointer.x, pointer.y);
        context.lineTo(star.x, star.y);
        context.stroke();
      }
    }

    const glow = context.createRadialGradient(
      pointer.x,
      pointer.y,
      0,
      pointer.x,
      pointer.y,
      90
    );

    glow.addColorStop(0, "rgba(92, 225, 230, 0.14)");
    glow.addColorStop(1, "rgba(92, 225, 230, 0)");

    context.fillStyle = glow;
    context.fillRect(pointer.x - 90, pointer.y - 90, 180, 180);
  }

  function frame(timestamp) {
    animationId = null;

    if (document.hidden || motionPreference.matches) return;

    const delta = previousTime === null
      ? 1 / 60
      : Math.min((timestamp - previousTime) / 1000, 0.05);

    previousTime = timestamp;
    elapsedTime += delta;

    draw(delta * 60);

    animationId = window.requestAnimationFrame(frame);
  }

  function synchronizeAnimation() {
    if (animationId !== null) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
    }

    previousTime = null;

    if (motionPreference.matches || document.hidden) {
      clearPointer();
      draw(0);
      return;
    }

    animationId = window.requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);

  window.addEventListener("pointermove", (event) => {
    if (
      motionPreference.matches ||
      event.pointerType === "touch"
    ) {
      return;
    }

    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  });

  document.documentElement.addEventListener(
    "pointerleave",
    clearPointer
  );

  window.addEventListener("blur", clearPointer);

  window.addEventListener("pointerdown", (event) => {
    if (motionPreference.matches) return;

    for (const star of stars) {
      const distanceX = star.x - event.clientX;
      const distanceY = star.y - event.clientY;
      const distance = Math.hypot(distanceX, distanceY);

      if (distance > 0 && distance < 220) {
        const force = (1 - distance / 220) * 7;

        star.velocityX += (distanceX / distance) * force;
        star.velocityY += (distanceY / distance) * force;
      }
    }
  });

  motionPreference.addEventListener("change", synchronizeAnimation);
  document.addEventListener("visibilitychange", synchronizeAnimation);

  resize();
  synchronizeAnimation();
})();