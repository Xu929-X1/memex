export type UserActionType = "HIGHLIGHT" | ""

export interface TabSession {
    tabId: number,
    url: string,
    title: string,
    startedAt: number,
    activeDwell: number,
    scrollDepth: number,
    lastActiveAt: number,
    isIdle: boolean
}

export default defineUnlistedScript(() => {

});