"use client";

import { createClient } from "@/lib/supabase/client";

/** Downscale an image in the browser and encode as WebP before upload (saves bandwidth + storage). */
async function compress(file: File, maxDim: number, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/webp", quality),
  );
}

export async function uploadImage(file: File, bucket: "avatars" | "game-photos", userId: string) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is too large (max 15 MB)");
  const blob = await compress(file, bucket === "avatars" ? 512 : 1600);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
