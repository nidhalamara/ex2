(function () {
  if (window.__fiabiloLocationScraperLoaded) {
    return;
  }

  window.__fiabiloLocationScraperLoaded = true;

  const LOAD_WAIT_MS = 2000;
  const DISCOVERY_TIMEOUT_MS = 20000;
  const OPTION_TIMEOUT_MS = 10000;
  const POLL_INTERVAL_MS = 300;

  const state = {
    autoStarted: false,
    running: false
  };

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalizeText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function formatTimestamp(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") + "_" + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join("-");
  }

  function isVisible(element) {
    if (!element) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function isPlaceholderOption(option, index) {
    const label = normalizeText(option?.textContent);
    const value = String(option?.value ?? "").trim();

    if (!label || option?.disabled) {
      return true;
    }

    if (/^(choisir|selectionner|selectionnez|veuillez|select)/.test(label)) {
      return true;
    }

    if (/^[-.]+$/.test(label)) {
      return true;
    }

    if (index === 0 && !value) {
      return true;
    }

    return false;
  }

  function extractOptions(select) {
    return Array.from(select?.options || [])
      .map((option, index) => ({ option, index }))
      .filter(({ option, index }) => !isPlaceholderOption(option, index))
      .map((option) => ({
        index: option.index,
        value: String(option.option.value).trim(),
        label: option.option.textContent.trim()
      }));
  }

  function buildOptionSignature(select) {
    return extractOptions(select)
      .map((option) => `${option.value}::${option.label}`)
      .join("|");
  }

  function getStatusElement() {
    let status = document.getElementById("fiabilo-location-scraper-status");

    if (!status) {
      status = document.createElement("div");
      status.id = "fiabilo-location-scraper-status";
      status.style.position = "fixed";
      status.style.top = "16px";
      status.style.right = "16px";
      status.style.zIndex = "2147483647";
      status.style.maxWidth = "360px";
      status.style.padding = "12px 14px";
      status.style.borderRadius = "10px";
      status.style.background = "rgba(14, 25, 43, 0.92)";
      status.style.color = "#ffffff";
      status.style.font = "13px/1.45 Arial, sans-serif";
      status.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.25)";
      status.style.whiteSpace = "pre-wrap";
      document.body.appendChild(status);
    }

    return status;
  }

  function activateDropdown(select) {
    if (!select) {
      return;
    }

    try {
      select.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
    } catch (error) {
      select.scrollIntoView();
    }

    select.focus();

    const eventNames = ["pointerdown", "mousedown", "mouseup", "click"];
    for (const eventName of eventNames) {
      try {
        select.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
      } catch (error) {
        console.debug(`Could not dispatch ${eventName} on dropdown.`, error);
      }
    }
  }

  function updateStatus(message, tone) {
    const status = getStatusElement();
    const colors = {
      info: "rgba(14, 25, 43, 0.92)",
      success: "rgba(20, 83, 45, 0.95)",
      error: "rgba(127, 29, 29, 0.95)"
    };

    status.style.background = colors[tone] || colors.info;
    status.textContent = message;
  }

  function downloadJson(payload) {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = `fiabilo_locations_${formatTimestamp(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }

  function findSelectByLabel(labelText) {
    const expected = normalizeText(labelText);
    const labels = Array.from(document.querySelectorAll("label"));

    for (const label of labels) {
      if (!normalizeText(label.textContent).includes(expected)) {
        continue;
      }

      if (label.htmlFor) {
        const linked = document.getElementById(label.htmlFor);
        if (linked?.tagName === "SELECT") {
          return linked;
        }
      }

      let current = label.parentElement;
      while (current && current !== document.body) {
        const scopedSelects = Array.from(current.querySelectorAll("select")).filter(isVisible);
        if (scopedSelects.length === 1) {
          return scopedSelects[0];
        }
        current = current.parentElement;
      }

      let sibling = label.nextElementSibling;
      while (sibling) {
        if (sibling.matches?.("select")) {
          return sibling;
        }

        const nestedSelect = sibling.querySelector?.("select");
        if (nestedSelect) {
          return nestedSelect;
        }

        sibling = sibling.nextElementSibling;
      }
    }

    return null;
  }

  function resolveDropdowns() {
    const gouvernorat = findSelectByLabel("gouvernorat");
    const ville = findSelectByLabel("ville");
    const localite = findSelectByLabel("localite");

    if (gouvernorat && ville && localite) {
      return { gouvernorat, ville, localite };
    }

    const visibleSelects = Array.from(document.querySelectorAll("select")).filter(isVisible);

    if (visibleSelects.length >= 3) {
      return {
        gouvernorat: gouvernorat || visibleSelects[0],
        ville: ville || visibleSelects[1],
        localite: localite || visibleSelects[2]
      };
    }

    return null;
  }

  async function waitForDropdowns() {
    const startedAt = Date.now();

    while (Date.now() - startedAt < DISCOVERY_TIMEOUT_MS) {
      const dropdowns = resolveDropdowns();
      if (dropdowns) {
        return dropdowns;
      }
      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error("Could not find the gouvernorat, ville, and localite dropdowns on the page.");
  }

  function selectOption(select, optionData) {
    activateDropdown(select);

    let option = select.options?.[optionData.index];

    if (!option || option.textContent.trim() !== optionData.label) {
      option = Array.from(select.options).find((item) => {
        return item.textContent.trim() === optionData.label && String(item.value).trim() === optionData.value;
      });
    }

    if (!option) {
      throw new Error(`Could not find option "${optionData.label}" in the dropdown.`);
    }

    select.selectedIndex = option.index;
    option.selected = true;
    select.value = option.value;

    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function waitForUpdatedOptions(select, previousSignature) {
    activateDropdown(select);
    await sleep(LOAD_WAIT_MS);

    const startedAt = Date.now();
    while (Date.now() - startedAt < OPTION_TIMEOUT_MS) {
      activateDropdown(select);
      const options = extractOptions(select);
      const nextSignature = buildOptionSignature(select);

      if (!previousSignature && options.length > 0) {
        return options;
      }

      if (previousSignature && nextSignature !== previousSignature && options.length > 0) {
        return options;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    return extractOptions(select);
  }

  async function scrapeTree() {
    const dropdowns = await waitForDropdowns();
    const gouvernoratOptions = extractOptions(dropdowns.gouvernorat);
    const gouvernorats = [];

    if (!gouvernoratOptions.length) {
      throw new Error("The gouvernorat dropdown was found, but it has no selectable options.");
    }

    for (let i = 0; i < gouvernoratOptions.length; i += 1) {
      const gouvernoratOption = gouvernoratOptions[i];
      updateStatus(
        `Gouvernorat ${i + 1}/${gouvernoratOptions.length}\n${gouvernoratOption.label}\nLoading villes...`,
        "info"
      );

      const previousVilleSignature = buildOptionSignature(dropdowns.ville);
      selectOption(dropdowns.gouvernorat, gouvernoratOption);
      const villeOptions = await waitForUpdatedOptions(dropdowns.ville, previousVilleSignature);
      const villes = [];

      for (let j = 0; j < villeOptions.length; j += 1) {
        const villeOption = villeOptions[j];
        updateStatus(
          `Gouvernorat ${i + 1}/${gouvernoratOptions.length}: ${gouvernoratOption.label}\nVille ${j + 1}/${villeOptions.length}: ${villeOption.label}\nLoading localites...`,
          "info"
        );

        const previousLocaliteSignature = buildOptionSignature(dropdowns.localite);
        selectOption(dropdowns.ville, villeOption);
        const localiteOptions = await waitForUpdatedOptions(dropdowns.localite, previousLocaliteSignature);

        villes.push({
          label: villeOption.label,
          value: villeOption.value,
          localites: localiteOptions
        });
      }

      gouvernorats.push({
        label: gouvernoratOption.label,
        value: gouvernoratOption.value,
        villes
      });
    }

    return {
      scrapedAt: new Date().toISOString(),
      sourceUrl: window.location.href,
      gouvernorats
    };
  }

  async function startScrape(source) {
    if (state.running) {
      updateStatus("The scraper is already running on this page.", "info");
      return;
    }

    if (source === "auto" && state.autoStarted) {
      return;
    }

    state.autoStarted = state.autoStarted || source === "auto";
    state.running = true;

    try {
      updateStatus("Looking for the dropdowns...", "info");
      const payload = await scrapeTree();
      downloadJson(payload);
      updateStatus(
        `Finished.\n${payload.gouvernorats.length} gouvernorats collected.\nThe JSON file was downloaded to your browser.`,
        "success"
      );
    } catch (error) {
      console.error("Fiabilo scraper failed:", error);
      updateStatus(`Scrape failed.\n${error.message}`, "error");
    } finally {
      state.running = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "START_SCRAPE") {
      startScrape("manual");
      sendResponse({ ok: true });
    }
  });

  window.setTimeout(() => {
    startScrape("auto");
  }, 800);
})();
