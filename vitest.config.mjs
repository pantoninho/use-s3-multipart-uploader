import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environmentMatchGlobs: [['tests/index.test.js', 'jsdom']],
    },
});
