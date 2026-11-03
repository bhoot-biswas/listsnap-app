"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaImg } from "@/components/app/media-img";
import type { ReviewPhoto } from "./review-side";

/**
 * One photo at a time, as large as the screen allows: a 90 px tile is too small to judge
 * an AI scene by. From here the seller includes it or leaves it out, and makes it the
 * main photo (the first one in the store and the catalog). A native dialog, so Esc and
 * the back gesture close it and focus stays inside.
 */
export function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
  selected,
  cover,
  onToggle,
  onCover,
  name,
  title,
}: {
  photos: ReviewPhoto[];
  /** The photo on screen; null when closed. */
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  selected: Set<string>;
  /** The main photo, when the seller chose one; otherwise the white cutout leads. */
  cover: string | null;
  onToggle: (id: string) => void;
  /** Null puts the white cutout first again. */
  onCover: (id: string | null) => void;
  name: (p: ReviewPhoto) => string;
  title: string;
}) {
  const t = useTranslations("review.viewer");
  const ref = useRef<HTMLDialogElement>(null);
  const open = index !== null;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const photo = index === null ? null : photos[index];
  const isMain = !!photo && (photo.locked ? cover === null : cover === photo.id);
  const on = !!photo && (photo.locked || selected.has(photo.id));
  const step = (by: number) => index !== null && onIndex((index + by + photos.length) % photos.length);

  return (
    <dialog
      ref={ref}
      aria-label={photo ? name(photo) : t("title")}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      {photo && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 p-2">
            <p className="px-2 text-sm font-medium" aria-live="polite">
              {t("count", { n: index! + 1, total: photos.length })} · {name(photo)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 text-white hover:bg-white/10 hover:text-white"
              aria-label={t("close")}
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
          <div className="relative min-h-0 flex-1">
            <MediaImg src={photo.url} alt={title} sizes="100vw" className="absolute inset-0 size-full object-contain" />
            {photos.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 left-2 size-11 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                  aria-label={t("previous")}
                  onClick={() => step(-1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-2 size-11 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                  aria-label={t("next")}
                  onClick={() => step(1)}
                >
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {photo.locked ? (
              <p className="px-2 text-sm text-white/80">{t("alwaysGoes")}</p>
            ) : (
              <Button
                type="button"
                variant={on ? "secondary" : "outline"}
                className="h-11 text-foreground"
                aria-pressed={on}
                onClick={() => onToggle(photo.id)}
              >
                <Check className={on ? "" : "opacity-30"} aria-hidden="true" />
                {on ? t("included") : t("include")}
              </Button>
            )}
            {isMain ? (
              <p className="flex items-center gap-1.5 px-2 text-sm font-medium">
                <Star className="size-4 fill-current text-marigold" aria-hidden="true" />
                {t("isMain")}
              </p>
            ) : (
              <Button type="button" className="h-11" onClick={() => onCover(photo.locked ? null : photo.id)}>
                <Star aria-hidden="true" />
                {t("makeMain")}
              </Button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
