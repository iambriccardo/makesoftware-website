import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

const stickerAssets = [
  "/assets/stickers/freud.webp",
  "/assets/stickers/hundertwasser.webp",
  "/assets/stickers/klimt.webp",
  "/assets/stickers/knodel.webp",
  "/assets/stickers/krapfen.webp",
  "/assets/stickers/mozart.webp",
  "/assets/stickers/oper.webp",
  "/assets/stickers/prater.webp",
  "/assets/stickers/sacher.webp",
  "/assets/stickers/schnitzel.webp",
  "/assets/stickers/schonnbrunn.webp",
  "/assets/stickers/sissi.webp",
  "/assets/stickers/stephansdom.webp",
  "/assets/stickers/tram.webp",
  "/assets/stickers/u-bahn.webp",
  "/assets/stickers/vienna.webp"
];

const terminalCommands = [
  ["$ make tiny-app", "built /tiny/weird.html"],
  ["$ vibe --local", "found 5 friends nearby"],
  ["$ ship weird", "demo uploaded"],
  ["$ open portal", "portal says: play more"],
  ["$ save magic", "magic saved locally"]
];

const chatMessages = [
  "bring a weird idea",
  "ugly demos welcome",
  "tiny tools forever",
  "made near others",
  "computers are toys"
];

const calendarDates = [
  { month: "June", day: "7" },
  { month: "July", day: "13" },
  { month: "Soon", day: "21" },
  { month: "Now", day: "∞" }
];

const paletteSets = [
  ["#ff5a47", "#103dff", "#60d130"],
  ["#fff36e", "#fb78a6", "#111111"],
  ["#ff8a2a", "#63a7ff", "#fffdf5"],
  ["#60d130", "#fff36e", "#103dff"]
];

const weatherStates = [
  { temp: "23°", a: "#63a7ff", b: "#bde6ff", sun: "#fff36e" },
  { temp: "18°", a: "#b7c1ff", b: "#fffdf5", sun: "#fb78a6" },
  { temp: "31°", a: "#ff8a2a", b: "#fff36e", sun: "#fffdf5" }
];

const memoTexts = ["save the odd version", "invite one friend", "make it smaller", "ship before polish"];
const pixelColors = ["#fffdf5", "#fff36e", "#60d130", "#63a7ff", "#fb78a6", "#ff8a2a", "#2D250E"];

const initialState = {
  stampActive: false,
  terminalIndex: 0,
  chatIndex: 0,
  calendarIndex: 0,
  receiptTotal: 8,
  receiptItems: 2,
  weatherIndex: 0,
  clock24: true,
  websiteTheme: 0,
  paletteIndex: 0,
  calc: "",
  calcDemoIndex: 0,
  bubbleCount: 3,
  mailCount: 5,
  timerProgress: 35,
  memoIndex: 0,
  photoFlip: false,
  mapIndex: 0,
  voiceRecording: false,
  pixelSeed: 0,
  pixelActive: false,
  fileCount: 12,
  sliderStep: 0,
  coinHeads: false,
  gameStep: 0,
  todoDone: [false, false, false, false],
  windowTab: "html",
  musicPlaying: false
};

function stickerIdFromSrc(src) {
  return decodeURIComponent(src.split("/").pop() || src).replace(/\.[^.]+$/, "");
}

function seededNoise(seed) {
  const value = Math.sin(seed * 9283.123) * 43758.5453;
  return value - Math.floor(value);
}

function greatestCommonDivisor(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left || 1;
}

function spreadStep(count) {
  let step = Math.max(1, Math.round(count * 0.618));
  while (greatestCommonDivisor(step, count) !== 1) step += 1;
  return step;
}

function stickerViewportConfig(width = window.innerWidth) {
  if (width <= 480) {
    return { count: 6, size: Math.round(clamp(width * 0.13, 46, 54)), marginX: 0.16, marginTop: 0.14, marginBottom: 0.2, avoidWidth: 0.48, avoidHeight: 0.42 };
  }
  if (width <= 640) {
    return { count: 7, size: Math.round(clamp(width * 0.12, 52, 62)), marginX: 0.14, marginTop: 0.13, marginBottom: 0.18, avoidWidth: 0.46, avoidHeight: 0.4 };
  }
  if (width <= 920) {
    return { count: 10, size: 72, marginX: 0.11, marginTop: 0.11, marginBottom: 0.16, avoidWidth: 0.44, avoidHeight: 0.38 };
  }
  return { count: Number.POSITIVE_INFINITY, size: Math.round(clamp(width * 0.075, 88, 112)), marginX: 0.08, marginTop: 0.1, marginBottom: 0.14, avoidWidth: 0.43, avoidHeight: 0.39 };
}

function selectStickerAssetsForViewport(assets, seed, width) {
  const { count } = stickerViewportConfig(width);
  const limit = Math.min(assets.length, count);
  if (limit >= assets.length) return assets;

  return assets
    .map((src, index) => ({ src, rank: seededNoise(seed + index * 5.73 + assets.length * 0.41) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((item) => item.src);
}

function randomStickerPosition(index, total, seed, width, height) {
  const config = stickerViewportConfig(width);
  const aspect = width / Math.max(height, 1);
  const safeLeft = clamp(width * config.marginX, 46, 150);
  const safeRight = clamp(width * config.marginX, 46, 150);
  const safeTop = clamp(height * config.marginTop, 54, 132);
  const safeBottom = clamp(height * config.marginBottom, 72, 172);
  const usableWidth = Math.max(width - safeLeft - safeRight, 1);
  const usableHeight = Math.max(height - safeTop - safeBottom, 1);
  const columns = Math.max(2, Math.ceil(Math.sqrt(total * aspect)));
  const rows = Math.max(2, Math.ceil(total / columns));
  const cellCount = columns * rows;
  const cellOffset = Math.floor(seededNoise(seed + total * 1.91) * cellCount);
  const cell = (index * spreadStep(cellCount) + cellOffset) % cellCount;
  const column = cell % columns;
  const row = Math.floor(cell / columns);
  const cellWidth = usableWidth / columns;
  const cellHeight = usableHeight / rows;
  const wave = seed + index * 2.399 + total * 0.17;
  let x = safeLeft + (column + 0.5) * cellWidth + (seededNoise(wave) - 0.5) * cellWidth * 0.5;
  let y = safeTop + (row + 0.5) * cellHeight + (seededNoise(wave + 7.13) - 0.5) * cellHeight * 0.5;
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const avoidWidth = width * config.avoidWidth;
  const avoidHeight = height * config.avoidHeight;
  const centerDx = x - centerX;
  const centerDy = y - centerY;

  if (Math.abs(centerDx) < avoidWidth && Math.abs(centerDy) < avoidHeight) {
    const direction = Math.atan2(
      centerDy || seededNoise(seed + index + 18.3) - 0.5,
      centerDx || seededNoise(seed + index + 2.7) - 0.5
    );
    x += Math.cos(direction) * (avoidWidth - Math.abs(centerDx) + width * 0.075);
    y += Math.sin(direction) * (avoidHeight - Math.abs(centerDy) + height * 0.065);
  }

  const escapedDx = x - centerX;
  const escapedDy = y - centerY;
  if (Math.abs(escapedDx) < avoidWidth && Math.abs(escapedDy) < avoidHeight) {
    const signX = escapedDx < 0 ? -1 : 1;
    const signY = escapedDy < 0 ? -1 : 1;
    if (avoidWidth - Math.abs(escapedDx) < avoidHeight - Math.abs(escapedDy)) {
      x = centerX + signX * (avoidWidth + width * 0.045);
    } else {
      y = centerY + signY * (avoidHeight + height * 0.045);
    }
  }

  return { x, y };
}

function clampStickerPoint(x, y, size) {
  const gutter = Math.max(12, size * 0.45);
  return {
    x: clamp(x, gutter, window.innerWidth - gutter),
    y: clamp(y, gutter, window.innerHeight - gutter)
  };
}

function stickerExitVector(point, index, size, seed) {
  const width = Math.max(window.innerWidth, 1);
  const height = Math.max(window.innerHeight, 1);
  const fromCenterX = point.x - width * 0.5;
  const fromCenterY = point.y - height * 0.5;
  const length = Math.hypot(fromCenterX, fromCenterY) || 1;
  const normalX = fromCenterX / length;
  const normalY = fromCenterY / length;
  const wave = seed + index * 1.913;
  const tangent = seededNoise(wave + 11.7) > 0.5 ? 1 : -1;
  const push = Math.max(width, height) * 0.42 + size * 1.35;
  const drift = Math.min(width, height) * (0.1 + seededNoise(wave + 3.1) * 0.1);

  return {
    x: normalX * push + -normalY * tangent * drift,
    y: normalY * push + normalX * tangent * drift,
    rotate: (seededNoise(wave + 6.4) - 0.5) * 54
  };
}

function useBodyScrollClasses(progress) {
  useMotionValueEvent(progress, "change", (value) => {
    const detailsProgress = smoothstep((value - 0.24) / 0.36);
    const footerProgress = smoothstep((value - 0.3) / 0.36);
    const stickerProgress = smoothstep((value - 0.06) / 0.42);

    document.body.classList.toggle("is-details-active", detailsProgress > 0.06);
    document.body.classList.toggle("is-footer-active", footerProgress > 0.08);
    document.body.classList.toggle("is-stickers-hidden", clamp(1 - stickerProgress * 1.08) < 0.08 || detailsProgress > 0.06);
    document.body.classList.toggle("is-scene-complete", value > 0.94);
  });
}

function useScatter(sceneRef) {
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;

    const buildScatter = () => {
      const collage = scene.querySelector(".collage");
      const items = [...scene.querySelectorAll(".mini-app, .scene-wordmark")];
      const collageRect = collage?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 1;

      items.forEach((item, index) => {
        const isWordmark = item.classList.contains("scene-wordmark");
        const itemRect = item.getBoundingClientRect();
        const centerX = collageRect
          ? collageRect.left + item.offsetLeft + (isWordmark ? 0 : item.offsetWidth / 2)
          : itemRect.left + itemRect.width / 2;
        const centerY = collageRect
          ? collageRect.top + item.offsetTop + (isWordmark ? 0 : item.offsetHeight / 2)
          : itemRect.top + itemRect.height / 2;
        const fromCenterX = centerX - viewportWidth / 2;
        const fromCenterY = centerY - viewportHeight / 2;
        const length = Math.hypot(fromCenterX, fromCenterY) || 1;
        const wave = index * 1.618;
        const strength = isWordmark ? 0 : 1;
        const x = ((fromCenterX / length) * viewportWidth * 0.58 + Math.cos(wave) * 96) * strength;
        const y = ((fromCenterY / length) * viewportHeight * 0.52 + Math.sin(wave) * 88) * strength;

        item.style.setProperty("--scatter-x", `${x.toFixed(2)}px`);
        item.style.setProperty("--scatter-y", `${y.toFixed(2)}px`);
      });
    };

    let raf = requestAnimationFrame(buildScatter);
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(buildScatter);
    };

    window.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    document.fonts?.ready?.then(schedule);
    window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [sceneRef]);
}

function usePointerParallax(sceneRef) {
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const root = document.documentElement;
    let raf = 0;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const floaters = [...scene.querySelectorAll(".mini-app, .scene-wordmark")].map((item, index) => {
      const depth = Number(item.dataset.depth || ((index % 5) + 1));
      item.style.setProperty("--parallax", (0.36 + depth * 0.08).toFixed(2));
      return { item, depth };
    });

    const render = () => {
      pointer.x += (pointer.targetX - pointer.x) * 0.08;
      pointer.y += (pointer.targetY - pointer.y) * 0.08;
      if (Math.abs(pointer.targetX - pointer.x) < 0.001) pointer.x = pointer.targetX;
      if (Math.abs(pointer.targetY - pointer.y) < 0.001) pointer.y = pointer.targetY;

      root.style.setProperty("--scene-tilt-x", (pointer.x * 8).toFixed(3));
      root.style.setProperty("--scene-tilt-y", (pointer.y * 6).toFixed(3));
      floaters.forEach(({ item, depth }) => {
        item.style.setProperty("--float-x", `${(pointer.x * depth * 6).toFixed(2)}px`);
        item.style.setProperty("--float-y", `${(pointer.y * depth * 4).toFixed(2)}px`);
      });

      raf = pointer.x !== pointer.targetX || pointer.y !== pointer.targetY ? requestAnimationFrame(render) : 0;
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };
    const onMove = (event) => {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };
    const onLeave = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
      schedule();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [sceneRef]);
}

function useClock(clock24) {
  const [clock, setClock] = useState({ text: "--:--", hour: "0deg", minute: "0deg" });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      setClock({
        hour: `${((hours % 12) + minutes / 60) * 30}deg`,
        minute: `${minutes * 6}deg`,
        text: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !clock24 })
      });
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [clock24]);

  return clock;
}

function useWindowDrag(ref, index) {
  useEffect(() => {
    const windowEl = ref.current;
    const handle = windowEl?.querySelector("[data-drag-handle]");
    if (!windowEl || !handle) return undefined;

    let activeWindowZ = 40 + index;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let dragScale = 1;
    const mobileWindowQuery = window.matchMedia("(max-width: 640px), (hover: none) and (pointer: coarse)");

    windowEl.style.zIndex = String(20 + index);

    const bringToFront = () => {
      activeWindowZ += 10;
      windowEl.style.zIndex = String(activeWindowZ);
    };
    const moveDrag = (event) => {
      if (pointerId !== event.pointerId) return;
      event.preventDefault();
      const nextX = originX + (event.clientX - startX) / dragScale;
      const nextY = originY + (event.clientY - startY) / dragScale;
      windowEl.dataset.dragX = String(nextX);
      windowEl.dataset.dragY = String(nextY);
      windowEl.style.setProperty("--window-drag-x", `${nextX}px`);
      windowEl.style.setProperty("--window-drag-y", `${nextY}px`);
    };
    const endDrag = (event) => {
      if (pointerId !== event.pointerId) return;
      const activePointerId = pointerId;
      window.removeEventListener("pointermove", moveDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      if (handle.hasPointerCapture(activePointerId)) handle.releasePointerCapture(activePointerId);
      pointerId = null;
      dragScale = 1;
      windowEl.classList.remove("is-dragging");
    };
    const startDrag = (event) => {
      if (event.button !== 0 || event.detail > 1 || mobileWindowQuery.matches || event.pointerType === "touch") return;
      event.preventDefault();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      originX = Number(windowEl.dataset.dragX || 0);
      originY = Number(windowEl.dataset.dragY || 0);
      const desktopRect = windowEl.parentElement?.getBoundingClientRect();
      const desktopWidth = windowEl.parentElement?.offsetWidth || 0;
      dragScale = desktopRect && desktopWidth ? desktopRect.width / desktopWidth : 1;
      if (!Number.isFinite(dragScale) || dragScale <= 0) dragScale = 1;
      bringToFront();
      windowEl.classList.add("is-dragging");
      handle.setPointerCapture(pointerId);
      window.addEventListener("pointermove", moveDrag, { passive: false });
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    };
    const reset = (event) => {
      event.preventDefault();
      if (pointerId !== null) return;
      bringToFront();
      windowEl.classList.add("is-resetting");
      windowEl.dataset.dragX = "0";
      windowEl.dataset.dragY = "0";
      windowEl.style.setProperty("--window-drag-x", "0px");
      windowEl.style.setProperty("--window-drag-y", "0px");
      window.setTimeout(() => windowEl.classList.remove("is-resetting"), 520);
    };

    windowEl.addEventListener("pointerdown", bringToFront);
    windowEl.addEventListener("focusin", bringToFront);
    handle.addEventListener("pointerdown", startDrag);
    handle.addEventListener("dblclick", reset);
    return () => {
      windowEl.removeEventListener("pointerdown", bringToFront);
      windowEl.removeEventListener("focusin", bringToFront);
      handle.removeEventListener("pointerdown", startDrag);
      handle.removeEventListener("dblclick", reset);
      window.removeEventListener("pointermove", moveDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [ref, index]);
}

function Sticker({ sticker, seed, index }) {
  const ref = useRef(null);
  const state = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: sticker.x,
    originY: sticker.y,
    currentX: sticker.x,
    currentY: sticker.y,
    lastMoveX: sticker.x,
    lastMoveY: sticker.y,
    lastMoveTime: performance.now(),
    releaseVelocityX: 0,
    releaseVelocityY: 0
  });

  const updatePosition = useCallback((x, y) => {
    const element = ref.current;
    if (!element) return;
    state.current.currentX = x;
    state.current.currentY = y;
    element.style.setProperty("--sticker-x", `${x}px`);
    element.style.setProperty("--sticker-y", `${y}px`);
  }, []);

  const updateExitVector = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const exit = stickerExitVector(
      { x: state.current.currentX, y: state.current.currentY },
      index,
      sticker.size,
      seed
    );
    element.style.setProperty("--sticker-exit-x", `${exit.x.toFixed(2)}px`);
    element.style.setProperty("--sticker-exit-y", `${exit.y.toFixed(2)}px`);
    element.style.setProperty("--sticker-exit-rotate", `${exit.rotate.toFixed(2)}deg`);
  }, [index, seed, sticker.size]);

  useEffect(() => {
    updateExitVector();
    const onResize = () => {
      const next = clampStickerPoint(state.current.currentX, state.current.currentY, sticker.size);
      updatePosition(next.x, next.y);
      updateExitVector();
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [sticker.size, updateExitVector, updatePosition]);

  const bringToFront = () => {
    const element = ref.current;
    const board = element?.parentElement;
    if (!element || !board) return;
    const nextZ = Number(board.dataset.nextZ || 80) + 1;
    board.dataset.nextZ = String(nextZ);
    element.style.setProperty("--sticker-z", String(nextZ));
  };

  const attachSticker = () => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof element.animate !== "function") return;

    element
      .getAnimations?.({ subtree: true })
      .filter((animation) => animation.id === "sticker-attach" || animation.id === "sticker-shadow-attach")
      .forEach((animation) => animation.cancel());

    const velocity = Math.hypot(state.current.releaseVelocityX, state.current.releaseVelocityY);
    const direction = velocity > 0.01 ? Math.sign(state.current.releaseVelocityX || 1) : seededNoise(index + 19.4) > 0.5 ? 1 : -1;
    const twist = clamp((state.current.releaseVelocityX / 32) * 5, -6, 6) || direction * 2.6;
    const drop = clamp(Math.abs(state.current.releaseVelocityY) / 18, 1.5, 7);

    const animation = element.animate(
      [
        { offset: 0, scale: "0.9 0.94", translate: `${(-direction * 2.5).toFixed(2)}px ${(-drop).toFixed(2)}px`, rotate: `${(-twist * 0.75).toFixed(2)}deg`, easing: "cubic-bezier(.2,.72,.18,1)" },
        { offset: 0.3, scale: "1.08 0.91", translate: `${(direction * 1.5).toFixed(2)}px 3px`, rotate: `${twist.toFixed(2)}deg`, easing: "cubic-bezier(.12,.82,.16,1)" },
        { offset: 0.48, scale: "0.96 1.045", translate: `${(-direction * 0.7).toFixed(2)}px -1px`, rotate: `${(-twist * 0.34).toFixed(2)}deg`, easing: "cubic-bezier(.18,.7,.18,1)" },
        { offset: 0.68, scale: "1.025 0.985", translate: "0 0.5px", rotate: `${(twist * 0.16).toFixed(2)}deg`, easing: "cubic-bezier(.16,.84,.18,1)" },
        { offset: 1, scale: "1", translate: "0 0", rotate: "0deg" }
      ],
      { duration: 620, easing: "linear" }
    );
    animation.id = "sticker-attach";
  };

  const onPointerDown = (event) => {
    if (event.button && event.button !== 0) return;
    event.preventDefault();
    const current = state.current;
    current.pointerId = event.pointerId;
    current.startX = event.clientX;
    current.startY = event.clientY;
    current.originX = current.currentX;
    current.originY = current.currentY;
    current.lastMoveX = current.currentX;
    current.lastMoveY = current.currentY;
    current.lastMoveTime = performance.now();
    current.releaseVelocityX = 0;
    current.releaseVelocityY = 0;
    bringToFront();
    ref.current?.classList.add("is-dragging");
    ref.current?.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    const current = state.current;
    if (current.pointerId !== event.pointerId) return;
    const next = clampStickerPoint(current.originX + event.clientX - current.startX, current.originY + event.clientY - current.startY, sticker.size);
    const now = performance.now();
    const elapsed = Math.max(now - current.lastMoveTime, 16);
    current.releaseVelocityX = ((next.x - current.lastMoveX) / elapsed) * 16.67;
    current.releaseVelocityY = ((next.y - current.lastMoveY) / elapsed) * 16.67;
    current.lastMoveX = next.x;
    current.lastMoveY = next.y;
    current.lastMoveTime = now;
    updatePosition(next.x, next.y);
  };
  const endDrag = (event) => {
    const current = state.current;
    if (current.pointerId !== event.pointerId) return;
    ref.current?.releasePointerCapture(current.pointerId);
    current.pointerId = null;
    ref.current?.classList.remove("is-dragging");
    updateExitVector();
    attachSticker();
  };

  return (
    <button
      ref={ref}
      className="floating-sticker"
      type="button"
      data-sticker-id={sticker.id}
      aria-label={`Move ${sticker.label} sticker`}
      style={{
        "--sticker-x": `${sticker.x}px`,
        "--sticker-y": `${sticker.y}px`,
        "--sticker-size": `${sticker.size}px`,
        "--sticker-rotate": `${sticker.rotate.toFixed(2)}deg`,
        "--sticker-z": String(10 + index)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onFocus={bringToFront}
    >
      <img src={sticker.src} alt="" width="1254" height="1254" draggable="false" />
    </button>
  );
}

function StickerBoard({ style }) {
  const seed = useMemo(() => Math.random() * 10000, []);
  const [stickers, setStickers] = useState([]);

  useLayoutEffect(() => {
    const build = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const visibleAssets = selectStickerAssetsForViewport(stickerAssets, seed, width);
      const size = stickerViewportConfig(width).size;
      setStickers(
        visibleAssets.map((src, index) => {
          const rawPoint = randomStickerPosition(index, visibleAssets.length, seed, width, height);
          const point = clampStickerPoint(rawPoint.x, rawPoint.y, size);
          return {
            src,
            id: stickerIdFromSrc(src),
            label: stickerIdFromSrc(src),
            size,
            x: point.x,
            y: point.y,
            rotate: (seededNoise(seed + index + 12.7) - 0.5) * 22
          };
        })
      );
    };

    build();
    window.addEventListener("resize", build, { passive: true });
    return () => window.removeEventListener("resize", build);
  }, [seed]);

  return (
    <motion.div className="sticker-board" data-sticker-board aria-label="Draggable sticker layer" style={style}>
      {stickers.map((sticker, index) => (
        <Sticker key={sticker.id} sticker={sticker} index={index} seed={seed} />
      ))}
    </motion.div>
  );
}

function CloudLayer() {
  return (
    <>
      <svg className="cloud-filter-defs" aria-hidden="true" focusable="false">
        <filter id="cloud-squish" x="-18%" y="-30%" width="136%" height="172%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.028" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="5" />
        </filter>
      </svg>
      <div className="sky-layer" aria-hidden="true" />
      <div className="cloud-layer" aria-hidden="true">
        {["a", "b", "c", "d", "e", "f"].map((name) => (
          <div key={name} className={`soft-cloud cloud-${name}`}>
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </>
  );
}

function BurstLayer({ bursts }) {
  return (
    <AnimatePresence>
      {bursts.map((burst) => (
        <motion.span
          key={burst.id}
          className="interaction-burst"
          style={{
            left: burst.x,
            top: burst.y,
            width: burst.size
          }}
          initial={{ opacity: 0.74, scale: 0.36, rotate: 0 }}
          animate={{ opacity: 0, scale: 2.9, rotate: 34 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.72, ease: [0.16, 0.84, 0.18, 1] }}
        />
      ))}
    </AnimatePresence>
  );
}

function MiniApp({ id, className, label, children, onActivate, active, dataProps = {}, style = {} }) {
  const [front, setFront] = useState(false);
  const [tapped, setTapped] = useState(false);

  const activate = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTapped(true);
    window.setTimeout(() => setTapped(false), 260);
    onActivate(id, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      size: Math.max(rect.width, rect.height) * 0.74
    });
  };

  return (
    <article
      className={`artifact mini-app ${className}${active ? " is-active" : ""}${front ? " is-hover-target is-front" : ""}${tapped ? " is-tapped" : ""}`}
      data-widget={id}
      data-depth={dataProps["data-depth"]}
      tabIndex={0}
      aria-label={label}
      style={{ ...style, "--app-pulse": tapped ? 1 : 0 }}
      {...dataProps}
      onClick={activate}
      onPointerEnter={() => setFront(true)}
      onPointerLeave={() => setFront(false)}
      onFocus={() => setFront(true)}
      onBlur={() => setFront(false)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate(event);
      }}
    >
      {children}
    </article>
  );
}

function MiniApps({ state, activate, clock }) {
  const palette = paletteSets[state.paletteIndex % paletteSets.length];
  const terminal = terminalCommands[state.terminalIndex];
  const mapPins = [
    ["68%", "38%"],
    ["28%", "64%"],
    ["76%", "72%"],
    ["42%", "28%"]
  ];
  const mapPin = mapPins[state.mapIndex];
  const weather = weatherStates[state.weatherIndex];
  const doneRatio = state.todoDone.filter(Boolean).length / state.todoDone.length;

  return (
    <>
      <div className="scene-wordmark" data-depth="5" role="img" aria-label="Make Software">
        <span className="wordmark-line wordmark-make">Make</span>
        <span className="wordmark-line wordmark-software">Software</span>
      </div>

      <MiniApp id="stamp" className="stamp-app" label="Tiny stamp maker" active={state.stampActive} onActivate={activate}>
        <span className="stamp-label">{state.stampActive ? <>tiny<br />thing<br />shipped</> : <>made<br />near<br />others</>}</span>
        <button className="app-action stamp-hit" type="button" data-action="stamp" tabIndex={-1}>stamp</button>
      </MiniApp>

      <MiniApp
        id="palette"
        className="palette-app"
        label="Tiny theme mixer"
        onActivate={activate}
        style={{ "--swatch-a": palette[0], "--swatch-b": palette[1], "--swatch-c": palette[2] }}
      >
        <span className="theme-title">theme</span>
        <button className="palette-swatch palette-swatch-a" type="button" data-action="palette" data-palette="0" aria-label="Use warm theme" tabIndex={-1}><span /></button>
        <button className="palette-swatch palette-swatch-b" type="button" data-action="palette" data-palette="1" aria-label="Use punch theme" tabIndex={-1}><span /></button>
        <button className="palette-swatch palette-swatch-c" type="button" data-action="palette" data-palette="2" aria-label="Use sky theme" tabIndex={-1}><span /></button>
      </MiniApp>

      <MiniApp id="map" className="map-app" label="Tiny map app" onActivate={activate} style={{ "--pin-x": mapPin[0], "--pin-y": mapPin[1] }}>
        <button className="app-action" type="button" data-action="map" tabIndex={-1}>route</button>
      </MiniApp>

      <MiniApp id="terminal" className="terminal-app" label="Tiny terminal" onActivate={activate}>
        <span className="terminal-line">{terminal[0]} {state.terminalIndex ? terminal[1] : ""} <span className="cursor" /></span>
        <button className="app-action terminal-run" type="button" data-action="terminal" tabIndex={-1}>run</button>
      </MiniApp>

      <MiniApp id="window" className="window-card" label="Tiny code editor" onActivate={activate} dataProps={{ "data-tab": state.windowTab }}>
        <div className="window-tabs" aria-label="Editor tabs">
          <button type="button" data-action="window" data-tab="html" tabIndex={-1}>html</button>
          <button type="button" data-action="window" data-tab="css" tabIndex={-1}>css</button>
        </div>
        <span className="code-line code-line-a" style={{ width: state.windowTab === "css" ? "58%" : "78%" }} />
        <span className="code-line code-line-b" style={{ width: state.windowTab === "css" ? "74%" : "46%" }} />
        <span className="preview-dot" />
      </MiniApp>

      <MiniApp id="chat" className="chat-app" label="Tiny chat app" onActivate={activate}>
        <span className="chat-message">{chatMessages[state.chatIndex]}</span>
        <button className="app-action chat-send" type="button" data-action="chat" tabIndex={-1}>reply</button>
      </MiniApp>

      <MiniApp id="website" className="website-app" label="Tiny website builder" onActivate={activate} dataProps={{ "data-theme": state.websiteTheme }}>
        <span className="site-hero" />
        <span className="site-lines" />
        <div className="site-tools">
          <button type="button" data-action="website" data-theme="0" aria-label="Blue layout" tabIndex={-1} />
          <button type="button" data-action="website" data-theme="1" aria-label="Pink layout" tabIndex={-1} />
          <button type="button" data-action="website" data-theme="2" aria-label="Green layout" tabIndex={-1} />
        </div>
      </MiniApp>

      <MiniApp id="clock" className="clock-app" label="Live tiny clock" onActivate={activate} style={{ "--clock-hour": clock.hour, "--clock-minute": clock.minute }}>
        <span className="clock-face" aria-hidden="true" />
        <time className="clock-time">{clock.text}</time>
        <button className="app-action clock-toggle" type="button" data-action="clock" tabIndex={-1}>{state.clock24 ? "24h" : "12h"}</button>
      </MiniApp>

      <MiniApp id="mail" className="mail-app" label="Tiny inbox" active={state.mailCount === 0} onActivate={activate}>
        <strong>{state.mailCount}</strong>
        <button className="app-action" type="button" data-action="mail" tabIndex={-1}>read</button>
      </MiniApp>

      <MiniApp id="receipt" className="receipt" label="Tiny values receipt" onActivate={activate}>
        <strong className="receipt-total">{state.receiptTotal}</strong>
        <span className="receipt-line">{state.receiptItems === 2 ? <>tiny values<br />paid in taste</> : <>{state.receiptItems} tiny things<br />paid in taste</>}</span>
        <button className="app-action receipt-add" type="button" data-action="receipt" tabIndex={-1}>add</button>
      </MiniApp>

      <MiniApp id="calendar" className="calendar" label="Tiny calendar" onActivate={activate} dataProps={{ "data-day": calendarDates[state.calendarIndex].day }}>
        <span className="calendar-month">{calendarDates[state.calendarIndex].month}</span>
        <button type="button" data-action="calendar" aria-label="Next calendar day" tabIndex={-1} />
      </MiniApp>

      <MiniApp id="bubble" className={`chat-badge${state.bubbleCount === 0 ? " is-empty" : ""}`} label="Tiny notification bubble" onActivate={activate}>
        <span className="bubble-count">{state.bubbleCount}</span>
        <button type="button" data-action="bubble" aria-label="Clear notification" tabIndex={-1} />
      </MiniApp>

      <MiniApp id="calculator" className="calculator-app" label="Tiny calculator" onActivate={activate}>
        <output className="calc-screen">{state.calc || "0"}</output>
        <span className="calc-grid">
          {["7", "8", "+", "4", "5", "=", "C", "1", "2"].map((key) => (
            <button key={key} type="button" data-action="calc" data-key={key} tabIndex={-1}>{key}</button>
          ))}
        </span>
      </MiniApp>

      <MiniApp id="todo" className="todo-app" label="Tiny todo list" active={doneRatio > 0} onActivate={activate} style={{ "--done-ratio": String(doneRatio) }}>
        {["draw idea", "break code", "ship small", "tell friend"].map((label, index) => (
          <label key={label}><input type="checkbox" data-action="todo" checked={state.todoDone[index]} readOnly tabIndex={-1} />{label}</label>
        ))}
      </MiniApp>

      <MiniApp id="weather" className="weather-app" label="Tiny weather app" onActivate={activate} style={{ "--weather-a": weather.a, "--weather-b": weather.b, "--weather-sun": weather.sun }}>
        <span className="weather-temp">{weather.temp}</span>
        <button className="app-action weather-next" type="button" data-action="weather" tabIndex={-1}>next</button>
      </MiniApp>

      <MiniApp id="music" className={`music-app${state.musicPlaying ? " is-playing" : ""}`} label="Tiny music player" onActivate={activate}>
        <span />
        <button className="music-toggle" type="button" data-action="music" aria-label="Play tiny music" tabIndex={-1}>{state.musicPlaying ? "pause" : "play"}</button>
      </MiniApp>

      <MiniApp id="timer" className="timer-app" label="Tiny focus timer" onActivate={activate} style={{ "--timer-progress": String(state.timerProgress) }}>
        <span className="timer-label">{Math.max(1, Math.round((100 - state.timerProgress) / 6))}</span>
        <button type="button" data-action="timer" tabIndex={-1}>timer</button>
      </MiniApp>

      <MiniApp id="photo" className="photo-app" label="Tiny photo stack" active={state.photoFlip} onActivate={activate}>
        <span style={{ rotate: state.photoFlip ? "12deg" : "-10deg" }} />
        <span style={{ rotate: state.photoFlip ? "-12deg" : "8deg" }} />
        <button className="app-action" type="button" data-action="photo" tabIndex={-1}>flip</button>
      </MiniApp>

      <MiniApp id="memo" className="memo-app" label="Tiny memo app" onActivate={activate}>
        <span className="memo-text">{memoTexts[state.memoIndex]}</span>
        <button className="app-action" type="button" data-action="memo" tabIndex={-1}>new</button>
      </MiniApp>

      <MiniApp id="voice" className={`voice-app${state.voiceRecording ? " is-recording" : ""}`} label="Tiny voice recorder" onActivate={activate}>
        <span className="voice-title">voice</span>
        <span className="voice-bars"><i /><i /><i /><i /><i /></span>
        <button className="app-action voice-toggle" type="button" data-action="voice" tabIndex={-1}>{state.voiceRecording ? "stop" : "rec"}</button>
      </MiniApp>

      <MiniApp id="pixel" className="pixel-app" label="Tiny pixel painter" active={state.pixelActive} onActivate={activate}>
        <span className="pixel-grid" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => (
            <i key={index} style={{ background: pixelColors[(index + state.pixelSeed * 3) % pixelColors.length], scale: (index + state.pixelSeed) % 4 === 0 ? "0.72" : "1" }} />
          ))}
        </span>
        <button className="app-action pixel-shuffle" type="button" data-action="pixel" tabIndex={-1}>paint</button>
      </MiniApp>

      <MiniApp id="file" className="file-app" label="Tiny file stack" active={state.fileCount <= 6} onActivate={activate}>
        <span className="file-tab">files</span>
        <strong className="file-count">{state.fileCount}</strong>
        <button className="app-action file-add" type="button" data-action="file" tabIndex={-1}>sort</button>
      </MiniApp>

      <MiniApp id="slider" className="slider-app" label="Tiny control board" onActivate={activate} dataProps={{ "data-step": state.sliderStep }}>
        <span className="slider-row"><i /></span>
        <span className="slider-row"><i /></span>
        <span className="slider-row"><i /></span>
        <button className="app-action slider-mix" type="button" data-action="slider" tabIndex={-1}>mix</button>
      </MiniApp>

      <MiniApp id="coin" className={`coin-app${state.coinHeads ? " is-heads" : ""}`} label="Tiny budget coin" onActivate={activate}>
        <span className="coin-face">{state.coinHeads ? "MS" : "$"}</span>
        <button className="app-action coin-flip" type="button" data-action="coin" tabIndex={-1}>flip</button>
      </MiniApp>

      <MiniApp id="game" className="game-app" label="Tiny maze game" onActivate={activate} dataProps={{ "data-step": state.gameStep }}>
        <span className="game-board" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</span>
        <button className="app-action game-move" type="button" data-action="game" tabIndex={-1}>move</button>
      </MiniApp>
    </>
  );
}

function DesktopWindow({ index, className, title, children }) {
  const ref = useRef(null);
  useWindowDrag(ref, index);

  return (
    <article ref={ref} className={`desktop-window ${className}`} data-window>
      <div className="window-chrome" data-drag-handle>
        <span className="window-title">{title}</span>
      </div>
      {children}
    </article>
  );
}

function DetailsDesktop() {
  return (
    <section className="details-desktop" aria-label="Make Software events and contact">
      <DesktopWindow index={0} className="events-window" title="Events">
        <div className="window-body luma-window-body">
          <div className="window-hero-copy">
            <h2>Come make with us.</h2>
            <p>We are always looking for small, warm, hands-on software gatherings: demo nights, tiny workshops, prototype sessions, and strange tools made with friends.</p>
          </div>
          <div className="window-pill-row event-ribbon" aria-label="Event notes">
            <span className="window-pill">upcoming events</span>
            <span className="window-pill">bring a demo</span>
            <span className="window-pill">low pressure</span>
            <a className="window-action" href="https://luma.com/embed/calendar/cal-49APBOHEsAwegFJ/events">Open Luma</a>
          </div>
          <div className="event-frame-wrap">
            <iframe
              src="https://luma.com/embed/calendar/cal-49APBOHEsAwegFJ/events"
              title="Make Software events on Luma"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </DesktopWindow>

      <DesktopWindow index={1} className="contact-window" title="Contact">
        <div className="window-body contact-window-body">
          <div className="window-hero-copy">
            <h2>Email us a tiny signal.</h2>
            <p>If you want to collaborate, host us, mentor makers, bring ideas, or just join the next thing, send us a message. We are happy to hear half-formed thoughts.</p>
          </div>
          <div className="contact-stamp" aria-label="Email note">
            <span className="contact-seal" aria-hidden="true" />
            <span>
              <strong>Mailbox / Make Software</strong>
              <span>We read these and turn good sparks into small gatherings.</span>
            </span>
          </div>
          <div className="window-card-grid" aria-label="Ways to collaborate">
            <div className="window-soft-card" style={{ "--card-bg": "#fff36e", "--card-r": "-1.4deg" }}>
              <strong>Host us</strong>
              <span>Share a room, studio, office, cafe, or table for a small evening.</span>
            </div>
            <div className="window-soft-card" style={{ "--card-bg": "#bde6ff", "--card-r": "1.2deg" }}>
              <strong>Mentor</strong>
              <span>Help someone push a prototype from vague idea to working thing.</span>
            </div>
            <div className="window-soft-card" style={{ "--card-bg": "#ffb3c9", "--card-r": "-0.8deg" }}>
              <strong>Bring ideas</strong>
              <span>Suggest a workshop, demo theme, tiny challenge, or weird tool.</span>
            </div>
            <div className="window-soft-card" style={{ "--card-bg": "#9bea68", "--card-r": "1.5deg" }}>
              <strong>Join in</strong>
              <span>Show up with curiosity, unfinished code, or nothing but taste.</span>
            </div>
          </div>
          <div className="window-pill-row" aria-label="Contact links">
            <a className="window-action" href="mailto:riccardob36@gmail.com">Email us</a>
            <span className="window-pill" style={{ "--pill-bg": "#bde6ff" }}>Vienna / local internet</span>
          </div>
        </div>
      </DesktopWindow>

      <DesktopWindow index={2} className="letter-window" title="Manifesto">
        <div className="letter-window-body">
          <span className="letter-badge" aria-hidden="true">M</span>
          <div className="letter-copy">
            <span className="letter-kicker-app">Manifesto / Make Software</span>
            <h2>Computers are toys again.</h2>
            <p>Make Software is a community for people who want to create with computers the way others paint, write, or play music.</p>
            <p className="letter-note">Broken demos, ugly code, unfinished ideas, tiny tools, and strange scripts are welcome.</p>
          </div>
        </div>
      </DesktopWindow>

      <DesktopWindow index={3} className="values-window" title="Values">
        <div className="values-window-body">
          <h2>What we care about.</h2>
          <div className="values-square-grid" aria-label="Make Software values">
            <div className="value-square"><strong>AI with authorship</strong><span>Use AI fast, keep taste and intention.</span></div>
            <div className="value-square"><strong>Small software</strong><span>A tool for five friends can matter deeply.</span></div>
            <div className="value-square"><strong>Local internet</strong><span>Less feed, more peers and presence.</span></div>
            <div className="value-square"><strong>Finish tiny things</strong><span>Leave with something that exists.</span></div>
            <div className="value-square"><strong>Weird is good</strong><span>Poetic, funny, useless, awkward, alive.</span></div>
            <div className="value-square"><strong>No gatekeeping</strong><span>Beginners, experts, artists, tinkerers belong.</span></div>
          </div>
        </div>
      </DesktopWindow>
    </section>
  );
}

function useDebugApi(sceneRef, progress) {
  useEffect(() => {
    window.makeSoftwareScrollDebug = {
      sample() {
        const scene = sceneRef.current;
        return {
          y: Math.round(window.scrollY),
          width: window.innerWidth,
          height: document.documentElement.clientHeight || window.innerHeight,
          timeline: Number(progress.get().toFixed(4)),
          details: scene ? getComputedStyle(scene).getPropertyValue("--details-opacity").trim() : "",
          footer: getComputedStyle(document.documentElement).getPropertyValue("--footer-progress").trim(),
          bodyClasses: document.body.className
        };
      },
      async sweep({ steps = 120, maxRatio = 0.62, restore = true } = {}) {
        const initialY = window.scrollY;
        const maxScroll = Math.max(document.scrollingElement.scrollHeight - window.innerHeight, 1);
        const frames = [];
        let last = performance.now();
        for (let index = 0; index <= steps; index += 1) {
          window.scrollTo(0, maxScroll * maxRatio * (index / steps));
          await new Promise(requestAnimationFrame);
          const now = performance.now();
          frames.push(now - last);
          last = now;
        }
        if (restore) window.scrollTo(0, initialY);
        const sorted = [...frames].sort((a, b) => a - b);
        return {
          frames: frames.length,
          maxFrame: Number(Math.max(...frames).toFixed(2)),
          p95Frame: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
          slowOver25ms: frames.filter((frame) => frame > 25).length,
          sample: this.sample()
        };
      }
    };

    return () => {
      delete window.makeSoftwareScrollDebug;
    };
  }, [progress, sceneRef]);
}

export default function App() {
  const sceneRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const [appState, setAppState] = useState(initialState);
  const [bursts, setBursts] = useState([]);
  const clock = useClock(appState.clock24);
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end end"]
  });

  const sceneProgress = useTransform(scrollYProgress, (value) => smoothstep((value - 0.02) / 0.58));
  const wordmarkExit = useTransform(scrollYProgress, (value) => smoothstep((value - 0.02) / 0.58));
  const detailsProgress = useTransform(scrollYProgress, (value) => smoothstep((value - 0.24) / 0.36));
  const footerProgress = useTransform(scrollYProgress, (value) => smoothstep((value - 0.3) / 0.36));
  const stickerProgress = useTransform(scrollYProgress, (value) => smoothstep((value - 0.06) / 0.42));
  const stickerExitProgress = useTransform(stickerProgress, smoothstep);
  const itemOpacity = useTransform(sceneProgress, (value) => clamp(1 - value * 1.12));
  const itemScale = useTransform(sceneProgress, (value) => 1 - value * 0.18);
  const wordmarkOpacity = useTransform(wordmarkExit, (value) => clamp(1 - value * 1.15));
  const wordmarkScale = useTransform(wordmarkExit, (value) => 1 - value * 0.38);
  const wordmarkBlur = useTransform(wordmarkExit, (value) => `${(value * 8.5).toFixed(2)}px`);
  const stickersOpacity = useTransform(stickerProgress, (value) => clamp(1 - value * 1.08));

  const motionStyle = shouldReduceMotion
    ? {}
    : {
        "--scene-progress": sceneProgress,
        "--item-opacity": itemOpacity,
        "--item-scale": itemScale,
        "--wordmark-opacity": wordmarkOpacity,
        "--wordmark-scale": wordmarkScale,
        "--wordmark-depth": wordmarkExit,
        "--wordmark-blur": wordmarkBlur,
        "--details-opacity": detailsProgress
      };
  const stickerStyle = shouldReduceMotion
    ? {}
    : {
        "--stickers-opacity": stickersOpacity,
        "--stickers-progress": stickerExitProgress,
        "--stickers-depth": stickerExitProgress
      };
  const footerStyle = shouldReduceMotion ? {} : { "--footer-progress": footerProgress };

  useBodyScrollClasses(scrollYProgress);
  useScatter(sceneRef);
  usePointerParallax(sceneRef);
  useDebugApi(sceneRef, scrollYProgress);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  const activate = useCallback((id, burst) => {
    setBursts((current) => [...current, { id: `${Date.now()}-${Math.random()}`, ...burst }]);
    window.setTimeout(() => {
      setBursts((current) => current.slice(1));
    }, 760);

    setAppState((current) => {
      const next = { ...current };
      if (id === "stamp") next.stampActive = !current.stampActive;
      if (id === "palette") next.paletteIndex = current.paletteIndex + 1;
      if (id === "map") next.mapIndex = (current.mapIndex + 1) % 4;
      if (id === "terminal") next.terminalIndex = (current.terminalIndex + 1) % terminalCommands.length;
      if (id === "window") next.windowTab = current.windowTab === "css" ? "html" : "css";
      if (id === "chat") next.chatIndex = (current.chatIndex + 1) % chatMessages.length;
      if (id === "website") next.websiteTheme = (current.websiteTheme + 1) % 3;
      if (id === "clock") next.clock24 = !current.clock24;
      if (id === "mail") next.mailCount = current.mailCount > 0 ? current.mailCount - 1 : 5;
      if (id === "receipt") {
        next.receiptItems = current.receiptItems + 1;
        next.receiptTotal = current.receiptTotal + ((current.receiptItems + 1) % 3 === 0 ? 8 : 4);
      }
      if (id === "calendar") next.calendarIndex = (current.calendarIndex + 1) % calendarDates.length;
      if (id === "bubble") next.bubbleCount = current.bubbleCount > 0 ? current.bubbleCount - 1 : 3;
      if (id === "calculator") {
        const demoKeys = ["7", "+", "8", "="];
        const key = demoKeys[current.calcDemoIndex % demoKeys.length];
        next.calcDemoIndex = current.calcDemoIndex + 1;
        if (key === "C") next.calc = "";
        else if (key === "=") next.calc = String(current.calc.split("+").map((value) => Number(value || 0)).reduce((sum, value) => sum + value, 0));
        else if (key === "+") next.calc = current.calc && !current.calc.endsWith("+") ? `${current.calc}+` : current.calc;
        else next.calc = current.calc.length < 7 ? `${current.calc}${key}` : current.calc;
      }
      if (id === "todo") {
        const index = current.todoDone.findIndex((done) => !done);
        const nextDone = [...current.todoDone];
        nextDone[index === -1 ? 0 : index] = !nextDone[index === -1 ? 0 : index];
        next.todoDone = nextDone;
      }
      if (id === "weather") next.weatherIndex = (current.weatherIndex + 1) % weatherStates.length;
      if (id === "music") next.musicPlaying = !current.musicPlaying;
      if (id === "timer") next.timerProgress = current.timerProgress >= 95 ? 15 : current.timerProgress + 20;
      if (id === "photo") next.photoFlip = !current.photoFlip;
      if (id === "memo") next.memoIndex = (current.memoIndex + 1) % memoTexts.length;
      if (id === "voice") next.voiceRecording = !current.voiceRecording;
      if (id === "pixel") {
        next.pixelSeed = current.pixelSeed + 1;
        next.pixelActive = !current.pixelActive;
      }
      if (id === "file") next.fileCount = current.fileCount <= 3 ? 12 : current.fileCount - 3;
      if (id === "slider") next.sliderStep = (current.sliderStep + 1) % 3;
      if (id === "coin") next.coinHeads = !current.coinHeads;
      if (id === "game") next.gameStep = (current.gameStep + 1) % 4;
      return next;
    });
  }, []);

  return (
    <>
      <a className="scene-logo" href="/" aria-label="Make Software home">
        <img src="/assets/branding/tomo/logo.svg" alt="" width="1254" height="1254" />
      </a>
      <StickerBoard style={stickerStyle} />
      <BurstLayer bursts={bursts} />
      <motion.main ref={sceneRef} className="toy-page" style={motionStyle}>
        <CloudLayer />
        <section className="hero" aria-labelledby="page-title">
          <div className="collage">
            <MiniApps state={appState} activate={activate} clock={clock} />
          </div>
          <DetailsDesktop />
          <h1 className="sr-only" id="page-title">Make Software</h1>
        </section>
      </motion.main>
      <motion.footer className="floating-ambient-footer" aria-label="Made by Ambient, coming soon to Vienna" style={footerStyle}>
        <span className="footer-charms" aria-hidden="true"><i /><i /><i /></span>
        <span className="floating-ambient-mark" aria-hidden="true">
          <img src="/assets/branding/ambient-logo.svg" alt="" width="1254" height="1254" />
        </span>
        <span className="floating-footer-copy">
          <span className="floating-footer-kicker">local internet object</span>
          <strong>Made by Ambient</strong>
          <span>Make Software is a local software experiment: tiny workshops, prototype nights, and strange tools.</span>
        </span>
        <a className="floating-footer-soon" href="https://luma.com/embed/calendar/cal-49APBOHEsAwegFJ/events">Coming soon to Vienna</a>
      </motion.footer>
    </>
  );
}
