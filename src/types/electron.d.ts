export interface IElectronAPI {
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    isMaximized: () => Promise<boolean>;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI
    }
}