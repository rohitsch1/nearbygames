"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

export function ShareButton({ title }: { title: string }) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* user cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }
  return (
    <button type="button" onClick={share} aria-label="Share game" className="flex size-10 items-center justify-center rounded-full hover:bg-surface-2">
      <Share2 className="size-5" />
    </button>
  );
}
