export interface IElectronAPI {
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    isMaximized: () => Promise<boolean>;
    setTaskbarProgress: (progress: number, mode?: 'normal' | 'paused') => Promise<boolean>;
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
        search: (pluginId: string, query: string, page: number, limit: number) => Promise<any>;
        getLyric: (pluginId: string, id: string) => Promise<any>;
        getPlaylist: (pluginId: string, id: string, page?: number, limit?: number) => Promise<AppPlaylist>;
        getAlbum: (pluginId: string, id: string, page?: number, limit?: number) => Promise<AppPlaylist>;
        getAll: () => Promise<any[]>;
        uninstall: (pluginId: string) => Promise<boolean>;
        install: () => Promise<{ success: boolean; message: string }>;
        onChanged: (callback: (change: { action: string; pluginId?: string }) => void) => () => void;
    };
    auth: {
        getState: () => Promise<AuthState>;
        getAccessToken: () => Promise<string>;
        login: (forcePrompt?: boolean) => Promise<{ success: boolean; url: string }>;
        qrCreate: () => Promise<QrLoginSession>;
        qrPoll: (sessionId: string, pollToken: string) => Promise<QrLoginPollResult>;
        qrCancel: (sessionId: string, pollToken: string) => Promise<{ status: string; message?: string }>;
        refresh: () => Promise<AuthState>;
        logout: () => Promise<AuthState>;
        onChanged: (callback: (payload: { status: string; message?: string; state: AuthState }) => void) => () => void;
    };
    listenTogether: {
        getWsUrl: (params: Record<string, string>) => Promise<string>;
    };
    heartbeat: {
        sendPc: (duration: number, timestamp?: number) => Promise<any>;
    };
    stats: {
        getListenTime: (detail?: number, userId?: string) => Promise<ListenTimeStat>;
        getListenRange: (start: string, end: string, userId?: string) => Promise<ListenTimeRange>;
        getListenRank: (period?: ListenRankPeriod, limit?: number) => Promise<ListenRankResponse>;
    };
    playlist: {
        list: () => Promise<{ local: AppPlaylist[]; cloud: AppPlaylist[]; items: AppPlaylist[] }>;
        publicList: (search?: string, sort?: string, page?: number, limit?: number) => Promise<{ items: AppPlaylist[]; total: number; page: number; limit: number; sort: string }>;
        get: (scope: ManagedPlaylistScope, id: string) => Promise<AppPlaylist>;
        create: (scope: ManagedPlaylistScope, data: { name: string; desc?: string; is_public?: boolean }) => Promise<AppPlaylist>;
        update: (scope: ManagedPlaylistScope, id: string, info: Partial<PlaylistInfo>) => Promise<AppPlaylist>;
        delete: (scope: ManagedPlaylistScope, id: string) => Promise<{ success: boolean }>;
        addSong: (scope: ManagedPlaylistScope, id: string, song: any, index?: number) => Promise<AppPlaylist>;
        removeSong: (scope: ManagedPlaylistScope, id: string, index: number) => Promise<AppPlaylist>;
        export: (scope: ManagedPlaylistScope, id: string) => Promise<{ success: boolean; canceled?: boolean; path?: string }>;
        import: () => Promise<{ success: boolean; canceled?: boolean; playlist?: AppPlaylist }>;
        convertScope: (scope: ManagedPlaylistScope, id: string, targetScope: ManagedPlaylistScope) => Promise<AppPlaylist>;
        copyToLocal: (scope: ManagedPlaylistScope, id: string) => Promise<AppPlaylist>;
    };
    image: {
        selectAndUpload: () => Promise<{ success: boolean; canceled?: boolean; url?: string; message?: string }>;
    };
    privacy: {
        getLibrary: () => Promise<{ status: string; allow_public_library: boolean; allow_public_profile: boolean }>;
        setLibrary: (payload: { allow_public_library?: boolean; allow_public_profile?: boolean }) => Promise<{ status: string; allow_public_library: boolean; allow_public_profile: boolean }>;
    };
    user: {
        getProfile: (userId: string) => Promise<UserInfo>;
        getPlaylists: (userId: string) => Promise<PlaylistInfo[]>;
        getFavSongs: (userId: string) => Promise<any[]>;
        updateProfile: (payload: Partial<UserInfo>) => Promise<UserInfo>;
    };
    // Cache Control
    getCacheInfo: () => Promise<{ path: string; size: string; persistCache: boolean }>;
    setCachePersist: (persist: boolean) => Promise<void>;
    openCacheFolder: () => Promise<void>;
    clearCache: () => Promise<void>;
    changeCacheLocation: (newPath: string) => Promise<{ success: boolean; message: string; path?: string }>;
    selectDirectory: () => Promise<string | null>;
    selectDirectories: () => Promise<string[]>;
    localMusic: {
        getLibrary: () => Promise<LocalMusicLibrary>;
        scan: (roots: string[]) => Promise<LocalMusicLibrary>;
        setRoots: (roots: string[]) => Promise<LocalMusicLibrary>;
        remove: (id: string) => Promise<LocalMusicLibrary>;
        clearMissing: () => Promise<LocalMusicLibrary>;
    };
    // Settings
    settings: {
        getAll: () => Promise<{ persistCache: boolean; theme: 'dark' | 'light'; accentColor: string; playlistPagingMode: 'infinite' | 'pagination'; openPlayerOnSongClick: boolean }>;
        set: (settings: Partial<{ persistCache: boolean; theme: 'dark' | 'light'; accentColor: string; playlistPagingMode: 'infinite' | 'pagination'; openPlayerOnSongClick: boolean }>) => Promise<any>;
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

export interface UserInfo {
    id: string;
    username: string;
    avatar?: string | null;
    nickname?: string | null;
    gender?: string | null;
    region?: string | null;
    intro?: string | null;
    birthday?: string | null;
    subscribing?: boolean;
}

export interface AuthState {
    accessToken: string;
    refreshToken: string;
    exp: number;
    userInfo: UserInfo | null;
}

export interface QrLoginSession {
    status: string;
    session_id: string;
    poll_token: string;
    qr_payload: string;
    qr_data_url: string;
    expires_at: number;
    expires_in: number;
    message?: string;
}

export interface QrLoginPollResult {
    status: 'pending' | 'scanned' | 'success' | 'expired' | 'cancelled' | 'error' | string;
    message?: string;
    device_name?: string;
    expires_at?: number;
    state?: AuthState;
}

export type PlaylistScope = 'local' | 'cloud' | 'plugin';
export type ManagedPlaylistScope = 'local' | 'cloud';

export interface PlaylistInfo {
    id: string;
    name: string;
    desc: string;
    img: string;
    cover_mode?: 'auto' | 'custom' | string;
    author?: string;
    play_count?: string;
    visit_count?: number;
    is_public?: boolean;
}

export interface AppPlaylist {
    id: string;
    scope: PlaylistScope;
    source: string;
    kind?: 'playlist' | 'album';
    info: PlaylistInfo;
    list: any[];
    total: number;
}

export interface LocalSong {
    id: string;
    path: string;
    name: string;
    artist: string;
    albumName: string;
    duration: string;
    durationSeconds: number;
    source: 'local';
    type: 'Local';
    url: string;
    picUrl: string;
    lyric: string;
    quality: string;
    bitrate: number;
    sampleRate: number;
    channels: number;
    size: number;
    modifiedAt: number;
    addedAt: number;
}

export interface LocalMusicLibrary {
    roots: string[];
    songs: LocalSong[];
    updatedAt: number;
}

export interface ListenTimePoint {
    time?: string;
    date?: string;
    duration: number;
}

export interface ListenTimeStat {
    status: 'success' | 'error';
    msg?: string;
    total?: number;
    android_time?: number;
    pc_time?: number;
    chart_data?: {
        daily?: ListenTimePoint[];
        weekly?: ListenTimePoint[];
        monthly?: ListenTimePoint[];
        yearly?: ListenTimePoint[];
    };
}

export interface ListenTimeRange {
    status: 'success' | 'error';
    msg?: string;
    data: Array<{ date: string; duration: number }>;
}

export type ListenRankPeriod = 'week' | 'month' | 'year';

export interface ListenRankUser {
    id: string;
    username: string;
    nickname: string;
    avatar?: string | null;
}

export interface ListenRankItem {
    rank: number;
    duration: number;
    user: ListenRankUser;
}

export interface ListenRankResponse {
    status: 'success' | 'error';
    period: ListenRankPeriod;
    msg?: string;
    data: ListenRankItem[];
}
