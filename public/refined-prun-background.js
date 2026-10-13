// Reloads the open game tabs after the extension is updated or reloaded.
// The old page loses its link to the extension and cannot save changes any more.
chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason !== 'update') {
    return;
  }
  const tabs = await chrome.tabs.query({ url: 'https://apex.prosperousuniverse.com/*' });
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      await chrome.tabs.reload(tab.id);
    }
  }
});
