import { videoMemoryMaxSourceBytes } from "@/lib/video-memory/config";
import { STORAGE_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

export async function effectiveUploadLimitBytes(): Promise<{
  appLimit: number;
  bucketLimit: number | null;
  effective: number;
  inconsistent: boolean;
}> {
  const appLimit = videoMemoryMaxSourceBytes();
  let bucketLimit: number | null = null;
  try {
    const { data } = await supabaseAdmin().storage.getBucket(STORAGE_BUCKET);
    if (data?.file_size_limit) bucketLimit = data.file_size_limit;
  } catch {
    bucketLimit = null;
  }

  const inconsistent = bucketLimit !== null && appLimit > bucketLimit;
  if (inconsistent) {
    console.warn(
      "[ourTailTales] VIDEO_MEMORY_MAX_SOURCE_BYTES exceeds the private bucket file_size_limit. Uploads will fail at storage.",
      { appLimit, bucketLimit },
    );
  }

  return {
    appLimit,
    bucketLimit,
    effective: bucketLimit === null ? appLimit : Math.min(appLimit, bucketLimit),
    inconsistent,
  };
}
