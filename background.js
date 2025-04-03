let refreshCounts = {};
let activeRefreshes = new Set();
let nextRefreshTimes = {};  // Add this line
let minimumMinutes = 10;
let maximumMinutes = 20;

function getRandomRefreshTime() {
    return Math.random() * (maximumMinutes - minimumMinutes) + minimumMinutes;
}

function startRefreshing(tabId) {
    stopRefreshing(tabId);
    refreshCounts[tabId] = refreshCounts[tabId] || 0;
    activeRefreshes.add(tabId);
    
    const periodInMinutes = getRandomRefreshTime();
    const nextRefreshTime = Date.now() + (periodInMinutes * 60 * 1000);
    nextRefreshTimes[tabId] = nextRefreshTime;
    
    chrome.alarms.create(`refresh-${tabId}`, {
        delayInMinutes: periodInMinutes
    });
    console.log(`Tab ${tabId} will refresh in ${periodInMinutes} minutes`);
}

function stopRefreshing(tabId) {
    chrome.alarms.clear(`refresh-${tabId}`);
    activeRefreshes.delete(tabId);
    delete refreshCounts[tabId];
    delete nextRefreshTimes[tabId];  // Clean up refresh time
}

chrome.alarms.onAlarm.addListener((alarm) => {
    const match = alarm.name.match(/^refresh-(\d+)$/);
    if (match) {
        const tabId = parseInt(match[1], 10);
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                stopRefreshing(tabId);
                return;
            }
            
            // Perform the refresh
            chrome.tabs.reload(tabId);
            refreshCounts[tabId] = (refreshCounts[tabId] || 0) + 1;
            
            // Calculate and store next refresh time
            const newPeriod = getRandomRefreshTime();
            const nextRefreshTime = Date.now() + (newPeriod * 60 * 1000);
            nextRefreshTimes[tabId] = nextRefreshTime;

            // Create new alarm for next refresh
            chrome.alarms.create(`refresh-${tabId}`, {
                delayInMinutes: newPeriod
            });
            
            console.log(`Tab ${tabId} refreshed. Count: ${refreshCounts[tabId]}. Next refresh in ${newPeriod} minutes`);
        });
    }
});

// Update the message listener to include next refresh time
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received message:", request);
    if (request.action === "startRefreshing" && request.tabId) {
        console.log(`Starting refresh for tab ${request.tabId}`);
        startRefreshing(request.tabId);
        sendResponse({ success: true });
    } else if (request.action === "stopRefreshing" && request.tabId) {
        console.log(`Stopping refresh for tab ${request.tabId}`);
        stopRefreshing(request.tabId);
        sendResponse({ success: true });
    } else if (request.action === "getStatus" && request.tabId) {
        console.log(`Getting status for tab ${request.tabId}`);
        sendResponse({
            isRefreshing: activeRefreshes.has(request.tabId),
            refreshCount: refreshCounts[request.tabId] || 0,
            nextRefreshTime: nextRefreshTimes[request.tabId] || null
        });
    } else {
        console.error("Unknown action or missing tabId:", request);
        sendResponse({ success: false, error: "Invalid request" });
    }
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    stopRefreshing(tabId);
});

// Ensure service worker stays alive for debugging
chrome.runtime.onInstalled.addListener(() => {
    console.log("Background service worker installed.");
});

chrome.runtime.onStartup.addListener(() => {
    console.log("Background service worker started.");
});