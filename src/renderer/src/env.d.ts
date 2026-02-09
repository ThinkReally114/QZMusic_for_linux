/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />

declare module '*.svg' {
    import { Component } from 'vue';
    const content: Component;
    export default content;
}

declare module '*.svg?component' {
    import { Component } from 'vue';
    const content: Component;
    export default content;
}
