const posters = new Map<string, string>();
const previews = new Map<string, string>();
const posterBlobs = new Map<string, Blob>();
const videoFiles = new Map<string, File>();

function revoke(map: Map<string, string>, id: string): void {
  const url = map.get(id);
  if (!url) return;
  URL.revokeObjectURL(url);
  map.delete(id);
}

export function releaseVideoPoster(id: string): void {
  revoke(posters, id);
  revoke(previews, id);
  posterBlobs.delete(id);
  videoFiles.delete(id);
}

export function releaseAllVideoPosters(): void {
  for (const url of posters.values()) URL.revokeObjectURL(url);
  for (const url of previews.values()) URL.revokeObjectURL(url);
  posters.clear();
  previews.clear();
  posterBlobs.clear();
  videoFiles.clear();
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
  videoFiles.set(id, file);

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
  posterBlobs.set(id, blob);
  return { posterUrl, previewUrl };
}

export function getStoredVideoPreview(
  id: string,
): { file: File; posterBlob: Blob } | null {
  const file = videoFiles.get(id);
  const posterBlob = posterBlobs.get(id);
  return file && posterBlob ? { file, posterBlob } : null;
}

export function restoreVideoPreview(
  id: string,
  file: File,
  posterBlob: Blob,
): VideoPreview {
  releaseVideoPoster(id);
  const previewUrl = URL.createObjectURL(file);
  const posterUrl = URL.createObjectURL(posterBlob);
  previews.set(id, previewUrl);
  posters.set(id, posterUrl);
  videoFiles.set(id, file);
  posterBlobs.set(id, posterBlob);
  return { previewUrl, posterUrl };
}
