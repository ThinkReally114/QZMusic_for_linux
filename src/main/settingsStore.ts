import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface AppSettings {
    // Cache
    persistCache: boolean;
    cachePath: string; // [NEW] Custom cache path
    // Appearance
    theme: 'dark' | 'light';
    accentColor: string;
    // Playlist
    playlistPagingMode: 'infinite' | 'pagination';
    openPlayerOnSongClick: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    persistCache: true,
    cachePath: path.join(app.getPath('userData'), 'cache'), // Default
    theme: 'light',
    accentColor: '#8289d3',
    playlistPagingMode: 'infinite',
    openPlayerOnSongClick: false,
};

let settingsCache: AppSettings | null = null;

function getSettingsPath(): string {
    return path.join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
    if (settingsCache) return settingsCache;

    const settingsPath = getSettingsPath();
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            settingsCache = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
            console.log('[Settings] Loaded from disk:', settingsCache);
            return settingsCache!;
        }
    } catch (e) {
        console.error('[Settings] Failed to load settings:', e);
    }

    settingsCache = { ...DEFAULT_SETTINGS };
    return settingsCache;
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
    settingsCache = { ...loadSettings(), ...settings };

    const settingsPath = getSettingsPath();
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settingsCache, null, 2));
        console.log('[Settings] Saved to disk:', settingsCache);
    } catch (e) {
        console.error('[Settings] Failed to save settings:', e);
    }

    return settingsCache;
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return loadSettings()[key];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    saveSettings({ [key]: value });
}
