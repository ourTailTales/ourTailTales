const PRIVATE_SOURCE =
  /^drafts\/[0-9a-f-]{36}\/videos\/[0-9a-f-]{36}\/original\.[a-z0-9]+$/i;

/**
 * Processors may only read a VideoAsset's private storage object.
 * Customer-controlled URLs are rejected to avoid SSRF.
 */
export function assertPrivateVideoSourcePath(sourcePath: string): string {
  const trimmed = sourcePath.trim();
  if (trimmed.includes("://") || trimmed.includes("..") || trimmed.startsWith("/")) {
    throw new Error("Video processing only accepts a private storage path.");
  }
  if (!PRIVATE_SOURCE.test(trimmed)) {
    throw new Error("Video processing only accepts a private storage path.");
  }
  return trimmed;
}

export function isPrivateVideoSourcePath(sourcePath: string): boolean {
  try {
    assertPrivateVideoSourcePath(sourcePath);
    return true;
  } catch {
    return false;
  }
}
