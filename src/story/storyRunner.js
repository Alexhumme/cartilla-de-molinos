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
        this.musicVolume = 0.7;
    }

    // Inicializa UI persistente (botón de pausa).
    initUI() {
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
        if (this.characters.has(name)) return this.characters.get(name);

        const idleKey = `char-${name}-idle`;
        const textureKey = this.scene.textures.exists(idleKey) ? idleKey : ensurePlaceholder(this.scene);

        const sprite = this.scene.add.image(-300, 780, textureKey).setOrigin(0.5, 1);
        sprite.setScale(0.9);
        sprite.setScrollFactor(0);
        sprite.setDepth(200);
        this.characters.set(name, sprite);
        return sprite;
    }

    // Cambia la textura según emoción, con fallback a idle/placeholder.
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
            const dialogData = this.parseDialogTokens(dialogTokens);
            this.lastDialogMap = dialogData.map;
            this.lastDialogImageKey = dialogData.imageKeys;
            const text = this.resolveDialogText(dialogData.map);
            await this.showDialog(name, text, { imageKeys: dialogData.imageKeys });
        }
    }

    // Entrada lateral con flip según dirección.
    async characterEnter(name, direction) {
        const sprite = this.ensureCharacter(name);
        const startX = direction === 'derecha' ? 2300 : -300;
        const targetX = direction === 'derecha' ? 1400 : 520;

        const walkKey = `char-${name}-camina`;
        const idleKey = `char-${name}-idle`;
        if (this.scene.textures.exists(walkKey)) {
            sprite.setTexture(walkKey);
        }

        sprite.setFlipX(direction === 'derecha');
        sprite.x = startX;
        sprite.y = 980;

        this.startWalkingSound();
        await new Promise((resolve) => {
            this.scene.tweens.add({
                targets: sprite,
                x: targetX,
                duration: 1200,
                ease: 'Sine.out',
                onComplete: () => {
                    if (this.scene.textures.exists(idleKey)) {
                        sprite.setTexture(idleKey);
                    }
                    this.stopWalkingSound();
                    resolve();
                },
            });
        });
    }

    // Muestra un diálogo y espera click para continuar.
    async showDialog(speaker, text, options = {}) {
        const scene = this.scene;
        if (!this.dialogContainer) {
            const boxWidth = 1840;
            const boxHeight = 170;

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

        this.dialogSpeaker.setText(speaker);
        this.setDialogText(text);

        await this.animateDialogIn();

        await this.waitForClick();

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
        };

        scene.input.on('pointerdown', onPointer);
        return donePromise;
    }

    // Minijuego: girar la manija del grifo 3 vueltas siguiendo la flecha.
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

        const base = scene.add.image(0, 0, 'grifo-cano').setOrigin(0.5);
        const handle = scene.add.image(0, 0, 'grifo-manija').setOrigin(0.5);
        handle.setDepth(2);

        const handleTexture = scene.textures.get('grifo-manija')?.getSourceImage();
        const handleSize = handleTexture ? Math.min(handleTexture.width, handleTexture.height) : 400;
        const radius = handleSize * 0.36;
        const startAngle = -Math.PI / 4;
        const endAngle = Math.PI * 0.85;

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

        const knob = scene.add.circle(0, 0, 36, 0xffffff, 1);
        knob.setStrokeStyle(6, 0x4ea1ff, 1);
        knob.setDepth(1005);
        knob.setScrollFactor(0);
        knob.setInteractive({ useHandCursor: true });
        UIHelpers.attachHoverPop(scene, knob, 0.35);

        const setKnobAngle = (angle) => {
            knob.x = Math.cos(angle) * radius;
            knob.y = Math.sin(angle) * radius;
        };
        setKnobAngle(startAngle);

        const progressLabel = scene.add.text(0, 320, 'Gira la manija 3 veces', {
            fontFamily: 'fredoka',
            fontSize: '28px',
            color: '#ffffff',
        }).setOrigin(0.5, 0.5);

        const progressBg = scene.add.rectangle(0, 370, 620, 22, 0xffffff, 0.2).setOrigin(0.5);
        const progressFill = scene.add.rectangle(-310, 370, 600, 16, 0x4ea1ff, 1).setOrigin(0, 0.5);
        progressFill.scaleX = 0;

        ui.add([base, handle, indicator, knob, progressLabel, progressBg, progressFill]);
        ui.setDepth(950);
        ui.setScrollFactor(0);
        root.setDepth(940);

        await this.animateContainerIn(ui);

        let lastAngle = startAngle;
        let accumulated = 0;
        let finished = false;
        const target = Math.PI * 2 * 3;
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
            lastAngle = Phaser.Math.Angle.Between(0, 0, pointer.x - ui.x, pointer.y - ui.y);
        };

        const onDrag = (pointer) => {
            const angle = Phaser.Math.Angle.Between(0, 0, pointer.x - ui.x, pointer.y - ui.y);
            const delta = Phaser.Math.Angle.Wrap(angle - lastAngle);

            if (delta > 0) {
                accumulated += delta;
                handle.rotation += delta;
                setKnobAngle(startAngle + handle.rotation);
                const progress = Phaser.Math.Clamp(accumulated / target, 0, 1);
                progressFill.scaleX = progress;
                if (accumulated >= target) {
                    complete();
                }
            }

            lastAngle = angle;
        };

        let dragging = false;
        const hitRadius = 70;

        const pointerDownHandler = (pointer) => {
            const worldX = ui.x + knob.x;
            const worldY = ui.y + knob.y;
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
            cam.once('camerafadeoutcomplete', () => {
                this.scene.scene.start(target);
                resolve();
            });
        });
    }

    // Mueve la cámara hacia arriba/abajo.
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

    // Espera un tiempo en ms.
    async handleWait(tokens) {
        const ms = Number(tokens[1] ?? 500);
        return sleep(this.scene, ms);
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
        const panel = scene.add.rectangle(960, 540, 860, 520, 0x1f1f1f, 0.95);
        const title = scene.add.text(960, 390, 'Pausa', {
            fontFamily: 'fredoka',
            fontSize: '48px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const langToggle = this.createLanguageToggle(960, 480, [
            { id: 'es', label: 'Español' },
            { id: 'wayuunaiki', label: 'Wayuu' },
        ], this.language);

        const volumeSlider = this.createVolumeSelector(960, 600, 10, Math.round(this.musicVolume * 10), (level) => {
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume: 0.8 });
            }
            this.setMusicVolume(level / 10);
            this.ignoreNextDialogClick = true;
        });

        const restartBtn = this.createPauseActionButton(760, 690, 'Reiniciar capítulo', () => {
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume: 0.8 });
            }
            this.resume();
            this.ignoreNextDialogClick = true;
            scene.scene.restart();
        });

        const menuBtn = this.createPauseActionButton(1160, 690, 'Volver a capítulos', () => {
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume: 0.8 });
            }
            this.resume();
            this.ignoreNextDialogClick = true;
            scene.scene.start('Capitulos', {
                gearsOffsetX: 0,
                gearsOffsetY: 0,
            });
        });

        const hint = scene.add.text(960, 770, 'Toca fuera o presiona pausar para continuar', {
            fontFamily: 'fredoka',
            fontSize: '20px',
            color: '#cccccc',
        }).setOrigin(0.5);

        [bg, panel, title, langToggle.container, volumeSlider.container, restartBtn.container, menuBtn.container, hint].forEach((item, index) => {
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
            buttons: [langToggle, volumeSlider, restartBtn, menuBtn],
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
        scene.bgScrollWalker = name || scene.bgScrollWalker || null;

        if (scene.bgScrollWalker) {
            const sprite = this.ensureCharacter(scene.bgScrollWalker);
            const walkKey = `char-${scene.bgScrollWalker}-camina`;
            if (scene.textures.exists(walkKey)) {
                sprite.setTexture(walkKey);
            }
            // Si el fondo se mueve a la izquierda, el personaje camina a la derecha.
            sprite.setFlipX(direction === 'derecha');
        }

        this.startWalkingSound();
    }

    stopBackgroundScroll(name) {
        const scene = this.scene;
        scene.bgScrollActive = false;
        const walker = name || scene.bgScrollWalker;
        if (walker) {
            const idleKey = `char-${walker}-idle`;
            const sprite = this.characters.get(walker);
            if (sprite && scene.textures.exists(idleKey)) {
                sprite.setTexture(idleKey);
            }
        }
        scene.bgScrollWalker = null;
        this.stopWalkingSound();
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

    setMusicVolume(volume) {
        this.musicVolume = Phaser.Math.Clamp(volume, 0, 1);
        if (this.musicSound) {
            this.musicSound.setVolume(this.musicVolume);
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

    // Caminar con scroll horizontal y parallax.
    async handleWalk(tokens) {
        const name = tokens[1];
        const direction = normalizeKeyword(tokens[2] ?? 'derecha');
        const distance = Number(tokens[3] ?? 900);
        const duration = Number(tokens[4] ?? 5000);
        const scrollDistance = Number(tokens[5] ?? Math.round(distance * 0.6));
        if (!name) return;

        const sprite = this.ensureCharacter(name);
        const walkKey = `char-${name}-camina`;
        if (this.scene.textures.exists(walkKey)) {
            sprite.setTexture(walkKey);
        }
        sprite.setFlipX(direction === 'izquierda');

        const cam = this.scene.cameras.main;
        const targetX = sprite.x + (direction === 'izquierda' ? -distance : distance);
        const targetScroll = cam.scrollX + (direction === 'izquierda' ? -scrollDistance : scrollDistance);
        const bounds = cam.getBounds();
        const neededWidth = Math.max(bounds.width, targetScroll + cam.width);
        if (neededWidth > bounds.width) {
            cam.setBounds(bounds.x, bounds.y, neededWidth, bounds.height);
        }

        this.startWalkingSound();
        await new Promise((resolve) => {
            let done = 0;
            const finish = () => {
                done += 1;
                if (done === 2) resolve();
            };
            this.scene.tweens.add({
                targets: sprite,
                x: targetX,
                duration,
                ease: 'Sine.inOut',
                onComplete: () => {
                    const idleKey = `char-${name}-idle`;
                    if (this.scene.textures.exists(idleKey)) {
                        sprite.setTexture(idleKey);
                    }
                    this.stopWalkingSound();
                    finish();
                },
            });
            this.scene.tweens.add({
                targets: cam,
                scrollX: targetScroll,
                duration,
                ease: 'Sine.inOut',
                onComplete: finish,
            });
        });
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
        const followName = opts.follow || opts.personaje || opts.char;

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
    }
}
