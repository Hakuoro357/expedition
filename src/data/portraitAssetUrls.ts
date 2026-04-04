const portraitImages = import.meta.glob("../assets/portraits/raw/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export function resolvePortraitUrl(portraitKey: string): string | undefined {
  return Object.entries(portraitImages).find(([path]) => path.endsWith(`/${portraitKey}.png`))?.[1];
}
