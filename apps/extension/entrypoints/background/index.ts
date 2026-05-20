import { SYNC_SITE_MESSAGE } from "../popup/components/Settings";
import { getPreference } from "../popup/lib/api";
import { TabSession } from "../type";

export const SITE_TRACKING_KEY = "SITE_TRRCKING_KEY";
const sessions = new Map<number, TabSession>();

async function syncTrackedSite() {
    return await getPreference();
}

export default defineBackground(() => {
    browser.runtime.onMessage.addListener(async (msg) => {
        if (msg.type === SYNC_SITE_MESSAGE) {
            const userPreference = await syncTrackedSite();
            const trackedURLs = userPreference.trackAllActivities ? "*" : userPreference.trackURLs.join(",");
            browser.storage.local.set({
                trackedURLs
            });
        }
    });
    browser.tabs.onCreated.addListener((tab) => {
    });
});
