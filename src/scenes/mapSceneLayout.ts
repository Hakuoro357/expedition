export const MAP_SCENE_TYPOGRAPHY = {
  title: {
    fontFamily: "Georgia",
    fontSize: "28px",
  },
  expedition: {
    fontFamily: "'Trebuchet MS', Verdana, sans-serif",
    fontSize: "12px",
  },
  subtitle: {
    fontFamily: "'Trebuchet MS', Verdana, sans-serif",
    fontSize: "16px",
  },
  chapter: {
    fontFamily: "Georgia",
    fontSize: "24px",
  },
  progress: {
    fontFamily: "'Trebuchet MS', Verdana, sans-serif",
    fontSize: "16px",
  },
  node: {
    fontFamily: "'Trebuchet MS', Verdana, sans-serif",
    fontSize: {
      current: "20px",
      default: "18px",
    },
  },
  utility: {
    fontFamily: "'Trebuchet MS', Verdana, sans-serif",
    fontSize: "13px",
  },
} as const;

export const MAP_SCENE_SPACING = {
  titleY: 60,
  expeditionY: 94,
  subtitleY: 122,
  chapterY: 168,
  progressBarY: 202,
  progressTextY: 220,
  mapTop: 260,
  mapBottom: 468,
} as const;

type RouteBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  waveAmplitude: number;
};

export function buildRoutePoints(count: number, bounds: RouteBounds): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, idx) => {
    const t = count === 1 ? 0.5 : idx / Math.max(count - 1, 1);
    const x = bounds.left + t * (bounds.right - bounds.left);
    const wave = Math.sin(t * Math.PI * 1.5) * bounds.waveAmplitude;
    const y = bounds.top + (bounds.bottom - bounds.top) * t + wave;

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  });
}
