import { spawn, ChildProcess } from 'child_process';
import { Socket } from 'net';
import { EventEmitter } from 'events';
import path from 'path';

export class MpvController extends EventEmitter {
    private process: ChildProcess | null = null;
    private socket: Socket | null = null;
    private ipcPath: string;
    private messageBuffer: string = '';

    constructor(ipcPath?: string) {
        super();
        this.ipcPath = ipcPath || this.getIpcPath();
    }

    private getIpcPath(): string {
        if (process.platform === 'win32') {
            return '\\\\.\\pipe\\qzmusic_mpv_socket';
        }
        return '/tmp/qzmusic_mpv_socket';
    }

    private getMpvPath(): string {
        const appRoot = process.env.APP_ROOT || process.cwd();

        if (process.platform === 'win32') {
            return path.join(appRoot, 'core', 'mpv.exe');
        }
        // Darwin (Mac) or Linux
        // For now, assuming global mpv or a specific path in future
        return 'mpv';
    }

    start() {
        const mpvPath = this.getMpvPath();
        console.log('Starting MPV from:', mpvPath);

        this.process = spawn(mpvPath, [
            '--idle',
            '--force-window=no',
            '--no-media-controls',
            `--input-ipc-server=${this.ipcPath}`,
            '--no-terminal',
            // Network cache for smooth playback (disk caching is handled by proxy)
            '--cache=yes',
            '--demuxer-max-bytes=50MiB',
            '--demuxer-readahead-secs=30'
        ]);

        this.process.on('error', (err) => {
            console.error('Failed to start MPV:', err);
            this.emit('error', err);
        });

        this.process.on('exit', (code, signal) => {
            console.log(`MPV exited with code ${code} and signal ${signal}`);
            this.emit('exit', { code, signal });
            this.socket?.destroy();
        });

        this.tryConnect();
    }

    private tryConnect(retries = 10) {
        if (retries <= 0) {
            console.error('Could not connect to MPV socket after multiple attempts.');
            return;
        }

        setTimeout(() => {
            this.socket = new Socket();

            this.socket.on('connect', () => {
                console.log('Connected to MPV IPC socket');
                this.emit('ready');

                this.send(['observe_property', 1, 'pause']);
                this.send(['observe_property', 2, 'time-pos']);
                this.send(['observe_property', 3, 'duration']);
                this.send(['observe_property', 4, 'idle-active']);
                this.send(['observe_property', 5, 'eof-reached']);
            });

            this.socket.on('data', (data) => {
                this.handleData(data);
            });

            this.socket.on('error', (_) => {
                this.socket?.destroy();
                this.tryConnect(retries - 1);
            });

            this.socket.connect(this.ipcPath);
        }, 500);
    }

    private handleData(data: Buffer) {
        // Determine message boundaries by newline
        const raw = data.toString();
        // console.log('[MPV RX RAW]', raw.trim()); // Very noisy if enabled

        this.messageBuffer += raw;
        const messages = this.messageBuffer.split('\n');

        // The last part might be an incomplete message, save it back to buffer
        this.messageBuffer = messages.pop() || '';

        for (const msg of messages) {
            if (!msg.trim()) continue;
            console.log('[IPC]', msg); // User requested raw communication
            try {
                const json = JSON.parse(msg);
                this.emit('message', json);

                // Handle specific events
                if (json.event) {
                    this.emit('event', json);
                }
            } catch (e) {
                console.error('Failed to parse MPV message:', msg);
            }
        }
    }

    async send(command: any[]) {
        if (!this.socket || this.socket.destroyed) {
            console.warn('MPV socket not connected');
            return;
        }

        const payload = JSON.stringify({ command });
        console.log('[MPV TX]', payload); // User requested raw communication
        this.socket.write(payload + '\n');
    }

    // Convenience methods
    async load(url: string) {
        return this.send(['loadfile', url]);
    }

    async play() {
        return this.send(['set_property', 'pause', false]);
    }

    async pause() {
        return this.send(['set_property', 'pause', true]);
    }

    async togglePause() {
        return this.send(['cycle', 'pause']);
    }

    async stop() {
        return this.send(['stop']);
    }

    async setVolume(vol: number) {
        return this.send(['set_property', 'volume', vol]);
    }

    async seek(seconds: number) {
        return this.send(['seek', seconds, 'absolute']);
    }

    destroy() {
        if (this.process) {
            console.log('Killing MPV process...');
            this.process.kill();
            this.process = null;
        }
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
    }
}
