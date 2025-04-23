
test('chrome.scripting', () => {
    chrome.scripting.executeScript({
        target: { tabId: 1 },
        func: () => {}
    });
});