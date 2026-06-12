export const KeyboardCommands = {
    advance: ['Enter', ' ', 'Space', 'Spacebar'],
    confirm: ['Enter'],
    pause: ['Escape', 'p', 'P'],
};

const matchesKey = (event, keys) => keys.includes(event.key);

const isTextInputTarget = (target) => {
    const tagName = target?.tagName?.toLowerCase?.();
    return tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;
};

export const bindKeyboardCommand = (scene, keys, callback, options = {}) => {
    if (!scene?.input?.keyboard) return () => {};

    const {
        allowWhenTyping = false,
        ignoreRepeat = true,
        preventDefault = true,
    } = options;

    const handler = (event) => {
        if (!matchesKey(event, keys)) return;
        if (ignoreRepeat && event.repeat) return;
        if (!allowWhenTyping && isTextInputTarget(event.target)) return;
        if (preventDefault && event.preventDefault) event.preventDefault();
        callback(event);
    };

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (scene?.input?.keyboard) {
            scene.input.keyboard.off('keydown', handler);
        }
        scene.events?.off?.('shutdown', cleanup);
        scene.events?.off?.('destroy', cleanup);
    };

    scene.input.keyboard.on('keydown', handler);
    scene.events?.once?.('shutdown', cleanup);
    scene.events?.once?.('destroy', cleanup);
    return cleanup;
};

export const bindDomKeyboardCommand = (keys, callback, options = {}) => {
    const {
        allowWhenTyping = false,
        ignoreRepeat = true,
        preventDefault = true,
    } = options;

    const handler = (event) => {
        if (!matchesKey(event, keys)) return;
        if (ignoreRepeat && event.repeat) return;
        if (!allowWhenTyping && isTextInputTarget(event.target)) return;
        if (preventDefault && event.preventDefault) event.preventDefault();
        callback(event);
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
};
