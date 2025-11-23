class I18n {
  static instance = null;

  constructor() {
    if (I18n.instance) {
      return I18n.instance;
    }

    this.translations = {};
    this.currentLanguage = null;
    this.defaultLanguage = "en";
    this.supportedLanguages = ["en", "da"];

    I18n.instance = this;
  }

  static getInstance() {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  async init(settings) {
    // Determine language: settings > browser > default
    let language = settings?.settings?.language;

    if (!language) {
      // Detect from browser
      const browserLang = navigator.language || navigator.userLanguage;
      language = browserLang.split("-")[0]; // Get 'en' from 'en-US'
    }

    // Fallback to default if not supported
    if (!this.supportedLanguages.includes(language)) {
      language = this.defaultLanguage;
    }

    await this.loadLanguage(language);
  }

  async loadLanguage(language) {
    try {
      const response = await fetch(`js/i18n/${language}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load language: ${language}`);
      }
      this.translations = await response.json();
      this.currentLanguage = language;

      // Update HTML lang attribute
      document.documentElement.lang = language;
    } catch (error) {
      console.error("Error loading language:", error);

      // Fallback to default language if current fails
      if (language !== this.defaultLanguage) {
        await this.loadLanguage(this.defaultLanguage);
      }
    }
  }

  t(key, replacements = {}) {
    // Support nested keys like 'settings.weatherProvider'
    const keys = key.split(".");
    let value = this.translations;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    // Replace placeholders like {{temp}} with actual values
    if (typeof value === "string") {
      return value.replace(/\{\{(\w+)\}\}/g, (match, placeholder) => {
        return replacements[placeholder] !== undefined
          ? replacements[placeholder]
          : match;
      });
    }

    return value;
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  getLanguageName(code) {
    const names = {
      en: "English",
      da: "Dansk",
    };
    return names[code] || code;
  }
}
