"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AiNutritionReview,
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

interface NativeDetectedBarcode {
  rawValue?: string;
}

interface NativeBarcodeDetector {
  detect: (source: HTMLVideoElement) => Promise<NativeDetectedBarcode[]>;
}

interface NativeBarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
}

interface BarcodeLookupProps {
  isActive: boolean;
  isSaving: boolean;
  selectedMeal: MealCategory;
  energyUnit?: EnergyUnit;
  macroUnit?: MacroUnit;
  onSaveAiItems: (items: CustomFoodLogItem[]) => Promise<boolean>;
}

const BARCODE_FORMAT_CLEAN = /[\s-]+/g;
const BARCODE_PATTERN = /^\d{8,14}$/;

export function BarcodeLookup({
  isActive,
  isSaving,
  selectedMeal,
  energyUnit = "kcal",
  macroUnit = "g",
  onSaveAiItems,
}: BarcodeLookupProps) {
  const { t } = useLocale();
  const inputId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const isMountedRef = useRef(true);
  const lookupSeqRef = useRef(0);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<NutritionLookupResponse | null>(null);

  const stopCamera = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // Ignore teardown errors
      }
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (isMountedRef.current) {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!isActive) {
      stopCamera();
    }
  }, [isActive, stopCamera]);

  const lookupBarcode = useCallback(
    async (rawCode: string) => {
      const cleaned = rawCode.replace(BARCODE_FORMAT_CLEAN, "").trim();
      if (!BARCODE_PATTERN.test(cleaned)) {
        setErrorMessage(t.barcode.invalidBarcode);
        return;
      }

      const reqId = ++lookupSeqRef.current;
      setIsLookingUp(true);
      setErrorMessage(null);
      setResult(null);

      try {
        const res = await fetch(
          `/api/nutrition/barcode/${encodeURIComponent(cleaned)}`,
          { cache: "no-store" }
        );
        const payload = (await res.json().catch(() => ({}))) as Partial<
          NutritionLookupResponse
        > & { error?: string };

        if (reqId !== lookupSeqRef.current || !isMountedRef.current) return;

        if (!res.ok) {
          if (res.status === 400) {
            setErrorMessage(t.barcode.invalidBarcode);
          } else if (res.status === 404) {
            setErrorMessage(t.barcode.notFound);
          } else if (res.status === 502) {
            setErrorMessage(t.barcode.upstreamError);
          } else {
            setErrorMessage(payload.error || t.aiReview.errors.generic);
          }
          return;
        }

        if (!payload.items || payload.items.length === 0) {
          setErrorMessage(t.barcode.notFound);
          return;
        }

        setResult(payload as NutritionLookupResponse);
      } catch {
        if (reqId === lookupSeqRef.current && isMountedRef.current) {
          setErrorMessage(t.aiReview.errors.network);
        }
      } finally {
        if (reqId === lookupSeqRef.current && isMountedRef.current) {
          setIsLookingUp(false);
        }
      }
    },
    [t]
  );

  async function startCamera() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErrorMessage(t.barcode.cameraUnavailable);
      return;
    }

    stopCamera();
    setErrorMessage(null);
    setDetectedCode(null);
    setResult(null);
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      if (!isMountedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }

      video.srcObject = stream;
      await video.play();

      const win = window as Window & {
        BarcodeDetector?: NativeBarcodeDetectorConstructor;
      };

      const handleDetected = (raw: string) => {
        const cleaned = raw.replace(BARCODE_FORMAT_CLEAN, "").trim();
        if (!BARCODE_PATTERN.test(cleaned)) return false;
        stopCamera();
        setDetectedCode(cleaned);
        setBarcodeInput(cleaned);
        void lookupBarcode(cleaned);
        return true;
      };

      if (typeof win.BarcodeDetector === "function") {
        const detector = new win.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });

        const scanFrame = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const detected = await detector.detect(videoRef.current);
              for (const item of detected) {
                if (item.rawValue && handleDetected(item.rawValue)) {
                  return;
                }
              }
            }
          } catch {
            // Continue scanning frames until user stops or code is detected
          }
          if (streamRef.current) {
            pollTimerRef.current = window.setTimeout(
              () => void scanFrame(),
              250
            );
          }
        };

        pollTimerRef.current = window.setTimeout(() => void scanFrame(), 250);
        return;
      }

      // Cross-browser fallback for Safari / Firefox using @zxing/browser
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (!streamRef.current || !videoRef.current) return;

      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromStream(
        streamRef.current,
        videoRef.current,
        (decoded) => {
          if (decoded) {
            handleDetected(decoded.getText());
          }
        }
      );
      zxingControlsRef.current = controls;
    } catch (error) {
      stopCamera();
      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError")
      ) {
        setErrorMessage(t.barcode.cameraDenied);
      } else {
        setErrorMessage(t.barcode.cameraUnavailable);
      }
    }
  }

  async function handleConfirm(items: CustomFoodLogItem[]) {
    const saved = await onSaveAiItems(items);
    if (saved) {
      setResult(null);
      setBarcodeInput("");
      setDetectedCode(null);
      setErrorMessage(null);
    }
  }

  const isBusy = isLookingUp || isSaving;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">{t.barcode.intro}</p>

      {/* Camera Scanner Box */}
      <div className="space-y-2.5">
        {!isScanning ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void startCamera()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-input px-4 py-4 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <path d="M8 7v10" />
              <path d="M12 7v10" />
              <path d="M16 7v10" />
            </svg>
            <span>{t.barcode.scanButton}</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-xl border border-accent/50 bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="aspect-video w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center p-6"
              >
                <div className="h-24 w-full max-w-xs rounded-lg border-2 border-accent/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-secondary">
                {t.barcode.scanningHint}
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="shrink-0 rounded-lg border border-border-subtle bg-elevated px-3 py-1.5 font-medium text-ink-secondary hover:border-border-strong hover:text-ink"
              >
                {t.barcode.stopCamera}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Barcode Lookup Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookupBarcode(barcodeInput);
        }}
        className="space-y-2"
      >
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-ink-secondary"
        >
          {t.barcode.manualLabel}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={isBusy}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder={t.barcode.manualPlaceholder}
            className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-input px-3.5 py-2 text-sm text-ink tabular-nums placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isBusy || !barcodeInput.trim()}
            className="shrink-0 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            {isLookingUp ? t.barcode.lookingUp : t.barcode.lookupButton}
          </button>
        </div>
      </form>

      {detectedCode ? (
        <p className="text-xs font-medium text-accent tabular-nums">
          {t.barcode.detectedCode(detectedCode)}
        </p>
      ) : null}

      {isLookingUp ? <LoadingSpinner label={t.barcode.spinner} /> : null}

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-error-border bg-error-bg px-3.5 py-3 text-sm text-error-text"
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
