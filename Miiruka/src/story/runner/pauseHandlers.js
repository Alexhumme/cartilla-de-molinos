// Enfoque: pausa, configuración en runtime (idioma/volumen), navegación entre escenas.
// Estas funciones se ejecutan con `this` enlazado a StoryRunner.

import { GameStorage } from '../../utils/storage.js';
import { AudioManager } from '../../utils/audio.js';
import { UIHelpers } from '../../utils/ui.js';

export function createPauseToggleButton() {
    if (this.pauseButton) return;
    const scene = this.scene;
    const key = scene.textures.exists('pause-icon') ? 'pause-icon' : (this.placeholderTextureKey || 'story-placeholder');
    this.pauseButton = scene.add.image(1840, 80, key).setOrigin(0.5).setScale(0.25);
    this.pauseButton.setScrollFactor(0);
    this.pauseButton.setDepth(1000);
    this.pauseButton.setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerdown', () => {
        if (scene.cache.audio?.exists('pop')) {
            scene.sound.play('pop', { volume: 0.8 });
        }
        this.togglePause();
    });
    UIHelpers.attachHoverPop(scene, this.pauseButton, 0.35);
}

export function togglePauseState() {
    if (this.isPaused) {
        this.resume();
    } else {
        this.pause();
    }
}

export function pauseStory() {
    if (this.isPaused) return;
    this.isPaused = true;
    this.scene.tweens.timeScale = 0;
    this.scene.time.timeScale = 0;
    this.scene.sound.pauseAll();
    this.showPauseOverlay();
}

export function resumeStory() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.scene.tweens.timeScale = 1;
    this.scene.time.timeScale = 1;
    this.scene.sound.resumeAll();
    this.hidePauseOverlay();
}

export function getAdjacentChapterSceneKey(offset) {
    const scene = this.scene;
    const currentKey = scene.scene.key;
    const keys = scene.scene.manager.scenes.map((s) => s.sys.settings.key);
    const chapterKeys = keys.filter((key) => key.startsWith('Chp'));
    const index = chapterKeys.indexOf(currentKey);
    if (index < 0) return null;
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= chapterKeys.length) return null;
    return chapterKeys[nextIndex];
}

export function getCurrentChapterSceneInfo() {
    return GameStorage.parseChapterSceneKey(this.scene?.scene?.key);
}

export function createScenePaginationControl(x, y, onSelect) {
    const scene = this.scene;
    const container = scene.add.container(x, y);
    const hitZones = [];
    const info = this.getCurrentChapterInfo();

    if (!info) {
        const fallback = scene.add.text(0, 0, 'Escenas no disponibles', {
            fontFamily: 'fredoka',
            fontSize: '24px',
            color: '#b5b5b5',
        }).setOrigin(0.5);
        container.add(fallback);
        return {
            container,
            destroy: () => {
                hitZones.forEach((zone) => zone.destroy());
                container.destroy();
            },
        };
    }

    const chapter = info.chapter;
    const currentScene = info.scene;
    const summary = GameStorage.getChapterProgressSummary(chapter);
    const chapterProgress = GameStorage.getChapterProgress(chapter);
    const reached = new Set([...chapterProgress.reachedScenes, ...chapterProgress.completedScenes]);
    const maxReached = Math.max(...Array.from(reached.values()), currentScene);
    const totalScenes = Math.max(1, summary.totalScenes || currentScene);
    const spacing = 84;
    const startX = -((totalScenes - 1) * spacing) / 2;

    for (let index = 1; index <= totalScenes; index += 1) {
        const isCurrent = index === currentScene;
        const isReached = summary.isCompleted || reached.has(index) || index <= maxReached;
        const box = scene.add.graphics();
        const size = 56;
        const radius = 10;
        const bgColor = isCurrent ? 0xf0c18a : (isReached ? 0x6a3a1b : 0x3a3a3a);
        const textColor = isCurrent ? '#6a3a1b' : (isReached ? '#fce1b4' : '#8b8b8b');
        box.fillStyle(bgColor, isReached ? 1 : 0.75);
        box.fillRoundedRect(-size / 2, -size / 2, size, size, radius);
        box.lineStyle(2, isCurrent ? 0x8b4c1d : 0xfce1b4, isReached ? 0.7 : 0.2);
        box.strokeRoundedRect(-size / 2, -size / 2, size, size, radius);

        const label = scene.add.text(0, 1, String(index), {
            fontFamily: 'fredoka',
            fontSize: '28px',
            color: textColor,
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const item = scene.add.container(startX + (index - 1) * spacing, 0, [box, label]);
        item.setSize(size, size);
        container.add(item);

        if (isReached && !isCurrent) {
            const worldX = x + item.x;
            const worldY = y + item.y;
            const hit = scene.add.zone(worldX, worldY, size, size).setOrigin(0.5);
            hit.setInteractive({ useHandCursor: true });
            hit.setScrollFactor(0);
            hit.setDepth(1305);
            hit.on('pointerdown', (pointer) => {
                if (pointer?.event?.stopPropagation) pointer.event.stopPropagation();
                onSelect?.(`Chp${chapter}_scn${index}`);
            });
            hit.on('pointerover', () => item.setScale(1.08));
            hit.on('pointerout', () => item.setScale(1));
            UIHelpers.attachHoverPop(scene, hit, 0.35);
            hitZones.push(hit);
        } else if (!isReached) {
            item.setAlpha(0.65);
        }
    }

    return {
        container,
        destroy: () => {
            hitZones.forEach((zone) => zone.destroy());
            container.destroy();
        },
    };
}

export function showPauseMenuOverlay() {
    if (this.pauseOverlay) return;
    const scene = this.scene;
    scene.input.setTopOnly(true);
    const bg = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.65);
    const panelShadow = scene.add.rectangle(968, 548, 980, 780, 0x2f1a10, 0.65);
    const panel = scene.add.rectangle(960, 540, 980, 780, 0x2c2018, 0.95);
    panel.setStrokeStyle(6, 0xf0c18a, 0.95);

    const title = scene.add.text(960, 225, 'Pausa', {
        fontFamily: 'fredoka',
        fontSize: '64px',
        color: '#fce1b4',
        fontStyle: '700',
    }).setOrigin(0.5);
    const subtitle = scene.add.text(960, 278, 'Ajusta la sesión y continúa cuando quieras', {
        fontFamily: 'fredoka',
        fontSize: '24px',
        color: '#e9d6bf',
    }).setOrigin(0.5);

    const langLabel = scene.add.text(960, 352, 'Idioma', {
        fontFamily: 'fredoka',
        fontSize: '26px',
        color: '#fce1b4',
    }).setOrigin(0.5);

    const langToggle = this.createLanguageToggle(960, 402, [
        { id: 'es', label: 'Español' },
        { id: 'wayuunaiki', label: 'Wayuu' },
    ], this.language);

    const volumeLabel = scene.add.text(960, 486, 'Música', {
        fontFamily: 'fredoka',
        fontSize: '26px',
        color: '#fce1b4',
    }).setOrigin(0.5);
    const volumeSlider = this.createVolumeSelector(960, 536, 10, Math.round(this.musicVolume * 10), (level) => {
        if (scene.cache.audio?.exists('pop')) {
            scene.sound.play('pop', { volume: 0.8 });
        }
        this.setMusicVolume(level / 10);
        this.ignoreNextDialogClick = true;
    });

    const restartBtn = this.createPauseActionButton(960, 620, 'Reiniciar escena', () => {
        if (scene.cache.audio?.exists('pop')) {
            scene.sound.play('pop', { volume: 0.8 });
        }
        this.resetWalkingSound();
        const chapterInfo = this.getCurrentChapterInfo();
        if (chapterInfo) {
            GameStorage.commitChapterSession(chapterInfo.chapter);
        }
        this.resume();
        this.ignoreNextDialogClick = true;
        scene.scene.restart();
    });

    const menuBtn = this.createPauseActionButton(960, 700, 'Volver a capítulos', () => {
        if (scene.cache.audio?.exists('pop')) {
            scene.sound.play('pop', { volume: 0.8 });
        }
        this.resetWalkingSound();
        const chapterInfo = this.getCurrentChapterInfo();
        if (chapterInfo) {
            GameStorage.commitChapterSession(chapterInfo.chapter);
        }
        this.resume();
        this.ignoreNextDialogClick = true;
        scene.scene.start('Capitulos', {
            gearsOffsetX: 0,
            gearsOffsetY: 0,
        });
    });

    const toggleFullscreen = async () => {
        const lockLandscape = async () => {
            const orientation = globalThis.screen?.orientation;
            if (!orientation?.lock) return;
            try {
                await orientation.lock('landscape');
            } catch (error) {}
        };

        const exitFullscreen = async () => {
            const orientation = globalThis.screen?.orientation;
            if (orientation?.unlock) {
                try { orientation.unlock(); } catch (error) {}
            }
            if (document.exitFullscreen && document.fullscreenElement) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (scene.scale.isFullscreen) {
                scene.scale.stopFullscreen();
            }
        };

        if (document.fullscreenElement || scene.scale.isFullscreen) {
            await exitFullscreen();
            return;
        }

        const target = scene.game.canvas?.parentElement || document.documentElement;
        if (target.requestFullscreen) {
            await target.requestFullscreen();
        } else if (target.webkitRequestFullscreen) {
            target.webkitRequestFullscreen();
        } else {
            scene.scale.startFullscreen();
        }
        await lockLandscape();
    };

    const fullscreenBtn = this.createPauseActionButton(960, 780, 'Pantalla completa', async () => {
        if (scene.cache.audio?.exists('pop')) {
            scene.sound.play('pop', { volume: 0.8 });
        }
        await toggleFullscreen();
        this.ignoreNextDialogClick = true;
    });

    const pagination = this.createScenePagination(960, 860, (target) => {
        if (!target) return;
        if (scene.cache.audio?.exists('pop')) {
            scene.sound.play('pop', { volume: 0.8 });
        }
        this.resetWalkingSound();
        GameStorage.jumpToScene(this.scene?.scene?.key, target);
        this.resume();
        this.ignoreNextDialogClick = true;
        scene.scene.start(target);
    });

    const hint = scene.add.text(960, 932, 'Toca fuera o presiona pausar para continuar', {
        fontFamily: 'fredoka',
        fontSize: '20px',
        color: '#cccccc',
    }).setOrigin(0.5);

    [bg, panelShadow, panel, title, subtitle, langLabel, langToggle.container, volumeLabel, volumeSlider.container, restartBtn.container, menuBtn.container, fullscreenBtn.container, pagination.container, hint].forEach((item, index) => {
        item.setScrollFactor(0);
        item.setDepth(1100 + index);
    });

    bg.setInteractive();
    bg.on('pointerdown', (pointer) => {
        if (scene.cache.audio?.exists('pop')) {
            scene.sound.play('pop', { volume: 0.8 });
        }
        this.resume();
        this.ignoreNextDialogClick = true;
        if (pointer?.event?.stopPropagation) pointer.event.stopPropagation();
    });

    langToggle.onChange((lang) => {
        if (scene.cache.audio?.exists('pop')) {
            scene.sound.play('pop', { volume: 0.8 });
        }
        this.setLanguage(lang);
        this.ignoreNextDialogClick = true;
    });

    this.pauseOverlay = {
        bg,
        panel: [panelShadow, panel],
        title,
        subtitle,
        labels: [langLabel, volumeLabel],
        hint,
        buttons: [langToggle, volumeSlider, restartBtn, menuBtn, fullscreenBtn, pagination],
    };
}

export function hidePauseMenuOverlay() {
    if (!this.pauseOverlay) return;
    const { bg, panel, title, subtitle, labels, hint, buttons } = this.pauseOverlay;
    this.scene.input.setTopOnly(false);
    bg.destroy();
    if (Array.isArray(panel)) {
        panel.forEach((item) => item.destroy());
    } else {
        panel.destroy();
    }
    title.destroy();
    if (subtitle) subtitle.destroy();
    if (labels) labels.forEach((item) => item.destroy());
    hint.destroy();
    buttons.forEach((btn) => btn.destroy());
    this.pauseOverlay = null;
}

export function createLanguageToggleControl(x, y, options, activeId) {
    const scene = this.scene;
    const container = scene.add.container(x, y);
    const width = 560;
    const height = 84;
    const radius = 18;

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 6, width, height, radius);

    const bg = scene.add.graphics();
    bg.fillStyle(0xefe5f0, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

    const activePill = scene.add.graphics();

    const leftText = scene.add.text(-width / 4, 0, options[0].label, {
        fontFamily: 'fredoka',
        fontSize: '28px',
        color: '#6a5c6f',
    }).setOrigin(0.5);
    const rightText = scene.add.text(width / 4, 0, options[1].label, {
        fontFamily: 'fredoka',
        fontSize: '28px',
        color: '#6a5c6f',
    }).setOrigin(0.5);

    const hitLeft = scene.add.rectangle(-width / 4, 0, width / 2, height, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    const hitRight = scene.add.rectangle(width / 4, 0, width / 2, height, 0xffffff, 0.001).setInteractive({ useHandCursor: true });

    const render = (id) => {
        const isLeft = id === options[0].id;
        activePill.clear();
        activePill.fillStyle(0x63a711, 1);
        activePill.fillRoundedRect(
            isLeft ? -width / 2 + 6 : 0,
            -height / 2 + 6,
            width / 2 - 12,
            height - 12,
            radius - 6
        );
        leftText.setColor(isLeft ? '#fce1b4' : '#6a5c6f');
        rightText.setColor(!isLeft ? '#fce1b4' : '#6a5c6f');
        activeId = id;
    };
    render(activeId);

    [shadow, bg, activePill, leftText, rightText, hitLeft, hitRight].forEach((item) => {
        item.setScrollFactor(0);
    });
    container.add([shadow, bg, activePill, leftText, rightText, hitLeft, hitRight]);
    container.setSize(width, height);

    let onChange = null;
    hitLeft.on('pointerdown', (pointer) => {
        render(options[0].id);
        if (onChange) onChange(options[0].id);
        if (pointer?.event?.stopPropagation) pointer.event.stopPropagation();
    });
    hitRight.on('pointerdown', (pointer) => {
        render(options[1].id);
        if (onChange) onChange(options[1].id);
        if (pointer?.event?.stopPropagation) pointer.event.stopPropagation();
    });
    UIHelpers.attachHoverPop(scene, hitLeft, 0.35);
    UIHelpers.attachHoverPop(scene, hitRight, 0.35);

    return {
        container,
        onChange: (fn) => { onChange = fn; },
        destroy: () => container.destroy(),
    };
}

export function createPauseActionControl(x, y, label, onClick) {
    const scene = this.scene;
    const container = scene.add.container(x, y);
    const width = 460;
    const height = 68;

    const base = scene.add.graphics();
    base.fillStyle(0x8b4c1d, 1);
    base.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
    const border = scene.add.graphics();
    border.fillStyle(0xf0c18a, 1);
    border.fillRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, 14);
    const text = scene.add.text(0, 0, label, {
        fontFamily: 'fredoka',
        fontSize: '24px',
        color: '#6a3a1b',
        fontStyle: '700',
    }).setOrigin(0.5);

    [base, border, text].forEach((item) => item.setScrollFactor(0));
    container.add([base, border, text]);
    container.setSize(width, height);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', (pointer) => {
        if (pointer?.event?.stopPropagation) pointer.event.stopPropagation();
        onClick();
    });
    container.on('pointerover', () => container.setScale(1.03));
    container.on('pointerout', () => container.setScale(1));
    UIHelpers.attachHoverPop(scene, container, 0.35);

    return {
        container,
        destroy: () => container.destroy(),
    };
}

export function createVolumeSelectorControl(x, y, segments, activeLevel, onChange) {
    const scene = this.scene;
    const container = scene.add.container(x, y);
    const totalWidth = 360;
    const totalHeight = 24;
    const gap = 6;
    const segmentWidth = (totalWidth - gap * (segments - 1)) / segments;

    const bg = scene.add.rectangle(0, 0, totalWidth + 60, totalHeight + 20, 0x121212, 0.65).setOrigin(0.5);
    const label = scene.add.text(-totalWidth / 2 - 6, 0, 'Música', {
        fontFamily: 'fredoka',
        fontSize: '22px',
        color: '#ffffff',
    }).setOrigin(1, 0.5);

    const muteLabel = scene.add.text(totalWidth / 2 + 18, 0, 'X', {
        fontFamily: 'fredoka',
        fontSize: '22px',
        color: '#ffffff',
    }).setOrigin(0.5);
    const muteHit = scene.add.rectangle(totalWidth / 2 + 18, 0, 26, 26, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    UIHelpers.attachHoverPop(scene, muteHit, 0.35);

    const segmentsList = [];
    for (let i = 0; i < segments; i += 1) {
        const xPos = -totalWidth / 2 + segmentWidth / 2 + i * (segmentWidth + gap);
        const rect = scene.add.rectangle(xPos, 0, segmentWidth, totalHeight, 0xffffff, 0.2).setOrigin(0.5);
        rect.setStrokeStyle(2, 0xffffff, 0.2);
        rect.setInteractive({ useHandCursor: true });
        UIHelpers.attachHoverPop(scene, rect, 0.35);
        segmentsList.push(rect);
    }

    const render = (level) => {
        const clamped = Phaser.Math.Clamp(level, 0, segments);
        segmentsList.forEach((rect, idx) => {
            const active = idx < clamped;
            rect.setFillStyle(active ? 0x63a711 : 0xffffff, active ? 0.85 : 0.2);
            rect.setStrokeStyle(2, active ? 0xfce1b4 : 0xffffff, active ? 0.9 : 0.25);
        });
    };

    render(activeLevel);

    segmentsList.forEach((rect, idx) => {
        rect.on('pointerdown', (pointer) => {
            if (pointer?.event?.stopPropagation) pointer.event.stopPropagation();
            const level = idx + 1;
            render(level);
            onChange(level);
        });
    });

    muteHit.on('pointerdown', (pointer) => {
        if (pointer?.event?.stopPropagation) pointer.event.stopPropagation();
        render(0);
        onChange(0);
    });

    [bg, label, muteLabel, muteHit, ...segmentsList].forEach((item) => item.setScrollFactor(0));
    container.add([bg, label, muteLabel, muteHit, ...segmentsList]);
    container.setSize(totalWidth + 60, totalHeight + 20);

    return {
        container,
        destroy: () => container.destroy(),
    };
}

export function ensureRunnerMusic() {
    this.musicSound = AudioManager.ensureLoopingMusic(this.scene, 'gametheme', this.musicVolume);
}

export function setRunnerMusicVolume(volume, options = {}) {
    this.musicVolume = Phaser.Math.Clamp(volume, 0, 1);
    if (this.musicSound) {
        this.musicSound.setVolume(this.musicVolume);
    } else if (!options.silent) {
        this.ensureMusic();
    }
}

export function setRunnerLanguage(lang) {
    this.language = lang;
    GameStorage.setLanguage(lang);
    if (this.lastDialogMap) {
        const nextText = this.resolveDialogText(this.lastDialogMap);
        this.setDialogText(nextText);
    }
}
