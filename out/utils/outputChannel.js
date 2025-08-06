"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOutputChannel = void 0;
// Create a completely silent output channel that does absolutely nothing
const createSilentOutputChannel = (name) => ({
    name,
    append: () => { },
    appendLine: () => { },
    clear: () => { },
    show: () => { },
    hide: () => { },
    replace: () => { },
    dispose: () => { }
});
// Create output channel - DISABLED for time logging
const createOutputChannel = (name) => {
    // Output channels are completely disabled for time logging
    return createSilentOutputChannel(name);
};
exports.createOutputChannel = createOutputChannel;
//# sourceMappingURL=outputChannel.js.map