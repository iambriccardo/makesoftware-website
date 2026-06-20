import {
  AnimatePresence,
  motion
} from "motion/react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

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
  ["$ make tiny-tool", "saved /tiny/weird.html"],
  ["$ gather nearby", "room found"],
  ["$ ship strange", "unfinished demo welcome"],
  ["$ keep taste", "authorship saved"],
  ["$ help friend", "bug fixed together"]
];

const chatMessages = [
  "bring a half idea",
  "unfinished demos welcome",
  "tiny tools forever",
  "made near others",
  "taste beats hype"
];

const calendarDates = [
  { month: "Room", day: "1" },
  { month: "Demo", day: "2" },
  { month: "Soon", day: "3" },
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

const memoTexts = ["save the odd version", "invite one maker", "make it smaller", "help someone debug"];
const pixelColors = ["#fffdf5", "#fff36e", "#60d130", "#63a7ff", "#fb78a6", "#ff8a2a", "#2D250E"];
const communityValues = [
  {
    title: "Computers are fun again",
    text: "Make them feel magical, personal, and worth playing with.",
    bg: "#fff36e",
    rotate: "-1.4deg"
  },
  {
    title: "Make, don't perform",
    text: "The work matters more than the image of the work.",
    bg: "#bde6ff",
    rotate: "1.1deg"
  },
  {
    title: "AI with authorship",
    text: "Use AI to move faster, but keep your taste and intention.",
    bg: "#ffb3c9",
    rotate: "-0.9deg"
  },
  {
    title: "Small software is beautiful",
    text: "A tool for five friends can matter deeply.",
    bg: "#9bea68",
    rotate: "1.4deg"
  },
  {
    title: "Bring back the local internet",
    text: "Less feed, more room. Less audience, more peers.",
    bg: "#ffd0a1",
    rotate: "-1.1deg"
  },
  {
    title: "Finish tiny things",
    text: "Leave with something that exists, even if it is small.",
    bg: "#c9cfff",
    rotate: "0.8deg"
  },
  {
    title: "Weird is good",
    text: "Poetic, funny, useless, awkward, absurd ideas belong.",
    bg: "#fff36e",
    rotate: "1.2deg"
  },
  {
    title: "Taste over hype",
    text: "When execution is cheap, care and judgment matter more.",
    bg: "#bde6ff",
    rotate: "-1.5deg"
  },
  {
    title: "Learn by making near others",
    text: "Knowledge spreads when people debug side by side.",
    bg: "#ffb3c9",
    rotate: "0.9deg"
  },
  {
    title: "No gatekeeping",
    text: "Beginners, experts, artists, engineers, and tinkerers belong.",
    bg: "#9bea68",
    rotate: "-0.6deg"
  }
];
const audiencePills = ["beginners", "experts", "designers", "engineers", "artists", "tinkerers", "curious minds"];
const contactPrompts = [
  {
    title: "Host us",
    text: "Share a room, studio, office, cafe, or long table.",
    bg: "#fff36e",
    rotate: "-1.4deg"
  },
  {
    title: "Mentor",
    text: "Help someone move from vague spark to working thing.",
    bg: "#bde6ff",
    rotate: "1.2deg"
  },
  {
    title: "Bring ideas",
    text: "Suggest a tiny challenge, weird tool, or playful prompt.",
    bg: "#ffb3c9",
    rotate: "-0.8deg"
  },
  {
    title: "Join in",
    text: "Show up with curiosity, unfinished code, or taste.",
    bg: "#9bea68",
    rotate: "1.5deg"
  }
];
const footerCopy = {
  title: "Make Software",
  kicker: "a project by Ambient",
  description: "A playful software community in Vienna.",
  action: "Open Luma"
};
let activeDesktopWindowZ = 40;
const MiniAppStackContext = createContext({
  frontWidget: null,
  bringMiniAppToFront: () => {}
});

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
    return { count: 6, size: Math.round(clamp(width * 0.18, 64, 78)), marginX: 0.18, marginTop: 0.16, marginBottom: 0.22, avoidWidth: 0.5, avoidHeight: 0.44 };
  }
  if (width <= 640) {
    return { count: 7, size: Math.round(clamp(width * 0.15, 66, 86)), marginX: 0.16, marginTop: 0.14, marginBottom: 0.2, avoidWidth: 0.48, avoidHeight: 0.42 };
  }
  if (width <= 920) {
    return { count: 10, size: 82, marginX: 0.12, marginTop: 0.12, marginBottom: 0.16, avoidWidth: 0.44, avoidHeight: 0.38 };
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

function stickerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function stickerCenterPenalty(point, width, height, config) {
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const avoidWidth = width * config.avoidWidth;
  const avoidHeight = height * config.avoidHeight;
  const normalizedX = Math.abs(point.x - centerX) / Math.max(avoidWidth, 1);
  const normalizedY = Math.abs(point.y - centerY) / Math.max(avoidHeight, 1);
  return clamp(1 - Math.max(normalizedX, normalizedY), 0, 1);
}

function stickerOverlapsExclusion(point, size, exclusionZones) {
  const inset = size * 0.56;
  return exclusionZones.some((zone) => (
    point.x > zone.left - inset
    && point.x < zone.right + inset
    && point.y > zone.top - inset
    && point.y < zone.bottom + inset
  ));
}

function fallbackStickerPoint(index, total, seed, width, height, size, exclusionZones) {
  const config = stickerViewportConfig(width);
  const safeLeft = clamp(width * config.marginX, size * 0.72, 160);
  const safeRight = clamp(width * config.marginX, size * 0.72, 160);
  const safeTop = clamp(height * config.marginTop, size * 0.78, 140);
  const safeBottom = clamp(height * config.marginBottom, size * 0.9, 180);
  const columns = 9;
  const rows = 7;
  const step = spreadStep(columns * rows);
  const offset = Math.floor(seededNoise(seed + index * 4.71) * columns * rows);

  for (let attempt = 0; attempt < columns * rows * 2; attempt += 1) {
    const cell = (offset + (index + attempt) * step) % (columns * rows);
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    const xNoise = seededNoise(seed + index * 10.9 + attempt * 3.13);
    const yNoise = seededNoise(seed + index * 12.7 + attempt * 4.91);
    const x = safeLeft + ((column + 0.25 + xNoise * 0.5) / columns) * Math.max(width - safeLeft - safeRight, 1);
    const y = safeTop + ((row + 0.25 + yNoise * 0.5) / rows) * Math.max(height - safeTop - safeBottom, 1);
    const point = clampStickerPoint(x, y, size);
    if (!stickerOverlapsExclusion(point, size, exclusionZones)) return point;
  }

  const edgePoints = [
    { x: safeLeft, y: safeTop },
    { x: width - safeRight, y: safeTop },
    { x: safeLeft, y: height - safeBottom },
    { x: width - safeRight, y: height - safeBottom },
    { x: width * 0.5, y: safeTop },
    { x: width * 0.5, y: height - safeBottom }
  ];
  return edgePoints.find((point) => !stickerOverlapsExclusion(point, size, exclusionZones))
    || clampStickerPoint(width * 0.5, safeTop, size);
}

function generateStickerCandidates(index, total, seed, width, height, size, config) {
  const safeLeft = clamp(width * config.marginX, size * 0.72, 160);
  const safeRight = clamp(width * config.marginX, size * 0.72, 160);
  const safeTop = clamp(height * config.marginTop, size * 0.78, 140);
  const safeBottom = clamp(height * config.marginBottom, size * 0.9, 180);
  const usableWidth = Math.max(width - safeLeft - safeRight, 1);
  const usableHeight = Math.max(height - safeTop - safeBottom, 1);
  const aspect = usableWidth / Math.max(usableHeight, 1);
  const columns = Math.max(2, Math.ceil(Math.sqrt(total * aspect)));
  const rows = Math.max(2, Math.ceil(total / columns));
  const cellCount = columns * rows;
  const step = spreadStep(cellCount);
  const cellOffset = Math.floor(seededNoise(seed + total * 1.91) * cellCount);
  const baseCell = (index * step + cellOffset) % cellCount;
  const candidates = [];
  const push = (x, y, rankBias = 0) => {
    const point = clampStickerPoint(x, y, size);
    candidates.push({ ...point, rankBias });
  };

  for (let attempt = 0; attempt < Math.max(cellCount, total * 3); attempt += 1) {
    const cell = (baseCell + attempt * step) % cellCount;
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    const cellWidth = usableWidth / columns;
    const cellHeight = usableHeight / rows;
    const wave = seed + index * 29.7 + attempt * 8.13;
    const jitterX = (seededNoise(wave) - 0.5) * Math.min(cellWidth * 0.58, size * 0.88);
    const jitterY = (seededNoise(wave + 3.77) - 0.5) * Math.min(cellHeight * 0.58, size * 0.88);
    push(
      safeLeft + (column + 0.5) * cellWidth + jitterX,
      safeTop + (row + 0.5) * cellHeight + jitterY,
      attempt * 0.04
    );
  }

  const randomCount = Math.max(24, total * 7);
  for (let attempt = 0; attempt < randomCount; attempt += 1) {
    const wave = seed + index * 17.31 + attempt * 11.17;
    const xNoise = seededNoise(wave + 5.3);
    const yNoise = seededNoise(wave + 7.9);
    const x = safeLeft + usableWidth * xNoise;
    const y = safeTop + usableHeight * yNoise;
    push(x, y, 0.16 + attempt * 0.014);
  }

  return candidates;
}

function placeStickerPoints(total, seed, width, height, size, exclusionZones = []) {
  const config = stickerViewportConfig(width);
  const placed = [];
  const minGap = Math.max(size * 0.42, 30);
  const minDistance = size + minGap;

  for (let index = 0; index < total; index += 1) {
    const candidates = generateStickerCandidates(index, total, seed, width, height, size, config);
    let best = null;

    for (const candidate of candidates) {
      if (stickerOverlapsExclusion(candidate, size, exclusionZones)) continue;
      const nearest = placed.length
        ? Math.min(...placed.map((point) => stickerDistance(candidate, point)))
        : minDistance * 1.8;
      const overlapPenalty = nearest < minDistance ? (minDistance - nearest) * 95 : 0;
      const centerPenalty = stickerCenterPenalty(candidate, width, height, config) * size * 0.58;
      const edgeDistance = Math.min(candidate.x, width - candidate.x, candidate.y, height - candidate.y);
      const edgePenalty = Math.max(0, size * 0.62 - edgeDistance) * 6;
      const spacingReward = Math.min(nearest, minDistance * 1.8);
      const organicNoise = (seededNoise(seed + index * 23.13 + candidate.x * 0.017 + candidate.y * 0.019) - 0.5) * size * 0.34;
      const score = spacingReward + organicNoise - overlapPenalty - centerPenalty - edgePenalty - candidate.rankBias;

      if (!best || score > best.score) best = { ...candidate, score };
    }

    const point = best ? { x: best.x, y: best.y } : fallbackStickerPoint(index, total, seed, width, height, size, exclusionZones);
    placed.push(point);
  }

  return placed;
}

function getStickerPageHeight() {
  return Math.max(
    window.innerHeight,
    document.documentElement.scrollHeight,
    document.body?.scrollHeight || 0
  );
}

function getStickerViewportMetrics() {
  const width = Math.max(320, Math.round(document.documentElement.clientWidth || window.innerWidth));
  const height = Math.max(480, Math.round(document.documentElement.clientHeight || window.innerHeight));
  const config = stickerViewportConfig(width);
  return {
    width,
    height,
    count: Math.min(stickerAssets.length, config.count),
    size: config.size,
    pageHeight: getStickerPageHeight()
  };
}

function getVisibleViewportBounds() {
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop || 0;
  const height = viewport?.height || window.innerHeight;
  return {
    top,
    bottom: top + height,
    height
  };
}

function clampStickerPoint(x, y, size, bounds = {}) {
  const gutter = Math.max(12, size * 0.45);
  const maxY = Math.max(window.innerHeight, bounds.height || getStickerPageHeight());
  const width = Math.max(320, document.documentElement.clientWidth || window.innerWidth);
  return {
    x: clamp(x, gutter, width - gutter),
    y: clamp(y, gutter, maxY - gutter)
  };
}

function getStickerExclusionZones(width, height, size) {
  const wordmark = document.querySelector(".scene-wordmark");
  const padding = Math.max(10, size * 0.12);

  if (wordmark) {
    const rect = wordmark.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return [{
        left: clamp(rect.left - padding, 0, width),
        top: clamp(rect.top - padding, 0, height),
        right: clamp(rect.right + padding, 0, width),
        bottom: clamp(rect.bottom + padding, 0, height)
      }];
    }
  }

  const fallbackWidth = width <= 640 ? Math.min(width * 0.9, 360) : Math.min(width * 0.78, 1040);
  const fallbackHeight = width <= 640 ? Math.min(height * 0.38, 250) : Math.min(height * 0.42, 360);
  return [{
    left: (width - fallbackWidth) * 0.5,
    top: (height - fallbackHeight) * 0.5,
    right: (width + fallbackWidth) * 0.5,
    bottom: (height + fallbackHeight) * 0.5
  }];
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

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let dragScale = 1;
    let lastClientX = 0;
    let lastClientY = 0;
    let autoScrollFrame = 0;
    let autoScrollY = 0;
    let resetTimer = 0;
    const mobileWindowQuery = window.matchMedia("(max-width: 640px), (hover: none) and (pointer: coarse)");

    windowEl.style.zIndex = String(20 + index);

    const bringToFront = () => {
      activeDesktopWindowZ += 1;
      windowEl.parentElement?.querySelectorAll("[data-window]").forEach((item) => {
        if (item !== windowEl) item.classList.remove("is-front");
      });
      windowEl.classList.add("is-front");
      windowEl.style.zIndex = String(activeDesktopWindowZ);
    };

    const readRenderedDrag = () => {
      const styles = window.getComputedStyle(windowEl);
      const x = Number.parseFloat(styles.getPropertyValue("--window-drag-x"));
      const y = Number.parseFloat(styles.getPropertyValue("--window-drag-y"));
      return {
        x: Number.isFinite(x) ? x : Number(windowEl.dataset.dragX || 0),
        y: Number.isFinite(y) ? y : Number(windowEl.dataset.dragY || 0)
      };
    };

    const updateDragFromClient = (clientX, clientY) => {
      if (pointerId === null) return;
      const nextX = originX + (clientX - startX) / dragScale;
      const nextY = originY + (clientY + window.scrollY - startY) / dragScale;
      windowEl.dataset.dragX = String(nextX);
      windowEl.dataset.dragY = String(nextY);
      windowEl.style.setProperty("--window-drag-x", `${nextX}px`);
      windowEl.style.setProperty("--window-drag-y", `${nextY}px`);
    };

    const stopAutoScroll = () => {
      if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = 0;
      autoScrollY = 0;
    };

    const updateAutoScroll = (clientY) => {
      const visible = getVisibleViewportBounds();
      const edge = Math.min(110, visible.height * 0.18);
      const topDistance = clientY - visible.top;
      const bottomDistance = visible.bottom - clientY;
      const topPressure = topDistance < edge ? clamp((edge - topDistance) / edge, 0, 1.25) : 0;
      const bottomPressure = bottomDistance < edge ? clamp((edge - bottomDistance) / edge, 0, 1.25) : 0;
      autoScrollY = (bottomPressure - topPressure) * 18;

      if (Math.abs(autoScrollY) < 0.5) {
        stopAutoScroll();
        return;
      }

      if (autoScrollFrame) return;
      const tick = () => {
        if (pointerId === null || Math.abs(autoScrollY) < 0.5) {
          autoScrollFrame = 0;
          return;
        }
        const before = window.scrollY;
        window.scrollBy({ top: autoScrollY, left: 0, behavior: "auto" });
        if (window.scrollY !== before) updateDragFromClient(lastClientX, lastClientY);
        autoScrollFrame = requestAnimationFrame(tick);
      };
      autoScrollFrame = requestAnimationFrame(tick);
    };

    const moveDrag = (event) => {
      if (pointerId !== event.pointerId) return;
      event.preventDefault();
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      updateDragFromClient(event.clientX, event.clientY);
      updateAutoScroll(event.clientY);
    };
    const endDrag = (event) => {
      if (pointerId !== event.pointerId) return;
      const activePointerId = pointerId;
      window.removeEventListener("pointermove", moveDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      if (typeof handle.hasPointerCapture === "function" && handle.hasPointerCapture(activePointerId)) {
        handle.releasePointerCapture(activePointerId);
      }
      pointerId = null;
      dragScale = 1;
      stopAutoScroll();
      windowEl.classList.remove("is-dragging");
    };
    const startDrag = (event) => {
      if (event.button !== 0 || event.detail > 1 || mobileWindowQuery.matches || event.pointerType === "touch") return;
      event.preventDefault();
      const rendered = readRenderedDrag();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY + window.scrollY;
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      originX = rendered.x;
      originY = rendered.y;
      windowEl.dataset.dragX = String(originX);
      windowEl.dataset.dragY = String(originY);
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
      stopAutoScroll();
      windowEl.dataset.dragX = "0";
      windowEl.dataset.dragY = "0";
      windowEl.style.setProperty("--window-drag-x", "0px");
      windowEl.style.setProperty("--window-drag-y", "0px");
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => windowEl.classList.remove("is-resetting"), 520);
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
      window.clearTimeout(resetTimer);
      stopAutoScroll();
    };
  }, [ref, index]);
}

function Sticker({ sticker, index }) {
  const ref = useRef(null);
  const state = useRef({
    pointerId: null,
    isDragging: false,
    moved: false,
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
    releaseVelocityY: 0,
    lastClientX: 0,
    lastClientY: 0,
    autoScrollFrame: 0,
    autoScrollY: 0
  });

  const cancelStickerAnimations = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element
      .getAnimations?.({ subtree: true })
      .filter((animation) => animation.id === "sticker-attach")
      .forEach((animation) => animation.cancel());
  }, []);

  const clearStickerMotion = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    cancelStickerAnimations();
    element.classList.remove("is-lifted", "is-dragging");
    element.style.setProperty("--sticker-lift", "0");
    element.style.setProperty("--sticker-press-x", "0px");
    element.style.setProperty("--sticker-press-y", "0px");
    element.style.setProperty("--sticker-press-rotate", "0deg");
    element.style.setProperty("--sticker-press-scale-x", "1");
    element.style.setProperty("--sticker-press-scale-y", "1");
  }, [cancelStickerAnimations]);

  const readRenderedPosition = useCallback(() => {
    const element = ref.current;
    if (!element) return { x: state.current.currentX, y: state.current.currentY };
    const styles = window.getComputedStyle(element);
    const x = Number.parseFloat(styles.getPropertyValue("--sticker-x"));
    const y = Number.parseFloat(styles.getPropertyValue("--sticker-y"));
    return {
      x: Number.isFinite(x) ? x : state.current.currentX,
      y: Number.isFinite(y) ? y : state.current.currentY
    };
  }, []);

  const updatePosition = useCallback((x, y) => {
    const element = ref.current;
    if (!element) return;
    state.current.currentX = x;
    state.current.currentY = y;
    element.style.setProperty("--sticker-x", `${x}px`);
    element.style.setProperty("--sticker-y", `${y}px`);
  }, []);

  useLayoutEffect(() => {
    const current = state.current;
    if (current.pointerId !== null) return;
    current.originX = sticker.x;
    current.originY = sticker.y;
    current.currentX = sticker.x;
    current.currentY = sticker.y;
    current.lastMoveX = sticker.x;
    current.lastMoveY = sticker.y;
    updatePosition(sticker.x, sticker.y);
  }, [sticker.x, sticker.y, updatePosition]);

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
    if (!element) return;

    cancelStickerAnimations();
    element.style.setProperty("--sticker-lift", "1");
    element.style.setProperty("--sticker-press-x", "0px");
    element.style.setProperty("--sticker-press-y", "0px");
    element.style.setProperty("--sticker-press-rotate", "0deg");
    element.style.setProperty("--sticker-press-scale-x", "1");
    element.style.setProperty("--sticker-press-scale-y", "1");
    element.classList.remove("is-lifted", "is-dragging");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof element.animate !== "function") {
      element.style.setProperty("--sticker-lift", "0");
      return;
    }

    const direction = Math.sign(state.current.releaseVelocityX || seededNoise(index + 19.4) - 0.5 || 1);
    const velocity = Math.min(Math.hypot(state.current.releaseVelocityX, state.current.releaseVelocityY), 18);
    const twist = clamp(state.current.releaseVelocityX * 0.08, -2.4, 2.4) || direction * 0.8;
    const settleY = clamp(1 + velocity * 0.06, 1, 2.2);

    const animation = element.animate(
      [
        {
          offset: 0,
          "--sticker-lift": "1",
          "--sticker-press-x": "0px",
          "--sticker-press-y": "-1px",
          "--sticker-press-rotate": `${(twist * -0.45).toFixed(2)}deg`,
          "--sticker-press-scale-x": "1.018",
          "--sticker-press-scale-y": "0.992",
          easing: "cubic-bezier(.16,.84,.18,1)"
        },
        {
          offset: 0.34,
          "--sticker-lift": "0.35",
          "--sticker-press-x": `${(direction * 0.7).toFixed(2)}px`,
          "--sticker-press-y": `${settleY.toFixed(2)}px`,
          "--sticker-press-rotate": `${twist.toFixed(2)}deg`,
          "--sticker-press-scale-x": "1.035",
          "--sticker-press-scale-y": "0.948",
          easing: "cubic-bezier(.22,.72,.18,1)"
        },
        {
          offset: 0.62,
          "--sticker-lift": "0.08",
          "--sticker-press-x": `${(direction * -0.28).toFixed(2)}px`,
          "--sticker-press-y": "-0.7px",
          "--sticker-press-rotate": `${(twist * -0.24).toFixed(2)}deg`,
          "--sticker-press-scale-x": "0.992",
          "--sticker-press-scale-y": "1.014",
          easing: "cubic-bezier(.18,.7,.18,1)"
        },
        {
          offset: 1,
          "--sticker-lift": "0",
          "--sticker-press-x": "0px",
          "--sticker-press-y": "0px",
          "--sticker-press-rotate": "0deg",
          "--sticker-press-scale-x": "1",
          "--sticker-press-scale-y": "1"
        }
      ],
      { duration: 360, easing: "linear" }
    );
    animation.id = "sticker-attach";
    animation.onfinish = () => {
      element.style.setProperty("--sticker-lift", "0");
      element.style.setProperty("--sticker-press-x", "0px");
      element.style.setProperty("--sticker-press-y", "0px");
      element.style.setProperty("--sticker-press-rotate", "0deg");
      element.style.setProperty("--sticker-press-scale-x", "1");
      element.style.setProperty("--sticker-press-scale-y", "1");
      animation.cancel();
    };
  };

  const updateDragFromClient = useCallback((clientX, clientY) => {
    const current = state.current;
    if (current.pointerId === null) return;
    const deltaX = clientX - current.startX;
    const deltaY = clientY + window.scrollY - current.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (!current.isDragging && distance < 6) return;
    if (!current.isDragging) {
      current.isDragging = true;
      current.moved = true;
      clearStickerMotion();
      ref.current?.style.setProperty("--sticker-lift", "1");
      ref.current?.classList.add("is-lifted", "is-dragging");
    }
    const next = clampStickerPoint(
      current.originX + deltaX,
      current.originY + deltaY,
      sticker.size
    );
    const now = performance.now();
    const elapsed = Math.max(now - current.lastMoveTime, 16);
    current.releaseVelocityX = ((next.x - current.lastMoveX) / elapsed) * 16.67;
    current.releaseVelocityY = ((next.y - current.lastMoveY) / elapsed) * 16.67;
    current.lastMoveX = next.x;
    current.lastMoveY = next.y;
    current.lastMoveTime = now;
    updatePosition(next.x, next.y);
  }, [sticker.size, updatePosition]);

  const stopAutoScroll = useCallback(() => {
    const current = state.current;
    if (current.autoScrollFrame) cancelAnimationFrame(current.autoScrollFrame);
    current.autoScrollFrame = 0;
    current.autoScrollY = 0;
  }, []);

  const updateAutoScroll = useCallback((clientY) => {
    const current = state.current;
    const visible = getVisibleViewportBounds();
    const edge = Math.min(110, visible.height * 0.18);
    const topDistance = clientY - visible.top;
    const bottomDistance = visible.bottom - clientY;
    const topPressure = topDistance < edge ? clamp((edge - topDistance) / edge, 0, 1.25) : 0;
    const bottomPressure = bottomDistance < edge ? clamp((edge - bottomDistance) / edge, 0, 1.25) : 0;
    current.autoScrollY = (bottomPressure - topPressure) * 18;

    if (Math.abs(current.autoScrollY) < 0.5) {
      stopAutoScroll();
      return;
    }

    if (current.autoScrollFrame) return;
    const tick = () => {
      const active = state.current;
      if (active.pointerId === null || Math.abs(active.autoScrollY) < 0.5) {
        active.autoScrollFrame = 0;
        return;
      }
      const before = window.scrollY;
      window.scrollBy({ top: active.autoScrollY, left: 0, behavior: "auto" });
      if (window.scrollY !== before) updateDragFromClient(active.lastClientX, active.lastClientY);
      active.autoScrollFrame = requestAnimationFrame(tick);
    };
    current.autoScrollFrame = requestAnimationFrame(tick);
  }, [stopAutoScroll, updateDragFromClient]);

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  const onPointerDown = (event) => {
    if (event.button && event.button !== 0) return;
    event.preventDefault();
    const current = state.current;
    const rendered = readRenderedPosition();
    current.pointerId = event.pointerId;
    current.startX = event.clientX;
    current.startY = event.clientY + window.scrollY;
    current.lastClientX = event.clientX;
    current.lastClientY = event.clientY;
    current.originX = rendered.x;
    current.originY = rendered.y;
    current.currentX = rendered.x;
    current.currentY = rendered.y;
    current.lastMoveX = rendered.x;
    current.lastMoveY = rendered.y;
    current.lastMoveTime = performance.now();
    current.releaseVelocityX = 0;
    current.releaseVelocityY = 0;
    current.isDragging = false;
    current.moved = false;
    clearStickerMotion();
    bringToFront();
    ref.current?.style.setProperty("--sticker-lift", "0.7");
    ref.current?.classList.add("is-lifted");
    ref.current?.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    const current = state.current;
    if (current.pointerId !== event.pointerId) return;
    current.lastClientX = event.clientX;
    current.lastClientY = event.clientY;
    updateDragFromClient(event.clientX, event.clientY);
    updateAutoScroll(event.clientY);
  };
  const endDrag = (event) => {
    const current = state.current;
    if (current.pointerId !== event.pointerId) return;
    ref.current?.releasePointerCapture(current.pointerId);
    current.pointerId = null;
    stopAutoScroll();
    ref.current?.classList.remove("is-lifted", "is-dragging");
    if (current.moved) attachSticker();
    else ref.current?.style.setProperty("--sticker-lift", "0");
    current.isDragging = false;
    current.moved = false;
  };

  return (
    <motion.button
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.96 }}
      transition={{ delay: 0.22 + index * 0.035, duration: 0.78, ease: [0.18, 0.86, 0.2, 1] }}
    >
      <img src={sticker.src} alt="" width="1254" height="1254" draggable="false" />
    </motion.button>
  );
}

function StickerBoard({ style }) {
  const seed = useMemo(() => Math.random() * 10000, []);
  const [stickers, setStickers] = useState([]);
  const [boardHeight, setBoardHeight] = useState(0);
  const layoutRef = useRef(null);

  useLayoutEffect(() => {
    let frame = 0;

    const build = ({ force = false } = {}) => {
      const metrics = getStickerViewportMetrics();
      setBoardHeight(metrics.pageHeight);

      const previous = layoutRef.current;
      const widthChanged = !previous || Math.abs(metrics.width - previous.width) >= 18;
      const layoutChanged = widthChanged || !previous || metrics.count !== previous.count || metrics.size !== previous.size;
      if (!force && !layoutChanged) return;

      layoutRef.current = {
        width: metrics.width,
        count: metrics.count,
        size: metrics.size
      };

      const width = metrics.width;
      const height = metrics.height;
      const visibleAssets = selectStickerAssetsForViewport(stickerAssets, seed, width);
      const size = metrics.size;
      const exclusionZones = getStickerExclusionZones(width, height, size);
      const points = placeStickerPoints(visibleAssets.length, seed, width, height, size, exclusionZones);
      setStickers(
        visibleAssets.map((src, index) => {
          const point = points[index];
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
    const scheduleBuild = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        build();
      });
    };

    build({ force: true });
    window.addEventListener("resize", scheduleBuild, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleBuild, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleBuild);
      window.visualViewport?.removeEventListener("resize", scheduleBuild);
    };
  }, [seed]);

  return (
    <motion.div
      className="sticker-board"
      data-sticker-board
      aria-label="Draggable sticker layer"
      style={{ ...style, "--sticker-board-height": boardHeight ? `${boardHeight}px` : "100svh" }}
    >
      {stickers.map((sticker, index) => (
        <Sticker key={sticker.id} sticker={sticker} index={index} />
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
          animate={{ opacity: 0, scale: 2.35, rotate: 18 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.62, ease: [0.18, 0.86, 0.2, 1] }}
        />
      ))}
    </AnimatePresence>
  );
}

function MiniApp({ id, className, label, children, onActivate, active, dataProps = {}, style = {} }) {
  const { frontWidget, bringMiniAppToFront } = useContext(MiniAppStackContext);
  const [tapped, setTapped] = useState(false);
  const tapTimerRef = useRef(0);
  const front = frontWidget === id;

  useEffect(() => () => window.clearTimeout(tapTimerRef.current), []);

  const activate = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    bringMiniAppToFront(id);
    setTapped(true);
    window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => setTapped(false), 260);
    onActivate(id, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      size: Math.max(rect.width, rect.height) * 0.74
    });
  };

  return (
    <article
      className={`artifact mini-app ${className}${active ? " is-active" : ""}${front ? " is-front" : ""}${tapped ? " is-tapped" : ""}`}
      data-widget={id}
      data-depth={dataProps["data-depth"]}
      tabIndex={0}
      aria-label={label}
      style={{ ...style, "--app-pulse": tapped ? 1 : 0 }}
      {...dataProps}
      onClick={activate}
      onFocus={() => bringMiniAppToFront(id)}
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

function ClockMiniApp({ clock24, activate }) {
  const clock = useClock(clock24);

  return (
    <MiniApp id="clock" className="clock-app" label="Live gathering clock" onActivate={activate} style={{ "--clock-hour": clock.hour, "--clock-minute": clock.minute }}>
      <span className="clock-face" aria-hidden="true" />
      <time className="clock-time">{clock.text}</time>
      <button className="app-action clock-toggle" type="button" data-action="clock" tabIndex={-1}>{clock24 ? "24h" : "12h"}</button>
    </MiniApp>
  );
}

function MiniApps({ state, activate }) {
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
        <span className="wordmark-line wordmark-make" data-text="Make">Make</span>
        <span className="wordmark-line wordmark-software" data-text="Software">Software</span>
      </div>

      <MiniApp id="stamp" className="stamp-app" label="Tiny tool stamp" active={state.stampActive} onActivate={activate}>
        <span className="stamp-label">{state.stampActive ? <>tiny<br />tool<br />finished</> : <>made<br />near<br />others</>}</span>
        <button className="app-action stamp-hit" type="button" data-action="stamp" tabIndex={-1}>stamp</button>
      </MiniApp>

      <MiniApp
        id="palette"
        className="palette-app"
        label="Playful theme mixer"
        onActivate={activate}
        style={{ "--swatch-a": palette[0], "--swatch-b": palette[1], "--swatch-c": palette[2] }}
      >
        <span className="theme-title">theme</span>
        <button className="palette-swatch palette-swatch-a" type="button" data-action="palette" data-palette="0" aria-label="Use warm theme" tabIndex={-1}><span /></button>
        <button className="palette-swatch palette-swatch-b" type="button" data-action="palette" data-palette="1" aria-label="Use punch theme" tabIndex={-1}><span /></button>
        <button className="palette-swatch palette-swatch-c" type="button" data-action="palette" data-palette="2" aria-label="Use sky theme" tabIndex={-1}><span /></button>
      </MiniApp>

      <MiniApp id="map" className="map-app" label="Gathering map" onActivate={activate} style={{ "--pin-x": mapPin[0], "--pin-y": mapPin[1] }}>
        <button className="app-action" type="button" data-action="map" tabIndex={-1}>route</button>
      </MiniApp>

      <MiniApp id="terminal" className="terminal-app" label="Playful terminal" onActivate={activate}>
        <span className="terminal-line">{terminal[0]} {state.terminalIndex ? terminal[1] : ""} <span className="cursor" /></span>
        <button className="app-action terminal-run" type="button" data-action="terminal" tabIndex={-1}>run</button>
      </MiniApp>

      <MiniApp id="window" className="window-card" label="Small code editor" onActivate={activate} dataProps={{ "data-tab": state.windowTab }}>
        <div className="window-tabs" aria-label="Editor tabs">
          <button type="button" data-action="window" data-tab="html" tabIndex={-1}>html</button>
          <button type="button" data-action="window" data-tab="css" tabIndex={-1}>css</button>
        </div>
        <span className="code-line code-line-a" style={{ width: state.windowTab === "css" ? "58%" : "78%" }} />
        <span className="code-line code-line-b" style={{ width: state.windowTab === "css" ? "74%" : "46%" }} />
        <span className="preview-dot" />
      </MiniApp>

      <MiniApp id="chat" className="chat-app" label="Weird idea message" onActivate={activate}>
        <span className="chat-message">{chatMessages[state.chatIndex]}</span>
        <button className="app-action chat-send" type="button" data-action="chat" tabIndex={-1}>reply</button>
      </MiniApp>

      <MiniApp id="website" className="website-app" label="Small website sketch" onActivate={activate} dataProps={{ "data-theme": state.websiteTheme }}>
        <span className="site-hero" />
        <span className="site-lines" />
        <div className="site-tools">
          <button type="button" data-action="website" data-theme="0" aria-label="Blue layout" tabIndex={-1} />
          <button type="button" data-action="website" data-theme="1" aria-label="Pink layout" tabIndex={-1} />
          <button type="button" data-action="website" data-theme="2" aria-label="Green layout" tabIndex={-1} />
        </div>
      </MiniApp>

      <ClockMiniApp clock24={state.clock24} activate={activate} />

      <MiniApp id="mail" className="mail-app" label="Local room inbox" active={state.mailCount === 0} onActivate={activate}>
        <strong>{state.mailCount}</strong>
        <button className="app-action" type="button" data-action="mail" tabIndex={-1}>read</button>
      </MiniApp>

      <MiniApp id="receipt" className="receipt" label="Values receipt" onActivate={activate}>
        <strong className="receipt-total">{state.receiptTotal}</strong>
        <span className="receipt-line">{state.receiptItems === 2 ? <>tiny tools<br />paid in taste</> : <>{state.receiptItems} small sparks<br />paid in care</>}</span>
        <button className="app-action receipt-add" type="button" data-action="receipt" tabIndex={-1}>add</button>
      </MiniApp>

      <MiniApp id="calendar" className="calendar" label="Gathering calendar" onActivate={activate} dataProps={{ "data-day": calendarDates[state.calendarIndex].day }}>
        <span className="calendar-month">{calendarDates[state.calendarIndex].month}</span>
        <button type="button" data-action="calendar" aria-label="Next calendar day" tabIndex={-1} />
      </MiniApp>

      <MiniApp id="bubble" className={`chat-badge${state.bubbleCount === 0 ? " is-empty" : ""}`} label="Peer note bubble" onActivate={activate}>
        <span className="bubble-count">{state.bubbleCount}</span>
        <button type="button" data-action="bubble" aria-label="Clear notification" tabIndex={-1} />
      </MiniApp>

      <MiniApp id="calculator" className="calculator-app" label="Smallness calculator" onActivate={activate}>
        <output className="calc-screen">{state.calc || "0"}</output>
        <span className="calc-grid">
          {["7", "8", "+", "4", "5", "=", "C", "1", "2"].map((key) => (
            <button key={key} type="button" data-action="calc" data-key={key} tabIndex={-1}>{key}</button>
          ))}
        </span>
      </MiniApp>

      <MiniApp id="todo" className="todo-app" label="Prototype checklist" active={doneRatio > 0} onActivate={activate} style={{ "--done-ratio": String(doneRatio) }}>
        {["draw idea", "keep taste", "finish small", "tell friend"].map((label, index) => (
          <label key={label}><input type="checkbox" data-action="todo" checked={state.todoDone[index]} readOnly tabIndex={-1} />{label}</label>
        ))}
      </MiniApp>

      <MiniApp id="weather" className="weather-app" label="Room weather card" onActivate={activate} style={{ "--weather-a": weather.a, "--weather-b": weather.b, "--weather-sun": weather.sun }}>
        <span className="weather-temp">{weather.temp}</span>
        <button className="app-action weather-next" type="button" data-action="weather" tabIndex={-1}>next</button>
      </MiniApp>

      <MiniApp id="music" className={`music-app${state.musicPlaying ? " is-playing" : ""}`} label="Playful music player" onActivate={activate}>
        <span className="music-bars" aria-hidden="true"><i /><i /><i /><i /></span>
        <button className="music-toggle" type="button" data-action="music" aria-label="Play tiny music" tabIndex={-1}>{state.musicPlaying ? "pause" : "play"}</button>
      </MiniApp>

      <MiniApp id="timer" className="timer-app" label="Tiny finish timer" onActivate={activate} style={{ "--timer-progress": String(state.timerProgress) }}>
        <span className="timer-label">{Math.max(1, Math.round((100 - state.timerProgress) / 6))}</span>
        <button type="button" data-action="timer" tabIndex={-1}>timer</button>
      </MiniApp>

      <MiniApp id="photo" className="photo-app" label="Demo photo stack" active={state.photoFlip} onActivate={activate}>
        <span style={{ rotate: state.photoFlip ? "12deg" : "-10deg" }} />
        <span style={{ rotate: state.photoFlip ? "-12deg" : "8deg" }} />
        <button className="app-action" type="button" data-action="photo" tabIndex={-1}>flip</button>
      </MiniApp>

      <MiniApp id="memo" className="memo-app" label="Taste memo" onActivate={activate}>
        <span className="memo-text">{memoTexts[state.memoIndex]}</span>
        <button className="app-action" type="button" data-action="memo" tabIndex={-1}>new</button>
      </MiniApp>

      <MiniApp id="voice" className={`voice-app${state.voiceRecording ? " is-recording" : ""}`} label="Room voice recorder" onActivate={activate}>
        <span className="voice-title">room</span>
        <span className="voice-status">{state.voiceRecording ? "recording" : "ready"}</span>
        <span className="voice-bars"><i /><i /><i /><i /><i /></span>
        <button className="app-action voice-toggle" type="button" data-action="voice" tabIndex={-1}>{state.voiceRecording ? "stop" : "rec"}</button>
      </MiniApp>

      <MiniApp id="pixel" className="pixel-app" label="Small pixel painter" active={state.pixelActive} onActivate={activate}>
        <span className="pixel-grid" aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => (
            <i key={index} style={{ background: pixelColors[(index + state.pixelSeed * 3) % pixelColors.length], scale: (index + state.pixelSeed) % 4 === 0 ? "0.72" : "1" }} />
          ))}
        </span>
        <button className="app-action pixel-shuffle" type="button" data-action="pixel" tabIndex={-1}>paint</button>
      </MiniApp>

      <MiniApp id="file" className="file-app" label="Tiny file stack" active={state.fileCount <= 6} onActivate={activate}>
        <span className="file-tab">demos</span>
        <strong className="file-count">{state.fileCount}</strong>
        <button className="app-action file-add" type="button" data-action="file" tabIndex={-1}>sort</button>
      </MiniApp>

      <MiniApp id="slider" className="slider-app" label="Playful control board" onActivate={activate} dataProps={{ "data-step": state.sliderStep }}>
        <span className="slider-row"><i /></span>
        <span className="slider-row"><i /></span>
        <span className="slider-row"><i /></span>
        <button className="app-action slider-mix" type="button" data-action="slider" tabIndex={-1}>mix</button>
      </MiniApp>

      <MiniApp id="coin" className={`coin-app${state.coinHeads ? " is-heads" : ""}`} label="Taste coin" onActivate={activate}>
        <span className="coin-face">{state.coinHeads ? "MS" : "fun"}</span>
        <button className="app-action coin-flip" type="button" data-action="coin" tabIndex={-1}>flip</button>
      </MiniApp>

      <MiniApp id="game" className="game-app" label="Small maze" onActivate={activate} dataProps={{ "data-step": state.gameStep }}>
        <span className="game-board" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</span>
        <button className="app-action game-move" type="button" data-action="game" tabIndex={-1}>move</button>
      </MiniApp>
    </>
  );
}

function DesktopWindow({ index, className, title, action, children }) {
  const ref = useRef(null);
  useWindowDrag(ref, index);

  return (
    <motion.article
      ref={ref}
      className={`desktop-window ${className}`}
      data-window
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        delay: 0.08 + index * 0.08,
        type: "spring",
        stiffness: 150,
        damping: 18,
        mass: 0.72
      }}
    >
      <div className="desktop-window-frame">
        <div className="window-chrome" data-drag-handle>
          <span className="window-title">{title}</span>
          {action}
        </div>
        {children}
      </div>
    </motion.article>
  );
}

function DetailsDesktop() {
  return (
    <motion.section
      className="details-desktop"
      aria-label="Make Software desktop"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.55, ease: [0.18, 0.86, 0.2, 1] }}
    >
      <DesktopWindow index={0} className="letter-window" title="Manifesto">
        <div className="letter-window-body">
          <span className="letter-badge" aria-hidden="true">M</span>
          <div className="letter-copy">
            <span className="letter-kicker-app">Manifesto / Make Software</span>
            <h2>Computers are fun again.</h2>
            <p>Make Software is a Vienna community for people who want to create with computers the way others paint, write, play music, or make tiny strange things with friends.</p>
            <p>We make software without needing to justify it through profit, scale, business models, users, or a startup pitch. AI makes building easier; this room is for keeping taste, authorship, and play in the process.</p>
            <p className="letter-note">Bring a half-working demo, a blank idea, a useful script, a silly game, a personal website, or just curiosity.</p>
            <p className="letter-signature">
              <span>For tiny finished things and strange ideas made near others,</span>
              <strong>Riccardo &amp; Florian</strong>
            </p>
          </div>
        </div>
      </DesktopWindow>

      <DesktopWindow
        index={1}
        className="events-window"
        title="Events"
      >
        <div className="window-body luma-window-body">
          <div className="window-hero-copy">
            <h2>Come make with us.</h2>
            <p>Small, warm gatherings for tiny tools, playful prototypes, broken demos, and strange things with computers. Browse upcoming dates below.</p>
          </div>
          <div className="window-pill-row event-ribbon" aria-label="Event notes">
            <span className="window-pill">upcoming events</span>
            <span className="window-pill">Vienna / local internet</span>
            <a className="window-action window-action-compact" href="https://luma.com/embed/calendar/cal-49APBOHEsAwegFJ/events">Open Luma</a>
          </div>
          <div className="event-frame-wrap" data-window-surface>
            <iframe
              src="https://luma.com/embed/calendar/cal-49APBOHEsAwegFJ/events"
              title="Make Software events on Luma"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </DesktopWindow>

      <DesktopWindow index={2} className="values-window" title="Values">
        <div className="values-window-body">
          <div className="values-window-heading">
            <span className="letter-kicker-app">Values / Make Software</span>
            <h2>What we want to protect while building gets easier.</h2>
          </div>
          <div className="values-square-grid" aria-label="Make Software values">
            {communityValues.map((value) => (
              <div
                className="value-square"
                key={value.title}
                style={{ "--value-bg": value.bg, "--value-r": value.rotate }}
              >
                <strong>{value.title}</strong>
                <span>{value.text}</span>
              </div>
            ))}
          </div>
        </div>
      </DesktopWindow>

      <DesktopWindow index={3} className="contact-window" title="Contact">
        <div className="window-body contact-window-body">
          <div className="window-hero-copy">
            <h2>Send a small signal.</h2>
            <p>If you want to collaborate, host us, mentor makers, bring a weird idea, or make something with us, send a note. Half-formed thoughts are welcome.</p>
          </div>
          <div className="contact-stamp" aria-label="Email note">
            <span className="contact-seal" aria-hidden="true" />
            <span>
              <strong>Mailbox / Make Software</strong>
              <span>We read these and turn good sparks into rooms, prompts, and tiny gatherings.</span>
            </span>
          </div>
          <div className="window-card-grid" aria-label="Ways to collaborate">
            {contactPrompts.map((prompt) => (
              <div
                className="window-soft-card"
                key={prompt.title}
                style={{ "--card-bg": prompt.bg, "--card-r": prompt.rotate }}
              >
                <strong>{prompt.title}</strong>
                <span>{prompt.text}</span>
              </div>
            ))}
          </div>
          <div className="window-pill-row audience-ribbon" aria-label="Who belongs here">
            {audiencePills.map((pill) => <span className="window-pill" key={pill}>{pill}</span>)}
          </div>
          <div className="window-pill-row" aria-label="Contact links">
            <a className="window-action" href="mailto:riccardob36@gmail.com">Email us</a>
          </div>
        </div>
      </DesktopWindow>

      <DesktopWindow index={4} className="becoming-window" title="Still Becoming">
        <div className="window-body becoming-window-body">
          <div className="window-hero-copy">
            <h2>Make Software 0.1 is still compiling.</h2>
            <p>We are shaping this into prototype nights, tiny workshops, demo evenings, and strange prompts. Stay close if that sounds like your kind of room.</p>
          </div>
          <div className="system-note" aria-label="Community status">
            <span className="system-note-light" aria-hidden="true" />
            <span>status: playful, local, unfinished on purpose</span>
          </div>
        </div>
      </DesktopWindow>
    </motion.section>
  );
}

function LogoPlayer() {
  const audioRef = useRef(null);
  const pressRef = useRef({ pointerId: null, startedAt: 0, timer: 0, longPressReady: false });
  const noteIdRef = useRef(0);
  const noteTimersRef = useRef(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [notes, setNotes] = useState([]);

  const emitNotes = useCallback((count = 4) => {
    const base = performance.now();
    const glyphs = ["♪", "♫", "♬", "♩", "♪", "♫"].slice(0, count);
    const created = glyphs.map((glyph, index) => ({
      id: `note-${noteIdRef.current += 1}`,
      glyph,
      x: `${(seededNoise(index * 7.31 + base * 0.001) - 0.5) * 3.8}rem`,
      y: `${-4.4 - seededNoise(index * 5.17 + 3.4) * 3.2}rem`,
      r: `${(seededNoise(index * 3.41 + 9.7) - 0.5) * 34}deg`,
      d: `${index * 140}ms`
    }));
    setNotes((current) => [...current, ...created]);
    const timer = window.setTimeout(() => {
      const createdIds = new Set(created.map((note) => note.id));
      noteTimersRef.current.delete(timer);
      setNotes((current) => current.filter((note) => !createdIds.has(note.id)));
    }, 3400);
    noteTimersRef.current.add(timer);
  }, []);

  const playAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    emitNotes(5);
    try {
      await audio.play();
      setIsPlaying(true);
    } catch (_) {
      setIsPlaying(false);
    }
  }, [emitNotes]);

  const toggleAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await playAudio();
      return;
    }
    audio.pause();
    setIsPlaying(false);
  }, [playAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const sync = () => setIsPlaying(!audio.paused && !audio.ended);
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("ended", sync);
    return () => {
      audio.removeEventListener("play", sync);
      audio.removeEventListener("pause", sync);
      audio.removeEventListener("ended", sync);
      window.clearTimeout(pressRef.current.timer);
      noteTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      noteTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => emitNotes(3), 1250);
    return () => window.clearInterval(timer);
  }, [emitNotes, isPlaying]);

  const clearPress = useCallback(() => {
    window.clearTimeout(pressRef.current.timer);
    pressRef.current.pointerId = null;
    pressRef.current.timer = 0;
    pressRef.current.longPressReady = false;
    setIsHolding(false);
  }, []);

  const onPointerDown = (event) => {
    if (event.button && event.button !== 0) return;
    event.preventDefault();
    pressRef.current.pointerId = event.pointerId;
    pressRef.current.startedAt = performance.now();
    pressRef.current.longPressReady = false;
    setIsHolding(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressRef.current.timer = window.setTimeout(() => {
      pressRef.current.longPressReady = true;
      emitNotes(5);
    }, 850);
  };

  const onPointerUp = async (event) => {
    const press = pressRef.current;
    if (press.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const heldLongEnough = press.longPressReady || performance.now() - press.startedAt > 820;
    window.clearTimeout(press.timer);
    press.pointerId = null;
    press.timer = 0;
    press.longPressReady = false;
    setIsHolding(false);
    if (heldLongEnough) await playAudio();
    else await toggleAudio();
  };

  const onPointerCancel = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    clearPress();
  };

  const onKeyDown = async (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    await toggleAudio();
  };

  return (
    <button
      className={`scene-logo${isPlaying ? " is-playing" : ""}${isHolding ? " is-holding" : ""}`}
      type="button"
      aria-label={isPlaying ? "Pause Make Software music" : "Play Make Software music"}
      aria-pressed={isPlaying}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={(event) => {
        if (pressRef.current.pointerId === event.pointerId) onPointerCancel(event);
      }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={onKeyDown}
    >
      <audio ref={audioRef} src="/assets/audio/song.mp3" preload="none" loop />
      <img src="/assets/branding/tomo/logo.svg" alt="" width="1254" height="1254" draggable="false" />
      <span className="logo-notes" aria-hidden="true">
        {notes.map((note) => (
          <span
            key={note.id}
            className="logo-note"
            style={{ "--note-x": note.x, "--note-y": note.y, "--note-r": note.r, "--note-delay": note.d }}
          >
            {note.glyph}
          </span>
        ))}
      </span>
    </button>
  );
}

export default function App() {
  const sceneRef = useRef(null);
  const burstIdRef = useRef(0);
  const burstTimersRef = useRef(new Set());
  const footerAtBottomRef = useRef(false);
  const footerAutoSuppressedRef = useRef(false);
  const [appState, setAppState] = useState(initialState);
  const [bursts, setBursts] = useState([]);
  const [frontWidget, setFrontWidget] = useState(null);
  const [footerCollapsed, setFooterCollapsed] = useState(true);
  const [footerManualOpen, setFooterManualOpen] = useState(false);

  usePointerParallax(sceneRef);

  useEffect(() => () => {
    burstTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    burstTimersRef.current.clear();
  }, []);

  useEffect(() => {
    let frame = 0;

    const readBottomState = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
      const pageHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );
      const threshold = Math.max(120, viewportHeight * 0.18);
      return scrollTop + viewportHeight >= pageHeight - threshold;
    };

    const updateFooterFromScroll = () => {
      frame = 0;
      const atBottom = readBottomState();
      footerAtBottomRef.current = atBottom;

      if (footerManualOpen) return;

      if (!atBottom) {
        footerAutoSuppressedRef.current = false;
        setFooterCollapsed(true);
        return;
      }

      if (!footerAutoSuppressedRef.current) {
        setFooterCollapsed(false);
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateFooterFromScroll);
    };

    updateFooterFromScroll();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [footerManualOpen]);

  const activate = useCallback((id, burst) => {
    const burstId = `burst-${burstIdRef.current += 1}`;
    setBursts((current) => [...current, { id: burstId, ...burst }]);
    const timer = window.setTimeout(() => {
      burstTimersRef.current.delete(timer);
      setBursts((current) => current.filter((item) => item.id !== burstId));
    }, 760);
    burstTimersRef.current.add(timer);

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

  const miniAppStack = useMemo(() => ({
    frontWidget,
    bringMiniAppToFront: setFrontWidget
  }), [frontWidget]);

  const openFooterManually = useCallback(() => {
    footerAutoSuppressedRef.current = false;
    setFooterManualOpen(true);
    setFooterCollapsed(false);
  }, []);

  const closeFooterManually = useCallback(() => {
    footerAutoSuppressedRef.current = footerAtBottomRef.current;
    setFooterManualOpen(false);
    setFooterCollapsed(true);
  }, []);

  const footerAutoOpen = !footerManualOpen && !footerCollapsed;

  return (
    <>
      <LogoPlayer />
      <StickerBoard />
      <BurstLayer bursts={bursts} />
      <motion.main
        ref={sceneRef}
        className="play-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.78, ease: [0.18, 0.86, 0.2, 1] }}
      >
        <CloudLayer />
        <section className="hero" aria-labelledby="page-title">
          <div className="collage">
            <MiniAppStackContext.Provider value={miniAppStack}>
              <MiniApps state={appState} activate={activate} />
            </MiniAppStackContext.Provider>
          </div>
          <h1 className="sr-only" id="page-title">Make Software</h1>
        </section>
        <DetailsDesktop />
      </motion.main>
      <motion.footer
        className={`floating-ambient-footer${footerCollapsed ? " is-collapsed" : ""}${footerAutoOpen ? " is-auto-open" : ""}${footerManualOpen ? " is-manual-open" : ""}`}
        aria-label="Make Software by Ambient"
        data-state={footerCollapsed ? "collapsed" : "open"}
        data-open-mode={footerManualOpen ? "manual" : footerAutoOpen ? "auto" : "collapsed"}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.36, type: "spring", stiffness: 170, damping: 16, mass: 0.76 }}
      >
        <span className="footer-charms" aria-hidden="true"><i /><i /><i /></span>
        {footerCollapsed ? (
          <button
            className="floating-ambient-mark footer-logo-toggle"
            type="button"
            aria-label="Show Ambient footer"
            aria-expanded="false"
            onClick={openFooterManually}
          >
            <img src="/assets/branding/ambient-logo.svg" alt="" width="1254" height="1254" />
          </button>
        ) : (
          <span className="floating-ambient-mark" aria-hidden="true">
            <img src="/assets/branding/ambient-logo.svg" alt="" width="1254" height="1254" />
          </span>
        )}
        <span className="floating-footer-copy">
          <span className="floating-footer-title">
            <strong>{footerCopy.title}</strong>
            <span className="floating-footer-kicker">{footerCopy.kicker}</span>
          </span>
          <span className="floating-footer-description">{footerCopy.description}</span>
        </span>
        <a className="floating-footer-soon" href="https://luma.com/embed/calendar/cal-49APBOHEsAwegFJ/events">{footerCopy.action}</a>
        <button
          className="footer-collapse-button"
          type="button"
          aria-label="Hide Ambient footer"
          aria-expanded="true"
          onClick={closeFooterManually}
        />
      </motion.footer>
    </>
  );
}
