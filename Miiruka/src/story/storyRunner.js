import { normalizeKeyword, parseScript } from './parser.js';
import { GameStorage } from '../utils/storage.js';
import { AudioManager } from '../utils/audio.js';
import { UIHelpers } from '../utils/ui.js';

// Textura placeholder para assets faltantes.
const PLACEHOLDER_KEY = 'story-placeholder';

// Crea (una sola vez) la textura placeholder.
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

// Utilidad para esperar ms dentro de secuencias async.
const sleep = (scene, ms) =>
    new Promise((resolve) => scene.time.delayedCall(ms, resolve));

// Estilo base de texto para el diálogo.
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
        this.characterState = new Map();
        this.characterLipEvents = new Map();
        this.minigames = new Map();
        this.dialogBox = null;
        this.dialogText = null;
        this.dialogSpeaker = null;
        this.dialogContainer = null;
        this.pauseButton = null;
        this.pauseOverlay = null;
        this.language = GameStorage.getLanguage() || 'es';
        this.isPaused = false;
        this.lastDialogMap = null;
        this.walkingCount = 0;
        this.walkSound = null;
        this.musicSound = null;
        this.musicVolume = GameStorage.getMusicVolume();
        this.dialogMetrics = { width: 1840, height: 170 };
        this.pendingSceneQuestion = null;

        // Blindaje: si la escena se cierra abruptamente, no dejamos pasos sonando.
        this.scene.events.once('shutdown', () => this.forceStopAllWalkSounds());
        this.scene.events.once('destroy', () => this.forceStopAllWalkSounds());
    }

    getCharacterNameKey(name) {
        return normalizeKeyword((name || '')).replace(/\s+/g, '');
    }

    resolveCharacterName(name) {
        const raw = (name || '').trim();
        if (!raw) return raw;
        const key = this.getCharacterNameKey(raw);
        const aliases = {
            kai: 'Kai',
            jouktai: 'Jouktai',
            joktai: 'Jouktai',
        };

        for (const existingName of this.characters.keys()) {
            if (this.getCharacterNameKey(existingName) === key) return existingName;
        }
        for (const existingName of this.characterState.keys()) {
            if (this.getCharacterNameKey(existingName) === key) return existingName;
        }
        return aliases[key] || raw;
    }

    // Inicializa UI persistente (botón de pausa).
    initUI() {
        GameStorage.touchChapterSceneBySceneKey(this.scene?.scene?.key);
        this.createPauseButton();
        this.ensureMusic();
    }

    // Ejecuta todos los eventos de una escena del guion en orden.
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

    // Resuelve un comando del guion.
    async executeEvent(tokens, rawLine, currentScene) {
        const keyword = normalizeKeyword(tokens[0]);

        if (keyword === 'label' || keyword === 'etiqueta') return;
        if (keyword === 'plano') return this.handleShot(tokens);
        if (keyword === 'personaje' || keyword === 'char') return this.handleCharacter(tokens);
        if (keyword === 'caminar' || keyword === 'walk') return this.handleWalk(tokens);
        if (keyword === 'bgscroll') return this.handleBgScroll(tokens);
        if (keyword === 'imagen' || keyword === 'image') return this.handleImage(tokens);
        if (keyword === 'mostrar') return this.handleShow(tokens);
        if (keyword === 'pregunta' || keyword === 'quiz' || keyword === 'pregunta_escena' || keyword === 'pregunta_final') {
            return this.handleSceneQuestionCommand(tokens);
        }
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

    // Crea o reutiliza el sprite base de un personaje.
    ensureCharacter(name) {
        name = this.resolveCharacterName(name);
        if (this.characters.has(name)) return this.characters.get(name);
        const textureKey = this.getCharacterTextureKey(name, {
            emotion: 'idle',
            facing: 'mira_jugador',
            mouth: 1,
        });

        const sprite = this.scene.add.image(-300, 780, textureKey).setOrigin(0, 0);
        const useWorld = !!this.scene?.useWorldCharacters;
        sprite.setScrollFactor(useWorld ? 1 : 0);
        sprite.setDepth(200);
        this.characters.set(name, sprite);
        this.characterState.set(name, {
            emotion: 'idle',
            facing: 'mira_jugador',
            mouth: 1,
            flipX: false,
            baseY: 180,
            isWalking: false,
            walkBobTween: null,
        });
        return sprite;
    }

    getCharacterTextureKey(name, state) {
        const emotion = state.emotion || 'idle';
        const facing = state.facing || 'mira_jugador';
        const mouth = state.mouth || 1;
        const key = `char-${name}-${facing}-${emotion}-${mouth}`;
        if (this.scene.textures.exists(key)) return key;

        const mouthClosed = `char-${name}-${facing}-${emotion}-1`;
        if (this.scene.textures.exists(mouthClosed)) return mouthClosed;

        const fallbackEmotionMouth = `char-${name}-${facing}-idle-${mouth}`;
        if (this.scene.textures.exists(fallbackEmotionMouth)) return fallbackEmotionMouth;

        const fallbackEmotion = `char-${name}-${facing}-idle-1`;
        if (this.scene.textures.exists(fallbackEmotion)) return fallbackEmotion;

        const fallbackFacing = `char-${name}-mira_jugador-idle-1`;
        if (this.scene.textures.exists(fallbackFacing)) return fallbackFacing;

        const legacyIdle = `char-${name}-idle`;
        if (this.scene.textures.exists(legacyIdle)) return legacyIdle;

        return ensurePlaceholder(this.scene);
    }

    setCharacterState(name, partial) {
        name = this.resolveCharacterName(name);
        this.ensureCharacter(name);
        const prev = this.characterState.get(name) ?? {
            emotion: 'idle',
            facing: 'mira_jugador',
            mouth: 1,
            flipX: false,
            baseY: 180,
            isWalking: false,
            walkBobTween: null,
        };
        const next = { ...prev, ...partial };
        this.characterState.set(name, next);
        const sprite = this.characters.get(name);
        if (sprite) {
            sprite.setTexture(this.getCharacterTextureKey(name, next));
            sprite.setFlipX(!!next.flipX);
        }
    }

    // Cambia la expresión base del personaje.
    setCharacterEmotion(name, emotion) {
        name = this.resolveCharacterName(name);
        if (!emotion) return;
        if (this.scene.bgScrollActive && (this.scene.bgScrollWalkers || []).includes(name)) return;
        this.setCharacterState(name, { emotion });
    }

    getCharacterTargetPosition(name, direction) {
        const normalized = (name || '').toLowerCase();
        const sprite = this.ensureCharacter(name);
        const cam = this.scene.cameras.main;
        const useWorld = !!this.scene?.useWorldCharacters;
        const sceneWidth = this.scene.scale.width || 1920;
        if (direction === 'derecha') {
            const rightEdgeX = (useWorld ? cam.scrollX : 0) + sceneWidth - 30;
            return { x: rightEdgeX - sprite.displayWidth, y: 180 };
        }
        if (normalized === 'jouktai') {
            return { x: 30, y: 180 };
        }
        if (normalized === 'kai') {
            return { x: 480, y: 180 };
        }
        return { x: 30, y: 180 };
    }

    getSpeakingFacing(name) {
        const othersVisible = Array.from(this.characters.keys()).some((charName) => {
            if (charName === name) return false;
            const sprite = this.characters.get(charName);
            return !!sprite && sprite.visible !== false && sprite.alpha > 0;
        });
        return othersVisible ? 'mira_lado' : 'mira_jugador';
    }

    getSpeakerFlip(name, facing) {
        if (facing !== 'mira_lado') return false;
        const self = this.characters.get(name);
        if (!self) return false;
        let nearest = null;
        this.characters.forEach((sprite, charName) => {
            if (charName === name || !sprite || sprite.visible === false) return;
            if (!nearest || Math.abs(sprite.x - self.x) < Math.abs(nearest.x - self.x)) {
                nearest = sprite;
            }
        });
        if (!nearest) return false;
        return nearest.x < self.x;
    }

    startLipSync(name) {
        this.stopLipSync(name);
        let frameIndex = 0;
        const sequence = [2, 3, 2, 1];
        this.characterLipEvents.set(name, this.scene.time.addEvent({
            delay: 120,
            loop: true,
            callback: () => {
                this.setCharacterState(name, { mouth: sequence[frameIndex % sequence.length] });
                frameIndex += 1;
            },
        }));
    }

    stopLipSync(name) {
        const event = this.characterLipEvents.get(name);
        if (event) {
            event.remove(false);
            this.characterLipEvents.delete(name);
        }
        this.setCharacterState(name, { mouth: 1 });
    }

    startWalkBob(name) {
        const sprite = this.characters.get(name);
        const state = this.characterState.get(name);
        if (!sprite || !state || state.isWalking) return;
        state.isWalking = true;
        state.baseY = sprite.y;
        const runCycle = () => {
            if (!state.isWalking) return;
            this.scene.tweens.add({
                targets: sprite,
                y: state.baseY - 14,
                duration: 170,
                ease: 'Sine.out',
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: sprite,
                        y: state.baseY,
                        duration: 280,
                        ease: 'Sine.in',
                        onComplete: runCycle,
                    });
                },
            });
        };
        runCycle();
    }

    stopWalkBob(name) {
        const sprite = this.characters.get(name);
        const state = this.characterState.get(name);
        if (!sprite || !state) return;
        state.isWalking = false;
        this.scene.tweens.killTweensOf(sprite);
        sprite.y = state.baseY ?? sprite.y;
    }

    // Acciones de cámara/plano predefinidas.
    async handleShot(tokens) {
        const type = normalizeKeyword(tokens[1] ?? '');
        if (type === 'sol_hacia_abajo' || type === 'amanecer') {
            await this.runSunPan();
            return;
        }
    }

    // Paneo del sol hacia abajo usado en la intro.
    async runSunPan() {
        const scene = this.scene;

        const worldHeight = 2000;
        const worldWidth = 3200;
        scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
        const cam = scene.cameras.main;

        cam.scrollY = 0;
        cam.fadeIn(500, 0, 0, 0);
        scene.input.enabled = false;

        scene.add.image(960, 0, 'sky').setOrigin(0.5, 0).setScrollFactor(0);
        scene.sun1 = scene.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        scene.sun2 = scene.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        scene.add.image(960, 1230, 'bg_layer1').setScrollFactor(0.7);
        scene.add.image(960, 1260, 'bg_layer2').setScrollFactor(0.8);
        scene.add.image(960, 1300, 'bg_layer3').setScrollFactor(0.9);
        scene.add.image(960, 1340, 'bg_layer4').setScrollFactor(1);

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

    // Maneja acciones de personajes (entra, emoción, habla).
    async handleCharacter(tokens) {
        const name = this.resolveCharacterName(tokens[1]);
        const normalizedTokens = tokens.map((token) => normalizeKeyword(token));
        const actionIndex = normalizedTokens.findIndex((token) => token === 'entra');
        const action = actionIndex >= 0 ? 'entra' : normalizeKeyword(tokens[2] ?? '');

        if (!name) return;
        const emotionIndex = normalizedTokens.findIndex((token) => token === 'emocion' || token === 'expresion');
        const lookIndex = normalizedTokens.findIndex((token) => token === 'mira');
        const sayIndex = normalizedTokens.findIndex((token) => token === 'habla' || token === 'dice');

        if (emotionIndex >= 0) {
            this.setCharacterEmotion(name, tokens[emotionIndex + 1]);
        }

        if (lookIndex >= 0) {
            const lookRaw = normalizeKeyword(tokens[lookIndex + 1] ?? '');
            const isAutoLook = lookRaw === 'auto';
            const facing = (lookRaw === 'lado' || lookRaw === 'mira_lado')
                ? 'mira_lado'
                : 'mira_jugador';
            const state = this.characterState.get(name) ?? {};
            this.setCharacterState(name, {
                facing,
                mouth: 1,
                // Mantener el flip actual al cambiar mira manualmente.
                // El mirror depende de por dónde entró o ajustes previos.
                flipX: state.flipX ?? false,
                manualFacing: !isAutoLook,
            });
        }

        if (action === 'entra') {
            const directionToken = actionIndex >= 0 ? tokens[actionIndex + 1] : tokens[3];
            const direction = normalizeKeyword(directionToken ?? 'izquierda');
            await this.characterEnter(name, direction);
        }

        if (sayIndex >= 0) {
            const dialogTokens = tokens.slice(sayIndex + 1);
            const dialogData = this.parseDialogTokens(dialogTokens);
            this.lastDialogMap = dialogData.map;
            this.lastDialogImageKey = dialogData.imageKeys;
            const text = this.resolveDialogText(dialogData.map);
            await this.showDialog(name, text, { imageKeys: dialogData.imageKeys });
        }
    }

    // Entrada lateral con flip según dirección.
    async characterEnter(name, direction) {
        name = this.resolveCharacterName(name);
        const sprite = this.ensureCharacter(name);
        const startX = direction === 'derecha' ? 2300 : -300;
        const targetPos = this.getCharacterTargetPosition(name, direction);
        const targetX = targetPos.x;
        const cam = this.scene.cameras.main;
        const useWorld = !!this.scene?.useWorldCharacters;
        const targetY = useWorld ? cam.scrollY + targetPos.y : targetPos.y;
        this.setCharacterState(name, {
            emotion: 'camina',
            mouth: 1,
            facing: 'mira_lado',
            flipX: direction === 'derecha',
        });
        sprite.x = startX;
        sprite.y = targetY;
        this.setCharacterState(name, { baseY: targetY });
        this.startWalkBob(name);

        this.startWalkingSound();
        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: sprite,
                x: targetX,
                duration: 1200,
                ease: 'Sine.out',
                onComplete: () => {
                    this.stopWalkBob(name);
                    this.setCharacterState(name, { emotion: 'idle', mouth: 1 });
                    this.stopWalkingSound();
                    resolve();
                },
            });
        });
    }

    // Muestra un diálogo y espera click para continuar.
    async showDialog(speaker, text, options = {}) {
        speaker = this.resolveCharacterName(speaker);
        const scene = this.scene;
        if (!this.dialogContainer) {
            const boxWidth = this.dialogMetrics.width;
            const boxHeight = this.dialogMetrics.height;

            this.dialogBox = scene.add.graphics();
            this.dialogBox.fillStyle(0x000000, 0.6);
            this.dialogBox.fillRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 24);

            this.dialogSpeaker = scene.add.text(-boxWidth / 2 + 80, -boxHeight / 2 + 30, '', {
                fontFamily: 'fredoka',
                fontSize: '28px',
                color: '#fce1b4',
            }).setOrigin(0, 0.5);

            this.dialogContainer = scene.add.container(960, 975, [
                this.dialogBox,
                this.dialogSpeaker,
            ]);
            this.dialogContainer.setScrollFactor(0);
            this.dialogContainer.setDepth(800);
        }

        let dialogImages = [];
        if (options.imageKeys?.length) {
            const keys = options.imageKeys;
            const count = keys.length;
            const spacing = 240;
            const startX = 1400 - (count - 1) * spacing * 0.5;
            for (let i = 0; i < count; i += 1) {
                const rawKey = keys[i];
                const key = scene.textures.exists(rawKey) ? rawKey : ensurePlaceholder(scene);
                const texture = scene.textures.get(key)?.getSourceImage();
                const imgRadius = texture ? Math.max(texture.width, texture.height) * 0.34 : 180;
                const x = startX + i * spacing;
                const y = 640;

                const frame = scene.add.circle(x, y, imgRadius, 0xffffff, 0.18);
                frame.setStrokeStyle(6, 0xffffff, 0.9);
                frame.setScrollFactor(0);
                frame.setDepth(819);
                frame.setScale(0);

                const img = scene.add.image(x, y, key).setOrigin(0.5);
                img.setScrollFactor(0);
                img.setDepth(820);
                img.setScale(0);
                scene.tweens.add({
                    targets: [frame, img],
                    scale: 0.9,
                    duration: 220,
                    ease: 'Back.out',
                });
                img._frame = frame;
                dialogImages.push(img);
            }
        }

        const speakerState = this.characterState.get(speaker) ?? {};
        const useManualFacing = !!speakerState.manualFacing;
        const speakingFacing = useManualFacing
            ? (speakerState.facing || 'mira_jugador')
            : this.getSpeakingFacing(speaker);
        const isWalkingWithGroup = this.scene.bgScrollActive && (this.scene.bgScrollWalkers || []).includes(speaker);
        const speakerFlip = useManualFacing
            ? !!speakerState.flipX
            : (isWalkingWithGroup ? false : this.getSpeakerFlip(speaker, speakingFacing));
        this.setCharacterState(speaker, {
            facing: speakingFacing,
            mouth: 1,
            flipX: speakerFlip,
        });
        this.dialogSpeaker.setText(speaker);
        this.dialogSpeaker.setColor(this.getSpeakerColor(speaker));
        this.setDialogText(text);
        this.startLipSync(speaker);

        await this.animateDialogIn();

        await this.waitForClick();
        this.stopLipSync(speaker);

        if (dialogImages.length) {
            dialogImages.forEach((dialogImage) => {
                scene.tweens.add({
                    targets: [dialogImage, dialogImage._frame].filter(Boolean),
                    alpha: 0,
                    duration: 120,
                    ease: 'Sine.in',
                    onComplete: () => {
                        if (dialogImage._frame) dialogImage._frame.destroy();
                        dialogImage.destroy();
                    },
                });
            });
        }

        await this.animateDialogOut();
    }

    getSpeakerColor(name) {
        const key = (name || '').trim().toLowerCase();
        if (key === 'jouktai') return '#FCB4B5';
        if (key === 'kai' || key === 'kái') return '#FCE1B4';
        return '#fce1b4';
    }

    // Espera un click válido (ignora si está pausado).
    async waitForClick() {
        const scene = this.scene;
        return new Promise((resolve) => {
            const handler = () => {
                if (this.isPaused) return;
                if (this.ignoreNextDialogClick) {
                    this.ignoreNextDialogClick = false;
                    return;
                }
                if (scene.cache.audio?.exists('dialog-pop')) {
                    scene.sound.play('dialog-pop', { volume: 0.6 });
                }
                scene.input.off('pointerdown', handler);
                resolve();
            };
        scene.input.on('pointerdown', handler);
    });
}

    // Muestra una imagen (o placeholder) a pantalla completa.
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

    // Minijuego placeholder con opciones y registro de respuesta.
    async handleMinigame(tokens) {
        const id = tokens[1] ?? 'minijuego';
        const options = tokens.slice(2).filter(Boolean);
        const resolvedOptions = options.length ? options : ['respuesta1', 'respuesta2'];

        if (id === 'girar_llave') {
            return this.handleFaucetMinigame(id, resolvedOptions);
        }
        if (id === 'encontrar_molino') {
            return this.handleLocateMillMinigame(id);
        }
        if (id === 'soplar_molino') {
            return this.handleBlowMillMinigame(id, resolvedOptions);
        }

        const scene = this.scene;
        scene.input.enabled = true;
        const prevTopOnly = scene.input.topOnly;
        scene.input.setTopOnly(true);
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
            UIHelpers.attachHoverPop(scene, hitZone, 0.35);
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

    // Minijuego: soplar al microfono para hacer girar las aspas.
    async handleBlowMillMinigame(id, options) {
        const scene = this.scene;
        scene.input.enabled = true;
        const prevTopOnly = scene.input.topOnly;
        scene.input.setTopOnly(true);
        const prevAutoSpinSpeed = typeof scene.molinoAutoSpinSpeed === 'number' ? scene.molinoAutoSpinSpeed : 0;
        scene.molinoAutoSpinSpeed = 0;

        let pauseWasInteractive = false;
        if (this.pauseButton) {
            pauseWasInteractive = this.pauseButton.input?.enabled ?? false;
            this.pauseButton.disableInteractive();
            this.pauseButton.setVisible(false);
        }

        const root = scene.add.container(0, 0);
        const bg = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.58);
        bg.setScrollFactor(0);
        root.add(bg);

        const ui = scene.add.container(960, 540);
        ui.setScrollFactor(0);
        root.add(ui);
        root.setDepth(2050);

        const panel = scene.add.graphics();
        panel.fillStyle(0x000000, 0.7);
        panel.fillRoundedRect(-560, -300, 1120, 620, 24);

        const title = scene.add.text(0, -238, 'Sopla para girar el molino', {
            fontFamily: 'fredoka',
            fontSize: '42px',
            color: '#fce1b4',
        }).setOrigin(0.5);

        const hint = scene.add.text(0, -182, 'Sopla hacia la pantalla. Entre mas fuerte, mas rapido gira.', {
            fontFamily: 'fredoka',
            fontSize: '28px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 900 },
        }).setOrigin(0.5);

        const status = scene.add.text(0, 195, 'Esperando sonido...', {
            fontFamily: 'fredoka',
            fontSize: '24px',
            color: '#d9e8ff',
        }).setOrigin(0.5);

        const progressBg = scene.add.rectangle(0, 252, 820, 30, 0xffffff, 0.18).setOrigin(0.5);
        const progressFill = scene.add.rectangle(-410, 252, 812, 22, 0x4ea1ff, 1).setOrigin(0, 0.5);
        progressFill.scaleX = 0;

        const gaugeCenterY = 28;
        const gaugeLabel = scene.add.text(0, -58, 'Intensidad', {
            fontFamily: 'fredoka',
            fontSize: '24px',
            color: '#ffffff',
        }).setOrigin(0.5);
        const gaugeTrack = scene.add.graphics();
        const gaugeNeedle = scene.add.graphics();
        const gaugeHub = scene.add.circle(0, gaugeCenterY, 8, 0xfce1b4, 1);
        const gaugeRadius = 150;
        // Semicirculo superior: izquierda (bajo) a derecha (alto), en sentido horario.
        const gaugeStart = -Math.PI;
        const gaugeEnd = 0;
        const gaugeColors = [0x3b82f6, 0x22c55e, 0xfacc15, 0xfb923c, 0xef4444];
        const drawGaugeTrack = () => {
            gaugeTrack.clear();
            gaugeColors.forEach((color, idx) => {
                const t0 = idx / gaugeColors.length;
                const t1 = (idx + 1) / gaugeColors.length;
                const a0 = Phaser.Math.Linear(gaugeStart, gaugeEnd, t0);
                const a1 = Phaser.Math.Linear(gaugeStart, gaugeEnd, t1);
                gaugeTrack.lineStyle(18, color, 1);
                gaugeTrack.beginPath();
                gaugeTrack.arc(0, gaugeCenterY, gaugeRadius, a0, a1, false);
                gaugeTrack.strokePath();
            });
        };
        drawGaugeTrack();
        const updateGaugeNeedle = (strength) => {
            const clamped = Phaser.Math.Clamp(strength, 0, 1);
            const angle = Phaser.Math.Linear(gaugeStart, gaugeEnd, clamped);
            const endX = Math.cos(angle) * (gaugeRadius - 16);
            const endY = gaugeCenterY + Math.sin(angle) * (gaugeRadius - 16);
            gaugeNeedle.clear();
            gaugeNeedle.lineStyle(6, 0xf8fafc, 1);
            gaugeNeedle.beginPath();
            gaugeNeedle.moveTo(0, gaugeCenterY);
            gaugeNeedle.lineTo(endX, endY);
            gaugeNeedle.strokePath();
        };
        updateGaugeNeedle(0);

        ui.add([panel, title, hint, status, progressBg, progressFill, gaugeLabel, gaugeTrack, gaugeNeedle, gaugeHub]);
        await this.animateContainerIn(ui);

        let resolveDone;
        const donePromise = new Promise((resolve) => {
            resolveDone = resolve;
        });

        let finished = false;
        const cleanup = async () => {
            if (finished) return;
            finished = true;
            if (this.pauseButton) {
                this.pauseButton.setVisible(true);
                if (pauseWasInteractive) this.pauseButton.setInteractive({ useHandCursor: true });
            }
            if (pointerUpHandler) {
                scene.input.off('pointerup', pointerUpHandler);
                pointerUpHandler = null;
            }
            if (pointerUpOutsideHandler) {
                scene.input.off('pointerupoutside', pointerUpOutsideHandler);
                pointerUpOutsideHandler = null;
            }
            if (holdPulseTween) {
                holdPulseTween.stop();
                holdPulseTween = null;
            }
            if (holdButton) {
                holdButton.destroy();
                holdButton = null;
            }
            if (holdHitZone) {
                holdHitZone.destroy();
                holdHitZone = null;
            }
            scene.input.setTopOnly(prevTopOnly);
            await this.animateContainerOut(ui);
            root.destroy(true);
            resolveDone();
        };

        let rafId = null;
        let audioCtx = null;
        let analyser = null;
        let mediaStream = null;
        let sourceNode = null;
        let holdMode = false;
        let holding = false;
        let holdButton = null;
        let holdHitZone = null;
        let holdPulseTween = null;
        let pointerUpHandler = null;
        let pointerUpOutsideHandler = null;
        const target = 100;
        let progress = 0;
        let smoothed = 0;
        let noiseFloor = 0.01;
        let lastTs = performance.now();
        let currentAngularSpeed = 0.5;
        let holdStrength = 0;
        const speedSamples = [];
        const maxSpeedSamples = 14;

        const complete = async () => {
            const sampledSpeed = speedSamples.length
                ? speedSamples.reduce((acc, value) => acc + value, 0) / speedSamples.length
                : currentAngularSpeed;
            const mediumSpeed = 2.4;
            const targetAutoSpeed = Phaser.Math.Clamp((sampledSpeed + mediumSpeed) * 0.5, 1.2, 3.6);
            if (scene.tweens && scene.molinoAspas) {
                if (scene.molinoAutoSpinTween) {
                    scene.molinoAutoSpinTween.stop();
                    scene.molinoAutoSpinTween = null;
                }
                scene.molinoAutoSpinSpeed = sampledSpeed;
                scene.molinoAutoSpinTween = scene.tweens.add({
                    targets: scene,
                    molinoAutoSpinSpeed: targetAutoSpeed,
                    duration: 850,
                    ease: 'Sine.inOut',
                    onComplete: () => {
                        scene.molinoAutoSpinTween = null;
                    },
                });
            } else {
                scene.molinoAutoSpinSpeed = targetAutoSpeed || prevAutoSpinSpeed;
            }
            this.minigames.set(id, options[0] ?? 'respuesta1');
            if (scene.cache.audio?.exists('success-bell')) {
                scene.sound.play('success-bell', { volume: 0.65 });
            }
            await cleanup();
        };

        const rotateMill = (strength, dtSec) => {
            // strength 0..1 => velocidad angular base.
            if (scene.molinoAspas) {
                scene.molinoAspas.rotation += (0.5 + strength * 5.5) * dtSec;
            }
        };

        const tick = () => {
            const now = performance.now();
            const dtSec = Math.min((now - lastTs) / 1000, 0.05);
            lastTs = now;

            let strength = 0;
            if (holdMode) {
                // Fallback sin microfono: la intensidad sube gradualmente
                // mientras se mantiene presionado, y decae al soltar.
                const holdTarget = holding ? 0.78 : 0;
                const risePerSecond = 0.85;
                const fallPerSecond = 1.6;
                if (holdTarget > holdStrength) {
                    holdStrength = Math.min(holdTarget, holdStrength + risePerSecond * dtSec);
                } else {
                    holdStrength = Math.max(holdTarget, holdStrength - fallPerSecond * dtSec);
                }
                strength = holdStrength;
            } else if (analyser) {
                const data = new Uint8Array(analyser.fftSize);
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i += 1) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                noiseFloor = noiseFloor * 0.98 + Math.min(rms, 0.04) * 0.02;
                // Muy sensible para soplar hacia pantalla, con compresion para no saturar.
                const normalized = Phaser.Math.Clamp((rms - noiseFloor) * 28, 0, 1);
                smoothed = smoothed * 0.78 + normalized * 0.22;
                strength = smoothed;
            }

            updateGaugeNeedle(strength);
            currentAngularSpeed = 0.5 + strength * 5.5;
            if (strength > 0.06) {
                speedSamples.push(currentAngularSpeed);
                if (speedSamples.length > maxSpeedSamples) speedSamples.shift();
            }
            rotateMill(strength, dtSec);

            if (strength > 0.06) {
                progress += dtSec * (8 + strength * 42);
                status.setText('Soplando... sigue asi');
            } else if (holdMode) {
                status.setText(holding ? 'Impulsando aspas...' : 'Manten presionado para soplar');
            } else {
                status.setText('Sopla hacia la pantalla');
            }

            progress = Phaser.Math.Clamp(progress, 0, target);
            progressFill.scaleX = progress / target;

            if (progress >= target) {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = null;
                complete();
                return;
            }
            rafId = requestAnimationFrame(tick);
        };

        const enableHoldFallback = () => {
            holdMode = true;
            status.setText('Sin microfono: manten presionado para soplar');
            const holdHint = scene.add.text(0, 150, 'Presiona y manten para soplar', {
                fontFamily: 'fredoka',
                fontSize: '22px',
                color: '#ffd58a',
            }).setOrigin(0.5);
            ui.add(holdHint);

            holdButton = scene.add.container(0, 20);
            const holdBtnShadow = scene.add.circle(2, 5, 44, 0x000000, 0.28);
            const holdBtnOuter = scene.add.circle(0, 0, 44, 0x1d8f4a, 1);
            holdBtnOuter.setStrokeStyle(5, 0xfce1b4, 0.9);
            const holdBtnInner = scene.add.circle(0, 0, 24, 0xfce1b4, 1);
            holdButton.add([holdBtnShadow, holdBtnOuter, holdBtnInner]);
            holdButton.setSize(92, 92);
            ui.add(holdButton);

            holdHitZone = scene.add.zone(ui.x + holdButton.x, ui.y + holdButton.y, 96, 96);
            holdHitZone.setScrollFactor(0);
            holdHitZone.setDepth(root.depth + 1);
            holdHitZone.setInteractive({ useHandCursor: true });

            holdHitZone.on('pointerdown', () => {
                holding = true;
                if (holdPulseTween) {
                    holdPulseTween.pause();
                }
                holdButton.setScale(0.94);
            });
            holdHitZone.on('pointerup', () => {
                holding = false;
                holdButton.setScale(1);
                if (holdPulseTween) {
                    holdPulseTween.resume();
                }
            });
            holdHitZone.on('pointerout', () => {
                holding = false;
                holdButton.setScale(1);
                if (holdPulseTween) {
                    holdPulseTween.resume();
                }
            });
            UIHelpers.attachHoverPop(scene, holdHitZone, 0.35);
            holdPulseTween = scene.tweens.add({
                targets: holdButton,
                scaleX: 1.06,
                scaleY: 1.06,
                duration: 460,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.inOut',
            });

            pointerUpHandler = () => {
                holding = false;
                if (holdButton) holdButton.setScale(1);
                if (holdPulseTween) holdPulseTween.resume();
            };
            pointerUpOutsideHandler = () => {
                holding = false;
                if (holdButton) holdButton.setScale(1);
                if (holdPulseTween) holdPulseTween.resume();
            };
            scene.input.on('pointerup', pointerUpHandler);
            scene.input.on('pointerupoutside', pointerUpOutsideHandler);
        };

        try {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!navigator.mediaDevices?.getUserMedia || !AudioContextCtor) {
                enableHoldFallback();
            } else {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });
                audioCtx = new AudioContextCtor();
                sourceNode = audioCtx.createMediaStreamSource(mediaStream);
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.18;
                sourceNode.connect(analyser);
                status.setText('Sopla para girar las aspas');
            }
        } catch (error) {
            enableHoldFallback();
        }

        rafId = requestAnimationFrame(tick);
        await donePromise;

        if (rafId) cancelAnimationFrame(rafId);
        if (sourceNode) {
            try { sourceNode.disconnect(); } catch {}
        }
        if (analyser) {
            try { analyser.disconnect(); } catch {}
        }
        if (audioCtx) {
            try { await audioCtx.close(); } catch {}
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
        }
    }

    // Minijuego: ubicar el molino en el mapa.
    async handleLocateMillMinigame(id) {
        const scene = this.scene;
        scene.input.enabled = true;
        const prevTopOnly = scene.input.topOnly;
        scene.input.setTopOnly(true);

        let pauseWasInteractive = false;
        if (this.pauseButton) {
            pauseWasInteractive = this.pauseButton.input?.enabled ?? false;
            this.pauseButton.disableInteractive();
            this.pauseButton.setVisible(false);
        }

        const root = scene.add.container(0, 0);
        const bg = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.6);
        bg.setScrollFactor(0);
        root.add(bg);

        const map = scene.add.image(960, 520, 'mapa-molino').setOrigin(0.5);
        map.setScrollFactor(0);
        map.setDepth(900);
        const scale = 0.9;
        map.setScale(scale);

        const hint = scene.add.text(960, 940, 'Toca el lugar donde debe ir el molino', {
            fontFamily: 'fredoka',
            fontSize: '26px',
            color: '#ffffff',
        }).setOrigin(0.5);
        hint.setScrollFactor(0);
        hint.setDepth(910);

        const errorText = scene.add.text(960, 900, '', {
            fontFamily: 'fredoka',
            fontSize: '22px',
            color: '#ff6b6b',
        }).setOrigin(0.5);
        errorText.setScrollFactor(0);
        errorText.setDepth(910);

        root.add([map, hint, errorText]);
        root.setDepth(880);

        const target = { x: 200, y: 460 }; // coordenadas en el mapa (px)
        const tolerance = 70;
        let marker = null;
        let ring = null;

        const placeMarker = (x, y, success) => {
            if (marker) marker.destroy();
            if (ring) ring.destroy();
            marker = scene.add.image(x, y, 'mini-molino').setOrigin(0.5);
            marker.setScrollFactor(0);
            marker.setDepth(920);
            marker.setScale(0.7);

            ring = scene.add.circle(x, y, success ? 58 : 54, success ? 0x00c853 : 0xff3b30, 0.12);
            ring.setStrokeStyle(4, success ? 0x00c853 : 0xff3b30, 0.9);
            ring.setScrollFactor(0);
            ring.setDepth(919);
            root.add([ring, marker]);
        };

        const toLocal = (pointer) => {
            const localX = (pointer.x - map.x) / scale + map.width / 2;
            const localY = (pointer.y - map.y) / scale + map.height / 2;
            return { x: localX, y: localY };
        };

        const toWorld = (local) => {
            const worldX = map.x + (local.x - map.width / 2) * scale;
            const worldY = map.y + (local.y - map.height / 2) * scale;
            return { x: worldX, y: worldY };
        };

        let resolveDone;
        const donePromise = new Promise((resolve) => {
            resolveDone = resolve;
        });

        const onPointer = (pointer) => {
            const local = toLocal(pointer);
            const dist = Phaser.Math.Distance.Between(local.x, local.y, target.x, target.y);
            const world = toWorld(local);
            if (dist <= tolerance) {
                errorText.setText('');
                placeMarker(world.x, world.y, true);
                if (scene.cache.audio?.exists('success-bell')) {
                    scene.sound.play('success-bell', { volume: 0.7 });
                }
                scene.input.off('pointerdown', onPointer);
                this.minigames.set(id, 'respuesta1');
                hint.setText('¡Correcto! Toca para continuar.');
                errorText.setText('');
                const finishHandler = () => {
                    scene.input.off('pointerdown', finishHandler);
                    root.destroy(true);
                    if (this.pauseButton) {
                        this.pauseButton.setVisible(true);
                        if (pauseWasInteractive) this.pauseButton.setInteractive({ useHandCursor: true });
                    }
                    scene.input.setTopOnly(prevTopOnly);
                    resolveDone();
                };
                scene.input.once('pointerdown', finishHandler);
                return;
            }

            placeMarker(world.x, world.y, false);
            errorText.setText('Ese no es el lugar correcto. Intenta de nuevo.');
            if (scene.cache.audio?.exists('wrong-option')) {
                scene.sound.play('wrong-option', { volume: 0.7 });
            }
        };

        scene.input.on('pointerdown', onPointer);
        return donePromise;
    }

    // Minijuego: girar la palanca del grifo 90 grados.
    async handleFaucetMinigame(id, options) {
        const scene = this.scene;
        scene.input.enabled = true;
        const prevTopOnly = scene.input.topOnly;
        scene.input.setTopOnly(true);

        let pauseWasInteractive = false;
        if (this.pauseButton) {
            pauseWasInteractive = this.pauseButton.input?.enabled ?? false;
            this.pauseButton.disableInteractive();
            this.pauseButton.setVisible(false);
        }

        const root = scene.add.container(0, 0);
        const bg = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.6);
        bg.setScrollFactor(0);
        root.add(bg);

        const ui = scene.add.container(960, 540);
        ui.setScrollFactor(0);
        root.add(ui);

        const base = scene.add.image(0, 50, 'grifo-cano').setOrigin(0.5);
        const handleTexture = scene.textures.get('grifo-manija')?.getSourceImage();
        const handleWidth = handleTexture?.width ?? 202;
        const handleHeight = handleTexture?.height ?? 202;
        // Nuevo eje de giro de la palanca.
        const pivotX = 101;
        const pivotY = 101;
        const handle = scene.add.image(0, 0, 'grifo-manija')
            .setOrigin(pivotX / handleWidth, pivotY / handleHeight);
        handle.setDepth(2);

        const handleSize = Math.min(handleWidth, handleHeight);
        const radius = handleWidth * 0.5;
        const startAngle = 0;
        const endAngle = startAngle + Math.PI / 2 ;

        const indicator = scene.add.graphics();
        indicator.setDepth(3);
        indicator.lineStyle(6, 0x4ea1ff, 1);
        for (let t = startAngle; t < endAngle; t += 0.22) {
            const x = Math.cos(t) * radius;
            const y = Math.sin(t) * radius;
            indicator.fillStyle(0x4ea1ff, 1);
            indicator.fillCircle(x, y, 6);
        }

        const arrowX = Math.cos(endAngle) * radius;
        const arrowY = Math.sin(endAngle) * radius;
        const tangent = endAngle + Math.PI / 2;
        const arrowSize = 32;
        const left = {
            x: arrowX - Math.cos(tangent - 0.6) * arrowSize,
            y: arrowY - Math.sin(tangent - 0.6) * arrowSize,
        };
        const right = {
            x: arrowX - Math.cos(tangent + 0.6) * arrowSize,
            y: arrowY - Math.sin(tangent + 0.6) * arrowSize,
        };
        indicator.fillStyle(0x4ea1ff, 1);
        indicator.fillTriangle(
            arrowX,
            arrowY,
            left.x,
            left.y,
            right.x,
            right.y
        );

        const progressLabel = scene.add.text(0, 320, 'Arrastra la palanca 90° para abrir', {
            fontFamily: 'fredoka',
            fontSize: '28px',
            color: '#ffffff',
        }).setOrigin(0.5, 0.5);

        const progressBg = scene.add.rectangle(0, 370, 620, 22, 0xffffff, 0.2).setOrigin(0.5);
        const progressFill = scene.add.rectangle(-310, 370, 600, 16, 0x4ea1ff, 1).setOrigin(0, 0.5);
        progressFill.scaleX = 0;

        ui.add([base, handle, indicator, progressLabel, progressBg, progressFill]);
        ui.setDepth(950);
        ui.setScrollFactor(0);
        root.setDepth(940);

        await this.animateContainerIn(ui);

        let lastAngle = startAngle;
        let openedRotation = 0;
        let openSign = 0;
        let finished = false;
        const target = Math.PI / 2;
        const squeak = scene.sound.add('metal-squeak', { volume: 0.5, loop: true });
        const success = scene.sound.add('success-bell', { volume: 0.7 });

        let resolveDone;
        const donePromise = new Promise((resolve) => {
            resolveDone = resolve;
        });

        const complete = async () => {
            if (finished) return;
            finished = true;
            scene.input.off('pointerdown', pointerDownHandler);
            scene.input.off('pointermove', pointerMoveHandler);
            scene.input.off('pointerup', pointerUpHandler);
            if (squeak.isPlaying) squeak.stop();
            this.minigames.set(id, options[0] ?? 'respuesta1');
            success.play();
            await this.animateContainerOut(ui);
            root.destroy(true);
            if (this.pauseButton) {
                this.pauseButton.setVisible(true);
                if (pauseWasInteractive) this.pauseButton.setInteractive({ useHandCursor: true });
            }
            scene.input.setTopOnly(prevTopOnly);
            resolveDone();
        };

        const onDragStart = (pointer) => {
            lastAngle = Phaser.Math.Angle.Between(ui.x, ui.y, pointer.x, pointer.y);
        };

        const onDrag = (pointer) => {
            const angle = Phaser.Math.Angle.Between(ui.x, ui.y, pointer.x, pointer.y);
            const delta = Phaser.Math.Angle.Wrap(angle - lastAngle);
            if (Math.abs(delta) > 0.002) {
                if (openSign === 0) {
                    openSign = delta >= 0 ? 1 : -1;
                }
                const signedDelta = delta * openSign;
                openedRotation = Phaser.Math.Clamp(openedRotation + signedDelta, 0, target);
                handle.rotation = openedRotation * openSign;
                const progress = Phaser.Math.Clamp(openedRotation / target, 0, 1);
                progressFill.scaleX = progress;
                if (openedRotation >= target) {
                    complete();
                }
            }

            lastAngle = angle;
        };

        let dragging = false;
        const hitRadius = Math.max(72, handleWidth * 0.5);

        const pointerDownHandler = (pointer) => {
            const worldX = ui.x;
            const worldY = ui.y;
            const dx = pointer.x - worldX;
            const dy = pointer.y - worldY;
            if (Math.hypot(dx, dy) > hitRadius) return;
            dragging = true;
            if (!squeak.isPlaying) squeak.play();
            onDragStart(pointer);
        };

        const pointerMoveHandler = (pointer) => {
            if (!dragging) return;
            onDrag(pointer);
        };

        const pointerUpHandler = () => {
            if (!dragging) return;
            dragging = false;
            if (squeak.isPlaying) squeak.stop();
        };

        scene.input.on('pointerdown', pointerDownHandler);
        scene.input.on('pointermove', pointerMoveHandler);
        scene.input.on('pointerup', pointerUpHandler);

        return donePromise;
    }

    // Ejecuta un evento solo si la respuesta del minijuego coincide.
    async handleIf(tokens, currentScene) {
        const id = tokens[1];
        const expected = tokens[2];
        const rest = tokens.slice(3);

        if (!id || !expected || rest.length === 0) return;

        const actual = this.minigames.get(id);
        if (actual !== expected) return;

        return this.executeEvent(rest, `[if] ${id} ${expected}`, currentScene);
    }

    // Salta a una etiqueta dentro de la escena actual.
    async handleGoto(tokens, currentScene) {
        const label = tokens[1];
        if (!label || !currentScene?.labelMap?.has(label)) return;
        return { jumpTo: label };
    }

    // Cambia de escena con fade-out.
    async handleSceneChange(tokens) {
        const target = tokens[1];
        if (!target) return;
        const cam = this.scene.cameras.main;
        return new Promise((resolve) => {
            cam.fadeOut(600, 0, 0, 0);
            cam.once('camerafadeoutcomplete', async () => {
                this.resetWalkingSound();
                this.characterLipEvents.forEach((event) => event.remove(false));
                this.characterLipEvents.clear();
                if (this.pendingSceneQuestion) {
                    const question = this.pendingSceneQuestion;
                    this.pendingSceneQuestion = null;
                    // Quitamos el FX de fade para que la UI de la pregunta sea visible.
                    cam.resetFX();
                    await this.showSceneQuestion(question);
                }
                GameStorage.transitionScene(this.scene?.scene?.key, target);
                this.scene.scene.start(target);
                resolve();
            });
        });
    }

    // Mueve la cámara hacia arriba/abajo.
    async handleCamera(tokens) {
        const direction = normalizeKeyword(tokens[1] ?? '');
        const rawDistance = tokens[2] ?? 300;
        let distance = Number(rawDistance);
        if (Number.isNaN(distance) && typeof this.scene?.getCameraPanDistance === 'function') {
            distance = this.scene.getCameraPanDistance();
        }
        if (Number.isNaN(distance)) distance = 300;
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

    // Espera un tiempo en ms.
    async handleWait(tokens) {
        const ms = Number(tokens[1] ?? 500);
        return sleep(this.scene, ms);
    }

    handleSceneQuestionCommand(tokens) {
        const kv = {};
        tokens.slice(1).forEach((token) => {
            const idx = token.indexOf(':');
            if (idx <= 0) return;
            const key = normalizeKeyword(token.slice(0, idx));
            const value = token.slice(idx + 1).trim();
            kv[key] = value;
        });

        const question = {
            map: {
                es: kv.es || kv.pregunta || '',
                wayuunaiki: kv.wayuunaiki || kv.way || kv.wayuunaiki || kv.es || kv.pregunta || '',
            },
            correct: Number(kv.correcta ?? kv.correct ?? kv.respuesta ?? 1),
            options: [],
        };

        for (let i = 1; i <= 4; i += 1) {
            const es = kv[`op${i}es`] || kv[`opcion${i}es`] || kv[`op${i}`] || kv[`opcion${i}`];
            const way = kv[`op${i}way`] || kv[`op${i}wayuunaiki`] || kv[`opcion${i}way`] || kv[`opcion${i}wayuunaiki`] || es;
            if (es) {
                question.options.push({
                    es,
                    wayuunaiki: way,
                    index: i,
                });
            }
        }

        if (!question.map.es || question.options.length < 2) {
            console.warn('[StoryRunner] pregunta_escena invalida: faltan enunciado u opciones.');
            return;
        }

        if (question.correct < 1 || question.correct > question.options.length) {
            question.correct = 1;
        }

        this.pendingSceneQuestion = question;
    }

    async showSceneQuestion(questionData) {
        const scene = this.scene;
        const prevTopOnly = scene.input.topOnly;
        scene.input.setTopOnly(true);

        let pauseWasInteractive = false;
        if (this.pauseButton) {
            pauseWasInteractive = this.pauseButton.input?.enabled ?? false;
            this.pauseButton.disableInteractive();
            this.pauseButton.setVisible(false);
        }

        const root = scene.add.container(0, 0);
        const backdrop = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.8);
        backdrop.setScrollFactor(0);
        root.add(backdrop);

        const panel = scene.add.container(960, 540);
        panel.setScrollFactor(0);
        root.add(panel);
        root.setDepth(2500);

        const width = 1500;
        const height = 620;
        const box = scene.add.graphics();
        box.fillStyle(0x000000, 0.6);
        box.fillRoundedRect(-width / 2, -height / 2, width, height, 24);

        const title = scene.add.text(0, -240, 'Pregunta', {
            fontFamily: 'fredoka',
            fontSize: '36px',
            color: '#fce1b4',
        }).setOrigin(0.5);

        const questionText = scene.add.text(0, -165, this.resolveDialogText(questionData.map), {
            ...defaultDialogStyle,
            fontSize: '34px',
            wordWrap: { width: 1300 },
        }).setOrigin(0.5);

        const feedback = scene.add.text(0, 245, '', {
            fontFamily: 'fredoka',
            fontSize: '26px',
            color: '#ffb3b3',
        }).setOrigin(0.5);

        const optionButtons = questionData.options.map((option, idx) => {
            const y = -55 + idx * 95;
            const btn = scene.add.container(0, y);
            const base = scene.add.graphics();
            const border = scene.add.graphics();
            const label = scene.add.text(0, 0, this.language === 'wayuunaiki' ? option.wayuunaiki : option.es, {
                fontFamily: 'fredoka',
                fontSize: '30px',
                color: '#ffffff',
                wordWrap: { width: 1150 },
                align: 'center',
            }).setOrigin(0.5);

            const btnWidth = 1220;
            const btnHeight = 74;
            const render = (hovered) => {
                base.clear();
                border.clear();
                base.fillStyle(hovered ? 0x2f7a36 : 0x1f1f1f, hovered ? 0.95 : 0.9);
                base.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 16);
                border.lineStyle(3, hovered ? 0xfce1b4 : 0xffffff, hovered ? 0.95 : 0.45);
                border.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 16);
            };

            render(false);
            btn.add([base, border, label]);
            btn.setSize(btnWidth, btnHeight);
            return { btn, option, render, y, btnWidth, btnHeight };
        });

        panel.add([box, title, questionText, feedback, ...optionButtons.map((entry) => entry.btn)]);

        const hitZones = optionButtons.map((entry) => {
            const hit = scene.add.rectangle(960, 540 + entry.y, entry.btnWidth, entry.btnHeight, 0xffffff, 0.001);
            hit.setScrollFactor(0);
            hit.setDepth(2605);
            hit.setInteractive({ useHandCursor: true });
            UIHelpers.attachHoverPop(scene, hit, 0.35);
            hit.on('pointerover', () => {
                entry.render(true);
                entry.btn.setScale(1.02);
            });
            hit.on('pointerout', () => {
                entry.render(false);
                entry.btn.setScale(1);
            });
            return hit;
        });
        await this.animateContainerIn(panel);

        await new Promise((resolve) => {
            optionButtons.forEach(({ btn, option }, idx) => {
                hitZones[idx].on('pointerdown', () => {
                    if (scene.cache.audio?.exists('pop')) {
                        scene.sound.play('pop', { volume: 0.8 });
                    }
                    if (option.index === questionData.correct) {
                        feedback.setColor('#9df0a8');
                        feedback.setText('Respuesta correcta');
                        if (scene.cache.audio?.exists('success-bell')) {
                            scene.sound.play('success-bell', { volume: 0.6 });
                        }
                        scene.time.delayedCall(260, resolve);
                        return;
                    }

                    feedback.setColor('#ffb3b3');
                    feedback.setText('Esa no es la respuesta correcta. Intenta de nuevo.');
                    if (scene.cache.audio?.exists('wrong-option')) {
                        scene.sound.play('wrong-option', { volume: 0.7 });
                    }
                    scene.tweens.add({
                        targets: btn,
                        x: 12,
                        duration: 55,
                        yoyo: true,
                        repeat: 3,
                        onComplete: () => {
                            btn.x = 0;
                        },
                    });
                });
            });
        });

        await this.animateContainerOut(panel);
        hitZones.forEach((hit) => hit.destroy());
        root.destroy(true);
        scene.input.setTopOnly(prevTopOnly);
        if (this.pauseButton) {
            this.pauseButton.setVisible(true);
            if (pauseWasInteractive) this.pauseButton.setInteractive({ useHandCursor: true });
        }
    }

    // Soporta diálogos bilingües por tokens: es:..., way:...
    parseDialogTokens(tokens) {
        const imageKeys = [];
        const filtered = tokens.filter((token) => {
            const normalized = normalizeKeyword(token);
            if (normalized.startsWith('img:') || normalized.startsWith('imagen:') || normalized.startsWith('image:')) {
                const raw = token.split(':')[1]?.trim();
                if (raw) {
                    raw.split(/[,|]/).map((v) => v.trim()).filter(Boolean).forEach((key) => imageKeys.push(key));
                }
                return false;
            }
            return true;
        });

        const rawTexts = filtered.filter((token) => token.includes(':'));
        if (rawTexts.length > 0) {
            const map = {};
            rawTexts.forEach((token) => {
                const idx = token.indexOf(':');
                const key = normalizeKeyword(token.slice(0, idx));
                const normalizedKey = key === 'wayu' ? 'wayuunaiki' : key;
                map[normalizedKey] = token.slice(idx + 1).trim();
            });
            return { map, imageKeys };
        }

        if (filtered.length >= 2) {
            return { map: { es: filtered[0], wayuunaiki: filtered[1] }, imageKeys };
        }

        return { map: { es: filtered[0] ?? '', wayuunaiki: filtered[0] ?? '' }, imageKeys };
    }

    // Elige el texto correcto según idioma activo.
    resolveDialogText(dialogMap) {
        if (!dialogMap) return '';
        if (this.language === 'wayuunaiki') {
            return dialogMap.wayuunaiki ?? dialogMap.way ?? dialogMap.es ?? '';
        }
        return dialogMap.es ?? dialogMap.wayuunaiki ?? '';
    }

    // Animación bouncy de entrada del diálogo.
    async animateDialogIn() {
        if (!this.dialogContainer) return;
        this.dialogContainer.setAlpha(0);
        this.dialogContainer.setScale(0.7);
        await this.animateContainerIn(this.dialogContainer);
    }

    // Animación de salida rápida.
    async animateDialogOut() {
        if (!this.dialogContainer) return;
        await this.animateContainerOut(this.dialogContainer);
    }

    // Reutilizable: entrada con rebote.
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

    // Reutilizable: salida con fade corto.
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

    // Botón de pausa flotante.
    createPauseButton() {
        if (this.pauseButton) return;
        const scene = this.scene;
        const key = scene.textures.exists('pause-icon') ? 'pause-icon' : ensurePlaceholder(scene);
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

    // Alterna pausa/reanudar.
    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    // Pausa animaciones, timers y audio.
    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        this.scene.tweens.timeScale = 0;
        this.scene.time.timeScale = 0;
        this.scene.sound.pauseAll();
        this.showPauseOverlay();
    }

    // Reanuda animaciones, timers y audio.
    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this.scene.tweens.timeScale = 1;
        this.scene.time.timeScale = 1;
        this.scene.sound.resumeAll();
        this.hidePauseOverlay();
    }

    // Muestra el overlay de pausa con selector de idioma.
    showPauseOverlay() {
        if (this.pauseOverlay) return;
        const scene = this.scene;
        scene.input.setTopOnly(true);
        const bg = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.6);
        const panel = scene.add.rectangle(960, 540, 860, 640, 0x1f1f1f, 0.95);
        const title = scene.add.text(960, 350, 'Pausa', {
            fontFamily: 'fredoka',
            fontSize: '48px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const langToggle = this.createLanguageToggle(960, 450, [
            { id: 'es', label: 'Español' },
            { id: 'wayuunaiki', label: 'Wayuu' },
        ], this.language);

        const currentMusicEnabled = GameStorage.getMusicEnabled();
        const initialLevel = currentMusicEnabled ? Math.round(this.musicVolume * 10) : 0;
        const volumeSlider = this.createVolumeSelector(960, 560, 10, initialLevel, (level) => {
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume: 0.8 });
            }
            this.setMusicVolume(level / 10, { fromUser: true });
            this.ignoreNextDialogClick = true;
        });

        const restartBtn = this.createPauseActionButton(760, 650, 'Reiniciar capítulo', () => {
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume: 0.8 });
            }
            const chapterInfo = this.getCurrentChapterInfo();
            if (chapterInfo) {
                GameStorage.commitChapterSession(chapterInfo.chapter);
            }
            this.resume();
            this.resetWalkingSound();
            this.ignoreNextDialogClick = true;
            scene.scene.restart();
        });

        const menuBtn = this.createPauseActionButton(1160, 650, 'Volver a capítulos', () => {
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume: 0.8 });
            }
            const chapterInfo = this.getCurrentChapterInfo();
            if (chapterInfo) {
                GameStorage.commitChapterSession(chapterInfo.chapter);
            }
            this.resume();
            this.resetWalkingSound();
            this.ignoreNextDialogClick = true;
            scene.scene.start('Capitulos', {
                gearsOffsetX: 0,
                gearsOffsetY: 0,
            });
        });

        const pagination = this.createScenePagination(960, 760, (target) => {
            if (!target) return;
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume: 0.8 });
            }
            GameStorage.jumpToScene(this.scene?.scene?.key, target);
            this.resume();
            this.resetWalkingSound();
            this.ignoreNextDialogClick = true;
            scene.scene.start(target);
        });

        const hint = scene.add.text(960, 865, 'Toca fuera o presiona pausar para continuar', {
            fontFamily: 'fredoka',
            fontSize: '20px',
            color: '#cccccc',
        }).setOrigin(0.5);

        [bg, panel, title, langToggle.container, volumeSlider.container, restartBtn.container, menuBtn.container, pagination.container, hint].forEach((item, index) => {
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
            panel,
            title,
            hint,
            buttons: [langToggle, volumeSlider, restartBtn, menuBtn, pagination],
        };
    }

    // Cierra el overlay de pausa.
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

    // Toggle de idioma estilo "pill" doble.
    createLanguageToggle(x, y, options, activeId) {
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

        const hitLeft = scene.add.rectangle(-width / 4, 0, width / 2, height, 0xffffff, 0.001);
        const hitRight = scene.add.rectangle(width / 4, 0, width / 2, height, 0xffffff, 0.001);
        hitLeft.setInteractive({ useHandCursor: true });
        hitRight.setInteractive({ useHandCursor: true });

        const render = (id) => {
            activePill.clear();
            const isLeft = id === options[0].id;
            const pillX = isLeft ? -width / 4 : width / 4;
            activePill.fillStyle(0x63a711, 1);
            activePill.fillRoundedRect(pillX - (width / 4) + 12, -height / 2 + 10, width / 2 - 24, height - 20, 16);
            leftText.setColor(isLeft ? '#ffffff' : '#8b8b8b');
            rightText.setColor(!isLeft ? '#ffffff' : '#8b8b8b');
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

    createPauseActionButton(x, y, label, onClick) {
        const scene = this.scene;
        const container = scene.add.container(x, y);
        const width = 360;
        const height = 64;

        const base = scene.add.graphics();
        base.fillStyle(0x3a3a3a, 1);
        base.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
        const border = scene.add.graphics();
        border.lineStyle(3, 0xffffff, 0.7);
        border.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);
        const text = scene.add.text(0, 0, label, {
            fontFamily: 'fredoka',
            fontSize: '24px',
            color: '#ffffff',
        }).setOrigin(0.5);

        [base, border, text].forEach((item) => item.setScrollFactor(0));
        container.add([base, border, text]);
        container.setSize(width, height);
        container.setInteractive({ useHandCursor: true });
        container.on('pointerdown', (pointer) => {
            if (pointer?.event?.stopPropagation) pointer.event.stopPropagation();
            onClick();
        });
        UIHelpers.attachHoverPop(scene, container, 0.35);

        return {
            container,
            destroy: () => container.destroy(),
        };
    }

    getAdjacentChapterScene(offset) {
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

    getCurrentChapterInfo() {
        return GameStorage.parseChapterSceneKey(this.scene?.scene?.key);
    }

    createScenePagination(x, y, onSelect) {
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
        const reached = new Set([
            ...chapterProgress.reachedScenes,
            ...chapterProgress.completedScenes,
        ]);
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

    handleBgScroll(tokens) {
        const action = normalizeKeyword(tokens[1] ?? 'start');
        const name = tokens[2];
        const direction = normalizeKeyword(tokens[3] ?? 'izquierda');
        const speed = Number(tokens[4] ?? 40);

        if (action === 'stop') {
            this.stopBackgroundScroll(name);
            return;
        }

        this.startBackgroundScroll(name, direction, speed);
    }

    startBackgroundScroll(name, direction, speed) {
        const scene = this.scene;
        scene.bgScrollActive = true;
        // direction indica hacia dónde se mueve el fondo (izquierda/derecha)
        scene.bgScrollDirection = direction === 'izquierda' ? 1 : -1;
        scene.bgScrollSpeed = speed;
        const walkers = name
            ? name.split(',').map((token) => this.resolveCharacterName(token)).filter(Boolean)
            : (scene.bgScrollWalkers || []);
        scene.bgScrollWalkers = walkers;

        const activeWalkers = walkers.filter((walkerName) => this.characters.has(walkerName));
        const hasKai = activeWalkers.includes('Kai');
        const hasJouktai = activeWalkers.includes('Jouktai');
        if (hasKai && hasJouktai) {
            const kaiSprite = this.characters.get('Kai');
            const jouSprite = this.characters.get('Jouktai');
            const kaiState = this.characterState.get('Kai');
            const jouState = this.characterState.get('Jouktai');
            const cam = this.scene.cameras.main;
            const useWorld = !!this.scene?.useWorldCharacters;
            const baseX = (useWorld ? cam.scrollX : 0) + 30;
            // Mantener continuidad visual: Jouktai en su x habitual y Kai adelantado.
            jouSprite.x = baseX;
            kaiSprite.x = baseX + 450;
            if (kaiState) {
                kaiState.baseY = kaiSprite.y;
            }
            if (jouState) {
                jouState.baseY = jouSprite.y;
            }
        }

        scene.bgScrollWalkers = activeWalkers;
        activeWalkers.forEach((walkerName) => {
            const walkerKey = (walkerName || '').toLowerCase();
            this.setCharacterState(walkerName, {
                emotion: 'camina',
                facing: 'mira_lado',
                // En caminata conjunta, Kai debe mirar a la derecha.
                flipX: walkerKey === 'kai',
            });
            this.startWalkBob(walkerName);
        });

        this.startWalkingSound();
    }

    stopBackgroundScroll(name) {
        const scene = this.scene;
        scene.bgScrollActive = false;
        const walkers = name
            ? name.split(',').map((token) => this.resolveCharacterName(token)).filter(Boolean)
            : (scene.bgScrollWalkers || []);
        walkers.forEach((walkerName) => {
            this.stopWalkBob(walkerName);
            this.setCharacterState(walkerName, { emotion: 'idle', mouth: 1 });
        });
        scene.bgScrollWalkers = [];
        this.resetWalkingSound();
    }

    createVolumeSelector(x, y, segments, activeLevel, onChange) {
        const scene = this.scene;
        const container = scene.add.container(x, y);
        const totalWidth = 360;
        const totalHeight = 24;
        const gap = 6;
        const segmentWidth = (totalWidth - gap * (segments - 1)) / segments;
        const segmentHeight = totalHeight;

        const bg = scene.add.graphics();
        bg.fillStyle(0xffffff, 0.12);
        bg.fillRoundedRect(-totalWidth / 2 - 12, -totalHeight / 2 - 10, totalWidth + 24, totalHeight + 20, 12);

        const label = scene.add.text(0, -36, 'Música', {
            fontFamily: 'fredoka',
            fontSize: '22px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const muteLabel = scene.add.text(-totalWidth / 2 - 22, 0, '0', {
            fontFamily: 'fredoka',
            fontSize: '18px',
            color: '#ffffff',
        }).setOrigin(0.5);
        const muteHit = scene.add.circle(-totalWidth / 2 - 22, 0, 14, 0xffffff, 0.001);
        muteHit.setInteractive({ useHandCursor: true });
        UIHelpers.attachHoverPop(scene, muteHit, 0.35);

        const segmentsList = [];
        for (let i = 0; i < segments; i += 1) {
            const xPos = -totalWidth / 2 + i * (segmentWidth + gap) + segmentWidth / 2;
            const rect = scene.add.rectangle(xPos, 0, segmentWidth, segmentHeight, 0xffffff, 0.2);
            rect.setStrokeStyle(2, 0xffffff, 0.25);
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

    ensureMusic() {
        this.musicSound = AudioManager.ensureLoopingMusic(this.scene, 'gametheme', this.musicVolume);
    }

    setMusicVolume(volume, options = {}) {
        const { fromUser = false } = options;
        this.musicVolume = Phaser.Math.Clamp(volume, 0, 1);
        GameStorage.setMusicVolume(this.musicVolume);
        if (fromUser) {
            const enabled = this.musicVolume > 0;
            GameStorage.setMusicEnabled(enabled);
        }
        const enabled = GameStorage.getMusicEnabled();
        if (this.musicSound) {
            this.musicSound.setVolume(this.musicVolume);
            if (enabled && !this.musicSound.isPlaying) {
                this.musicSound.play();
            }
            if (!enabled && this.musicSound.isPlaying) {
                this.musicSound.stop();
            }
        }
    }

    // Cambia idioma activo y refresca el texto visible.
    setLanguage(lang) {
        this.language = lang;
        GameStorage.setLanguage(lang);
        if (this.lastDialogMap) {
            const nextText = this.resolveDialogText(this.lastDialogMap);
            this.setDialogText(nextText);
        }
    }

    // Renderiza texto con resaltado usando {{palabra}}.
    setDialogText(text) {
        const scene = this.scene;
        const y = 10;
        const highlightColor = '#FCE94F';
        if (!this.dialogContainer) return;

        if (this.dialogTextItems) {
            this.dialogTextItems.forEach((item) => item.destroy());
        }
        this.dialogTextItems = [];

        if (text.includes('||')) {
            const parts = text.split('||').map((item) => item.trim());
            const intro = parts.shift() ?? '';
            const items = parts.filter(Boolean);
            this.renderDialogList(items, intro);
            return;
        }

        if (this.dialogMetrics.height !== 170) {
            this.dialogMetrics.height = 170;
            this.dialogBox.clear();
            this.dialogBox.fillStyle(0x000000, 0.6);
            this.dialogBox.fillRoundedRect(-this.dialogMetrics.width / 2, -this.dialogMetrics.height / 2, this.dialogMetrics.width, this.dialogMetrics.height, 24);
            this.dialogSpeaker.setPosition(-this.dialogMetrics.width / 2 + 80, -this.dialogMetrics.height / 2 + 30);
        }

        const match = text.match(/\{\{([^}]+)\}\}/);
        if (!match) {
            const normal = scene.add.text(0, y, text.replace(/\{\{|\}\}/g, ''), defaultDialogStyle).setOrigin(0.5);
            this.dialogContainer.add(normal);
            this.dialogTextItems.push(normal);
            return;
        }

        const before = text.slice(0, match.index);
        const highlighted = match[1];
        const after = text.slice(match.index + match[0].length);

        const style = { ...defaultDialogStyle, wordWrap: { width: 2000 } };
        const beforeText = scene.add.text(0, y, before, style).setOrigin(0, 0.5);
        const highlightText = scene.add.text(0, y, highlighted, {
            ...defaultDialogStyle,
            color: highlightColor,
        }).setOrigin(0, 0.5);
        const afterText = scene.add.text(0, y, after, style).setOrigin(0, 0.5);

        const totalWidth = beforeText.width + highlightText.width + afterText.width;
        let startX = -totalWidth / 2;
        beforeText.x = startX;
        highlightText.x = beforeText.x + beforeText.width;
        afterText.x = highlightText.x + highlightText.width;

        this.dialogContainer.add(beforeText);
        this.dialogContainer.add(highlightText);
        this.dialogContainer.add(afterText);
        this.dialogTextItems.push(beforeText, highlightText, afterText);
    }

    renderDialogList(items, intro) {
        const scene = this.scene;
        const paddingX = 36;
        const itemHeight = 42;
        const itemGap = 12;
        const contentWidth = this.dialogMetrics.width - 220;
        const listHeight = items.length * itemHeight + (items.length - 1) * itemGap;
        const introHeight = intro ? 36 : 0;
        const boxHeight = Math.max(this.dialogMetrics.height, listHeight + introHeight + 110);

        this.dialogMetrics.height = boxHeight;
        this.dialogBox.clear();
        this.dialogBox.fillStyle(0x000000, 0.6);
        this.dialogBox.fillRoundedRect(-this.dialogMetrics.width / 2, -boxHeight / 2, this.dialogMetrics.width, boxHeight, 24);
        this.dialogSpeaker.setPosition(-this.dialogMetrics.width / 2 + 80, -boxHeight / 2 + 30);

        let startY = -listHeight / 2 + 10;
        if (intro) {
            const introText = scene.add.text(0, -boxHeight / 2 + 72, intro, {
                ...defaultDialogStyle,
                fontSize: '26px',
                align: 'center',
                wordWrap: { width: contentWidth }
            }).setOrigin(0.5, 0.5);
            this.dialogContainer.add(introText);
            this.dialogTextItems.push(introText);
            startY += introHeight;
        }
        const startX = -contentWidth / 2;

        items.forEach((item, index) => {
            const y = startY + index * (itemHeight + itemGap);
            const text = scene.add.text(startX + paddingX, y, `• ${item}`, {
                fontFamily: 'fredoka',
                fontSize: '24px',
                color: '#ffffff',
                align: 'left',
                wordWrap: { width: contentWidth - paddingX * 2 }
            }).setOrigin(0, 0.5);

            this.dialogContainer.add(text);
            this.dialogTextItems.push(text);
        });
    }


    // Caminar con scroll horizontal y parallax.
    async handleWalk(tokens) {
        const name = this.resolveCharacterName(tokens[1]);
        const direction = normalizeKeyword(tokens[2] ?? 'derecha');
        const distance = Number(tokens[3] ?? 900);
        const duration = Number(tokens[4] ?? 5000);
        const scrollDistance = Number(tokens[5] ?? Math.round(distance * 0.6));
        if (!name) return;

        this.ensureCharacter(name);
        this.setCharacterState(name, { emotion: 'camina' });
        this.startWalkBob(name);

        const cam = this.scene.cameras.main;
        const targetScroll = cam.scrollX + (direction === 'izquierda' ? -scrollDistance : scrollDistance);
        const bounds = cam.getBounds();
        const neededWidth = Math.max(bounds.width, targetScroll + cam.width);
        if (neededWidth > bounds.width) {
            cam.setBounds(bounds.x, bounds.y, neededWidth, bounds.height);
        }

        this.startWalkingSound();
        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: cam,
                scrollX: targetScroll,
                duration,
                ease: 'Sine.inOut',
                onComplete: resolve,
            });
        });
        this.stopWalkBob(name);
        this.setCharacterState(name, { emotion: 'idle', mouth: 1 });
        this.stopWalkingSound();
    }

    // Comando genérico para colocar imágenes en la escena.
    handleImage(tokens) {
        const opts = {};
        tokens.slice(1).forEach((token) => {
            const normalized = normalizeKeyword(token);
            if (!token.includes(':') && !token.includes('=')) return;
            const sep = token.includes(':') ? ':' : '=';
            const idx = token.indexOf(sep);
            const key = normalizeKeyword(token.slice(0, idx));
            const value = token.slice(idx + 1).trim();
            opts[key] = value;
        });

        const keyName = opts.key || opts.src || opts.imagen || opts.image || '';
        const textureKey = this.scene.textures.exists(keyName) ? keyName : ensurePlaceholder(this.scene);
        const scale = Number(opts.scale ?? 1);
        const depth = Number(opts.depth ?? 350);
        const originX = Number(opts.originx ?? 0.5);
        const originY = Number(opts.originy ?? 1);
        const offsetX = Number(opts.offsetx ?? 0);
        const offsetY = Number(opts.offsety ?? 0);
        const isUi = (opts.layer ?? opts.ui ?? '') === 'ui';

        let x = Number(opts.x);
        let y = Number(opts.y);
        const followName = this.resolveCharacterName(opts.follow || opts.personaje || opts.char);

        let forceUi = isUi;
        if (Number.isNaN(x) || Number.isNaN(y)) {
            if (followName && this.characters.has(followName)) {
                const sprite = this.characters.get(followName);
                x = sprite.x + offsetX;
                y = sprite.y + offsetY;
                if (sprite.scrollFactorX === 0 && sprite.scrollFactorY === 0) {
                    forceUi = true;
                }
            } else {
                x = 960 + offsetX;
                y = 540 + offsetY;
                forceUi = true;
            }
        }

        const img = this.scene.add.image(x, y, textureKey).setOrigin(originX, originY);
        img.setScale(scale);
        img.setDepth(depth);
        img.setScrollFactor(forceUi ? 0 : 1);
        return img;
    }

    startWalkingSound() {
        if (!this.scene.cache.audio?.exists('walk')) return;
        if (!this.walkSound) {
            this.walkSound = this.scene.sound.add('walk', { volume: 0.6, loop: true });
        }
        this.walkingCount += 1;
        if (!this.walkSound.isPlaying) {
            this.walkSound.play();
        }
    }

    stopWalkingSound() {
        this.walkingCount = Math.max(0, this.walkingCount - 1);
        if (this.walkingCount === 0 && this.walkSound?.isPlaying) {
            this.walkSound.stop();
        }
    }

    resetWalkingSound() {
        this.walkingCount = 0;
        if (this.walkSound?.isPlaying) {
            this.walkSound.stop();
        }
        this.forceStopAllWalkSounds();
    }

    forceStopAllWalkSounds() {
        const manager = this.scene?.sound;
        if (!manager) return;
        const sounds = Array.isArray(manager.sounds) ? manager.sounds : [];
        sounds.forEach((sound) => {
            if (sound?.key === 'walk' && sound.isPlaying) {
                sound.stop();
            }
        });
        this.walkSound = null;
    }
}
