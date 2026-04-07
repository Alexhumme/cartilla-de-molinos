import { GameStorage } from './storage.js';

export const AudioManager = {
    ensureLoopingMusic(scene, key, volume = 0.7) {
        if (!scene.cache.audio?.exists(key)) return null;
        let sound = scene.sound.get(key);
        if (!sound) {
            sound = scene.sound.add(key, { volume, loop: true });
        }
        sound.setVolume(volume);

        if (GameStorage.getMusicEnabled()) {
            if (!sound.isPlaying) sound.play();
        } else if (sound.isPlaying) {
            sound.stop();
        }
        return sound;
    },

    setMusicEnabled(scene, key, enabled, volume = 0.7) {
        GameStorage.setMusicEnabled(enabled);
        if (!scene.cache.audio?.exists(key)) return;
        let sound = scene.sound.get(key);
        if (!sound && enabled) {
            sound = scene.sound.add(key, { volume, loop: true });
        }
        if (!sound) return;
        sound.setVolume(volume);
        if (enabled) {
            if (!sound.isPlaying) sound.play();
        } else if (sound.isPlaying) {
            sound.stop();
        }
    },
};
