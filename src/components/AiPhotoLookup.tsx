"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AiNutritionReview,
  formatFriendlyAiError,
  LoadingSpinner,
} from "@/components/AiNutritionReview";
import { useLocale } from "@/components/LocaleProvider";
import type {
  CustomFoodLogItem,
  EnergyUnit,
  MacroUnit,
  MealCategory,
  NutritionLookupResponse,
} from "@/types/food";

interface AiPhotoLookupProps {
  isSaving: boolean;
  selectedMeal: MealCategory;
  energyUnit?: EnergyUnit;
  macroUnit?: MacroUnit;
  onSaveAiItems: (items: CustomFoodLogItem[]) => Promise<boolean>;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function AiPhotoLookup({
  isSaving,
  selectedMeal,
  energyUnit = "kcal",
  macroUnit = "g",
  onSaveAiItems,
}: AiPhotoLookupProps) {
  const { locale, t } = useLocale();
  const fileInputId = useId();
  const notesInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<NutritionLookupResponse | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function clearSelectedFile() {
    setSelectedFile(null);
    setResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(file: File | undefined) {
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setErrorMessage(t.aiPhoto.unsupportedTypeError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size <= 0) {
      setErrorMessage(t.aiPhoto.emptyFileError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage(t.aiPhoto.tooLargeError);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setErrorMessage(null);
    setResult(null);
    setSelectedFile(file);
  }

  async function analyzePhoto() {
    if (!selectedFile) {
      setErrorMessage(t.aiPhoto.missingFileError);
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("locale", locale);
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      const res = await fetch("/api/nutrition/image", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json().catch(() => ({}))) as Partial<
        NutritionLookupResponse
      > & { error?: string };

      if (!res.ok) {
        setErrorMessage(
          formatFriendlyAiError(res.status, t.aiReview.errors, payload.error)
        );
        return;
      }

      if (!payload.items || payload.items.length === 0) {
        setErrorMessage(t.aiPhoto.noFoodsError);
        return;
      }

      setResult(payload as NutritionLookupResponse);
    } catch {
      setErrorMessage(formatFriendlyAiError(null, t.aiReview.errors));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleConfirm(items: CustomFoodLogItem[]) {
    const saved = await onSaveAiItems(items);
    if (saved) {
      setNotes("");
      clearSelectedFile();
    }
  }

  const isBusy = isAnalyzing || isSaving;

  return (
    <div>
      <p className="mb-3.5 text-sm text-ink-secondary">{t.aiPhoto.intro}</p>

      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        disabled={isBusy}
        onChange={(e) => handleFileChange(e.target.files?.[0])}
        className="sr-only"
      />

      {!selectedFile ? (
        <label
          htmlFor={fileInputId}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-input px-4 py-8 text-center transition-colors hover:border-accent hover:bg-elevated"
        >
          <span className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink">
            {t.aiPhoto.uploadButton}
          </span>
          <span className="mt-2.5 text-xs text-ink-secondary">
            {t.aiPhoto.uploadHint}
          </span>
        </label>
      ) : (
        <div className="space-y-3">
          {previewUrl ? (
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={t.aiPhoto.previewAlt}
                className="max-h-64 w-full object-contain"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
            <span className="truncate font-medium text-ink">
              {selectedFile.name}{" "}
              <span className="font-normal text-ink-muted tabular-nums">
                ({formatFileSize(selectedFile.size)})
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-border-subtle bg-elevated px-2.5 py-1 font-medium text-ink-secondary hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.aiPhoto.changePhoto}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={clearSelectedFile}
                className="rounded-lg border border-border-subtle px-2.5 py-1 font-medium text-ink-secondary hover:border-error-border hover:bg-error-bg hover:text-error-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.aiPhoto.removePhoto}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor={notesInputId}
              className="mb-1.5 block text-xs font-medium text-ink-secondary"
            >
              {t.aiPhoto.notesLabel}
            </label>
            <input
              id={notesInputId}
              type="text"
              maxLength={300}
              disabled={isBusy}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.aiPhoto.notesPlaceholder}
              className="w-full rounded-xl border border-border-subtle bg-input px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => void analyzePhoto()}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? t.aiPhoto.analyzing : t.aiPhoto.analyze}
          </button>
        </div>
      )}

      {isAnalyzing ? (
        <div className="mt-4">
          <LoadingSpinner label={t.aiPhoto.spinner} />
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-error-border bg-error-bg px-3.5 py-3 text-sm text-error-text"
        >
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <AiNutritionReview
          result={result}
          selectedMeal={selectedMeal}
          energyUnit={energyUnit}
          macroUnit={macroUnit}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onDiscard={() => setResult(null)}
        />
      ) : null}
    </div>
  );
}
