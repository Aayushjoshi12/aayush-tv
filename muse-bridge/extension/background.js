// Clicking the toolbar icon opens the side panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("Muse Bridge: sidePanel setup failed", err));
