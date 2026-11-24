"use client";

import { useId, useState } from "react";
import { AiPhotoLookup } from "@/components/AiPhotoLookup";
import { AiTextLookup } from "@/components/AiTextLookup";
import { FoodSearchCatalog } from "@/components/FoodSearchCatalog";
import { useLocale } from "@/components/LocaleProvider";
import {
  MEAL_CATEGORIES,
  type CustomFoodLogItem,
  type FoodItem,
  type MealCategory,
} from "@/types/food";

type InputMode = "quick" | "text" | "photo";

interface AddFoodPanelProps {
  foods: FoodItem[];
  isLoadingFoods: boolean;
  addingFoodId: number | null;
  isSavingAi: boolean;
  selectedMeal: MealCategory;
  onSelectMeal: (category: MealCategory) => void;
  onAddFood: (foodId: number, servings: number) => Promise<void>;
  onSaveAiItems: (items: CustomFoodLogItem[]) => Promise<boolean>;
}

export function AddFoodPanel({
  foods,
  isLoadingFoods,
  addingFoodId,
  isSavingAi,
  selectedMeal,
  onSelectMeal,
  onAddFood,
  onSaveAiItems,
}: AddFoodPanelProps) {
  const { t } = useLocale();
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<InputMode>("quick");

  const tabs: Array<{ id: InputMode; label: string }> = [
    { id: "quick", label: t.addPanel.tabs.quick },
    { id: "text", label: t.addPanel.tabs.text },
    { id: "photo", label: t.addPanel.tabs.photo },
  ];

  return (
    <section
      aria-label={t.addPanel.sectionLabel}
      className="min-w-0 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5"
    >
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-ink">
          {t.addPanel.title}
        </h2>
        <p className="mt-0.5 text-sm text-ink-secondary">
          {t.addPanel.subtitle}
        </p>
      </div>

      {/* Meal Category Selector */}
      <div className="mb-3.5">
        <span
          id={`${baseId}-meal-label`}
          className="mb-1.5 block text-xs font-medium text-ink-secondary"
        >
          {t.addPanel.mealCategoryLabel}
        </span>
        <div
          role="group"
          aria-labelledby={`${baseId}-meal-label`}
          className="grid grid-cols-4 gap-1 rounded-xl border border-border-subtle bg-canvas p-1"
        >
          {MEAL_CATEGORIES.map((category) => {
            const isSelected = selectedMeal === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectMeal(category)}
                className={`min-w-0 truncate rounded-lg px-1.5 py-1.5 text-[11px] font-medium transition-colors sm:px-2 sm:text-xs ${
                  isSelected
                    ? "bg-accent font-semibold text-accent-ink"
                    : "text-ink-secondary hover:bg-elevated hover:text-ink"
                }`}
              >
                {t.meals[category]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Method Tabs */}
      <div
        role="tablist"
        aria-label={t.addPanel.tabsLabel}
        className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-border-subtle bg-canvas p-1"
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`min-w-0 truncate rounded-lg px-1.5 py-2 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs ${
                isSelected
                  ? "bg-elevated font-semibold text-ink shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel-quick`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-quick`}
        hidden={activeTab !== "quick"}
      >
        <FoodSearchCatalog
          embedded
          foods={foods}
          isLoading={isLoadingFoods}
          addingFoodId={addingFoodId}
          selectedMeal={selectedMeal}
          onAddFood={onAddFood}
        />
      </div>

      <div
        id={`${baseId}-panel-text`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-text`}
        hidden={activeTab !== "text"}
      >
        <AiTextLookup
          isSaving={isSavingAi}
          selectedMeal={selectedMeal}
          onSaveAiItems={onSaveAiItems}
        />
      </div>

      <div
        id={`${baseId}-panel-photo`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-photo`}
        hidden={activeTab !== "photo"}
      >
        <AiPhotoLookup
          isSaving={isSavingAi}
          selectedMeal={selectedMeal}
          onSaveAiItems={onSaveAiItems}
        />
      </div>
    </section>
  );
}
