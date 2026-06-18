'use client'
// Importing the module runs its side effect — registering the axios request
// interceptor on the default instance — in the browser, before any page fires
// a request. Rendering this once in the root layout guarantees that.
import "@/interceptors";

export function AxiosSetup() {
    return null;
}
