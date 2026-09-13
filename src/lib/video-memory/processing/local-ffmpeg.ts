import { createHash } from "node:crypto";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import {
  DURATION_TOO_LONG_MESSAGE,
  VIDEO_MEMORY_MAX_DURATION_MS,
  VIDEO_MEMORY_MAX_FPS,
  VIDEO_MEMORY_MAX_PROCESSED_BYTES,
  VIDEO_MEMORY_TARGET_HEIGHT,
} from "@/lib/video-memory/config";
import { targetVideoBitrate } from "@/lib/video-memory/processing/bitrate";
import { assertProcessedContract } from "@/lib/video-memory/processing/contract";
import type {
  ProcessedVideoResult,
  VideoProcessingProvider,
} from "@/lib/video-memory/processing/types";
import { assertPrivateVideoSourcePath } from "@/lib/video-memory/processing/validate-source-path";
import {
  STORAGE_BUCKET,
  supabaseAdmin,
} from "@/lib/supabase/server";

type FfprobeFormat = {
  format?: { duration?: string };
  streams?: {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
  }[];
};

export class LocalFfmpegVideoProcessor implements VideoProcessingProvider {
  async processVideo(input: {
    sourcePath: string;
    assetId: string;
  }): Promise<ProcessedVideoResult> {
    const sourcePath = assertPrivateVideoSourcePath(input.sourcePath);
    const workDir = await mkdtemp(join(tmpdir(), "ott-video-"));

    try {
      const sourceLocal = join(workDir, "source");
      await downloadPrivateObject(sourcePath, sourceLocal);

      const probe = await ffprobe(sourceLocal);
      const durationMs = Math.round(Number(probe.format?.duration ?? 0) * 1000);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new Error("That video could not be read.");
      }
      if (durationMs > VIDEO_MEMORY_MAX_DURATION_MS) {
        throw new Error(DURATION_TOO_LONG_MESSAGE);
      }

      const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
      const sourceHeight = videoStream?.height ?? VIDEO_MEMORY_TARGET_HEIGHT;
      const targetHeight = Math.min(sourceHeight, VIDEO_MEMORY_TARGET_HEIGHT);

      const outputLocal = join(workDir, "processed.mp4");
      const thumbLocal = join(workDir, "thumb.jpg");
      let bitrate = targetVideoBitrate(durationMs / 1000);
      let bytes = Number.POSITIVE_INFINITY;

      for (let attempt = 0; attempt < 3 && bytes > VIDEO_MEMORY_MAX_PROCESSED_BYTES; attempt += 1) {
        await ffmpeg([
          "-y",
          "-i",
          sourceLocal,
          "-vf",
          `scale=-2:${targetHeight}:flags=lanczos,fps=${VIDEO_MEMORY_MAX_FPS}`,
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-b:v",
          String(bitrate),
          "-maxrate",
          String(bitrate),
          "-bufsize",
          String(bitrate * 2),
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          "-map_metadata",
          "-1",
          outputLocal,
        ]);
        bytes = (await stat(outputLocal)).size;
        bitrate = Math.floor(bitrate * 0.75);
      }

      if (bytes > VIDEO_MEMORY_MAX_PROCESSED_BYTES) {
        throw new Error("That video could not be prepared within our size budget.");
      }

      await ffmpeg([
        "-y",
        "-i",
        sourceLocal,
        "-ss",
        "0.4",
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-2",
        thumbLocal,
      ]).catch(() => undefined);

      const sha256 = createHash("sha256")
        .update(await import("node:fs").then((fs) => fs.readFileSync(outputLocal)))
        .digest("hex");

      const processedPath = sourcePath.replace(/\/original\.[a-z0-9]+$/i, "/processed.mp4");
      const thumbnailPath = sourcePath.replace(/\/original\.[a-z0-9]+$/i, "/thumb.jpg");
      await uploadPrivateObject(processedPath, outputLocal, "video/mp4");
      if (await exists(thumbLocal)) {
        await uploadPrivateObject(thumbnailPath, thumbLocal, "image/jpeg");
      }

      const outProbe = await ffprobe(outputLocal);
      const outVideo = outProbe.streams?.find((stream) => stream.codec_type === "video");
      const outAudio = outProbe.streams?.find((stream) => stream.codec_type === "audio");

      const result: ProcessedVideoResult = {
        processedPath,
        processedBytes: bytes,
        durationMs,
        width: outVideo?.width ?? 0,
        height: outVideo?.height ?? targetHeight,
        sha256,
        videoCodec: outVideo?.codec_name ?? "h264",
        audioCodec: outAudio?.codec_name,
        thumbnailPath: (await exists(thumbLocal)) ? thumbnailPath : undefined,
      };
      assertProcessedContract(result);
      return result;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadPrivateObject(path: string, dest: string): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(error?.message ?? "The uploaded video could not be read.");
  }
  await writeFile(dest, Buffer.from(await data.arrayBuffer()));
}

async function uploadPrivateObject(
  path: string,
  localPath: string,
  contentType: string,
): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(localPath);
  const { error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

function ffmpeg(args: string[]): Promise<void> {
  return run("ffmpeg", args);
}

async function ffprobe(file: string): Promise<FfprobeFormat> {
  const stdout = await runCapture("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  return JSON.parse(stdout) as FfprobeFormat;
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () =>
      reject(new Error("Video processing is not available on this machine.")),
    );
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("Video processing failed."));
    });
  });
}

function runCapture(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", () =>
      reject(new Error("Video processing is not available on this machine.")),
    );
    child.on("exit", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString("utf8"));
      else reject(new Error("Video processing failed."));
    });
  });
}
