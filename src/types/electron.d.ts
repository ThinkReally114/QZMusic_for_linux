export interface IElectronAPI {
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    isMaximized: () => Promise<boolean>;
    mpv: {
        load: (url: string) => Promise<void>;
        play: () => Promise<void>;
        pause: () => Promise<void>;
        togglePause: () => Promise<void>;
        stop: () => Promise<void>;
        setVolume: (vol: number) => Promise<void>;
        seek: (time: number) => Promise<void>;
        onEvent: (callback: (event: any, data: any) => void) => void;
    }
}

declare global {
    interface Window {
        electronAPI: IElectronAPI
    }
}