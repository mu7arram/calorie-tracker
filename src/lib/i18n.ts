import type { FoodItem, MealCategory } from "@/types/food";

export const SUPPORTED_LOCALES = ["en", "es", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isValidLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function getLocaleDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export const LOCALE_META: Record<
  Locale,
  {
    code: string;
    nativeName: string;
    dir: "ltr" | "rtl";
    dateLocale: string;
  }
> = {
  en: {
    code: "EN",
    nativeName: "English",
    dir: "ltr",
    dateLocale: "en-US",
  },
  es: {
    code: "ES",
    nativeName: "Español",
    dir: "ltr",
    dateLocale: "es-ES",
  },
  ar: {
    code: "عربي",
    nativeName: "العربية",
    dir: "rtl",
    dateLocale: "ar-u-nu-latn",
  },
};

export function formatLocaleNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
}

export function formatGrams(value: number, locale: Locale): string {
  const formatted = formatLocaleNumber(value);
  const unit = TRANSLATIONS[locale].units.grams;
  return locale === "ar" ? `${formatted} ${unit}` : `${formatted}${unit}`;
}

export function formatHeaderDate(dateStr: string, locale: Locale): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  return localDate.toLocaleDateString(LOCALE_META[locale].dateLocale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export interface LocalizedStrings {
  appName: string;
  units: {
    kcal: string;
    grams: string;
  };
  macros: {
    protein: string;
    carbs: string;
    fat: string;
    proteinShort: string;
    carbsShort: string;
    fatShort: string;
  };
  meals: Record<MealCategory, string>;
  theme: {
    groupLabel: string;
    light: string;
    dark: string;
    systemCurrent: (scheme: "light" | "dark") => string;
    systemFallback: string;
  };
  language: {
    label: string;
    menuLabel: string;
  };
  summary: {
    sectionLabel: string;
    dailyCalorieIntake: string;
    editGoal: string;
    dailyGoalInputLabel: string;
    saveGoal: string;
    saving: string;
    cancel: string;
    goalValidationError: string;
    progressLabel: string;
    remaining: (amount: string) => string;
    goalReached: string;
    overGoal: (amount: string) => string;
    percentOfGoal: (pct: number, count: number) => string;
    macroBreakdown: string;
    shareOfCalories: string;
    noMacrosLogged: string;
    macroDistributionLabel: string;
  };
  addPanel: {
    sectionLabel: string;
    title: string;
    subtitle: string;
    mealCategoryLabel: string;
    tabsLabel: string;
    tabs: {
      quick: string;
      text: string;
      photo: string;
    };
  };
  catalog: {
    sectionLabel: string;
    searchLabel: string;
    searchPlaceholder: string;
    noMatch: (query: string) => string;
    noMatchHint: string;
    servingsAria: (foodName: string) => string;
    addAria: (foodName: string, meal?: string) => string;
    adding: string;
    add: string;
  };
  aiText: {
    intro: string;
    label: string;
    placeholder: string;
    shortcutTip: string;
    analyze: string;
    analyzing: string;
    spinner: string;
    emptyInputError: string;
    noFoodsError: string;
  };
  aiPhoto: {
    intro: string;
    uploadButton: string;
    uploadHint: string;
    previewAlt: string;
    changePhoto: string;
    removePhoto: string;
    notesLabel: string;
    notesPlaceholder: string;
    analyze: string;
    analyzing: string;
    spinner: string;
    unsupportedTypeError: string;
    emptyFileError: string;
    tooLargeError: string;
    missingFileError: string;
    noFoodsError: string;
  };
  aiReview: {
    eyebrow: string;
    selectedSubtotal: string;
    discard: string;
    saving: string;
    addSingle: (meal: string) => string;
    addMultiple: (count: number, meal: string) => string;
    errors: {
      network: string;
      missingKey: string;
      badInput: string;
      upstream: string;
      generic: string;
    };
  };
  foodLog: {
    sectionLabel: string;
    title: string;
    subtitle: string;
    entryCount: (count: number) => string;
    loadingLabel: string;
    emptyTitle: string;
    emptySubtitle: string;
    logMeal: (meal: string) => string;
    emptyMealRow: (meal: string) => string;
    selectedMeal: string;
    addToMeal: (meal: string) => string;
    aiEstimate: string;
    remove: string;
    removing: string;
    removeAria: (foodName: string) => string;
  };
  toasts: {
    addedSingle: (meal: string) => string;
    addedMultiple: (count: number, meal: string) => string;
    removedEntry: string;
    goalUpdated: (goal: string) => string;
  };
  errors: {
    loadFailed: string;
    addFailed: string;
    saveAiFailed: string;
    deleteFailed: string;
    refreshAfterDeleteFailed: string;
    goalFailed: string;
    dismiss: string;
  };
}

export const TRANSLATIONS: Record<Locale, LocalizedStrings> = {
  en: {
    appName: "Calorie Tracker",
    units: {
      kcal: "kcal",
      grams: "g",
    },
    macros: {
      protein: "Protein",
      carbs: "Carbs",
      fat: "Fat",
      proteinShort: "P",
      carbsShort: "C",
      fatShort: "F",
    },
    meals: {
      Breakfast: "Breakfast",
      Lunch: "Lunch",
      Dinner: "Dinner",
      Snack: "Snack",
    },
    theme: {
      groupLabel: "Color theme",
      light: "Light",
      dark: "Dark",
      systemCurrent: (scheme) =>
        `System (currently ${scheme === "dark" ? "dark" : "light"})`,
      systemFallback: "System",
    },
    language: {
      label: "Select language",
      menuLabel: "Language options",
    },
    summary: {
      sectionLabel: "Daily nutrition summary",
      dailyCalorieIntake: "Daily calorie intake",
      editGoal: "Edit goal",
      dailyGoalInputLabel: "Daily calorie goal",
      saveGoal: "Save goal",
      saving: "Saving...",
      cancel: "Cancel",
      goalValidationError: "Enter a whole number between 500 and 10,000 kcal.",
      progressLabel: "Daily calorie goal progress",
      remaining: (amount) => `${amount} kcal remaining`,
      goalReached: "Daily goal reached",
      overGoal: (amount) => `${amount} kcal over goal`,
      percentOfGoal: (pct, count) =>
        `${pct}% of goal (${count} ${count === 1 ? "item" : "items"})`,
      macroBreakdown: "Macro breakdown",
      shareOfCalories: "Share of calories",
      noMacrosLogged: "No macros logged",
      macroDistributionLabel: "Macronutrient calorie distribution",
    },
    addPanel: {
      sectionLabel: "Add food",
      title: "Add food",
      subtitle: "Select a meal, then choose how to log it.",
      mealCategoryLabel: "Meal category",
      tabsLabel: "Food logging methods",
      tabs: {
        quick: "Quick add",
        text: "Describe meal",
        photo: "Upload photo",
      },
    },
    catalog: {
      sectionLabel: "Food search and quick add",
      searchLabel: "Search common foods",
      searchPlaceholder: "Search chicken, rice, eggs, banana...",
      noMatch: (query) => `No common foods match “${query}”.`,
      noMatchHint: "Try the Describe meal tab for any custom dish.",
      servingsAria: (foodName) => `Servings for ${foodName}`,
      addAria: (foodName, meal) =>
        meal ? `Add ${foodName} to ${meal}` : `Add ${foodName}`,
      adding: "Adding...",
      add: "Add",
    },
    aiText: {
      intro:
        "Describe your meal in plain English and review the AI breakdown before saving.",
      label: "Meal description",
      placeholder:
        "e.g., grilled chicken breast with 1 cup of white rice and a side salad",
      shortcutTip: "Cmd/Ctrl + Enter to analyze",
      analyze: "Analyze meal",
      analyzing: "Analyzing meal...",
      spinner: "Estimating calories and macros with Gemini...",
      emptyInputError: "Describe what you ate before analyzing.",
      noFoodsError:
        "No foods were detected in that description. Add ingredients or portion sizes and try again.",
    },
    aiPhoto: {
      intro:
        "Take or upload a meal photo. Gemini identifies every food on your plate for review before saving.",
      uploadButton: "Take or upload meal photo",
      uploadHint: "JPEG, PNG, WebP, GIF, or HEIC up to 10 MB",
      previewAlt: "Preview of uploaded meal photo",
      changePhoto: "Change photo",
      removePhoto: "Remove",
      notesLabel: "Optional portion note",
      notesPlaceholder: "e.g., olive oil dressing on the side, ~200g steak",
      analyze: "Analyze photo",
      analyzing: "Analyzing photo...",
      spinner: "Identifying foods in your photo with Gemini...",
      unsupportedTypeError:
        "Unsupported image type. Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF photo.",
      emptyFileError: "The selected image file is empty.",
      tooLargeError: "Image must be 10 MB or smaller.",
      missingFileError: "Select or take a photo of your meal first.",
      noFoodsError:
        "No foods could be identified in that photo. Try a clearer angle or brighter lighting.",
    },
    aiReview: {
      eyebrow: "Review estimated items",
      selectedSubtotal: "Selected subtotal:",
      discard: "Discard",
      saving: "Saving...",
      addSingle: (meal) => `Add to ${meal}`,
      addMultiple: (count, meal) => `Add ${count} items to ${meal}`,
      errors: {
        network:
          "Could not reach the server. Check your connection and try again.",
        missingKey:
          "Gemini API key is missing or invalid on the server. Update GEMINI_API_KEY in .env and restart.",
        badInput: "Check your input and try again.",
        upstream:
          "Gemini could not analyze that meal. Try rephrasing, using a clearer photo, or trying again shortly.",
        generic: "Could not analyze that meal. Please try again.",
      },
    },
    foodLog: {
      sectionLabel: "Today's food log",
      title: "Today's meals",
      subtitle: "Grouped by meal and saved automatically on this device.",
      entryCount: (count) => `${count} ${count === 1 ? "entry" : "entries"}`,
      loadingLabel: "Loading food log",
      emptyTitle: "Start your food log for today",
      emptySubtitle:
        "Add foods from the common list, describe a meal in plain English, or upload a photo of your plate.",
      logMeal: (meal) => `Log ${meal}`,
      emptyMealRow: (meal) => `Nothing logged for ${meal} yet`,
      selectedMeal: "Selected",
      addToMeal: (meal) => `Add to ${meal}`,
      aiEstimate: "AI estimate",
      remove: "Remove",
      removing: "Removing...",
      removeAria: (foodName) => `Remove ${foodName}`,
    },
    toasts: {
      addedSingle: (meal) => `Added to ${meal}`,
      addedMultiple: (count, meal) => `Added ${count} items to ${meal}`,
      removedEntry: "Removed entry",
      goalUpdated: (goal) => `Daily goal updated to ${goal} kcal`,
    },
    errors: {
      loadFailed: "Could not load your nutrition data. Refresh to retry.",
      addFailed: "Could not add food entry.",
      saveAiFailed: "Could not save AI meal entries.",
      deleteFailed: "Could not remove food entry.",
      refreshAfterDeleteFailed:
        "Removed entry, but could not refresh daily log.",
      goalFailed: "Could not update daily goal.",
      dismiss: "Dismiss",
    },
  },
  es: {
    appName: "Calorie Tracker",
    units: {
      kcal: "kcal",
      grams: "g",
    },
    macros: {
      protein: "Proteína",
      carbs: "Carbohidratos",
      fat: "Grasas",
      proteinShort: "P",
      carbsShort: "C",
      fatShort: "G",
    },
    meals: {
      Breakfast: "Desayuno",
      Lunch: "Almuerzo",
      Dinner: "Cena",
      Snack: "Snack",
    },
    theme: {
      groupLabel: "Tema de color",
      light: "Claro",
      dark: "Oscuro",
      systemCurrent: (scheme) =>
        `Sistema (actualmente ${scheme === "dark" ? "oscuro" : "claro"})`,
      systemFallback: "Sistema",
    },
    language: {
      label: "Seleccionar idioma",
      menuLabel: "Opciones de idioma",
    },
    summary: {
      sectionLabel: "Resumen nutricional diario",
      dailyCalorieIntake: "Consumo calórico diario",
      editGoal: "Editar meta",
      dailyGoalInputLabel: "Meta calórica diaria",
      saveGoal: "Guardar meta",
      saving: "Guardando...",
      cancel: "Cancelar",
      goalValidationError:
        "Ingresa un número entero entre 500 y 10,000 kcal.",
      progressLabel: "Progreso de la meta calórica diaria",
      remaining: (amount) => `Faltan ${amount} kcal`,
      goalReached: "Meta diaria alcanzada",
      overGoal: (amount) => `${amount} kcal por encima`,
      percentOfGoal: (pct, count) =>
        `${pct}% de la meta (${count} ${count === 1 ? "alimento" : "alimentos"})`,
      macroBreakdown: "Distribución de macros",
      shareOfCalories: "Porcentaje de calorías",
      noMacrosLogged: "Sin macros registrados",
      macroDistributionLabel: "Distribución calórica por macronutriente",
    },
    addPanel: {
      sectionLabel: "Agregar alimento",
      title: "Agregar alimento",
      subtitle: "Elige una comida y selecciona cómo registrarla.",
      mealCategoryLabel: "Categoría de comida",
      tabsLabel: "Métodos para registrar alimentos",
      tabs: {
        quick: "Lista rápida",
        text: "Describir",
        photo: "Subir foto",
      },
    },
    catalog: {
      sectionLabel: "Búsqueda y agregado rápido",
      searchLabel: "Buscar alimentos comunes",
      searchPlaceholder: "Buscar pollo, arroz, huevo, plátano...",
      noMatch: (query) => `No hay alimentos que coincidan con “${query}”.`,
      noMatchHint: "Usa la pestaña Describir para cualquier plato.",
      servingsAria: (foodName) => `Porciones de ${foodName}`,
      addAria: (foodName, meal) =>
        meal ? `Agregar ${foodName} a ${meal}` : `Agregar ${foodName}`,
      adding: "Agregando...",
      add: "Agregar",
    },
    aiText: {
      intro:
        "Describe lo que comiste y revisa el cálculo de IA antes de guardarlo.",
      label: "Descripción de la comida",
      placeholder:
        "ej., pechuga a la plancha con 1 taza de arroz blanco y ensalada",
      shortcutTip: "Cmd/Ctrl + Enter para analizar",
      analyze: "Analizar comida",
      analyzing: "Analizando...",
      spinner: "Estimando calorías y macros con Gemini...",
      emptyInputError: "Describe lo que comiste antes de analizar.",
      noFoodsError:
        "No se detectaron alimentos en la descripción. Agrega ingredientes o porciones e intenta de nuevo.",
    },
    aiPhoto: {
      intro:
        "Toma o sube una foto de tu comida. Gemini identifica cada alimento para revisarlo antes de guardar.",
      uploadButton: "Tomar o subir foto",
      uploadHint: "JPEG, PNG, WebP, GIF o HEIC hasta 10 MB",
      previewAlt: "Vista previa de la comida subida",
      changePhoto: "Cambiar foto",
      removePhoto: "Quitar",
      notesLabel: "Nota opcional de porción",
      notesPlaceholder: "ej., aderezo aparte, ~200 g de carne",
      analyze: "Analizar foto",
      analyzing: "Analizando foto...",
      spinner: "Identificando alimentos en la foto con Gemini...",
      unsupportedTypeError:
        "Formato no compatible. Elige una imagen JPEG, PNG, WebP, GIF, HEIC o HEIF.",
      emptyFileError: "El archivo de imagen está vacío.",
      tooLargeError: "La imagen debe pesar 10 MB o menos.",
      missingFileError: "Selecciona o toma una foto primero.",
      noFoodsError:
        "No se identificaron alimentos en la foto. Intenta con mejor luz o ángulo.",
    },
    aiReview: {
      eyebrow: "Revisar alimentos estimados",
      selectedSubtotal: "Subtotal seleccionado:",
      discard: "Descartar",
      saving: "Guardando...",
      addSingle: (meal) => `Agregar a ${meal}`,
      addMultiple: (count, meal) => `Agregar ${count} a ${meal}`,
      errors: {
        network:
          "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
        missingKey:
          "Falta GEMINI_API_KEY o no es válida en el servidor. Revisa el archivo .env.",
        badInput: "Revisa los datos ingresados e intenta de nuevo.",
        upstream:
          "Gemini no pudo analizar la comida. Intenta redactarlo diferente o con una foto más clara.",
        generic: "No se pudo analizar la comida. Intenta de nuevo.",
      },
    },
    foodLog: {
      sectionLabel: "Registro diario",
      title: "Comidas de hoy",
      subtitle: "Agrupadas por comida y guardadas localmente.",
      entryCount: (count) => `${count} ${count === 1 ? "registro" : "registros"}`,
      loadingLabel: "Cargando registro diario",
      emptyTitle: "Comienza tu registro de hoy",
      emptySubtitle:
        "Agrega alimentos comunes, describe una comida con texto o sube una foto de tu plato.",
      logMeal: (meal) => `Registrar ${meal}`,
      emptyMealRow: (meal) => `Sin alimentos en ${meal} todavía`,
      selectedMeal: "Seleccionado",
      addToMeal: (meal) => `Agregar a ${meal}`,
      aiEstimate: "Estimación IA",
      remove: "Quitar",
      removing: "Quitando...",
      removeAria: (foodName) => `Quitar ${foodName}`,
    },
    toasts: {
      addedSingle: (meal) => `Agregado a ${meal}`,
      addedMultiple: (count, meal) => `Se agregaron ${count} a ${meal}`,
      removedEntry: "Registro eliminado",
      goalUpdated: (goal) => `Meta diaria actualizada a ${goal} kcal`,
    },
    errors: {
      loadFailed: "No se pudieron cargar tus datos. Recarga para reintentar.",
      addFailed: "No se pudo agregar el alimento.",
      saveAiFailed: "No se pudieron guardar los alimentos de IA.",
      deleteFailed: "No se pudo eliminar el registro.",
      refreshAfterDeleteFailed:
        "Se eliminó el registro, pero no se pudo actualizar la lista.",
      goalFailed: "No se pudo actualizar la meta diaria.",
      dismiss: "Cerrar",
    },
  },
  ar: {
    appName: "متتبع السعرات",
    units: {
      kcal: "سعرة",
      grams: "غ",
    },
    macros: {
      protein: "بروتين",
      carbs: "كربوهيدرات",
      fat: "دهون",
      proteinShort: "ب",
      carbsShort: "ك",
      fatShort: "د",
    },
    meals: {
      Breakfast: "الفطور",
      Lunch: "الغداء",
      Dinner: "العشاء",
      Snack: "وجبة خفيفة",
    },
    theme: {
      groupLabel: "مظهر الألوان",
      light: "فاتح",
      dark: "داكن",
      systemCurrent: (scheme) =>
        `النظام (حاليًا ${scheme === "dark" ? "داكن" : "فاتح"})`,
      systemFallback: "النظام",
    },
    language: {
      label: "اختر اللغة",
      menuLabel: "خيارات اللغة",
    },
    summary: {
      sectionLabel: "ملخص التغذية اليومي",
      dailyCalorieIntake: "الاستهلاك اليومي للسعرات",
      editGoal: "تعديل الهدف",
      dailyGoalInputLabel: "هدف السعرات اليومي",
      saveGoal: "حفظ الهدف",
      saving: "جارٍ الحفظ...",
      cancel: "إلغاء",
      goalValidationError: "أدخل رقمًا صحيحًا بين 500 و 10,000 سعرة.",
      progressLabel: "تقدم هدف السعرات اليومي",
      remaining: (amount) => `المتبقي ${amount} سعرة`,
      goalReached: "تم الوصول إلى الهدف اليومي",
      overGoal: (amount) => `تجاوز الهدف بـ ${amount} سعرة`,
      percentOfGoal: (pct, count) =>
        `${pct}% من الهدف (${count} ${count === 1 ? "صنف" : "أصناف"})`,
      macroBreakdown: "توزيع العناصر الغذائية",
      shareOfCalories: "نسبة السعرات",
      noMacrosLogged: "لا توجد بيانات مسجلة",
      macroDistributionLabel: "توزيع السعرات بين العناصر الغذائية",
    },
    addPanel: {
      sectionLabel: "إضافة طعام",
      title: "إضافة طعام",
      subtitle: "اختر الوجبة ثم حدد طريقة التسجيل.",
      mealCategoryLabel: "تصنيف الوجبة",
      tabsLabel: "طرق إضافة الطعام",
      tabs: {
        quick: "إضافة سريعة",
        text: "وصف الوجبة",
        photo: "رفع صورة",
      },
    },
    catalog: {
      sectionLabel: "البحث في الأطعمة الشائعة",
      searchLabel: "ابحث عن طعام",
      searchPlaceholder: "ابحث عن دجاج، أرز، بيض، موز...",
      noMatch: (query) => `لا توجد نتائج مطابقة لـ «${query}».`,
      noMatchHint: "جرّب تبويب وصف الوجبة لأي طبق مخصص.",
      servingsAria: (foodName) => `عدد الحصص لـ ${foodName}`,
      addAria: (foodName, meal) =>
        meal ? `إضافة ${foodName} إلى ${meal}` : `إضافة ${foodName}`,
      adding: "جارٍ الإضافة...",
      add: "إضافة",
    },
    aiText: {
      intro:
        "اكتب وصفًا للوجبة بالعربية أو الإنجليزية وسيحسب الذكاء الاصطناعي السعرات لمراجعتها قبل الحفظ.",
      label: "وصف الوجبة",
      placeholder:
        "مثال: صدر دجاج مشوي مع كوب أرز أبيض وسلطة خضراء",
      shortcutTip: "اضغط Cmd/Ctrl + Enter للتحليل",
      analyze: "تحليل الوجبة",
      analyzing: "جارٍ التحليل...",
      spinner: "جارٍ تقدير السعرات والعناصر عبر Gemini...",
      emptyInputError: "اكتب وصف ما أكلته قبل التحليل.",
      noFoodsError:
        "لم يتم التعرف على أطعمة في الوصف. أضف المكونات أو الكمية وحاول مجددًا.",
    },
    aiPhoto: {
      intro:
        "التقط أو ارفع صورة لوجبتك. يتعرّف Gemini على كل مكونات الطبق لمراجعتها قبل الحفظ.",
      uploadButton: "التقاط أو رفع صورة للوجبة",
      uploadHint: "JPEG أو PNG أو WebP أو GIF أو HEIC حتى 10 MB",
      previewAlt: "معاينة صورة الوجبة المرفوعة",
      changePhoto: "تغيير الصورة",
      removePhoto: "إزالة",
      notesLabel: "ملاحظة اختيارية للكمية",
      notesPlaceholder: "مثال: زيت زيتون إضافي أو 200 غ لحم",
      analyze: "تحليل الصورة",
      analyzing: "جارٍ تحليل الصورة...",
      spinner: "جارٍ التعرف على الأطعمة في الصورة عبر Gemini...",
      unsupportedTypeError:
        "صيغة الصورة غير مدعومة. اختر JPEG أو PNG أو WebP أو GIF أو HEIC.",
      emptyFileError: "ملف الصورة المختار فارغ.",
      tooLargeError: "يجب أن يكون حجم الصورة 10 MB أو أقل.",
      missingFileError: "اختر أو التقط صورة لوجبتك أولًا.",
      noFoodsError:
        "لم يتم التعرف على أطعمة في الصورة. جرّب زاوية أوضح وإضاءة أفضل.",
    },
    aiReview: {
      eyebrow: "مراجعة الأصناف المقدّرة",
      selectedSubtotal: "المجموع المحدد:",
      discard: "تجاهل",
      saving: "جارٍ الحفظ...",
      addSingle: (meal) => `إضافة إلى ${meal}`,
      addMultiple: (count, meal) => `إضافة ${count} أصناف إلى ${meal}`,
      errors: {
        network: "تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مجددًا.",
        missingKey:
          "مفتاح Gemini API مفقود أو غير صالح على الخادم. راجع ملف .env.",
        badInput: "تحقق من البيانات المدخلة وحاول مجددًا.",
        upstream:
          "تعذر تحليل الوجبة عبر Gemini. جرّب إعادة الصياغة أو استخدام صورة أوضح.",
        generic: "حدث خطأ أثناء تحليل الوجبة. حاول مجددًا.",
      },
    },
    foodLog: {
      sectionLabel: "سجل الطعام اليومي",
      title: "وجبات اليوم",
      subtitle: "مرتبة حسب الوجبة ومحفوظة تلقائيًا على هذا الجهاز.",
      entryCount: (count) => `${count} ${count === 1 ? "صنف" : "أصناف"}`,
      loadingLabel: "جارٍ تحميل سجل الطعام",
      emptyTitle: "ابدأ تسجيل وجباتك لليوم",
      emptySubtitle:
        "أضف من القائمة السريعة، أو صف وجبتك نصيًا، أو ارفع صورة لطبقك.",
      logMeal: (meal) => `تسجيل ${meal}`,
      emptyMealRow: (meal) => `لا توجد أصناف مسجلة في ${meal} بعد`,
      selectedMeal: "محدد",
      addToMeal: (meal) => `إضافة إلى ${meal}`,
      aiEstimate: "تقدير ذكي",
      remove: "حذف",
      removing: "جارٍ الحذف...",
      removeAria: (foodName) => `حذف ${foodName}`,
    },
    toasts: {
      addedSingle: (meal) => `تمت الإضافة إلى ${meal}`,
      addedMultiple: (count, meal) => `تمت إضافة ${count} أصناف إلى ${meal}`,
      removedEntry: "تم حذف الصنف",
      goalUpdated: (goal) => `تم تحديث الهدف اليومي إلى ${goal} سعرة`,
    },
    errors: {
      loadFailed: "تعذر تحميل بيانات التغذية. أعد تحميل الصفحة للمحاولة.",
      addFailed: "تعذر إضافة الصنف.",
      saveAiFailed: "تعذر حفظ تقديرات الذكاء الاصطناعي.",
      deleteFailed: "تعذر حذف الصنف.",
      refreshAfterDeleteFailed: "تم الحذف لكن تعذر تحديث القائمة.",
      goalFailed: "تعذر تحديث الهدف اليومي.",
      dismiss: "إغلاق",
    },
  },
};

export interface FoodTranslation {
  name: string;
  servingSize: string;
}

export const FOOD_TRANSLATIONS: Record<
  string,
  Record<"es" | "ar", FoodTranslation>
> = {
  "Chicken Breast (grilled)": {
    es: { name: "Pechuga de pollo (a la plancha)", servingSize: "100 g" },
    ar: { name: "صدر دجاج (مشوي)", servingSize: "100 غ" },
  },
  "White Rice (cooked)": {
    es: { name: "Arroz blanco (cocido)", servingSize: "1 taza (158 g)" },
    ar: { name: "أرز أبيض (مطبوخ)", servingSize: "كوب واحد (158 غ)" },
  },
  "Brown Rice (cooked)": {
    es: { name: "Arroz integral (cocido)", servingSize: "1 taza (195 g)" },
    ar: { name: "أرز بني (مطبوخ)", servingSize: "كوب واحد (195 غ)" },
  },
  "Whole Egg (large)": {
    es: { name: "Huevo entero (grande)", servingSize: "1 grande (50 g)" },
    ar: { name: "بيضة كاملة (كبيرة)", servingSize: "1 حبة كبيرة (50 غ)" },
  },
  "Egg Whites": {
    es: { name: "Claras de huevo", servingSize: "3 grandes (99 g)" },
    ar: { name: "بياض البيض", servingSize: "3 حبات كبيرة (99 غ)" },
  },
  Banana: {
    es: { name: "Plátano", servingSize: "1 mediano (118 g)" },
    ar: { name: "موز", servingSize: "1 حبة متوسطة (118 غ)" },
  },
  Apple: {
    es: { name: "Manzana", servingSize: "1 mediana (182 g)" },
    ar: { name: "تفاح", servingSize: "1 حبة متوسطة (182 غ)" },
  },
  "Rolled Oats (dry)": {
    es: { name: "Avena en hojuelas (seca)", servingSize: "1/2 taza (40 g)" },
    ar: { name: "شوفان كامل (جاف)", servingSize: "1/2 كوب (40 غ)" },
  },
  "Greek Yogurt (nonfat, plain)": {
    es: {
      name: "Yogur griego (descremado, natural)",
      servingSize: "Envase de 170 g",
    },
    ar: {
      name: "زبادي يوناني (خالي الدسم، سادة)",
      servingSize: "عبوة 170 غ",
    },
  },
  "Atlantic Salmon (cooked)": {
    es: { name: "Salmón del Atlántico (cocido)", servingSize: "100 g" },
    ar: { name: "سلمون أطلسي (مطبوخ)", servingSize: "100 غ" },
  },
  Avocado: {
    es: { name: "Aguacate", servingSize: "1/2 mediano (75 g)" },
    ar: { name: "أفوكادو", servingSize: "1/2 حبة متوسطة (75 غ)" },
  },
  Almonds: {
    es: { name: "Almendras", servingSize: "28 g (aprox. 23 piezas)" },
    ar: { name: "لوز", servingSize: "28 غ (نحو 23 حبة)" },
  },
  "Broccoli (steamed)": {
    es: { name: "Brócoli (al vapor)", servingSize: "1 taza (156 g)" },
    ar: { name: "بروكلي (على البخار)", servingSize: "كوب واحد (156 غ)" },
  },
  "Sweet Potato (baked)": {
    es: { name: "Camote / Batata (horneada)", servingSize: "1 mediana (114 g)" },
    ar: { name: "بطاطا حلوة (مشوية)", servingSize: "1 حبة متوسطة (114 غ)" },
  },
  "Whole Wheat Bread": {
    es: { name: "Pan integral", servingSize: "1 rebanada (28 g)" },
    ar: { name: "خبز قمح كامل", servingSize: "شريحة واحدة (28 غ)" },
  },
  "Peanut Butter": {
    es: { name: "Mantequilla de maní", servingSize: "2 cdas (32 g)" },
    ar: { name: "زبدة الفول السوداني", servingSize: "ملعقتان كبيرتان (32 غ)" },
  },
  "Whole Milk": {
    es: { name: "Leche entera", servingSize: "1 taza (244 g)" },
    ar: { name: "حليب كامل الدسم", servingSize: "كوب واحد (244 غ)" },
  },
  "Whey Protein Powder": {
    es: { name: "Proteína de suero en polvo", servingSize: "1 scoop (30 g)" },
    ar: { name: "مسحوق بروتين مصل اللبن", servingSize: "مكيال واحد (30 غ)" },
  },
  "Olive Oil": {
    es: { name: "Aceite de oliva", servingSize: "1 cda (14 g)" },
    ar: { name: "زيت زيتون", servingSize: "ملعقة كبيرة (14 غ)" },
  },
  "Lean Ground Beef (90/10, cooked)": {
    es: { name: "Carne molida magra (90/10, cocida)", servingSize: "100 g" },
    ar: { name: "لحم بقري مفروم قليل الدسم (90/10)", servingSize: "100 غ" },
  },
  "Canned Tuna (in water)": {
    es: { name: "Atún enlatado (en agua)", servingSize: "100 g escurrido" },
    ar: { name: "تونة معلبة (في الماء)", servingSize: "100 غ مصفى" },
  },
  "Cottage Cheese (low-fat)": {
    es: { name: "Queso cottage (bajo en grasa)", servingSize: "1/2 taza (113 g)" },
    ar: { name: "جبن قريش (قليل الدسم)", servingSize: "1/2 كوب (113 غ)" },
  },
  "Pasta (cooked)": {
    es: { name: "Pasta (cocida)", servingSize: "1 taza (140 g)" },
    ar: { name: "معكرونة (مطبوخة)", servingSize: "كوب واحد (140 غ)" },
  },
  Blueberries: {
    es: { name: "Arándanos azules", servingSize: "1 taza (148 g)" },
    ar: { name: "توت أزرق", servingSize: "كوب واحد (148 غ)" },
  },
};

export function localizeFoodItem(
  food: Pick<FoodItem, "name" | "servingSize">,
  locale: Locale
): FoodTranslation {
  if (locale === "en") {
    return { name: food.name, servingSize: food.servingSize };
  }
  const translated = FOOD_TRANSLATIONS[food.name]?.[locale];
  return translated ?? { name: food.name, servingSize: food.servingSize };
}

export function localizeLoggedFood(
  foodName: string,
  servingSize: string,
  foodId: number | null,
  locale: Locale
): FoodTranslation {
  if (foodId === null || locale === "en") {
    return { name: foodName, servingSize };
  }
  const translated = FOOD_TRANSLATIONS[foodName]?.[locale];
  return translated ?? { name: foodName, servingSize };
}

export function matchesFoodSearch(
  food: Pick<FoodItem, "name">,
  query: string,
  locale: Locale
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  if (food.name.toLowerCase().includes(normalized)) {
    return true;
  }

  if (locale !== "en") {
    const translatedName =
      FOOD_TRANSLATIONS[food.name]?.[locale]?.name.toLowerCase() ?? "";
    if (translatedName.includes(normalized)) {
      return true;
    }
  }

  return false;
}
