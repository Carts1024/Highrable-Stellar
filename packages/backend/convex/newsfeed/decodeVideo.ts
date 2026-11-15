"use node";

import { v } from "convex/values";
import { createFile, type ISOFile, type Movie, type Sample, type Track } from "mp4box";

import { internalAction } from "../_generated/server";
import { MAX_VIDEO_BYTES, STORAGE_MARKER, VIDEO_MAX_DURATION_SECONDS } from "./photos";

export const VIDEO_ERROR_CODES = {
  EMPTY: "VIDEO_EMPTY",
  SIZE: "VIDEO_SIZE_LIMIT",
  CONTAINER: "VIDEO_CONTAINER",
  CODEC: "VIDEO_CODEC",
  AUDIO: "VIDEO_AUDIO_CODEC",
  TRACKS: "VIDEO_TRACKS",
  DURATION: "VIDEO_DURATION",
  SAMPLES: "VIDEO_SAMPLES",
} as const;

export class VideoValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "VideoValidationError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new VideoValidationError(code, message);
}

function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

function assertMp4FileType(bytes: Uint8Array): void {
  if (bytes.length < 16 || readFourCC(bytes, 4) !== "ftyp")
    fail(
      VIDEO_ERROR_CODES.CONTAINER,
      "Use a complete MP4 video. MOV and WebM files are not supported.",
    );
  const majorBrand = readFourCC(bytes, 8);
  const compatibleBrands = Array.from({ length: Math.floor((bytes.length - 16) / 4) }, (_, index) =>
    readFourCC(bytes, 16 + index * 4),
  );
  if (majorBrand === "qt  " || compatibleBrands.includes("qt  "))
    fail(VIDEO_ERROR_CODES.CONTAINER, "MOV videos are not supported. Export the recording as MP4.");
}

function assertTrackSamples(bytes: Uint8Array, file: ISOFile, track: Track): number {
  const samples: Sample[] = file.getTrackSamplesInfo(track.id);
  if (!samples.length || samples.length !== track.nb_samples || !track.timescale)
    fail(VIDEO_ERROR_CODES.SAMPLES, "The video has incomplete or invalid sample timing.");
  let end = 0;
  for (const sample of samples) {
    if (
      !Number.isSafeInteger(sample.offset) ||
      !Number.isSafeInteger(sample.size) ||
      sample.offset < 0 ||
      sample.size <= 0 ||
      sample.offset + sample.size > bytes.length ||
      !Number.isFinite(sample.dts) ||
      !Number.isFinite(sample.duration) ||
      sample.duration <= 0
    )
      fail(VIDEO_ERROR_CODES.SAMPLES, "The video contains invalid sample offsets or timing.");
    end = Math.max(end, sample.dts + sample.duration);
  }
  const seconds = end / track.timescale;
  if (!Number.isFinite(seconds) || seconds <= 0)
    fail(VIDEO_ERROR_CODES.SAMPLES, "The video contains invalid sample timing.");
  return seconds;
}

function validateMovie(
  bytes: Uint8Array,
  file: ISOFile,
  info: Movie,
): {
  width: number;
  height: number;
  duration: number;
  videoCodec: string;
  audioCodec?: string;
} {
  if (!info.hasMoov || !info.mime?.startsWith("video/mp4"))
    fail(
      VIDEO_ERROR_CODES.CONTAINER,
      "Use a complete MP4 video. MOV and WebM files are not supported.",
    );
  if (info.videoTracks.length !== 1 || info.audioTracks.length > 1 || info.otherTracks.length)
    fail(VIDEO_ERROR_CODES.TRACKS, "Use one video track and optional AAC-LC audio only.");

  const video = info.videoTracks[0];
  if (!video || !/^avc[13](?:\.|$)/u.test(video.codec) || video.codec.startsWith("encv"))
    fail(
      VIDEO_ERROR_CODES.CODEC,
      "Only H.264/AVC video is supported. HEVC and encrypted video are not supported.",
    );
  const audio = info.audioTracks[0];
  if (audio && (!/^mp4a\.40\.2$/u.test(audio.codec) || audio.codec.startsWith("enca")))
    fail(VIDEO_ERROR_CODES.AUDIO, "Only optional AAC-LC audio is supported.");
  if (!video.video?.width || !video.video.height)
    fail(VIDEO_ERROR_CODES.CONTAINER, "The video dimensions are missing or invalid.");

  const videoDuration = assertTrackSamples(bytes, file, video);
  const audioDuration = audio ? assertTrackSamples(bytes, file, audio) : videoDuration;
  const duration = Math.max(videoDuration, audioDuration);
  if (duration > VIDEO_MAX_DURATION_SECONDS)
    fail(VIDEO_ERROR_CODES.DURATION, "Videos must be 60 seconds or shorter.");
  if (duration <= 0) fail(VIDEO_ERROR_CODES.DURATION, "Video duration must be greater than zero.");
  if (Math.abs(videoDuration - audioDuration) > 1)
    fail(VIDEO_ERROR_CODES.SAMPLES, "Video and audio sample timing is inconsistent.");

  return {
    width: video.video.width,
    height: video.video.height,
    duration,
    videoCodec: video.codec,
    ...(audio ? { audioCodec: audio.codec } : {}),
  };
}

export function validateVideo(bytes: Uint8Array) {
  if (!bytes.length) fail(VIDEO_ERROR_CODES.EMPTY, "Video cannot be empty.");
  if (bytes.length > MAX_VIDEO_BYTES)
    fail(VIDEO_ERROR_CODES.SIZE, "Videos must be 26,214,400 bytes or smaller.");
  assertMp4FileType(bytes);

  const file = createFile();
  let parseError: string | undefined;
  let movie: Movie | undefined;
  file.onError = (_module, message) => {
    parseError = message;
  };
  file.onReady = (info) => {
    movie = info;
  };
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer & {
    fileStart: number;
  };
  buffer.fileStart = 0;
  try {
    file.appendBuffer(buffer, true);
    file.flush();
  } catch {
    fail(VIDEO_ERROR_CODES.CONTAINER, "The MP4 container is malformed or truncated.");
  }
  if (parseError || !movie)
    fail(VIDEO_ERROR_CODES.CONTAINER, "The MP4 container is malformed or truncated.");
  return {
    format: "mp4",
    size: bytes.length,
    ...validateMovie(bytes, file, movie),
  };
}

export const decode = internalAction({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob || blob.type !== STORAGE_MARKER)
      throw new VideoValidationError(VIDEO_ERROR_CODES.CONTAINER, "Video upload is missing.");
    return validateVideo(new Uint8Array(await blob.arrayBuffer()));
  },
});
