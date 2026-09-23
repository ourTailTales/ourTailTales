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

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = previewUrl;

    await deadline(
      new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("That video could not be read."));
      }),
      LOAD_TIMEOUT_MS,
      "reject",
    );

    if (video.seekable.length > 0) {
      video.currentTime = Math.min(0.15, video.duration || 0.15);
      // Resolves either way. A browser that half-supports the codec, or a
      // duration that comes back NaN, can leave this seek pending forever,
      // and the album is read one video at a time: one that never settles
      // stopped every later file, so `Promise.all` never resolved and the
      // customer watched a spinner that was never going to finish. Drawing
      // whatever frame is loaded is a worse poster and a working album.
      await deadline(
        new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error("That video could not be read."));
        }),
        SEEK_TIMEOUT_MS,
        "resolve",
      );
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
  } catch (error) {
    // The object URL and the file handle were registered before any of this
    // could fail, and a rejected preview left both behind for the life of the
    // tab, holding the whole video in memory for a file nobody can see.
    releaseVideoPoster(id);
    throw error;
  }
}

/** How long to wait for a video to produce any data at all. */
const LOAD_TIMEOUT_MS = 15_000;
/** And for it to land on the frame we asked for. */
const SEEK_TIMEOUT_MS = 4_000;

/**
 * Bounds a promise that may never settle.
 *
 * `onTimeout` says what a timeout means here: "reject" for a stage that
 * cannot be skipped, "resolve" for one where carrying on with whatever we
 * have is better than failing the whole file.
 */
function deadline<T>(
  work: Promise<T>,
  ms: number,
  onTimeout: "resolve" | "reject",
): Promise<T | void> {
  return new Promise<T | void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (onTimeout === "resolve") resolve();
      else reject(new Error("That video could not be read in time."));
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("That video could not be read."));
      },
    );
  });
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
