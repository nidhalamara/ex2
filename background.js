const TARGET_URL = "https://fiabilo.tn/expediteur/pickup.php";
const TARGET_PATTERN = /^https:\/\/(www\.)?fiabilo\.tn\/expediteur\/pickup\.php(?:[?#].*)?$/i;

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && tab.url && TARGET_PATTERN.test(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "START_SCRAPE" });
      return;
    } catch (error) {
      console.warn("Could not send START_SCRAPE to existing tab, opening a fresh tab.", error);
    }
  }

  await chrome.tabs.create({ url: TARGET_URL });
});
