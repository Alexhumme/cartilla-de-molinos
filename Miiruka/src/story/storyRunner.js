import { normalizeKeyword, parseScript } from './parser.js';

const PLACEHOLDER_KEY = 'story-placeholder';

const ensurePlaceholder = (scene) => {
    if (scene.textures.exists(PLACEHOLDER_KEY)) return PLACEHOLDER_KEY;

    const gfx = scene.add.graphics();
    gfx.fillStyle(0x1f1f1f, 1);
    gfx.fillRect(0, 0, 256, 256);
    gfx.lineStyle(4, 0xffffff, 1);
    gfx.strokeRect(4, 4, 248, 248);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(40, 120, 176, 16);
    gfx.generateTexture(PLACEHOLDER_KEY, 256, 256);
    gfx.destroy();

    return PLACEHOLDER_KEY;
};

const sleep = (scene, ms) =>
    new Promise((resolve) => scene.time.delayedCall(ms, resolve));

const defaultDialogStyle = {
    fontFamily: 'fredoka',
    fontSize: '32px',
    color: '#ffffff',
    wordWrap: { width: 1600 },
    align: 'center',
};

export class StoryRunner {
    constructor(scene, scriptText) {
        this.scene = scene;
        this.script = parseScript(scriptText);
        this.characters = new Map();
        this.minigames = new Map();
        this.dialogBox = null;
        this.dialogText = null;
        this.dialogSpeaker = null;
        this.dialogContainer = null;
        this.pauseButton = null;
        this.pauseOverlay = null;
        this.language = 'es';
        this.isPaused = false;
        this.lastDialogMap = null;
    }

    initUI() {
        this.createPauseButton();
    }

    async run(sceneName) {
        const scene = this.script.sceneMap.get(sceneName) ?? this.script.scenes[0];
        if (!scene) return;

        for (let i = 0; i < scene.events.length; i += 1) {
            const event = scene.events[i];
            const result = await this.executeEvent(event.tokens, event.line, scene);
            if (result?.jumpTo) {
                const targetIndex = scene.labelMap?.get(result.jumpTo);
                if (typeof targetIndex === 'number') {
                    i = targetIndex - 1;
                }
            }
        }
    }

    async executeEvent(tokens, rawLine, currentScene) {
        const keyword = normalizeKeyword(tokens[0]);

        if (keyword === 'label' || keyword === 'etiqueta') return;
        if (keyword === 'plano') return this.handleShot(tokens);
        if (keyword === 'personaje' || keyword === 'char') return this.handleCharacter(tokens);
        if (keyword === 'mostrar') return this.handleShow(tokens);
        if (keyword === 'minijuego') return this.handleMinigame(tokens);
        if (keyword === 'if') return this.handleIf(tokens, currentScene);
        if (keyword === 'goto' || keyword === 'ir_a') return this.handleGoto(tokens, currentScene);
        if (keyword === 'cambiar_escena' || keyword === 'scene' || keyword === 'scene_start') {
            return this.handleSceneChange(tokens);
        }
        if (keyword === 'camara') return this.handleCamera(tokens);
        if (keyword === 'esperar') return this.handleWait(tokens);
        if (keyword === 'fin' || keyword === 'fin_escena' || keyword === 'salir' || keyword === 'salir_de_escena') {
            this.scene.cameras.main.fadeOut(600, 0, 0, 0);
            return sleep(this.scene, 600);
        }

        console.warn(`[StoryRunner] Acción desconocida: ${rawLine}`);
    }

    ensureCharacter(name) {
        if (this.characters.has(name)) return this.characters.get(name);

        const idleKey = `char-${name}-idle`;
        const textureKey = this.scene.textures.exists(idleKey) ? idleKey : ensurePlaceholder(this.scene);

        const sprite = this.scene.add.image(-300, 780, textureKey).setOrigin(0.5, 1);
        sprite.setScale(0.9);
        sprite.setScrollFactor(0);
        this.characters.set(name, sprite);
        return sprite;
    }

    setCharacterEmotion(name, emotion) {
        const sprite = this.ensureCharacter(name);
        if (!emotion) return;

        const emotionKey = `char-${name}-${emotion}`;
        if (this.scene.textures.exists(emotionKey)) {
            sprite.setTexture(emotionKey);
            return;
        }

        const idleKey = `char-${name}-idle`;
        if (this.scene.textures.exists(idleKey)) {
            sprite.setTexture(idleKey);
            return;
        }

        sprite.setTexture(ensurePlaceholder(this.scene));
    }

    async handleShot(tokens) {
        const type = normalizeKeyword(tokens[1] ?? '');
        if (type === 'sol_hacia_abajo' || type === 'amanecer') {
            await this.runSunPan();
            return;
        }
    }

    async runSunPan() {
        const scene = this.scene;

        const worldHeight = 2000;
        scene.cameras.main.setBounds(0, 0, 1920, worldHeight);
        const cam = scene.cameras.main;

        cam.scrollY = 0;
        cam.fadeIn(500, 0, 0, 0);
        scene.input.enabled = false;

        scene.add.image(960, 0, 'sky').setOrigin(0.5, 0);
        scene.sun1 = scene.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        scene.sun2 = scene.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        scene.add.image(1920, 1230, 'bg_layer1').setScrollFactor(0.7);
        scene.add.image(1920, 1260, 'bg_layer2').setScrollFactor(0.8);
        scene.add.image(1920, 1300, 'bg_layer3').setScrollFactor(0.9);
        scene.add.image(1920, 1340, 'bg_layer4').setScrollFactor(1);

        await new Promise((resolve) => {
            scene.tweens.add({
                targets: cam,
                scrollY: 800,
                duration: 6000,
                ease: 'Sine.inOut',
                onComplete: resolve,
            });
        });

        scene.input.enabled = true;
    }

    async handleCharacter(tokens) {
        const name = tokens[1];
        const normalizedTokens = tokens.map((token) => normalizeKeyword(token));
        const actionIndex = normalizedTokens.findIndex((token) => token === 'entra');
        const action = actionIndex >= 0 ? 'entra' : normalizeKeyword(tokens[2] ?? '');

        if (!name) return;
        const emotionIndex = normalizedTokens.findIndex((token) => token === 'emocion' || token === 'expresion');
        const sayIndex = normalizedTokens.findIndex((token) => token === 'habla' || token === 'dice');

        if (emotionIndex >= 0) {
            this.setCharacterEmotion(name, tokens[emotionIndex + 1]);
        }

        if (action === 'entra') {
            const directionToken = actionIndex >= 0 ? tokens[actionIndex + 1] : tokens[3];
            const direction = normalizeKeyword(directionToken ?? 'izquierda');
            await this.characterEnter(name, direction);
        }

        if (sayIndex >= 0) {
            const dialogTokens = tokens.slice(sayIndex + 1);
            const dialogMap = this.parseDialogTokens(dialogTokens);
            this.lastDialogMap = dialogMap;
            const text = this.resolveDialogText(dialogMap);
            await this.showDialog(name, text);
        }
    }

    async characterEnter(name, direction) {
        const sprite = this.ensureCharacter(name);
        const startX = direction === 'derecha' ? 2300 : -300;
        const targetX = direction === 'derecha' ? 1400 : 520;

        sprite.x = startX;
        sprite.y = 980;

        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: sprite,
                x: targetX,
                duration: 1200,
                ease: 'Sine.out',
                onComplete: resolve,
            });
        });
    }

    async showDialog(speaker, text) {
        const scene = this.scene;
        if (!this.dialogContainer) {
            const boxWidth = 1840;
            const boxHeight = 170;

            this.dialogBox = scene.add.graphics();
            this.dialogBox.fillStyle(0x000000, 0.6);
            this.dialogBox.fillRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 24);

            this.dialogText = scene.add.text(0, 10, '', defaultDialogStyle).setOrigin(0.5);
            this.dialogSpeaker = scene.add.text(-boxWidth / 2 + 80, -boxHeight / 2 + 30, '', {
                fontFamily: 'fredoka',
                fontSize: '28px',
                color: '#fce1b4',
            }).setOrigin(0, 0.5);

            this.dialogContainer = scene.add.container(960, 975, [
                this.dialogBox,
                this.dialogText,
                this.dialogSpeaker,
            ]);
            this.dialogContainer.setScrollFactor(0);
        }

        this.dialogSpeaker.setText(speaker);
        this.dialogText.setText(text);

        await this.animateDialogIn();

        await this.waitForClick();

        await this.animateDialogOut();
    }

    async waitForClick() {
        const scene = this.scene;
        return new Promise((resolve) => {
            const handler = () => {
                if (this.isPaused) return;
                scene.input.off('pointerdown', handler);
                resolve();
            };
            scene.input.on('pointerdown', handler);
        });
    }

    async handleShow(tokens) {
        const type = normalizeKeyword(tokens[1] ?? '');
        if (type !== 'imagen') return;

        const key = tokens[2];
        const textureKey = this.scene.textures.exists(key) ? key : ensurePlaceholder(this.scene);
        const image = this.scene.add.image(960, 540, textureKey).setOrigin(0.5);
        image.setScale(0.8);
        image.setScrollFactor(0);

        await this.waitForClick();
        image.destroy();
    }

    async handleMinigame(tokens) {
        const id = tokens[1] ?? 'minijuego';
        const options = tokens.slice(2).filter(Boolean);
        const resolvedOptions = options.length ? options : ['respuesta1', 'respuesta2'];

        const scene = this.scene;
        scene.input.enabled = true;
        scene.input.setTopOnly(false);
        const container = scene.add.container(960, 540);
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRoundedRect(-450, -200, 900, 400, 24);

        const title = scene.add.text(0, -120, `Minijuego: ${id}`, {
            fontFamily: 'fredoka',
            fontSize: '36px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const buttons = resolvedOptions.map((label, index) => {
            const localX = -200 + index * 400;
            const localY = 80;
            const btnBg = scene.add.graphics();
            btnBg.fillStyle(0x63a711, 1);
            btnBg.fillRoundedRect(localX - 150, localY - 45, 300, 90, 16);
            const txt = scene.add.text(localX, localY, label, {
                fontFamily: 'fredoka',
                fontSize: '28px',
                color: '#ffffff',
            }).setOrigin(0.5);
            const hitZone = scene.add.rectangle(
                container.x + localX,
                container.y + localY,
                300,
                90,
                0xffffff,
                0.001
            );
            hitZone.setInteractive({ useHandCursor: true });
            hitZone.setScrollFactor(0);
            hitZone.setDepth(901);
            return { visuals: [btnBg, txt], label, hitZone };
        });

        container.add([bg, title, ...buttons.flatMap((b) => b.visuals)]);
        container.setScrollFactor(0);
        container.setDepth(900);

        await this.animateContainerIn(container);

        const choice = await new Promise((resolve) => {
            buttons.forEach(({ hitZone, label }) => {
                hitZone.on('pointerdown', () => resolve(label));
            });
        });

        this.minigames.set(id, choice);

        await this.animateContainerOut(container);
        buttons.forEach(({ hitZone }) => hitZone.destroy());
        container.destroy();
    }

    async handleIf(tokens, currentScene) {
        const id = tokens[1];
        const expected = tokens[2];
        const rest = tokens.slice(3);

        if (!id || !expected || rest.length === 0) return;

        const actual = this.minigames.get(id);
        if (actual !== expected) return;

        return this.executeEvent(rest, `[if] ${id} ${expected}`, currentScene);
    }

    async handleGoto(tokens, currentScene) {
        const label = tokens[1];
        if (!label || !currentScene?.labelMap?.has(label)) return;
        return { jumpTo: label };
    }

    async handleSceneChange(tokens) {
        const target = tokens[1];
        if (!target) return;
        const cam = this.scene.cameras.main;
        return new Promise((resolve) => {
            cam.fadeOut(600, 0, 0, 0);
            cam.once('camerafadeoutcomplete', () => {
                this.scene.scene.start(target);
                resolve();
            });
        });
    }

    async handleCamera(tokens) {
        const direction = normalizeKeyword(tokens[1] ?? '');
        const distance = Number(tokens[2] ?? 300);
        const duration = Number(tokens[3] ?? 1500);

        const cam = this.scene.cameras.main;
        const targetY = direction === 'subir' ? cam.scrollY - distance : cam.scrollY + distance;

        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: cam,
                scrollY: targetY,
                duration,
                ease: 'Sine.inOut',
                onComplete: resolve,
            });
        });
    }

    async handleWait(tokens) {
        const ms = Number(tokens[1] ?? 500);
        return sleep(this.scene, ms);
    }

    parseDialogTokens(tokens) {
        const rawTexts = tokens.filter((token) => token.includes(':'));
        if (rawTexts.length > 0) {
            const map = {};
            rawTexts.forEach((token) => {
                const idx = token.indexOf(':');
                const key = normalizeKeyword(token.slice(0, idx));
                const normalizedKey = key === 'wayu' ? 'wayuunaiki' : key;
                map[normalizedKey] = token.slice(idx + 1).trim();
            });
            return map;
        }

        if (tokens.length >= 2) {
            return { es: tokens[0], wayuunaiki: tokens[1] };
        }

        return { es: tokens[0] ?? '', wayuunaiki: tokens[0] ?? '' };
    }

    resolveDialogText(dialogMap) {
        if (!dialogMap) return '';
        if (this.language === 'wayuunaiki') {
            return dialogMap.wayuunaiki ?? dialogMap.way ?? dialogMap.es ?? '';
        }
        return dialogMap.es ?? dialogMap.wayuunaiki ?? '';
    }

    async animateDialogIn() {
        if (!this.dialogContainer) return;
        this.dialogContainer.setAlpha(0);
        this.dialogContainer.setScale(0.7);
        await this.animateContainerIn(this.dialogContainer);
    }

    async animateDialogOut() {
        if (!this.dialogContainer) return;
        await this.animateContainerOut(this.dialogContainer);
    }

    async animateContainerIn(container) {
        container.setAlpha(0);
        container.setScale(0.7);
        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: container,
                alpha: 1,
                scale: 1.05,
                duration: 220,
                ease: 'Back.out',
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: container,
                        scale: 1,
                        duration: 120,
                        ease: 'Sine.out',
                        onComplete: resolve,
                    });
                },
            });
        });
    }

    async animateContainerOut(container) {
        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: container,
                alpha: 0,
                duration: 120,
                ease: 'Sine.in',
                onComplete: resolve,
            });
        });
    }

    createPauseButton() {
        if (this.pauseButton) return;
        const scene = this.scene;
        const key = scene.textures.exists('pause-icon') ? 'pause-icon' : ensurePlaceholder(scene);
        this.pauseButton = scene.add.image(1840, 80, key).setOrigin(0.5).setScale(0.25);
        this.pauseButton.setScrollFactor(0);
        this.pauseButton.setDepth(1000);
        this.pauseButton.setInteractive({ useHandCursor: true });
        this.pauseButton.on('pointerdown', () => this.togglePause());
    }

    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        this.scene.tweens.timeScale = 0;
        this.scene.time.timeScale = 0;
        this.scene.sound.pauseAll();
        this.showPauseOverlay();
    }

    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this.scene.tweens.timeScale = 1;
        this.scene.time.timeScale = 1;
        this.scene.sound.resumeAll();
        this.hidePauseOverlay();
    }

    showPauseOverlay() {
        if (this.pauseOverlay) return;
        const scene = this.scene;
        scene.input.setTopOnly(true);
        const bg = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.6);
        const panel = scene.add.rectangle(960, 540, 700, 420, 0x1f1f1f, 0.95);
        const title = scene.add.text(960, 390, 'Pausa', {
            fontFamily: 'fredoka',
            fontSize: '48px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const esBtn = this.createLangButton(860, 520, 'Español', this.language === 'es');
        const wayBtn = this.createLangButton(1060, 520, 'Wayuunaiki', this.language === 'wayuunaiki');

        const hint = scene.add.text(960, 640, 'Toca fuera o presiona pausar para continuar', {
            fontFamily: 'fredoka',
            fontSize: '20px',
            color: '#cccccc',
        }).setOrigin(0.5);

        [bg, panel, title, esBtn.container, wayBtn.container, hint].forEach((item, index) => {
            item.setScrollFactor(0);
            item.setDepth(1100 + index);
        });

        bg.setInteractive();
        bg.on('pointerdown', () => this.resume());

        esBtn.container.on('pointerdown', () => {
            this.setLanguage('es');
            esBtn.setActive(true);
            wayBtn.setActive(false);
        });

        wayBtn.container.on('pointerdown', () => {
            this.setLanguage('wayuunaiki');
            esBtn.setActive(false);
            wayBtn.setActive(true);
        });

        this.pauseOverlay = {
            bg,
            panel,
            title,
            hint,
            buttons: [esBtn, wayBtn],
        };
    }

    hidePauseOverlay() {
        if (!this.pauseOverlay) return;
        const { bg, panel, title, hint, buttons } = this.pauseOverlay;
        this.scene.input.setTopOnly(false);
        bg.destroy();
        panel.destroy();
        title.destroy();
        hint.destroy();
        buttons.forEach((btn) => btn.destroy());
        this.pauseOverlay = null;
    }

    createLangButton(x, y, label, active) {
        const scene = this.scene;
        const container = scene.add.container(x, y);
        const base = scene.add.graphics();
        const text = scene.add.text(0, 0, label, {
            fontFamily: 'fredoka',
            fontSize: '24px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const render = (isActive) => {
            base.clear();
            base.fillStyle(isActive ? 0x63a711 : 0x555555, 1);
            base.fillRoundedRect(-140, -30, 280, 60, 16);
        };

        render(active);
        container.add([base, text]);
        container.setSize(280, 60);
        container.setInteractive({ useHandCursor: true });

        return {
            container,
            setActive: render,
            destroy: () => container.destroy(),
        };
    }

    setLanguage(lang) {
        this.language = lang;
        if (this.dialogText && this.dialogText.text) {
            const current = this.dialogText.text;
            const dialogMap = this.lastDialogMap;
            if (dialogMap) {
                this.dialogText.setText(this.resolveDialogText(dialogMap));
            } else {
                this.dialogText.setText(current);
            }
        }
    }
}
