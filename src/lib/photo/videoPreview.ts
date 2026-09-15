const posters = new Map<string, string>();
const previews = new Map<string, string>();

export function getVideoPosterUrl(id: string): string | undefined {
  return posters.get(id);
}

export function getVideoPreviewUrl(id: string): string | undefined {
  return previews.get(id);
}

function revoke(map: Map<string, string>, id: string): void {
  const url = map.get(id);
  if (!url) return;
  URL.revokeObjectURL(url);
  map.delete(id);
}

export function releaseVideoPoster(id: string): void {
  revoke(posters, id);
  revoke(previews, id);
}

export function releaseAllVideoPosters(): void {
  for (const url of posters.values()) URL.revokeObjectURL(url);
  for (const url of previews.values()) URL.revokeObjectURL(url);
  posters.clear();
  previews.clear();
}

export type VideoPreview = {
  posterUrl: string;
  previewUrl: string;
};

/** Local object URLs for playback and a first-frame poster. */
export async function makeVideoPreview(
  id: string,
  file: File,
): Promise<VideoPreview> {
  releaseVideoPoster(id);
  const previewUrl = URL.createObjectURL(file);
  previews.set(id, previewUrl);

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = previewUrl;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("That video could not be read."));
  });
  if (video.seekable.length > 0) {
    video.currentTime = Math.min(0.15, video.duration || 0.15);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
  }
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("That video preview could not be drawn.");
  const width = video.videoWidth || size;
  const height = video.videoHeight || size;
  const scale = Math.max(size / width, size / height);
  const drawW = width * scale;
  const drawH = height * scale;
  context.drawImage(video, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("poster"))),
      "image/jpeg",
      0.82,
    );
  });
  const posterUrl = URL.createObjectURL(blob);
  posters.set(id, posterUrl);
  return { posterUrl, previewUrl };
}
