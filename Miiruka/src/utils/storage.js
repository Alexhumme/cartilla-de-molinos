const CHAPTER_SCENE_COUNT = {
    1: 6,
    2: 5,
    3: 6,
};

const SCENE_KEY_REGEX = /^Chp(\d+)_scn(\d+)$/i;

const nowMs = () => Date.now();

const toSortedUniqueNumbers = (values, min = 1) => {
    const unique = new Set(
        (values || [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= min)
    );
    return Array.from(unique).sort((a, b) => a - b);
};

const parseChapterSceneKey = (sceneKey) => {
    const raw = (sceneKey || '').trim();
    const match = raw.match(SCENE_KEY_REGEX);
    if (!match) return null;
    return { chapter: Number(match[1]), scene: Number(match[2]) };
};

const ensureChapterProgress = (save, chapter) => {
    const chapterNum = Number(chapter);
    if (!Number.isFinite(chapterNum)) return null;
    save.chapterProgress = save.chapterProgress ?? {};
    const existing = save.chapterProgress[chapterNum] ?? {};
    const totalScenes = Number(CHAPTER_SCENE_COUNT[chapterNum] ?? 0);
    const reachedScenes = toSortedUniqueNumbers(existing.reachedScenes, 1).filter((scene) => totalScenes === 0 || scene <= totalScenes);
    const completedScenes = toSortedUniqueNumbers(existing.completedScenes, 1).filter((scene) => totalScenes === 0 || scene <= totalScenes);
    const normalized = {
        reachedScenes: reachedScenes.length ? reachedScenes : [1],
        completedScenes,
        lastScene: Number.isFinite(existing.lastScene) ? Math.max(1, existing.lastScene) : 1,
        totalPlayMs: Math.max(0, Number(existing.totalPlayMs) || 0),
        sessionStartedAt: Number(existing.sessionStartedAt) || null,
        attemptAccumulatedMs: Math.max(0, Number(existing.attemptAccumulatedMs) || 0),
        attemptStartedAt: Number(existing.attemptStartedAt) || null,
        bestCompletionMs: Number.isFinite(existing.bestCompletionMs) ? Math.max(0, existing.bestCompletionMs) : null,
        completedAt: Number(existing.completedAt) || null,
    };

    if (totalScenes > 0) {
        normalized.lastScene = Math.min(totalScenes, normalized.lastScene);
    }
    if (!normalized.reachedScenes.includes(normalized.lastScene)) {
        normalized.reachedScenes.push(normalized.lastScene);
        normalized.reachedScenes = toSortedUniqueNumbers(normalized.reachedScenes, 1);
    }
    save.chapterProgress[chapterNum] = normalized;
    return normalized;
};

const ensureSaveShape = (save) => {
    const base = save ?? {};
    const normalized = {
        name: base.name || localStorage.getItem('playerName') || 'Jugador',
        createdAt: Number(base.createdAt) || nowMs(),
        completedChapters: toSortedUniqueNumbers(base.completedChapters, 1),
        unlockedChapters: toSortedUniqueNumbers(base.unlockedChapters, 1),
        lastChapter: Number(base.lastChapter) || 1,
        chapterProgress: base.chapterProgress ?? {},
    };

    if (!normalized.unlockedChapters.length) normalized.unlockedChapters = [1];

    Object.keys(CHAPTER_SCENE_COUNT).forEach((chapterKey) => {
        ensureChapterProgress(normalized, Number(chapterKey));
    });

    return normalized;
};

const elapsedFromSession = (chapterProgress) => {
    if (!chapterProgress?.sessionStartedAt) return 0;
    return Math.max(0, nowMs() - chapterProgress.sessionStartedAt);
};

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
            const parsed = JSON.parse(raw);
            return ensureSaveShape(parsed);
        } catch (error) {
            return null;
        }
    },

    setSave(save) {
        const normalized = ensureSaveShape(save);
        localStorage.setItem('gameSave', JSON.stringify(normalized));
    },

    clearSave() {
        localStorage.removeItem('gameSave');
    },

    hasSave() {
        return !!this.getSave();
    },

    getChapterSceneCount(chapter) {
        return Number(CHAPTER_SCENE_COUNT[chapter] ?? 0);
    },

    parseChapterSceneKey,

    startNewGame(name) {
        const trimmed = name?.trim?.() ?? '';
        if (trimmed) {
            this.setName(trimmed);
        }
        const save = ensureSaveShape({
            name: trimmed || this.getName() || 'Jugador',
            createdAt: nowMs(),
            completedChapters: [],
            unlockedChapters: [1],
            lastChapter: 1,
            chapterProgress: {},
        });
        this.setSave(save);
        return save;
    },

    getProgress() {
        const save = this.getSave();
        if (!save) {
            const fallback = ensureSaveShape({
                completedChapters: [],
                unlockedChapters: [1],
                lastChapter: 1,
                chapterProgress: {},
            });
            return {
                completedChapters: fallback.completedChapters,
                unlockedChapters: fallback.unlockedChapters,
                lastChapter: fallback.lastChapter,
                chapterProgress: fallback.chapterProgress,
            };
        }
        return {
            completedChapters: save.completedChapters ?? [],
            unlockedChapters: save.unlockedChapters ?? [1],
            lastChapter: save.lastChapter ?? 1,
            chapterProgress: save.chapterProgress ?? {},
        };
    },

    ensureGameSave() {
        return this.getSave() ?? this.startNewGame(this.getName() || 'Jugador');
    },

    commitChapterSession(chapter) {
        const save = this.ensureGameSave();
        const chapterProgress = ensureChapterProgress(save, chapter);
        if (!chapterProgress) return save;

        const elapsed = elapsedFromSession(chapterProgress);
        if (elapsed > 0) {
            chapterProgress.totalPlayMs += elapsed;
            if (!save.completedChapters.includes(Number(chapter))) {
                chapterProgress.attemptAccumulatedMs += elapsed;
            }
        }
        chapterProgress.sessionStartedAt = null;
        this.setSave(save);
        return save;
    },

    touchChapterScene(chapter, scene) {
        const chapterNum = Number(chapter);
        const sceneNum = Math.max(1, Number(scene) || 1);
        const save = this.ensureGameSave();
        const chapterProgress = ensureChapterProgress(save, chapterNum);
        if (!chapterProgress) return save;

        if (!chapterProgress.attemptStartedAt && !save.completedChapters.includes(chapterNum)) {
            chapterProgress.attemptStartedAt = nowMs();
        }
        if (!chapterProgress.sessionStartedAt) {
            chapterProgress.sessionStartedAt = nowMs();
        }
        if (!chapterProgress.reachedScenes.includes(sceneNum)) {
            chapterProgress.reachedScenes.push(sceneNum);
            chapterProgress.reachedScenes = toSortedUniqueNumbers(chapterProgress.reachedScenes, 1);
        }
        chapterProgress.lastScene = sceneNum;
        save.lastChapter = chapterNum;
        const unlocked = new Set(save.unlockedChapters ?? [1]);
        unlocked.add(chapterNum);
        save.unlockedChapters = Array.from(unlocked).sort((a, b) => a - b);
        this.setSave(save);
        return save;
    },

    touchChapterSceneBySceneKey(sceneKey) {
        const parsed = parseChapterSceneKey(sceneKey);
        if (!parsed) return this.getSave();
        return this.touchChapterScene(parsed.chapter, parsed.scene);
    },

    markSceneCompleted(chapter, scene) {
        const chapterNum = Number(chapter);
        const sceneNum = Math.max(1, Number(scene) || 1);
        const save = this.ensureGameSave();
        const chapterProgress = ensureChapterProgress(save, chapterNum);
        if (!chapterProgress) return save;
        if (!chapterProgress.completedScenes.includes(sceneNum)) {
            chapterProgress.completedScenes.push(sceneNum);
            chapterProgress.completedScenes = toSortedUniqueNumbers(chapterProgress.completedScenes, 1);
        }
        if (!chapterProgress.reachedScenes.includes(sceneNum)) {
            chapterProgress.reachedScenes.push(sceneNum);
            chapterProgress.reachedScenes = toSortedUniqueNumbers(chapterProgress.reachedScenes, 1);
        }

        this.setSave(save);
        return this.completeChapterIfReady(chapterNum);
    },

    markSceneCompletedBySceneKey(sceneKey) {
        const parsed = parseChapterSceneKey(sceneKey);
        if (!parsed) return this.getSave();
        return this.markSceneCompleted(parsed.chapter, parsed.scene);
    },

    setLastScene(chapter, scene) {
        const chapterNum = Number(chapter);
        const sceneNum = Math.max(1, Number(scene) || 1);
        const save = this.ensureGameSave();
        const chapterProgress = ensureChapterProgress(save, chapterNum);
        if (!chapterProgress) return save;
        chapterProgress.lastScene = sceneNum;
        if (!chapterProgress.reachedScenes.includes(sceneNum)) {
            chapterProgress.reachedScenes.push(sceneNum);
            chapterProgress.reachedScenes = toSortedUniqueNumbers(chapterProgress.reachedScenes, 1);
        }
        save.lastChapter = chapterNum;
        this.setSave(save);
        return save;
    },

    transitionScene(fromSceneKey, toSceneKey) {
        const from = parseChapterSceneKey(fromSceneKey);
        const to = parseChapterSceneKey(toSceneKey);

        if (from) {
            this.markSceneCompleted(from.chapter, from.scene);
            this.commitChapterSession(from.chapter);
        }
        if (to) {
            this.touchChapterScene(to.chapter, to.scene);
        }
        return this.getSave();
    },

    jumpToScene(fromSceneKey, toSceneKey) {
        const from = parseChapterSceneKey(fromSceneKey);
        const to = parseChapterSceneKey(toSceneKey);
        if (from) {
            this.commitChapterSession(from.chapter);
        }
        if (to) {
            this.touchChapterScene(to.chapter, to.scene);
        }
        return this.getSave();
    },

    getChapterProgress(chapter) {
        const save = this.ensureGameSave();
        const chapterProgress = ensureChapterProgress(save, chapter);
        const liveElapsed = elapsedFromSession(chapterProgress);
        return {
            ...chapterProgress,
            reachedScenes: [...chapterProgress.reachedScenes],
            completedScenes: [...chapterProgress.completedScenes],
            totalPlayMs: chapterProgress.totalPlayMs + liveElapsed,
            attemptAccumulatedMs: chapterProgress.attemptAccumulatedMs + (save.completedChapters.includes(Number(chapter)) ? 0 : liveElapsed),
        };
    },

    getChapterProgressSummary(chapter) {
        const chapterNum = Number(chapter);
        const progress = this.getChapterProgress(chapterNum);
        const totalScenes = this.getChapterSceneCount(chapterNum);
        const completedScenes = progress.completedScenes.filter((scene) => totalScenes === 0 || scene <= totalScenes).length;
        const reachedScenes = progress.reachedScenes.filter((scene) => totalScenes === 0 || scene <= totalScenes).length;
        const isCompleted = completedScenes >= totalScenes && totalScenes > 0;
        return {
            chapter: chapterNum,
            totalScenes,
            completedScenes,
            reachedScenes,
            isCompleted,
            bestCompletionMs: progress.bestCompletionMs,
            playTimeMs: isCompleted
                ? (progress.bestCompletionMs ?? progress.totalPlayMs)
                : progress.totalPlayMs,
            lastScene: progress.lastScene,
        };
    },

    getResumeScene(chapter) {
        const chapterNum = Number(chapter);
        const summary = this.getChapterProgressSummary(chapterNum);
        if (summary.isCompleted) return 1;
        return Math.max(1, summary.lastScene || 1);
    },

    completeChapterIfReady(chapter) {
        const chapterNum = Number(chapter);
        const save = this.ensureGameSave();
        const chapterProgress = ensureChapterProgress(save, chapterNum);
        if (!chapterProgress) return save;
        const totalScenes = this.getChapterSceneCount(chapterNum);
        if (totalScenes <= 0) {
            this.setSave(save);
            return save;
        }

        const completedCount = chapterProgress.completedScenes.filter((scene) => scene <= totalScenes).length;
        if (completedCount < totalScenes) {
            this.setSave(save);
            return save;
        }

        const elapsed = elapsedFromSession(chapterProgress);
        if (elapsed > 0) {
            chapterProgress.totalPlayMs += elapsed;
            chapterProgress.attemptAccumulatedMs += elapsed;
            chapterProgress.sessionStartedAt = null;
        }

        const runMs = chapterProgress.attemptAccumulatedMs;
        if (runMs > 0) {
            if (!Number.isFinite(chapterProgress.bestCompletionMs) || chapterProgress.bestCompletionMs === null) {
                chapterProgress.bestCompletionMs = runMs;
            } else {
                chapterProgress.bestCompletionMs = Math.min(chapterProgress.bestCompletionMs, runMs);
            }
        }
        chapterProgress.attemptAccumulatedMs = 0;
        chapterProgress.attemptStartedAt = null;
        chapterProgress.completedAt = nowMs();
        chapterProgress.lastScene = 1;

        const completed = new Set(save.completedChapters ?? []);
        completed.add(chapterNum);
        save.completedChapters = Array.from(completed).sort((a, b) => a - b);

        const unlocked = new Set(save.unlockedChapters ?? [1]);
        unlocked.add(chapterNum);
        unlocked.add(chapterNum + 1);
        save.unlockedChapters = Array.from(unlocked).sort((a, b) => a - b);
        save.lastChapter = chapterNum;

        this.setSave(save);
        return save;
    },

    completeChapter(chapter) {
        const chapterNum = Number(chapter);
        const save = this.ensureGameSave();
        const totalScenes = this.getChapterSceneCount(chapterNum);
        if (totalScenes > 0) {
            const chapterProgress = ensureChapterProgress(save, chapterNum);
            chapterProgress.completedScenes = Array.from({ length: totalScenes }, (_, index) => index + 1);
            chapterProgress.reachedScenes = [...chapterProgress.completedScenes];
            this.setSave(save);
        }
        return this.completeChapterIfReady(chapterNum);
    },

    isChapterCompleted(chapter) {
        const chapterNum = Number(chapter);
        return this.getChapterProgressSummary(chapterNum).isCompleted;
    },

    isChapterUnlocked(chapter) {
        const { unlockedChapters } = this.getProgress();
        return unlockedChapters.includes(Number(chapter));
    },

    isSceneReached(chapter, scene) {
        const progress = this.getChapterProgress(Number(chapter));
        return progress.reachedScenes.includes(Number(scene));
    },

    setLastChapter(chapter) {
        const save = this.ensureGameSave();
        save.lastChapter = Number(chapter) || 1;
        this.setSave(save);
    },

    getLastChapter() {
        return this.getProgress().lastChapter;
    },

    formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);
        return parts.join(' ');
    },

    downloadProgressCertificate() {
        const save = this.ensureGameSave();
        const playerName = save.name || this.getName() || 'Jugador';
        const date = new Date();
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1000;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const drawRoundedRect = (x, y, w, h, r, color) => {
            const radius = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.arcTo(x + w, y, x + w, y + h, radius);
            ctx.arcTo(x + w, y + h, x, y + h, radius);
            ctx.arcTo(x, y + h, x, y, radius);
            ctx.arcTo(x, y, x + w, y, radius);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        };

        const drawCircle = (x, y, radius, color) => {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        };

        // Fondo naranja con formas.
        ctx.fillStyle = '#f68943';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawCircle(1480, 50, 260, '#ff9f61');
        drawCircle(80, 940, 260, '#ff7f32');
        drawCircle(1450, 900, 220, '#ff7f32');

        // Tarjeta principal estilo certificado.
        drawRoundedRect(120, 110, 1360, 780, 26, '#f4f4f4');
        drawCircle(280, 110, 60, '#f68943');
        drawCircle(1460, 110, 120, '#82d9e8');
        drawCircle(1160, 110, 90, '#6b31ca');
        drawCircle(260, 840, 160, '#f2dc55');
        drawCircle(1360, 860, 150, '#ff4fa1');

        // Título.
        ctx.fillStyle = '#2a2a7c';
        ctx.font = '700 52px fredoka, Arial, sans-serif';
        ctx.fillText('CERTIFICADO DE PROGRESO', 220, 250);
        ctx.fillStyle = '#6b31ca';
        ctx.font = '700 92px fredoka, Arial, sans-serif';
        ctx.fillText(playerName, 650, 340);
        ctx.strokeStyle = '#efb27c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(650, 360);
        ctx.lineTo(1280, 360);
        ctx.stroke();

        // Subtítulos.
        ctx.fillStyle = '#4e4e4e';
        ctx.font = '500 34px fredoka, Arial, sans-serif';
        ctx.fillText(`Fecha: ${date.toLocaleDateString()}`, 220, 320);
        ctx.fillText('Miiruku - Cuidado del agua y del molino', 220, 370);

        // Bloque de progreso.
        let y = 450;
        Object.keys(CHAPTER_SCENE_COUNT).forEach((chapterKey) => {
            const chapter = Number(chapterKey);
            const summary = this.getChapterProgressSummary(chapter);
            const timing = summary.isCompleted && Number.isFinite(summary.bestCompletionMs)
                ? `Mejor tiempo: ${this.formatDuration(summary.bestCompletionMs)}`
                : `Tiempo jugado: ${this.formatDuration(summary.playTimeMs)}`;
            ctx.fillStyle = '#2a2a7c';
            ctx.font = '700 38px fredoka, Arial, sans-serif';
            ctx.fillText(`Capitulo ${chapter}`, 220, y);
            ctx.fillStyle = '#4e4e4e';
            ctx.font = '500 31px fredoka, Arial, sans-serif';
            ctx.fillText(`Escenas: ${summary.completedScenes}/${summary.totalScenes}`, 460, y);
            ctx.fillText(timing, 840, y);
            y += 78;
        });

        ctx.fillStyle = '#6b31ca';
        ctx.font = '600 34px fredoka, Arial, sans-serif';
        ctx.fillText('Gracias por aprender y cuidar el agua en comunidad.', 220, 790);

        const url = canvas.toDataURL('image/png');
        const anchor = document.createElement('a');
        const safeName = String(playerName).replace(/[^a-zA-Z0-9_-]/g, '_');
        anchor.href = url;
        anchor.download = `certificado_progreso_${safeName}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    },

    getMusicEnabled() {
        const raw = localStorage.getItem('musicEnabled');
        if (raw === null) return true;
        return raw === 'true';
    },

    setMusicEnabled(enabled) {
        localStorage.setItem('musicEnabled', enabled ? 'true' : 'false');
    },

    getMusicVolume() {
        const raw = Number(localStorage.getItem('musicVolume'));
        if (!Number.isFinite(raw)) return 0.7;
        return Math.min(1, Math.max(0, raw));
    },

    setMusicVolume(volume) {
        const safe = Math.min(1, Math.max(0, Number(volume) || 0));
        localStorage.setItem('musicVolume', String(safe));
    },
};
