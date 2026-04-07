export const GameStorage = {
    getName() { 
        return localStorage.getItem('playerName');
    },

    setName(name) {
        localStorage.setItem('playerName', name);
    },

    clear() {
        localStorage.removeItem('playerName');
        localStorage.removeItem('gameSave');
    },

    hasName() {
        return !!localStorage.getItem('playerName');
    },

    getLanguage() {
        return localStorage.getItem('gameLanguage');
    },

    setLanguage(lang) {
        localStorage.setItem('gameLanguage', lang);
    },

    getSave() {
        const raw = localStorage.getItem('gameSave');
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    },

    setSave(save) {
        localStorage.setItem('gameSave', JSON.stringify(save));
    },

    clearSave() {
        localStorage.removeItem('gameSave');
    },

    hasSave() {
        return !!this.getSave();
    },

    startNewGame(name) {
        const trimmed = name?.trim?.() ?? '';
        if (trimmed) {
            this.setName(trimmed);
        }
        const save = {
            name: trimmed || this.getName() || 'Jugador',
            createdAt: Date.now(),
            completedChapters: [],
            unlockedChapters: [1],
            lastChapter: 1
        };
        this.setSave(save);
        return save;
    },

    getProgress() {
        const save = this.getSave();
        if (!save) {
            return { completedChapters: [], unlockedChapters: [1], lastChapter: 1 };
        }
        return {
            completedChapters: save.completedChapters ?? [],
            unlockedChapters: save.unlockedChapters ?? [1],
            lastChapter: save.lastChapter ?? 1
        };
    },

    completeChapter(chapter) {
        const save = this.getSave() ?? this.startNewGame(this.getName() || 'Jugador');
        const completed = new Set(save.completedChapters ?? []);
        completed.add(chapter);
        const unlocked = new Set(save.unlockedChapters ?? [1]);
        unlocked.add(chapter);
        unlocked.add(chapter + 1);
        const updated = {
            ...save,
            completedChapters: Array.from(completed).sort((a, b) => a - b),
            unlockedChapters: Array.from(unlocked).sort((a, b) => a - b),
            lastChapter: chapter
        };
        this.setSave(updated);
        return updated;
    },

    isChapterCompleted(chapter) {
        const { completedChapters } = this.getProgress();
        return completedChapters.includes(chapter);
    },

    isChapterUnlocked(chapter) {
        const { unlockedChapters } = this.getProgress();
        return unlockedChapters.includes(chapter);
    },

    setLastChapter(chapter) {
        const save = this.getSave();
        if (!save) return;
        this.setSave({ ...save, lastChapter: chapter });
    },

    getLastChapter() {
        return this.getProgress().lastChapter;
    },

    getMusicEnabled() {
        const raw = localStorage.getItem('musicEnabled');
        if (raw === null) return true;
        return raw === 'true';
    },

    setMusicEnabled(enabled) {
        localStorage.setItem('musicEnabled', enabled ? 'true' : 'false');
    }
}
