export const UIHelpers = {
    setGameCursor(scene) {
        if (!scene?.input) return;
        scene.__defaultCursor = 'url(assets/cursor-arrow.png), pointer';
        scene.__hoverCursor = 'url(assets/cursor-pointer.png), pointer';
        scene.input.setDefaultCursor(scene.__defaultCursor);
    },

    attachHoverPop(scene, target, volume = 0.4) {
        if (!target?.on) return;
        target.on('pointerover', () => {
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume });
            }
            if (scene.input && scene.__hoverCursor) {
                scene.input.setDefaultCursor(scene.__hoverCursor);
            }
        });
        target.on('pointerout', () => {
            if (scene.input && scene.__defaultCursor) {
                scene.input.setDefaultCursor(scene.__defaultCursor);
            }
        });
    },
};
