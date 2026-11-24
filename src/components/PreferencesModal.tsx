"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { formatEnergy } from "@/lib/i18n";
import {
  getMacroGoalMismatch,
  scaleMacrosToCalorieGoal,
} from "@/lib/macro-sync";
import type {
  EnergyUnit,
  MacroUnit,
  UserSettings,
  UserSettingsPatch,
} from "@/types/food";

interface PreferencesModalProps {
  open: boolean;
  settings: UserSettings;
  isSaving: boolean;
  onClose: () => void;
  onSave: (patch: UserSettingsPatch) => Promise<boolean>;
}

export function PreferencesModal({
  open,
  settings,
  isSaving,
  onClose,
  onSave,
}: PreferencesModalProps) {
  const { locale, t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [caloriesInput, setCaloriesInput] = useState(
    String(settings.dailyCalorieGoal)
  );
  const [proteinInput, setProteinInput] = useState(String(settings.proteinGoal));
  const [carbsInput, setCarbsInput] = useState(String(settings.carbsGoal));
  const [fatInput, setFatInput] = useState(String(settings.fatGoal));
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>(settings.energyUnit);
  const [macroUnit, setMacroUnit] = useState<MacroUnit>(settings.macroUnit);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync draft form values whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setCaloriesInput(String(settings.dailyCalorieGoal));
    setProteinInput(String(settings.proteinGoal));
    setCarbsInput(String(settings.carbsGoal));
    setFatInput(String(settings.fatGoal));
    setEnergyUnit(settings.energyUnit);
    setMacroUnit(settings.macroUnit);
    setValidationError(null);
  }, [open, settings]);

  // Open/close native <dialog> via showModal() / close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Light-dismiss fallback for browsers without native closedby="any" (Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ("closedBy" in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    const handlePointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", handlePointerDown);
    dialog.addEventListener("pointerup", handlePointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", handlePointerDown);
      dialog.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  function handleAutoSplit() {
    const kcal = Number(caloriesInput);
    if (!Number.isFinite(kcal) || kcal < 500 || kcal > 10000) return;
    // Balanced 30% Protein / 40% Carbs / 30% Fat split, clamped to valid macro bounds
    const split = scaleMacrosToCalorieGoal(kcal);
    setProteinInput(String(split.proteinGoal));
    setCarbsInput(String(split.carbsGoal));
    setFatInput(String(split.fatGoal));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const dailyCalorieGoal = Number(caloriesInput);
    const proteinGoal = Number(proteinInput);
    const carbsGoal = Number(carbsInput);
    const fatGoal = Number(fatInput);

    if (
      !Number.isInteger(dailyCalorieGoal) ||
      dailyCalorieGoal < 500 ||
      dailyCalorieGoal > 10000
    ) {
      setValidationError(t.preferences.validation.calories);
      return;
    }
    if (
      !Number.isInteger(proteinGoal) ||
      proteinGoal < 10 ||
      proteinGoal > 800
    ) {
      setValidationError(t.preferences.validation.protein);
      return;
    }
    if (
      !Number.isInteger(carbsGoal) ||
      carbsGoal < 0 ||
      carbsGoal > 1500
    ) {
      setValidationError(t.preferences.validation.carbs);
      return;
    }
    if (!Number.isInteger(fatGoal) || fatGoal < 10 || fatGoal > 400) {
      setValidationError(t.preferences.validation.fat);
      return;
    }

    setValidationError(null);
    const saved = await onSave({
      dailyCalorieGoal,
      proteinGoal,
      carbsGoal,
      fatGoal,
      energyUnit,
      macroUnit,
    });

    if (saved) {
      dialogRef.current?.close();
    }
  }

  const draftCalorieGoal = Number(caloriesInput) || 0;
  const draftMismatch = getMacroGoalMismatch(draftCalorieGoal, {
    proteinGoal: Number(proteinInput) || 0,
    carbsGoal: Number(carbsInput) || 0,
    fatGoal: Number(fatInput) || 0,
  });
  const formattedMacroEnergy = formatEnergy(
    draftMismatch.macroKcal,
    locale,
    energyUnit
  );
  const formattedDiffEnergy = formatEnergy(
    draftMismatch.absDiff,
    locale,
    energyUnit
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = "";
        }
        onClose();
      }}
      className="app-dialog m-auto w-[min(calc(100vw-2rem),32rem)] rounded-2xl border border-border-subtle bg-surface p-0 text-ink shadow-2xl"
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h1
            id={titleId}
            className="font-display text-lg font-bold tracking-tight text-ink sm:text-xl"
          >
            {t.preferences.title}
          </h1>
          <p className="mt-0.5 text-xs text-ink-secondary sm:text-sm">
            {t.preferences.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t.preferences.closeAria}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5 px-5 py-5 sm:px-6"
      >
        {/* Daily Calorie Goal */}
        <div>
          <label
            htmlFor="pref-calories"
            className="mb-1.5 block text-xs font-medium text-ink-secondary"
          >
            {t.preferences.dailyCalorieGoal}
          </label>
          <input
            id="pref-calories"
            type="number"
            min={500}
            max={10000}
            step={50}
            autoFocus
            disabled={isSaving}
            value={caloriesInput}
            onChange={(e) => setCaloriesInput(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-input px-3.5 py-2.5 text-sm font-medium text-ink tabular-nums focus:border-accent focus:outline-none"
          />
        </div>

        {/* Daily Macro Targets */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-secondary">
              {t.preferences.macroTargets}
            </span>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleAutoSplit}
              className="rounded-md border border-accent-soft-border bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-soft-text transition-colors hover:border-accent"
            >
              {t.preferences.autoSplit}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label
                htmlFor="pref-protein"
                className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-secondary"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-macro-protein"
                />
                {t.macros.protein}
              </label>
              <input
                id="pref-protein"
                type="number"
                min={10}
                max={800}
                disabled={isSaving}
                value={proteinInput}
                onChange={(e) => setProteinInput(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-input px-3 py-2 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="pref-carbs"
                className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-secondary"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-macro-carbs"
                />
                {t.macros.carbs}
              </label>
              <input
                id="pref-carbs"
                type="number"
                min={0}
                max={1500}
                disabled={isSaving}
                value={carbsInput}
                onChange={(e) => setCarbsInput(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-input px-3 py-2 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="pref-fat"
                className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-secondary"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-macro-fat"
                />
                {t.macros.fat}
              </label>
              <input
                id="pref-fat"
                type="number"
                min={10}
                max={400}
                disabled={isSaving}
                value={fatInput}
                onChange={(e) => setFatInput(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-input px-3 py-2 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {draftMismatch.isMismatched ? (
            <p
              role="status"
              className="mt-2 rounded-lg border border-status-yellow/35 bg-status-yellow/10 px-2.5 py-1.5 text-xs font-medium text-status-yellow tabular-nums"
            >
              {draftMismatch.diffKcal < 0
                ? t.preferences.macroMismatchBelow(
                    formattedMacroEnergy,
                    formattedDiffEnergy
                  )
                : t.preferences.macroMismatchAbove(
                    formattedMacroEnergy,
                    formattedDiffEnergy
                  )}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-ink-muted tabular-nums">
              {t.preferences.macroCalorieSum(formattedMacroEnergy)}
            </p>
          )}
        </div>

        {/* Display Units */}
        <div>
          <p className="mb-2 text-xs font-medium text-ink-secondary">
            {t.preferences.displayUnits}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-[11px] text-ink-muted">
                {t.preferences.energyUnitLabel}
              </span>
              <div
                role="group"
                aria-label={t.preferences.energyUnitLabel}
                className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-canvas p-1"
              >
                <button
                  type="button"
                  aria-pressed={energyUnit === "kcal"}
                  onClick={() => setEnergyUnit("kcal")}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    energyUnit === "kcal"
                      ? "bg-accent font-semibold text-accent-ink"
                      : "text-ink-secondary hover:bg-elevated hover:text-ink"
                  }`}
                >
                  {t.preferences.kcalOption}
                </button>
                <button
                  type="button"
                  aria-pressed={energyUnit === "kj"}
                  onClick={() => setEnergyUnit("kj")}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    energyUnit === "kj"
                      ? "bg-accent font-semibold text-accent-ink"
                      : "text-ink-secondary hover:bg-elevated hover:text-ink"
                  }`}
                >
                  {t.preferences.kjOption}
                </button>
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[11px] text-ink-muted">
                {t.preferences.macroUnitLabel}
              </span>
              <div
                role="group"
                aria-label={t.preferences.macroUnitLabel}
                className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-canvas p-1"
              >
                <button
                  type="button"
                  aria-pressed={macroUnit === "g"}
                  onClick={() => setMacroUnit("g")}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    macroUnit === "g"
                      ? "bg-accent font-semibold text-accent-ink"
                      : "text-ink-secondary hover:bg-elevated hover:text-ink"
                  }`}
                >
                  {t.preferences.gramsOption}
                </button>
                <button
                  type="button"
                  aria-pressed={macroUnit === "oz"}
                  onClick={() => setMacroUnit("oz")}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    macroUnit === "oz"
                      ? "bg-accent font-semibold text-accent-ink"
                      : "text-ink-secondary hover:bg-elevated hover:text-ink"
                  }`}
                >
                  {t.preferences.ozOption}
                </button>
              </div>
            </div>
          </div>
        </div>

        {validationError ? (
          <p
            role="alert"
            className="rounded-xl border border-error-border bg-error-bg px-3.5 py-2.5 text-xs text-error-text"
          >
            {validationError}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => dialogRef.current?.close()}
            className="rounded-xl border border-border-subtle bg-elevated px-4 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink disabled:opacity-50"
          >
            {t.preferences.cancel}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {isSaving ? t.preferences.saving : t.preferences.save}
          </button>
        </div>
      </form>
    </dialog>
  );
}

