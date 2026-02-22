import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import ak from "./ak.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ak: { translation: ak },
  },
  lng: (typeof sessionStorage !== "undefined" && sessionStorage.getItem("boafo-language")) || "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: true,
  },
});

export default i18n;
