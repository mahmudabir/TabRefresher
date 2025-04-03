document.addEventListener('DOMContentLoaded', function () {
    const toggleButton = document.getElementById('toggleRefresh');
    const statusDiv = document.getElementById('status');
    const countDiv = document.getElementById('count');
    const timerDiv = document.getElementById('timer');
    let isRefreshing = false;
    let refreshCount = 0;
    let activeTabId = null;
    let statusCheckInterval;
    let timerInterval;

    function startStatusChecks() {
        // Initial check
        updateStatus();
        // Check every second
        statusCheckInterval = setInterval(updateStatus, 1000);
    }

    function updateTimer(nextRefreshTime) {
        if (!nextRefreshTime || !isRefreshing) {
            timerDiv.textContent = 'Next refresh in: --:--';
            return;
        }

        const updateTimerText = () => {
            const now = Date.now();
            const timeLeft = Math.max(0, nextRefreshTime - now);
            
            if (timeLeft === 0) return;

            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            timerDiv.textContent = `Next refresh in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        updateTimerText();
        const timerInterval = setInterval(updateTimerText, 1000);
        return timerInterval;
    }

    function updateStatus() {
        if (activeTabId) {
            chrome.runtime.sendMessage({ action: "getStatus", tabId: activeTabId }, function (response) {
                if (chrome.runtime.lastError) {
                    console.error("Error getting status:", chrome.runtime.lastError.message);
                    return;
                }
                isRefreshing = response.isRefreshing;
                refreshCount = response.refreshCount;
                
                if (timerInterval) {
                    clearInterval(timerInterval);
                }
                timerInterval = updateTimer(response.nextRefreshTime);
                
                updateUI();
            });
        }
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            activeTabId = tabs[0].id;
            console.log(`Active tab ID: ${activeTabId}`);
            startStatusChecks();
        } else {
            console.error("No active tab found.");
        }
    });

    toggleButton.addEventListener('click', function () {
        if (!activeTabId) {
            console.error("No active tab found. Cannot start or stop refreshing.");
            return;
        }

        isRefreshing = !isRefreshing;
        updateUI();

        const action = isRefreshing ? "startRefreshing" : "stopRefreshing";
        console.log(`Sending ${action} message for tab ${activeTabId}`);
        chrome.runtime.sendMessage({ action, tabId: activeTabId }, function (response) {
            if (chrome.runtime.lastError) {
                console.error(`Error sending ${action} message:`, chrome.runtime.lastError.message);
            } else {
                console.log(`${action} response:`, response);
            }
        });
    });

    function updateUI() {
        if (isRefreshing) {
            toggleButton.textContent = "Stop Refreshing";
            toggleButton.style.backgroundColor = "#f44336";
            statusDiv.textContent = "Running random refresher";
        } else {
            toggleButton.textContent = "Start Refreshing";
            toggleButton.style.backgroundColor = "#4CAF50";
            statusDiv.textContent = "Not refreshing";
        }
        countDiv.textContent = `Refresh Count: ${refreshCount}`;
    }

    // Cleanup both intervals when popup closes
    window.addEventListener('unload', function() {
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }
        if (timerInterval) {
            clearInterval(timerInterval);
        }
    });
});