import { invoke } from "@tauri-apps/api/core";

export interface FolderHandle {
  id: string;
  name?: string | null;
  uri?: string | null;
}

export interface DirEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDir: boolean;
  size?: number | null;
  mimeType?: string | null;
  lastModified?: number | null;
}

export interface FileStat extends DirEntry {}

export interface ScopedStorageErrorPayload {
  code: string;
  message: string;
}

export interface WriteFileOptions {
  mimeType?: string;
  recursive?: boolean;
}

export interface AppendFileOptions extends WriteFileOptions {
  create?: boolean;
}

export interface WriteTextFileOptions {
  recursive?: boolean;
}

export class ScopedStorageError extends Error {
  readonly code: string;
  constructor(payload: ScopedStorageErrorPayload) {
    super(payload.message);
    this.code = payload.code;
    this.name = "ScopedStorageError";
  }
}

export function isScopedStorageError(e: unknown): e is ScopedStorageError {
  return e instanceof ScopedStorageError;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function requireNonEmptyString(name: string, value: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${name} must not be empty`);
  }

  return normalized;
}

function normalizeOptionalPath(path?: string): string | undefined {
  if (path === undefined) {
    return undefined;
  }

  if (typeof path !== "string") {
    throw new TypeError("path must be a string");
  }

  return path.trim() ? path : undefined;
}

function requireBytes(name: string, data: Uint8Array): Uint8Array {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError(`${name} must be a Uint8Array`);
  }

  return data;
}

function requireSafeLength(len: number): number {
  if (!Number.isSafeInteger(len) || len < 0) {
    throw new RangeError("len must be a non-negative safe integer");
  }

  return len;
}

function isErrorPayload(e: unknown): e is ScopedStorageErrorPayload {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e &&
    typeof (e as Record<string, unknown>).code === "string" &&
    typeof (e as Record<string, unknown>).message === "string"
  );
}

async function invokeCommand<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(`plugin:scoped-storage|${command}`, payload);
  } catch (raw: unknown) {
    if (isErrorPayload(raw)) {
      throw new ScopedStorageError(raw);
    }
    throw raw;
  }
}

export async function pickFolder(): Promise<FolderHandle> {
  return invokeCommand("pick_folder");
}

export async function forgetFolder(folderId: string): Promise<void> {
  return invokeCommand("forget_folder", { folderId: requireNonEmptyString("folderId", folderId) });
}

export async function listFolders(): Promise<FolderHandle[]> {
  return invokeCommand("list_folders");
}

export async function getFolderInfo(folderId: string): Promise<FolderHandle> {
  return invokeCommand("get_folder_info", { req: { folderId: requireNonEmptyString("folderId", folderId) } });
}

export async function readDir(folderId: string, path?: string): Promise<DirEntry[]> {
  return invokeCommand("read_dir", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: normalizeOptionalPath(path),
    },
  });
}

export const readdir = readDir;

export async function stat(folderId: string, path: string): Promise<FileStat> {
  return invokeCommand("stat", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
    },
  });
}

export async function exists(folderId: string, path: string): Promise<boolean> {
  const response = await invokeCommand<{ exists: boolean }>("exists", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
    },
  });
  return response.exists;
}

export async function readFile(folderId: string, path: string): Promise<Uint8Array> {
  const response = await invokeCommand<{ data: number[] }>("read_file", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
    },
  });
  return new Uint8Array(response.data);
}

export async function writeFile(
  folderId: string,
  path: string,
  data: Uint8Array,
  options: WriteFileOptions = {},
): Promise<void> {
  const bytes = requireBytes("data", data);
  return invokeCommand("write_file", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
      data: Array.from(bytes),
      mimeType: options.mimeType,
      recursive: options.recursive,
    },
  });
}

export async function readTextFile(folderId: string, path: string): Promise<string> {
  const response = await invokeCommand<{ contents: string }>("read_text_file", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
    },
  });
  return response.contents;
}

export async function readTextFileLines(folderId: string, path: string): Promise<string[]> {
  const response = await invokeCommand<{ lines: string[] }>("read_text_file_lines", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
    },
  });
  return response.lines;
}

export async function writeTextFile(
  folderId: string,
  path: string,
  contents: string,
  options: WriteTextFileOptions = {},
): Promise<void> {
  return invokeCommand("write_text_file", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
      contents,
      recursive: options.recursive,
    },
  });
}

export async function appendFile(
  folderId: string,
  path: string,
  data: Uint8Array,
  options: AppendFileOptions = {},
): Promise<void> {
  const bytes = requireBytes("data", data);
  return invokeCommand("append_file", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
      data: Array.from(bytes),
      mimeType: options.mimeType,
      create: options.create,
      recursive: options.recursive,
    },
  });
}

export async function appendTextFile(
  folderId: string,
  path: string,
  contents: string,
  options: AppendFileOptions = {},
): Promise<void> {
  return appendFile(folderId, path, utf8Encoder.encode(contents), {
    mimeType: options.mimeType ?? "text/plain",
    create: options.create ?? true,
    recursive: options.recursive,
  });
}

export async function mkdir(folderId: string, path: string, recursive = false): Promise<void> {
  return invokeCommand("mkdir", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
      recursive,
    },
  });
}

export async function removeFile(folderId: string, path: string): Promise<void> {
  return invokeCommand("remove_file", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
    },
  });
}

export async function removeDir(folderId: string, path: string, recursive = false): Promise<void> {
  return invokeCommand("remove_dir", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
      recursive,
    },
  });
}

export async function copy(
  fromFolderId: string,
  fromPath: string,
  toFolderId: string,
  toPath: string,
): Promise<void> {
  return invokeCommand("copy", {
    req: {
      fromFolderId: requireNonEmptyString("fromFolderId", fromFolderId),
      fromPath: requireNonEmptyString("fromPath", fromPath),
      toFolderId: requireNonEmptyString("toFolderId", toFolderId),
      toPath: requireNonEmptyString("toPath", toPath),
    },
  });
}

export async function move(
  fromFolderId: string,
  fromPath: string,
  toFolderId: string,
  toPath: string,
): Promise<void> {
  return invokeCommand("move", {
    req: {
      fromFolderId: requireNonEmptyString("fromFolderId", fromFolderId),
      fromPath: requireNonEmptyString("fromPath", fromPath),
      toFolderId: requireNonEmptyString("toFolderId", toFolderId),
      toPath: requireNonEmptyString("toPath", toPath),
    },
  });
}

export const mv = move;

export async function rename(folderId: string, fromPath: string, toPath: string): Promise<void> {
  return invokeCommand("rename", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      fromPath: requireNonEmptyString("fromPath", fromPath),
      toPath: requireNonEmptyString("toPath", toPath),
    },
  });
}

export async function truncate(folderId: string, path: string, len: number): Promise<void> {
  return invokeCommand("truncate", {
    req: {
      folderId: requireNonEmptyString("folderId", folderId),
      path: requireNonEmptyString("path", path),
      len: requireSafeLength(len),
    },
  });
}

export function decodeUtf8(data: Uint8Array): string {
  return utf8Decoder.decode(data);
}

export function encodeUtf8(value: string): Uint8Array {
  return utf8Encoder.encode(value);
}
