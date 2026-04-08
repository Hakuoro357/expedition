const artifactGridImages = import.meta.glob("../assets/artifacts/grid/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const artifactLargeImages = import.meta.glob("../assets/artifacts/large/*.webp", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function resolveArtifactUrl(
  imageMap: Record<string, string>,
  imageKey: string,
  ext: string,
): string | undefined {
  return Object.entries(imageMap).find(([path]) => path.endsWith(`/${imageKey}.${ext}`))?.[1];
}

export function resolveArtifactGridUrl(imageKey: string): string | undefined {
  return resolveArtifactUrl(artifactGridImages, imageKey, "png");
}

export function resolveArtifactLargeUrl(imageKey: string): string | undefined {
  return resolveArtifactUrl(artifactLargeImages, imageKey, "webp");
}
