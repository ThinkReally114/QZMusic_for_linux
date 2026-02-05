export interface IElectronAPI {
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    isMaximized: () => Promise<boolean>;
    qzplayer: {
        load: (url: string) => Promise<void>;
        play: () => Promise<void>;
        pause: () => Promise<void>;
        togglePause: () => Promise<void>;
        stop: () => Promise<void>;
        setVolume: (vol: number) => Promise<void>;
        seek: (time: number) => Promise<void>;
        onEvent: (callback: (event: any, data: any) => void) => void;
    };
    plugin: {
        call: (pluginId: string, method: string, args: any[]) => Promise<any>;
    };
    // Cache Control
    getCacheInfo: () => Promise<{ path: string; size: string; persistCache: boolean }>;
    setCachePersist: (persist: boolean) => Promise<void>;
    openCacheFolder: () => Promise<void>;
    clearCache: () => Promise<void>;
    // Settings
    settings: {
        getAll: () => Promise<{ persistCache: boolean; theme: 'dark' | 'light'; accentColor: string }>;
        set: (settings: Partial<{ persistCache: boolean; theme: 'dark' | 'light'; accentColor: string }>) => Promise<any>;
        getTheme: () => Promise<'dark' | 'light'>;
        setTheme: (theme: 'dark' | 'light') => Promise<void>;
        getAccentColor: () => Promise<string>;
        setAccentColor: (color: string) => Promise<void>;
    };
}

declare global {
    interface Window {
        electronAPI: IElectronAPI
    }
}