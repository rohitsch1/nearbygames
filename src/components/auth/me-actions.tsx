"use client";

import { BellRing, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { replayTour } from "@/app/actions/profile";

const subscribe = () => () => {};
const getPermission = () => ("Notification" in window ? Notification.permission : "unsupported");

export function MeActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const permission = useSyncExternalStore(subscribe, getPermission, () => "default");

  async function enableNotifications() {
    if (!("Notification" in window)) return toast.error("This browser doesn't support notifications");
    const res = await Notification.requestPermission();
    if (res === "granted") toast.success("You'll get a ping for requests and messages while nearbygames is open");
    else toast("Notifications stay off. You can change this in your browser settings.");
    router.refresh();
  }

  const replay = () =>
    startTransition(async () => {
      const res = await replayTour();
      if (!res.ok) return void toast.error(res.error);
      router.push("/onboarding/tour?next=/map");
    });

  return (
    <>
      {permission !== "granted" && permission !== "unsupported" && (
        <button type="button" onClick={enableNotifications}
          className="flex h-12 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
          <BellRing className="size-5 text-brand" /> Turn on notifications
        </button>
      )}
      <button type="button" onClick={replay} disabled={pending}
        className="flex h-12 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
        <RotateCcw className="size-5 text-muted" /> Replay the welcome tour
      </button>
    </>
  );
}
