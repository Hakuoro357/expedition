const artifactGridImages = import.meta.glob("../assets/artifacts/grid/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const artifactLargeImages = import.meta.glob("../assets/artifacts/large/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function resolveArtifactUrl(imageMap: Record<string, string>, imageKey: string): string | undefined {
  return Object.entries(imageMap).find(([path]) => path.endsWith(`/${imageKey}.png`))?.[1];
}

export function resolveArtifactGridUrl(imageKey: string): string | undefined {
  return resolveArtifactUrl(artifactGridImages, imageKey);
}

export function resolveArtifactLargeUrl(imageKey: string): string | undefined {
  return resolveArtifactUrl(artifactLargeImages, imageKey);
}
