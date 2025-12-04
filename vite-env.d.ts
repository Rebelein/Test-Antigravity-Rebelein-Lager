/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register/react' {
    import type { Dispatch, SetStateAction } from 'react'
    import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

    export interface RegisterSWHookReturn {
        offlineReady: [boolean, Dispatch<SetStateAction<boolean>>]
        needRefresh: [boolean, Dispatch<SetStateAction<boolean>>]
        updateServiceWorker: (reloadPage?: boolean) => Promise<void>
    }

    export function useRegisterSW(options?: RegisterSWOptions): RegisterSWHookReturn
}
