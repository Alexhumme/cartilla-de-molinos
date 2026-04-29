import { normalizeKeyword, parseScript } from './parser.js';
import { GameStorage } from '../utils/storage.js';
import { AudioManager } from '../utils/audio.js';
import { UIHelpers } from '../utils/ui.js';
import {
    runBlowMillMinigame,
    runConnectConceptsMinigame,
    runLocateMillMinigame,
    runFaucetMinigame,
} from './runner/minigameHandlers.js';
import {
    ensureCharacterSprite,
    getCharacterTextureForState,
    setCharacterStatePartial,
    setCharacterEmotionState,
    getCharacterTarget,
    getSpeakingFacingAuto,
    getSpeakerFlipAuto,
    startCharacterLipSync,
    stopCharacterLipSync,
    startCharacterWalkBob,
    stopCharacterWalkBob,
    handleCharacterCommand,
    runCharacterEnter,
} from './runner/characterHandlers.js';
import {
    createPauseToggleButton,
    togglePauseState,
    pauseStory,
    resumeStory,
    showPauseMenuOverlay,
    hidePauseMenuOverlay,
    createLanguageToggleControl,
    createPauseActionControl,
    getAdjacentChapterSceneKey,
    getCurrentChapterSceneInfo,
    createScenePaginationControl,
    createVolumeSelectorControl,
    ensureRunnerMusic,
    setRunnerMusicVolume,
    setRunnerLanguage,
} from './runner/pauseHandlers.js';
import { addDesertLayer, addSkyBackground } from '../utils/backgrounds.js';

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
        this.placeholderTextureKey = ensurePlaceholder(scene);
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
        this.sceneQuestionCounter = 0;
        this.recuadroPanel = null;
        this.recuadroContent = null;
        this.recuadroItems = [];
        this.recuadroShiftState = null;

        // Blindaje: si la escena se cierra abruptamente, no dejamos pasos sonando.
        this.scene.events.once('shutdown', () => {
            this.forceStopAllWalkSounds();
            this.destroyRecuadroInstant();
        });
        this.scene.events.once('destroy', () => {
            this.forceStopAllWalkSounds();
            this.destroyRecuadroInstant();
        });
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
            kamanewaa: 'Kamanewaa',
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
        this.sceneQuestionCounter = 0;

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
        if (keyword === 'recuadro') return this.handleRecuadro(tokens);
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
    // Delegado: manejo base de sprites/estado de personaje.
    ensureCharacter(name) {
        return ensureCharacterSprite.call(this, name);
    }

    getCharacterTextureKey(name, state) {
        return getCharacterTextureForState.call(this, name, state);
    }

    setCharacterState(name, partial) {
        return setCharacterStatePartial.call(this, name, partial);
    }

    // Cambia la expresión base del personaje.
    setCharacterEmotion(name, emotion) {
        return setCharacterEmotionState.call(this, name, emotion);
    }

    getCharacterTargetPosition(name, direction) {
        return getCharacterTarget.call(this, name, direction);
    }

    getSpeakingFacing(name) {
        return getSpeakingFacingAuto.call(this, name);
    }

    getSpeakerFlip(name, facing) {
        return getSpeakerFlipAuto.call(this, name, facing);
    }

    startLipSync(name) {
        return startCharacterLipSync.call(this, name);
    }

    stopLipSync(name) {
        return stopCharacterLipSync.call(this, name);
    }

    startWalkBob(name) {
        return startCharacterWalkBob.call(this, name);
    }

    stopWalkBob(name) {
        return stopCharacterWalkBob.call(this, name);
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

        addSkyBackground(scene);
        scene.sun1 = scene.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        scene.sun2 = scene.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        addDesertLayer(scene, 'bg_layer1', 1230, 0.7);
        addDesertLayer(scene, 'bg_layer2', 1260, 0.8);
        addDesertLayer(scene, 'bg_layer3', 1300, 0.9);
        addDesertLayer(scene, 'bg_layer4', 1340, 1);

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
        return handleCharacterCommand.call(this, tokens);
    }

    // Entrada lateral con flip según dirección.
    async characterEnter(name, direction) {
        return runCharacterEnter.call(this, name, direction);
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
        if (id === 'conectar_conceptos') {
            return this.handleConnectConceptsMinigame(id, resolvedOptions);
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
        return runBlowMillMinigame.call(this, id, options);
    }

    // Minijuego: ubicar el molino en el mapa.
    async handleLocateMillMinigame(id) {
        return runLocateMillMinigame.call(this, id);
    }

    // Minijuego: girar la palanca del grifo 90 grados.
    async handleFaucetMinigame(id, options) {
        return runFaucetMinigame.call(this, id, options);
    }

    // Minijuego: conectar piezas del molino con su definicion.
    async handleConnectConceptsMinigame(id, options) {
        return runConnectConceptsMinigame.call(this, id, options);
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
            sceneKey: this.scene?.scene?.key || '',
            questionIndex: this.sceneQuestionCounter + 1,
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

        this.sceneQuestionCounter += 1;
        this.pendingSceneQuestion = question;
    }

    async showSceneQuestion(questionData) {
        const scene = this.scene;
        const playerName = GameStorage.getName() || 'Jugador';
        const injectPlayerName = (value) => String(value ?? '').replace(/\$jugador/gi, playerName);
        let hadWrongAttempt = false;
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
            const optionText = this.language === 'wayuunaiki' ? option.wayuunaiki : option.es;
            const label = scene.add.text(0, 0, injectPlayerName(optionText), {
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
                        const questionSceneKey = questionData.sceneKey || this.scene?.scene?.key || '';
                        const questionIndex = Number(questionData.questionIndex) || 1;
                        GameStorage.registerSceneQuestionResult(questionSceneKey, questionIndex, !hadWrongAttempt);
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
                    hadWrongAttempt = true;
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
        const playerName = GameStorage.getName() || 'Jugador';
        const injectPlayerName = (value) =>
            String(value ?? '').replace(/\$jugador/gi, playerName);
        if (this.language === 'wayuunaiki') {
            return injectPlayerName(dialogMap.wayuunaiki ?? dialogMap.way ?? dialogMap.es ?? '');
        }
        return injectPlayerName(dialogMap.es ?? dialogMap.wayuunaiki ?? '');
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
        return createPauseToggleButton.call(this);
    }

    // Alterna pausa/reanudar.
    togglePause() {
        return togglePauseState.call(this);
    }

    // Pausa animaciones, timers y audio.
    pause() {
        return pauseStory.call(this);
    }

    // Reanuda animaciones, timers y audio.
    resume() {
        return resumeStory.call(this);
    }

    // Muestra el overlay de pausa con selector de idioma.
    showPauseOverlay() {
        return showPauseMenuOverlay.call(this);
    }

    // Cierra el overlay de pausa.
    hidePauseOverlay() {
        return hidePauseMenuOverlay.call(this);
    }

    // Toggle de idioma estilo "pill" doble.
    createLanguageToggle(x, y, options, activeId) {
        return createLanguageToggleControl.call(this, x, y, options, activeId);
    }

    createPauseActionButton(x, y, label, onClick) {
        return createPauseActionControl.call(this, x, y, label, onClick);
    }

    getAdjacentChapterScene(offset) {
        return getAdjacentChapterSceneKey.call(this, offset);
    }

    getCurrentChapterInfo() {
        return getCurrentChapterSceneInfo.call(this);
    }

    createScenePagination(x, y, onSelect) {
        return createScenePaginationControl.call(this, x, y, onSelect);
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
        return createVolumeSelectorControl.call(this, x, y, segments, activeLevel, onChange);
    }

    ensureMusic() {
        return ensureRunnerMusic.call(this);
    }

    setMusicVolume(volume, options = {}) {
        return setRunnerMusicVolume.call(this, volume, options);
    }

    // Cambia idioma activo y refresca el texto visible.
    setLanguage(lang) {
        return setRunnerLanguage.call(this, lang);
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
        const fullText = `${before}${highlighted}${after}`;
        const contentWidth = this.dialogMetrics.width - 220;

        // Cuando hay resaltado, el render usa 3 bloques de texto.
        // Ese layout no hace wrap multi-línea de forma natural, por eso
        // para textos largos hacemos fallback a texto normal con wrap.
        const measure = scene.add.text(0, y, fullText, {
            ...defaultDialogStyle,
            wordWrap: { width: contentWidth },
        }).setOrigin(0.5);
        const needsWrapFallback = measure.height > 44 || measure.width > contentWidth;
        measure.destroy();

        if (needsWrapFallback) {
            const normalWrapped = scene.add.text(0, y, fullText, {
                ...defaultDialogStyle,
                wordWrap: { width: contentWidth },
                align: 'center',
            }).setOrigin(0.5);
            this.dialogContainer.add(normalWrapped);
            this.dialogTextItems.push(normalWrapped);
            return;
        }

        const style = { ...defaultDialogStyle, wordWrap: { width: 2000 } };
        const beforeText = scene.add.text(0, y, before, style).setOrigin(0, 0.5);
        const highlightText = scene.add.text(0, y, highlighted, {
            ...defaultDialogStyle,
            color: highlightColor,
        }).setOrigin(0, 0.5);
        const afterText = scene.add.text(0, y, after, style).setOrigin(0, 0.5);

        const totalWidth = beforeText.width + highlightText.width + afterText.width;
        const startX = -totalWidth / 2;
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

    getCharacterScreenX(sprite) {
        const cam = this.scene.cameras.main;
        if (!sprite) return this.scene.scale.width / 2;
        if (sprite.scrollFactorX === 0) return sprite.x;
        return sprite.x - cam.scrollX;
    }

    getRecuadroSide() {
        const visible = [];
        this.characters.forEach((sprite) => {
            if (!sprite || sprite.visible === false || sprite.alpha <= 0.05) return;
            visible.push(sprite);
        });
        if (visible.length >= 2) return 'center';
        if (visible.length === 1) {
            const screenX = this.getCharacterScreenX(visible[0]);
            const centerX = this.scene.scale.width / 2;
            return screenX < centerX ? 'right' : 'left';
        }
        return 'center';
    }

    getRecuadroGeometry() {
        const sw = this.scene.scale.width || 1920;
        const sh = this.scene.scale.height || 1080;
        const width = Math.round(sw * 0.5);
        const height = Math.max(260, sh - 100);
        const side = this.getRecuadroSide();
        const x = side === 'left'
            ? (width / 2) + 100
            : side === 'right'
                ? (sw - width / 2) - 100
                : sw / 2;
        const y = sh / 2;
        return { x, y, width, height };
    }

    async openRecuadro() {
        const scene = this.scene;
        const g = this.getRecuadroGeometry();
        if (this.recuadroPanel) {
            await this.applyRecuadroCharacterSpread();
            await this.moveRecuadroToCurrentSide();
            return;
        }

        const root = scene.add.container(g.x, g.y);
        root.setScrollFactor(0);
        root.setDepth(760);
        root.setAlpha(0);
        root.setScale(0.84);

        const frame = scene.add.graphics();
        frame.fillStyle(0xf2e2c2, 0.97);
        frame.fillRoundedRect(-g.width / 2, -g.height / 2, g.width, g.height, 24);
        frame.lineStyle(6, 0x6f3515, 1);
        frame.strokeRoundedRect(-g.width / 2, -g.height / 2, g.width, g.height, 24);

        const content = scene.add.container(0, 0);
        root.add([frame, content]);

        this.recuadroPanel = root;
        this.recuadroContent = content;
        this.recuadroItems = [];
        await this.applyRecuadroCharacterSpread();

        await new Promise((resolve) => {
            scene.tweens.add({
                targets: root,
                alpha: 1,
                scale: 1.03,
                duration: 240,
                ease: 'Back.out',
                onComplete: () => {
                    scene.tweens.add({
                        targets: root,
                        scale: 1,
                        duration: 130,
                        ease: 'Sine.out',
                        onComplete: resolve,
                    });
                },
            });
        });
    }

    async moveRecuadroToCurrentSide() {
        if (!this.recuadroPanel) return;
        const scene = this.scene;
        const g = this.getRecuadroGeometry();
        await new Promise((resolve) => {
            scene.tweens.add({
                targets: this.recuadroPanel,
                x: g.x,
                y: g.y,
                duration: 260,
                ease: 'Sine.inOut',
                onComplete: resolve,
            });
        });
    }

    getRecuadroSlots(count) {
        const slotsByCount = {
            1: [{ x: 0.5, y: 0.5 }],
            2: [{ x: 0.3, y: 0.34 }, { x: 0.7, y: 0.66 }],
            3: [{ x: 0.5, y: 0.26 }, { x: 0.28, y: 0.7 }, { x: 0.72, y: 0.7 }],
            4: [{ x: 0.3, y: 0.32 }, { x: 0.7, y: 0.32 }, { x: 0.3, y: 0.7 }, { x: 0.7, y: 0.7 }],
        };
        if (slotsByCount[count]) return slotsByCount[count];

        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const slots = [];
        for (let i = 0; i < count; i += 1) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            slots.push({
                x: (col + 0.5) / cols,
                y: (row + 0.5) / rows,
            });
        }
        return slots;
    }

    getRecuadroScaleFactor(count) {
        if (count <= 1) return 0.9;
        if (count === 2) return 0.52;
        if (count === 3) return 0.42;
        if (count === 4) return 0.36;
        if (count <= 6) return 0.3;
        return 0.24;
    }

    async clearRecuadroContent() {
        if (!this.recuadroItems.length) return;
        const scene = this.scene;
        const items = [...this.recuadroItems];
        this.recuadroItems = [];
        await new Promise((resolve) => {
            scene.tweens.add({
                targets: items,
                alpha: 0,
                scaleX: 0.72,
                scaleY: 0.72,
                duration: 180,
                ease: 'Sine.in',
                onComplete: () => {
                    items.forEach((item) => item.destroy());
                    resolve();
                },
            });
        });
    }

    async showRecuadroImages(imageKeys) {
        if (!this.recuadroPanel) await this.openRecuadro();
        await this.moveRecuadroToCurrentSide();
        await this.clearRecuadroContent();

        const scene = this.scene;
        const g = this.getRecuadroGeometry();
        const margin = 34;
        const contentW = g.width - margin * 2;
        const contentH = g.height - margin * 2;
        const keys = imageKeys.filter(Boolean);
        const slots = this.getRecuadroSlots(keys.length);
        const slotFactor = this.getRecuadroScaleFactor(keys.length);

        keys.forEach((rawKey, idx) => {
            const key = scene.textures.exists(rawKey) ? rawKey : ensurePlaceholder(scene);
            const texture = scene.textures.get(key)?.getSourceImage();
            const texW = texture?.width ?? 256;
            const texH = texture?.height ?? 256;
            const slotW = contentW * slotFactor;
            const slotH = contentH * slotFactor;
            const fit = Math.min(slotW / texW, slotH / texH);
            const slot = slots[idx];
            const x = (slot.x - 0.5) * contentW;
            const y = (slot.y - 0.5) * contentH;

            const image = scene.add.image(x, y, key).setOrigin(0.5);
            image.setScale(Math.max(0.05, fit));
            image.setAlpha(0);
            image.setScale(image.scale * 0.72);
            this.recuadroContent.add(image);
            this.recuadroItems.push(image);

            if (scene.cache.audio?.exists('pop-img-recuadro')) {
                scene.time.delayedCall(idx * 45, () => {
                    scene.sound.play('pop-img-recuadro', { volume: 0.55 });
                });
            }

            scene.tweens.add({
                targets: image,
                alpha: 1,
                scaleX: fit * 1.05,
                scaleY: fit * 1.05,
                duration: 240,
                delay: idx * 45,
                ease: 'Back.out',
                onComplete: () => {
                    scene.tweens.add({
                        targets: image,
                        scaleX: fit,
                        scaleY: fit,
                        duration: 120,
                        ease: 'Sine.out',
                    });
                },
            });
        });
    }

    async closeRecuadro() {
        if (!this.recuadroPanel) return;
        await this.clearRecuadroContent();
        const scene = this.scene;
        const panel = this.recuadroPanel;
        this.recuadroPanel = null;
        this.recuadroContent = null;
        await new Promise((resolve) => {
            scene.tweens.add({
                targets: panel,
                alpha: 0,
                scale: 0.84,
                duration: 200,
                ease: 'Sine.in',
                onComplete: () => {
                    panel.destroy(true);
                    resolve();
                },
            });
        });
        await this.resetRecuadroCharacterSpread();
    }

    destroyRecuadroInstant() {
        if (this.recuadroPanel) {
            this.recuadroPanel.destroy(true);
        }
        this.resetRecuadroCharacterSpread(true);
        this.recuadroPanel = null;
        this.recuadroContent = null;
        this.recuadroItems = [];
    }

    getVisibleCharacters() {
        const visible = [];
        this.characters.forEach((sprite, name) => {
            if (!sprite || sprite.visible === false || sprite.alpha <= 0.05) return;
            visible.push({ name, sprite });
        });
        return visible;
    }

    async applyRecuadroCharacterSpread() {
        const visible = this.getVisibleCharacters();
        if (visible.length !== 2) return this.resetRecuadroCharacterSpread();

        const centerX = this.scene.scale.width / 2;
        const left = [];
        const right = [];
        visible.forEach(({ sprite }) => {
            const sx = this.getCharacterScreenX(sprite);
            if (sx < centerX) left.push(sprite);
            else right.push(sprite);
        });
        if (!left.length || !right.length) return this.resetRecuadroCharacterSpread();

        if (this.recuadroShiftState) return;
        const shiftPx = 100;
        const targets = [
            ...left.map((sprite) => ({ sprite, toX: sprite.x - shiftPx })),
            ...right.map((sprite) => ({ sprite, toX: sprite.x + shiftPx })),
        ];
        this.recuadroShiftState = {
            targets: targets.map(({ sprite }) => ({ sprite, originalX: sprite.x })),
        };
        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: targets.map((item) => item.sprite),
                x: (target, key, value, targetIndex) => targets[targetIndex].toX,
                duration: 220,
                ease: 'Sine.inOut',
                onComplete: resolve,
            });
        });
    }

    async resetRecuadroCharacterSpread(immediate = false) {
        if (!this.recuadroShiftState?.targets?.length) return;
        const restores = this.recuadroShiftState.targets.filter((item) => item.sprite && item.sprite.active);
        this.recuadroShiftState = null;
        if (!restores.length) return;
        if (immediate) {
            restores.forEach(({ sprite, originalX }) => {
                sprite.x = originalX;
            });
            return;
        }
        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: restores.map((item) => item.sprite),
                x: (target, key, value, targetIndex) => restores[targetIndex].originalX,
                duration: 220,
                ease: 'Sine.inOut',
                onComplete: resolve,
            });
        });
    }

    // API reutilizable: zona interna util para incrustar minijuegos en el recuadro.
    getRecuadroContentBounds() {
        const g = this.getRecuadroGeometry();
        const margin = 34;
        return {
            x: g.x - (g.width / 2) + margin,
            y: g.y - (g.height / 2) + margin,
            width: g.width - margin * 2,
            height: g.height - margin * 2,
        };
    }

    async handleRecuadro(tokens) {
        const action = normalizeKeyword(tokens[1] ?? 'abrir');
        if (action === 'abrir' || action === 'open') {
            return this.openRecuadro();
        }
        if (action === 'imagenes' || action === 'images') {
            const raw = tokens[2] ?? '';
            const imageKeys = raw.split(/[,|]/).map((value) => value.trim()).filter(Boolean);
            return this.showRecuadroImages(imageKeys);
        }
        if (action === 'limpiar' || action === 'clear') {
            return this.clearRecuadroContent();
        }
        if (action === 'cerrar' || action === 'close') {
            return this.closeRecuadro();
        }
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
