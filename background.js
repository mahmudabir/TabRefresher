let refreshCounts = {};
let activeRefreshes = new Set();
let nextRefreshTimes = {};
let endTimes = {}; // Store end times for each tab
let minimumMinutes = 5; // Default minimum refresh time
let maximumMinutes = 10; // Default maximum refresh time

function getRandomRefreshTime() {
    return Math.random() * (maximumMinutes - minimumMinutes) + minimumMinutes;
}

function startRefreshing(tabId, minTime, maxTime, endTime) {
    stopRefreshing(tabId);
    refreshCounts[tabId] = refreshCounts[tabId] || 0;
    activeRefreshes.add(tabId);
    
    // Update global min/max if provided
    if (minTime !== null && minTime !== undefined) {
        minimumMinutes = minTime;
    }
    if (maxTime !== null && maxTime !== undefined) {
        maximumMinutes = maxTime;
    }
    
    // Store end time if provided
    if (endTime) {
        endTimes[tabId] = endTime;
        console.log(`Tab ${tabId} will stop refreshing at ${endTime}`);
    } else {
        delete endTimes[tabId]; // No end time set
    }
    
    const periodInMinutes = getRandomRefreshTime();
    const nextRefreshTime = Date.now() + (periodInMinutes * 60 * 1000);
    nextRefreshTimes[tabId] = nextRefreshTime;
    
    chrome.alarms.create(`refresh-${tabId}`, {
        delayInMinutes: periodInMinutes
    });
    console.log(`Tab ${tabId} will refresh in ${periodInMinutes} minutes (range: ${minimumMinutes}-${maximumMinutes})`);
}

function stopRefreshing(tabId) {
    chrome.alarms.clear(`refresh-${tabId}`);
    activeRefreshes.delete(tabId);
    delete refreshCounts[tabId];
    delete nextRefreshTimes[tabId];  // Clean up refresh time
    delete endTimes[tabId];  // Clean up end time
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
            
            // Check if we've reached the end time
            if (endTimes[tabId]) {
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                
                const [endHours, endMinutes] = endTimes[tabId].split(':').map(Number);
                const endTime = endHours * 60 + endMinutes;
                
                if (currentTime >= endTime) {
                    console.log(`End time reached for tab ${tabId}. Stopping refreshes.`);
                    stopRefreshing(tabId);
                    return;
                }
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
        startRefreshing(request.tabId, request.minTime, request.maxTime, request.endTime);
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