// Enfoque: lógica completa de minijuegos (micrófono, ubicación y grifo).
// Estas funciones se ejecutan con `this` enlazado a StoryRunner.
import { UIHelpers } from '../../utils/ui.js';

const playUiSound = (scene, key, volume = 0.7) => {
    if (scene.cache.audio?.exists(key)) {
        scene.sound.play(key, { volume });
    }
};

export async function runBlowMillMinigame(id, options) {
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
    panel.fillRoundedRect(-530, -260, 1060, 540, 24);

    const title = scene.add.text(0, -205, 'Sopla para girar el molino', {
        fontFamily: 'fredoka',
        fontSize: '42px',
        color: '#fce1b4',
    }).setOrigin(0.5);

    const hint = scene.add.text(0, -140, 'Sopla hacia la pantalla. Entre mas fuerte, mas rapido gira.', {
        fontFamily: 'fredoka',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 900 },
    }).setOrigin(0.5);

    const status = scene.add.text(0, 138, 'Esperando sonido...', {
        fontFamily: 'fredoka',
        fontSize: '24px',
        color: '#d9e8ff',
    }).setOrigin(0.5);

    const progressBg = scene.add.rectangle(0, 190, 840, 30, 0xffffff, 0.18).setOrigin(0.5);
    const progressFill = scene.add.rectangle(-420, 190, 832, 22, 0x4ea1ff, 1).setOrigin(0, 0.5);
    progressFill.scaleX = 0;

    // Medidor analogico de intensidad (boca hacia arriba, avance horario).
    const gaugeX = 0;
    const gaugeY = 20;
    const gaugeRadius = 96;
    const gaugeStart = Phaser.Math.DegToRad(200);
    const gaugeEnd = Phaser.Math.DegToRad(340);

    const gaugeBase = scene.add.graphics();
    gaugeBase.lineStyle(10, 0x2a2a2a, 1);
    gaugeBase.beginPath();
    gaugeBase.arc(gaugeX, gaugeY, gaugeRadius, gaugeStart, gaugeEnd, false);
    gaugeBase.strokePath();

    const gaugeSegmentColors = [
        0x2f6bff, // azul
        0x18a7b5, // verde azulado
        0x2ebd59, // verde
        0x9fd23c, // verde amarillento
        0xf6da3f, // amarillo
        0xf6a03a, // naranja
        0xe6463a, // rojo
    ];
    const segSpan = (gaugeEnd - gaugeStart) / gaugeSegmentColors.length;
    gaugeSegmentColors.forEach((color, idx) => {
        const s = gaugeStart + segSpan * idx;
        const e = gaugeStart + segSpan * (idx + 1);
        gaugeBase.lineStyle(7, color, 0.95);
        gaugeBase.beginPath();
        gaugeBase.arc(gaugeX, gaugeY, gaugeRadius, s, e, false);
        gaugeBase.strokePath();
    });

    const gaugeTicks = scene.add.graphics();
    gaugeTicks.lineStyle(3, 0xfce1b4, 0.85);
    const tickCount = 8;
    for (let i = 0; i <= tickCount; i += 1) {
        const t = i / tickCount;
        const a = gaugeStart + (gaugeEnd - gaugeStart) * t;
        const ix = gaugeX + Math.cos(a) * (gaugeRadius - 10);
        const iy = gaugeY + Math.sin(a) * (gaugeRadius - 10);
        const ox = gaugeX + Math.cos(a) * (gaugeRadius + 6);
        const oy = gaugeY + Math.sin(a) * (gaugeRadius + 6);
        gaugeTicks.lineBetween(ix, iy, ox, oy);
    }

    const needle = scene.add.graphics();
    const intensityValue = scene.add.text(0, 100, 'Intensidad: 0%', {
        fontFamily: 'fredoka',
        fontSize: '24px',
        color: '#7be074',
    }).setOrigin(0.5);

    const renderNeedle = (strength) => {
        const clamped = Phaser.Math.Clamp(strength, 0, 1);
        const angle = gaugeStart + (gaugeEnd - gaugeStart) * clamped;
        const nx = gaugeX + Math.cos(angle) * (gaugeRadius - 20);
        const ny = gaugeY + Math.sin(angle) * (gaugeRadius - 20);
        needle.clear();
        needle.lineStyle(5, 0xffd166, 1);
        needle.lineBetween(gaugeX, gaugeY, nx, ny);
        needle.fillStyle(0xffd166, 1);
        needle.fillCircle(gaugeX, gaugeY, 8);
        intensityValue.setText(`Intensidad: ${Math.round(clamped * 100)}%`);
    };
    renderNeedle(0);

    ui.add([
        panel,
        title,
        hint,
        gaugeBase,
        gaugeTicks,
        needle,
        intensityValue,
        status,
        progressBg,
        progressFill,
    ]);
    await this.animateContainerIn(ui);

    let resolveDone;
    const donePromise = new Promise((resolve) => {
        resolveDone = resolve;
    });

    let finished = false;
    let pointerDownHandler = null;
    let pointerMoveHandler = null;
    let pointerUpHandler = null;
    let pointerUpOutsideHandler = null;

    const cleanup = async () => {
        if (finished) return;
        finished = true;
        if (this.pauseButton) {
            this.pauseButton.setVisible(true);
            if (pauseWasInteractive) this.pauseButton.setInteractive({ useHandCursor: true });
        }
        if (pointerDownHandler) {
            scene.input.off('pointerdown', pointerDownHandler);
            pointerDownHandler = null;
        }
        if (pointerMoveHandler) {
            scene.input.off('pointermove', pointerMoveHandler);
            pointerMoveHandler = null;
        }
        if (pointerUpHandler) {
            scene.input.off('pointerup', pointerUpHandler);
            pointerUpHandler = null;
        }
        if (pointerUpOutsideHandler) {
            scene.input.off('pointerupoutside', pointerUpOutsideHandler);
            pointerUpOutsideHandler = null;
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
    let fallbackStrength = 0;
    const target = 100;
    let progress = 0;
    let smoothed = 0;
    let noiseFloor = 0.01;
    let lastTs = performance.now();
    let currentAngularSpeed = 0.5;
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
            strength = Phaser.Math.Clamp(fallbackStrength + (holding ? 0.08 : 0), 0, 1);
            fallbackStrength *= 0.9;
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
            const normalized = Phaser.Math.Clamp((rms - noiseFloor) * 28, 0, 1);
            smoothed = smoothed * 0.78 + normalized * 0.22;
            strength = smoothed;
        }

        renderNeedle(strength);
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
            status.setText(holding ? 'Impulsando aspas...' : 'Mantén presionado y mueve el dedo');
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
        status.setText('Sin microfono: mantén presionado y mueve el dedo');
        const holdHint = scene.add.text(0, 62, 'Modo alterno activado', {
            fontFamily: 'fredoka',
            fontSize: '22px',
            color: '#ffd58a',
        }).setOrigin(0.5);
        ui.add(holdHint);

        let lastPointerX = 0;
        let lastPointerY = 0;
        let lastPointerTs = performance.now();

        bg.setInteractive();
        pointerDownHandler = (pointer) => {
            holding = true;
            lastPointerX = pointer.x;
            lastPointerY = pointer.y;
            lastPointerTs = performance.now();
            fallbackStrength = Math.max(fallbackStrength, 0.32);
        };
        pointerMoveHandler = (pointer) => {
            if (!holding) return;
            const now = performance.now();
            const dt = Math.max(8, now - lastPointerTs);
            const dx = pointer.x - lastPointerX;
            const dy = pointer.y - lastPointerY;
            const dist = Math.hypot(dx, dy);
            const speed = dist / dt;
            const impulse = Phaser.Math.Clamp(speed * 2.8, 0, 1);
            fallbackStrength = Phaser.Math.Clamp(Math.max(fallbackStrength * 0.75, impulse), 0, 1);
            lastPointerX = pointer.x;
            lastPointerY = pointer.y;
            lastPointerTs = now;
        };
        pointerUpHandler = () => { holding = false; };
        pointerUpOutsideHandler = () => { holding = false; };

        scene.input.on('pointerdown', pointerDownHandler);
        scene.input.on('pointermove', pointerMoveHandler);
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
        try { sourceNode.disconnect(); } catch { }
    }
    if (analyser) {
        try { analyser.disconnect(); } catch { }
    }
    if (audioCtx) {
        try { await audioCtx.close(); } catch { }
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
    }
}

export async function runLocateMillMinigame(id) {
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

    const target = { x: 632, y: 220 };
    const tolerance = 100;
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

    const mapLeft = map.x - (map.displayWidth / 2);
    const mapTop = map.y - (map.displayHeight / 2);

    let resolveDone;
    const donePromise = new Promise((resolve) => {
        resolveDone = resolve;
    });

    const onPointer = (pointer) => {
        const px = pointer.x;
        const py = pointer.y;
        if (px < mapLeft || px > mapLeft + map.displayWidth || py < mapTop || py > mapTop + map.displayHeight) {
            return;
        }

        const localX = (px - mapLeft) / scale;
        const localY = (py - mapTop) / scale;

        const dx = localX - target.x;
        const dy = localY - target.y;
        const dist = Math.hypot(dx, dy);

        const world = {
            x: px,
            y: py,
        };

        if (dist <= tolerance) {
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
        
        if (scene.cache.audio?.exists('wrong-option')) {
            scene.sound.play('wrong-option', { volume: 0.7 });
        }
        placeMarker(world.x, world.y, false);
        errorText.setText('Ese no es el lugar correcto. Intenta de nuevo.');
    };

    scene.input.on('pointerdown', onPointer);
    return donePromise;
}

export async function runFaucetMinigame(id, options) {
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
    const handleTexture = scene.textures.get('grifo-manija')?.getSourceImage();
    const handleWidth = handleTexture?.width ?? 202;
    const handleHeight = handleTexture?.height ?? 50;
    const pivotX = 101;
    const pivotY = 101;
    const handle = scene.add.image(0, -50, 'grifo-manija')
        .setOrigin(pivotX / handleWidth, pivotY / handleHeight);
    handle.setDepth(2);

    const handleSize = handleWidth
    const radius = handleSize * 0.4;
    const startAngle = 0;
    const endAngle = startAngle + Math.PI / 2;

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
    indicator.fillTriangle(arrowX, arrowY, left.x, left.y, right.x, right.y);

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
    const hitRadius = Math.max(72, handleSize * 0.48);

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

export async function runConnectConceptsMinigame(id, options = []) {
    const scene = this.scene;
    scene.input.enabled = true;
    const prevTopOnly = scene.input.topOnly;
    scene.input.setTopOnly(true);

    if (!this.recuadroPanel) await this.openRecuadro();
    await this.moveRecuadroToCurrentSide();
    await this.clearRecuadroContent();

    const bounds = this.getRecuadroContentBounds();
    const areaW = bounds.width;
    const areaH = bounds.height;
    const contentCenterX = bounds.x + (areaW / 2);
    const contentCenterY = bounds.y + (areaH / 2);

    const root = scene.add.container(0, 0);
    root.setScrollFactor(0);
    this.recuadroContent.add(root);
    this.recuadroItems.push(root);
    const hitZones = [];

    const title = scene.add.text(0, -areaH * 0.47, 'Conecta cada pieza con su definicion', {
        fontFamily: 'fredoka',
        fontSize: '30px',
        color: '#6f3515',
        fontStyle: '700',
    }).setOrigin(0.5, 0);

    const leftX = -areaW * 0.34;
    const rightX = areaW * 0.04;

    const pairs = [
        {
            key: 'aspas',
            imageKey: 'cc-aspas',
            text: 'Reciben la fuerza del viento y empiezan el movimiento.',
        },
        {
            key: 'convertidor',
            imageKey: 'cc-convertidor',
            text: 'Convierte el giro circular usando ejes y pinones.',
        },
        {
            key: 'pinion',
            imageKey: 'cc-pinion',
            text: 'Ayuda a transformar el giro en movimiento vertical.',
        },
        {
            key: 'bomba',
            imageKey: 'cc-bomba',
            text: 'Empuja el agua desde el pozo profundo hasta el tanque.',
        },
    ];

    const boardFrame = scene.add.graphics();
    boardFrame.lineStyle(3, 0x6f3515, 0.55);
    boardFrame.strokeRoundedRect(-areaW * 0.44, -areaH * 0.39, areaW * 0.88, areaH * 0.79, 18);

    const permanentLines = scene.add.graphics();
    const transientLine = scene.add.graphics();
    root.add([boardFrame, permanentLines, transientLine, title]);

    const rows = pairs.length;
    const topMargin = 180;
    const bottomMargin = 36;
    const usableHeight = Math.max(100, areaH - topMargin - bottomMargin);
    const baseGap = rows > 1 ? usableHeight / (rows - 1) : 0;
    const rowGap = Math.max(74, baseGap - 50);
    const yStart = -areaH / 2 + topMargin;

    const leftEntries = pairs.map((pair, index) => {
        const y = yStart + index * rowGap;
        const itemRoot = scene.add.container(leftX, y);
        const bg = scene.add.graphics();
        const image = scene.add.image(0, 0, scene.textures.exists(pair.imageKey) ? pair.imageKey : 'story-placeholder')
            .setOrigin(0.5);
        const fit = Math.min(86 / Math.max(1, image.width), 86 / Math.max(1, image.height));
        image.setScale(fit);

        const drawBg = (active, completed) => {
            bg.clear();
            const fill = completed ? 0xd9f4df : (active ? 0xffe7a8 : 0xf6eddc);
            const stroke = completed ? 0x2b9348 : (active ? 0xd97706 : 0x8a4b25);
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-56, -56, 112, 112, 18);
            bg.lineStyle(4, stroke, 0.95);
            bg.strokeRoundedRect(-56, -56, 112, 112, 18);
        };
        drawBg(false, false);

        itemRoot.add([bg, image]);
        itemRoot.setSize(112, 112);

        root.add(itemRoot);
        const hitZone = scene.add.zone(contentCenterX + leftX, contentCenterY + y, 112, 112);
        hitZone.setScrollFactor(0);
        hitZone.setDepth((this.recuadroPanel?.depth ?? 760) + 20);
        hitZone.setInteractive({ useHandCursor: true });
        UIHelpers.attachHoverPop(scene, hitZone, 0.3);
        hitZones.push(hitZone);

        return { pair, itemRoot, hitZone, drawBg, solved: false, y };
    });

    // Desorden intencional de definiciones para evitar emparejado trivial por fila.
    // Resultado:
    // imagen 1 -> concepto 4
    // imagen 2 -> concepto 1
    // imagen 3 -> concepto 3
    // imagen 4 -> concepto 2
    const definitionOrder = [3, 0, 2, 1];
    const rightPairs = definitionOrder.map((idx) => pairs[idx]).filter(Boolean);

    const rightEntries = rightPairs.map((pair, index) => {
        const y = yStart + index * rowGap;
        const itemRoot = scene.add.container(rightX, y);
        const bg = scene.add.graphics();
        const label = scene.add.text(0, 0, pair.text, {
            fontFamily: 'fredoka',
            fontSize: '22px',
            color: '#2f241e',
            align: 'left',
            wordWrap: { width: areaW * 0.38 },
        }).setOrigin(0, 0.5);

        const boxW = Math.min(areaW * 0.42, 450);
        const boxH = 86;
        const drawBg = (hovered, completed) => {
            bg.clear();
            const fill = completed ? 0xd9f4df : (hovered ? 0xf7e8c7 : 0xfaf4e8);
            const stroke = completed ? 0x2b9348 : (hovered ? 0x8a4b25 : 0x9e7a5d);
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 16);
            bg.lineStyle(3, stroke, 0.9);
            bg.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 16);
        };
        drawBg(false, false);
        label.setX((-boxW / 2) + 14);

        itemRoot.add([bg, label]);
        itemRoot.setSize(boxW, boxH);
        root.add(itemRoot);
        const hitZone = scene.add.zone(contentCenterX + rightX, contentCenterY + y, boxW, boxH);
        hitZone.setScrollFactor(0);
        hitZone.setDepth((this.recuadroPanel?.depth ?? 760) + 20);
        hitZone.setInteractive({ useHandCursor: true });
        UIHelpers.attachHoverPop(scene, hitZone, 0.3);
        hitZones.push(hitZone);
        return { pair, itemRoot, hitZone, drawBg, solved: false, y };
    });

    let activeLeft = null;
    let solvedCount = 0;
    const total = pairs.length;

    const drawPermanentLine = (leftEntry, rightEntry, color) => {
        permanentLines.lineStyle(6, color, 0.95);
        permanentLines.beginPath();
        permanentLines.moveTo(leftEntry.itemRoot.x + 56, leftEntry.itemRoot.y);
        permanentLines.lineTo(rightEntry.itemRoot.x - (rightEntry.itemRoot.width / 2), rightEntry.itemRoot.y);
        permanentLines.strokePath();
    };

    const drawTransientLine = (leftEntry, rightEntry, color) => {
        transientLine.clear();
        transientLine.lineStyle(6, color, 0.95);
        transientLine.beginPath();
        transientLine.moveTo(leftEntry.itemRoot.x + 56, leftEntry.itemRoot.y);
        transientLine.lineTo(rightEntry.itemRoot.x - (rightEntry.itemRoot.width / 2), rightEntry.itemRoot.y);
        transientLine.strokePath();
    };

    const resetLeftActiveVisuals = () => {
        leftEntries.forEach((entry) => entry.drawBg(false, entry.solved));
    };

    let resolveDone;
    const donePromise = new Promise((resolve) => {
        resolveDone = resolve;
    });

    const finish = async () => {
        this.minigames.set(id, options[0] ?? 'respuesta1');
        playUiSound(scene, 'success-bell', 0.65);
        scene.time.delayedCall(260, () => resolveDone());
    };

    leftEntries.forEach((leftEntry) => {
        leftEntry.hitZone.on('pointerover', () => {
            if (!leftEntry.solved && leftEntry !== activeLeft) leftEntry.drawBg(true, false);
            playUiSound(scene, 'pop', 0.22);
        });
        leftEntry.hitZone.on('pointerout', () => {
            if (!leftEntry.solved && leftEntry !== activeLeft) leftEntry.drawBg(false, false);
        });
        leftEntry.hitZone.on('pointerdown', () => {
            if (leftEntry.solved) return;
            activeLeft = leftEntry;
            resetLeftActiveVisuals();
            leftEntry.drawBg(true, false);
            playUiSound(scene, 'pop', 0.7);
        });
    });

    rightEntries.forEach((rightEntry) => {
        rightEntry.hitZone.on('pointerover', () => {
            if (!rightEntry.solved) rightEntry.drawBg(true, false);
            playUiSound(scene, 'pop', 0.22);
        });
        rightEntry.hitZone.on('pointerout', () => {
            if (!rightEntry.solved) rightEntry.drawBg(false, false);
        });
        rightEntry.hitZone.on('pointerdown', () => {
            if (rightEntry.solved || !activeLeft) return;
            const isCorrect = activeLeft.pair.key === rightEntry.pair.key;
            drawTransientLine(activeLeft, rightEntry, isCorrect ? 0x2b9348 : 0xd62828);
            playUiSound(scene, isCorrect ? 'success-bell' : 'wrong-option', isCorrect ? 0.45 : 0.7);

            if (isCorrect) {
                drawPermanentLine(activeLeft, rightEntry, 0x2b9348);
                activeLeft.solved = true;
                rightEntry.solved = true;
                activeLeft.drawBg(false, true);
                rightEntry.drawBg(false, true);
                activeLeft = null;
                transientLine.clear();
                solvedCount += 1;
                if (solvedCount >= total) {
                    finish();
                }
                return;
            }

            scene.time.delayedCall(320, () => {
                transientLine.clear();
                if (activeLeft && !activeLeft.solved) {
                    activeLeft.drawBg(true, false);
                }
            });
        });
    });

    await donePromise;
    hitZones.forEach((zone) => zone.destroy());
    scene.input.setTopOnly(prevTopOnly);
}

export async function runLocateIssuesMinigame(id, options = []) {
    const scene = this.scene;
    scene.input.enabled = true;
    const prevTopOnly = scene.input.topOnly;
    scene.input.setTopOnly(true);

    if (this.recuadroPanel) {
        await this.closeRecuadro();
    }

    const jouktaiEntry = Array.from(this.characters.entries())
        .find(([name, sprite]) => (name || '').toLowerCase() === 'jouktai' && sprite?.active);
    const jouktai = jouktaiEntry?.[1] ?? null;
    const jouktaiStart = jouktai ? { x: jouktai.x, y: jouktai.y, alpha: jouktai.alpha } : null;
    if (jouktai) {
        await new Promise((resolve) => {
            scene.tweens.add({
                targets: jouktai,
                x: jouktai.x - 320,
                alpha: 0,
                duration: 260,
                ease: 'Sine.in',
                onComplete: resolve,
            });
        });
        jouktai.setVisible(false);
    }

    const cam = scene.cameras.main;
    const initialScrollY = cam.scrollY;

    const toScrollY = async (target, duration = 420) => {
        await new Promise((resolve) => {
            scene.tweens.add({
                targets: cam,
                scrollY: target,
                duration,
                ease: 'Sine.inOut',
                onComplete: resolve,
            });
        });
    };

    const getClampedScrollForCenterY = (worldY) => {
        const b = cam.getBounds();
        const minY = b.y;
        const maxY = b.y + b.height - cam.height;
        return Phaser.Math.Clamp(worldY - (scene.scale.height / 2), minY, maxY);
    };

    const ensureUpperRoomFor = (worldY) => {
        const b = cam.getBounds();
        const minNeeded = worldY - (scene.scale.height / 2) - 12;
        if (minNeeded >= b.y) return;
        const newTop = Math.min(b.y, minNeeded - 64);
        const newHeight = b.height + (b.y - newTop);
        cam.setBounds(b.x, newTop, b.width, newHeight);
    };

    // Debe quedar por debajo del overlay de pausa (depth 1100+).
    const uiRoot = scene.add.container(0, 0).setScrollFactor(0).setDepth(1050);

    const listPanel = scene.add.container(88, 88).setScrollFactor(0);
    const panelBg = scene.add.graphics();
    panelBg.fillStyle(0x000000, 0.6);
    panelBg.fillRoundedRect(0, 0, 760, 340, 22);
    panelBg.lineStyle(3, 0xfce1b4, 1);
    panelBg.strokeRoundedRect(0, 0, 760, 340, 22);
    const panelTitle = scene.add.text(24, 16, 'Sintomas identificados', {
        fontFamily: 'fredoka',
        fontSize: '34px',
        color: '#fce1b4',
    });
    const listText = scene.add.text(24, 72, '', {
        fontFamily: 'fredoka',
        fontSize: '28px',
        color: '#ffffff',
        wordWrap: { width: 710 },
        lineSpacing: 10,
    });
    const continueText = scene.add.text(24, 296, '', {
        fontFamily: 'fredoka',
        fontSize: '24px',
        color: '#9df0a8',
    });
    listPanel.add([panelBg, panelTitle, listText, continueText]);
    uiRoot.add(listPanel);

    const mkRoundButton = (iconText) => {
        const btn = scene.add.container(scene.scale.width - 92, scene.scale.height - 92).setScrollFactor(0);
        const bg = scene.add.graphics();
        const icon = scene.add.text(0, -1, iconText, {
            fontFamily: 'fredoka',
            fontSize: '50px',
            color: '#6a3a1b',
        }).setOrigin(0.5);
        const redraw = (hover = false) => {
            bg.clear();
            bg.fillStyle(hover ? 0xfce1b4 : 0xf0c18a, 1);
            bg.fillCircle(0, 0, 46);
            bg.lineStyle(5, hover ? 0x6a3a1b : 0x8b4c1d, 1);
            bg.strokeCircle(0, 0, 44);
        };
        redraw(false);
        btn.add([bg, icon]);
        btn.setSize(92, 92);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => redraw(true));
        btn.on('pointerout', () => redraw(false));
        UIHelpers.attachHoverPop(scene, btn, 0.35);
        return btn;
    };

    const upButton = mkRoundButton('↑');
    upButton.setVisible(false);
    if (upButton.input) upButton.input.enabled = false;
    uiRoot.add(upButton);

    let nextPanTargetId = null;
    let isPanning = false;
    const showUpButton = () => {
        upButton.setVisible(true);
        if (upButton.input) upButton.input.enabled = true;
    };
    const hideUpButton = () => {
        upButton.setVisible(false);
        if (upButton.input) upButton.input.enabled = false;
    };
    upButton.on('pointerdown', async () => {
        if (isPanning || !upButton.visible) return;
        playUiSound(scene, 'pop', 0.75);
        isPanning = true;
        hideUpButton();
        const targetSymptom = symptoms.find((item) => item.id === nextPanTargetId);
        const desiredCenterY = targetSymptom?.y ?? cam.worldView.centerY;
        ensureUpperRoomFor(desiredCenterY);
        const targetScroll = getClampedScrollForCenterY(desiredCenterY);
        await toScrollY(targetScroll, 420);
        nextPanTargetId = null;
        isPanning = false;
    });

    const baseX = scene.molinoBase?.x ?? 800;
    const baseY = scene.molinoBase?.y ?? 700;
    const symptoms = [
        { id: 'base', text: 'Base: se oye un chirrido viniendo de la bomba', x: baseX + 703, y: baseY + 1710 },
        { id: 'cuerpo', text: 'Cuerpo: la varilla de la bomba parece no moverse bien', x: baseX + 655, y: baseY + 980 },
        { id: 'aspas', text: 'Aspas: las aspas no giran correctamente', x: scene.molinoAspas?.x ?? (baseX + 700), y: scene.molinoAspas?.y ?? (baseY + 175) },
    ];

    const found = new Set();
    const markers = symptoms.map((item) => {
        const marker = scene.add.container(item.x, item.y).setDepth(1040);
        const circle = scene.add.graphics();
        const icon = scene.add.text(0, -1, '!', {
            fontFamily: 'fredoka',
            fontSize: '32px',
            color: '#6a3a1b',
            fontStyle: '700',
        }).setOrigin(0.5);
        marker.add([circle, icon]);
        marker.setSize(84, 84);
        marker.setInteractive({ useHandCursor: true });
        UIHelpers.attachHoverPop(scene, marker, 0.35);
        return { item, marker, circle, hover: false };
    });

    const drawMarker = (entry, pulse = 0) => {
        entry.circle.clear();
        const radius = (entry.hover ? 37 : 33) + pulse;
        entry.circle.fillStyle(entry.hover ? 0xfff2c8 : 0xfce1b4, 0.95);
        entry.circle.fillCircle(0, 0, radius);
        entry.circle.lineStyle(4, entry.hover ? 0x2b9348 : 0x8b4c1d, 1);
        entry.circle.strokeCircle(0, 0, radius);
    };
    markers.forEach((entry) => drawMarker(entry, 0));

    const pulseEvent = scene.time.addEvent({
        delay: 60,
        loop: true,
        callback: () => {
            const pulse = Math.sin(scene.time.now * 0.01) * 2.2;
            markers.forEach((entry) => {
                if (found.has(entry.item.id)) return;
                drawMarker(entry, pulse);
            });
        },
    });

    const refreshList = () => {
        const lines = symptoms.filter((item) => found.has(item.id)).map((item) => `• ${item.text}`);
        listText.setText(lines.join('\n'));
        if (found.size === symptoms.length) {
            continueText.setText('Presiona en cualquier lugar para continuar');
            hideUpButton();
        }
    };
    refreshList();

    let resolveDone;
    const donePromise = new Promise((resolve) => { resolveDone = resolve; });
    let waitingForContinue = false;

    markers.forEach((entry) => {
        entry.marker.on('pointerover', () => {
            entry.hover = true;
            drawMarker(entry, 0);
        });
        entry.marker.on('pointerout', () => {
            entry.hover = false;
            drawMarker(entry, 0);
        });
        entry.marker.on('pointerdown', () => {
            if (found.has(entry.item.id)) return;
            found.add(entry.item.id);
            playUiSound(scene, 'success-bell', 0.7);
            entry.marker.disableInteractive();
            entry.hover = false;
            drawMarker(entry, 0);
            refreshList();
            if (found.size < symptoms.length && !isPanning) {
                if (entry.item.id === 'base') nextPanTargetId = 'cuerpo';
                else if (entry.item.id === 'cuerpo') nextPanTargetId = 'aspas';
                else {
                    const pending = symptoms.find((item) => !found.has(item.id));
                    nextPanTargetId = pending?.id ?? null;
                }
                showUpButton();
            }
            if (found.size !== symptoms.length || waitingForContinue) return;
            waitingForContinue = true;
            // Importante: registrar el listener en el siguiente tick para no capturar
            // el mismo click que acabó de seleccionar el tercer indicador.
            scene.time.delayedCall(0, () => {
                const finishHandler = () => {
                    scene.input.off('pointerdown', finishHandler);
                    resolveDone();
                };
                scene.input.on('pointerdown', finishHandler);
            });
        });
    });

    await donePromise;

    pulseEvent.remove(false);
    markers.forEach(({ marker }) => marker.destroy());
    uiRoot.destroy(true);

    if (Math.abs(cam.scrollY - initialScrollY) > 1) {
        ensureUpperRoomFor(initialScrollY + scene.scale.height / 2);
        await toScrollY(initialScrollY, 420);
    }

    if (jouktai && jouktaiStart) {
        jouktai.setVisible(true);
        jouktai.setAlpha(1);
        jouktai.setPosition(jouktaiStart.x - 320, jouktaiStart.y);
        await new Promise((resolve) => {
            scene.tweens.add({
                targets: jouktai,
                x: jouktaiStart.x,
                duration: 320,
                ease: 'Sine.out',
                onComplete: resolve,
            });
        });
    }

    this.minigames.set(id, options[0] ?? 'respuesta1');
    scene.input.setTopOnly(prevTopOnly);
}

export async function runSeparateUnionsMinigame(id, options = []) {
    const scene = this.scene;
    scene.input.enabled = true;
    const prevTopOnly = scene.input.topOnly;
    scene.input.setTopOnly(true);

    if (!this.recuadroPanel) await this.openRecuadro();
    await this.moveRecuadroToCurrentSide();
    await this.clearRecuadroContent();

    const bounds = this.getRecuadroContentBounds();
    const areaW = bounds.width;
    const areaH = bounds.height;
    const root = scene.add.container(0, 0);
    root.setScrollFactor(0);
    this.recuadroContent.add(root);
    this.recuadroItems.push(root);

    const elements = [
        { key: 'su-varilla_arriba', y: 100 },
        { key: 'su-boca_abajo', y: 525 },
        { key: 'su-rosca', y: 500 },
        { key: 'su-varilla_abajo', y: 583 },
        { key: 'su-boca_arriba', y: 386 },
    ];

    const itemSprites = elements.map((element, index) => {
        const image = scene.add.image(0, areaH * -0.54 + element.y, element.key);
        image.setOrigin(0.5, 0);
        image.setDepth(100 + index);
        root.add(image);
        return image;
    });

    const topRod = itemSprites[0];
    const topMouth = itemSprites[4];
    const topRodOriginalY = topRod.y;
    const topMouthOriginalY = topMouth.y;

    const instruction = scene.add.text(0, (-areaH / 2) + 28, 'Separa las varillas deslizando la llave', {
        fontFamily: 'fredoka',
        fontSize: '28px',
        color: '#482e00',
        align: 'center',
        wordWrap: { width: areaW * 0.9 },
    }).setOrigin(0.5, 0);
    root.add(instruction);

    const sliderY = (areaH / 2) - 104;
    const sliderWidth = Math.min(areaW * 0.78, 740);
    const sliderHeight = 42;
    const sliderLeft = -sliderWidth / 2;
    const sliderRight = sliderWidth / 2;
    const indicatorRadius = 26;
    const passCountTarget = 3;
    const passDelta = 100 / passCountTarget;

    const sliderTrack = scene.add.graphics();
    sliderTrack.fillStyle(0x3f2f20, 0.95);
    sliderTrack.fillRoundedRect(sliderLeft, sliderY - (sliderHeight / 2), sliderWidth, sliderHeight, 22);
    sliderTrack.lineStyle(4, 0xfce1b4, 0.95);
    sliderTrack.strokeRoundedRect(sliderLeft, sliderY - (sliderHeight / 2), sliderWidth, sliderHeight, 22);
    root.add(sliderTrack);

    const sliderFill = scene.add.rectangle(sliderLeft + 4, sliderY, 2, sliderHeight - 16, 0x9df0a8, 0.8)
        .setOrigin(0, 0.5);
    sliderFill.setDepth(105);
    root.add(sliderFill);

    const indicator = scene.add.circle(sliderLeft + indicatorRadius, sliderY, indicatorRadius, 0xfce1b4)
        .setStrokeStyle(4, 0x6f3515, 1)
        .setDepth(110);
    const indicatorHit = scene.add.zone(sliderLeft + indicatorRadius, sliderY, indicatorRadius * 2, indicatorRadius * 2)
        .setOrigin(0.5)
        .setDepth(111);
    root.add([indicator, indicatorHit]);

    const indicatorPulse = scene.tweens.add({
        targets: indicator,
        scale: 1.08,
        duration: 630,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
    });

    const progressText = scene.add.text(0, sliderY + 66, 'Arrastra la llave hacia la derecha', {
        fontFamily: 'fredoka',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
    }).setOrigin(0.5, 0.5);
    root.add(progressText);

    let activePasses = 0;
    let dragging = false;
    let readyToFinish = false;
    let finished = false;
    let isOverZone = false;
    let finishResolve;
    const donePromise = new Promise((resolve) => { finishResolve = resolve; });

    const updateSliderFill = () => {
        const fillWidth = Phaser.Math.Clamp(indicator.x - sliderLeft - indicatorRadius, 0, sliderWidth - (indicatorRadius * 2));
        sliderFill.width = Math.max(2, fillWidth);
        indicatorHit.setPosition(indicator.x, indicator.y);
    };

    const cleanup = () => {
        if (finished) return;
        finished = true;
        scene.input.off('pointerdown', onPointerDown);
        scene.input.off('pointermove', onPointerMove);
        scene.input.off('pointerup', onPointerUp);
        this.recuadroItems = this.recuadroItems.filter((item) => item !== root);
        if (root && root.destroy) root.destroy(true);
        this.minigames.set(id, options[0] ?? 'respuesta1');
        scene.input.setTopOnly(prevTopOnly);
        finishResolve();
    };

    const finishGame = () => {
        if (readyToFinish && !finished) {
            cleanup();
        }
    };

    const completePass = () => {

        if (scene.cache.audio?.exists('squeak-separador')) {
            scene.sound.play('squeak-separador', { volume: 0.7 });
        }

        activePasses += 1;
        const targetOffset = activePasses >= passCountTarget
            ? 100
            : Math.round(passDelta * activePasses * 100) / 100;

        scene.tweens.add({
            targets: [topRod, topMouth],
            y: (target, key, value, targetIndex) => {
                const original = targetIndex === 0 ? topRodOriginalY : topMouthOriginalY;
                return original - targetOffset;
            },
            duration: 220,
            ease: 'Sine.out',
        });

        if (activePasses >= passCountTarget) {
            readyToFinish = true;
            progressText.setText('¡Listo! Toca para continuar');
            indicatorHit.disableInteractive();
            indicatorPulse.stop();
            if (scene.cache.audio?.exists('success-bell')) {
                scene.sound.play('success-bell', { volume: 0.7 });
            }
            return;
        }

        progressText.setText(`Paso ${activePasses} de ${passCountTarget}`);
        indicatorHit.disableInteractive();
        scene.tweens.add({
            targets: indicator,
            x: sliderLeft + indicatorRadius,
            duration: 180,
            ease: 'Sine.inOut',
            onUpdate: updateSliderFill,
            onComplete: () => {
                updateSliderFill();
                indicatorHit.setInteractive({ useHandCursor: true });
            },
        });
        sliderFill.width = 4;
    };

    const onPointerDown = (pointer) => {
        if (readyToFinish) {
            finishGame();
            return;
        }
        const bounds = indicatorHit.getBounds();
        if (pointer.x >= bounds.left && pointer.x <= bounds.right &&
            pointer.y >= bounds.top && pointer.y <= bounds.bottom) {
            dragging = true;
        }
    };

    const onPointerMove = (pointer) => {
        const bounds = indicatorHit.getBounds();
        const overZone = pointer.x >= bounds.left && pointer.x <= bounds.right &&
            pointer.y >= bounds.top && pointer.y <= bounds.bottom;
        if (overZone && !isOverZone) {
            isOverZone = true;
            if (scene.input && scene.__hoverCursor) scene.input.setDefaultCursor(scene.__hoverCursor);
        } else if (!overZone && isOverZone) {
            isOverZone = false;
            if (scene.input && scene.__defaultCursor) scene.input.setDefaultCursor(scene.__defaultCursor);
        }

        if (!dragging || readyToFinish) return;
        const localPoint = root.getLocalPoint(pointer.x, pointer.y);
        const newX = Phaser.Math.Clamp(localPoint.x, sliderLeft + indicatorRadius, sliderRight - indicatorRadius);
        indicator.x = newX;
        indicatorHit.x = newX;
        updateSliderFill();
        if (indicator.x >= sliderRight - indicatorRadius - 2) {
            dragging = false;
            completePass();
        }
    };

    const onPointerUp = () => {
        dragging = false;
    };

    scene.input.on('pointerdown', onPointerDown);
    scene.input.on('pointermove', onPointerMove);
    scene.input.on('pointerup', onPointerUp);

    return donePromise;
}

export async function runOrdenarProcesoMinigame(id, options) {
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

    // 1. Contenedores y Fondo
    const root = scene.add.container(0, 0).setDepth(2000);
    root.setScrollFactor(0);
    const bg = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.8).setScrollFactor(0);
    root.add(bg);

    const title = scene.add.text(960, 150, 'Ordena los pasos para sacar agua', {
        fontFamily: 'fredoka', fontSize: '46px', color: '#fce1b4', fontStyle: 'bold'
    }).setOrigin(0.5);
    root.add(title);

    // 2. Definición del Proceso y Assets
    // Claves esperadas en este orden. 
    const processOrder = ['viento', 'aspas', 'engranes', 'bomba', 'tanque'];
    const slots = [];
    const draggables = [];

    // 3. Crear Zonas de Caída (Drop Zones)
    const startX = 360;
    const gapX = 300;
    const dragY = 320; // Imágenes arriba
    const dropY = 650; // Cajas vacías abajo
    for (let i = 0; i < 5; i++) {
        const x = startX + (i * gapX);
        const y = dropY;

        // Gráfico para que el jugador sepa dónde soltar
        const box = scene.add.graphics();
        box.lineStyle(4, 0x6f3515, 1);
        box.fillStyle(0x3f2f20, 0.6);
        box.fillRoundedRect(x - 100, y - 100, 200, 200, 16);
        box.strokeRoundedRect(x - 100, y - 100, 200, 200, 16);

        // Número del paso
        const stepText = scene.add.text(x, y - 140, `Paso ${i + 1}`, {
            fontFamily: 'fredoka', fontSize: '28px', color: '#ffffff'
        }).setOrigin(0.5);

        // La zona lógica de Phaser
        const dropZone = scene.add.zone(x, y, 200, 200).setRectangleDropZone(200, 200);
        dropZone.setScrollFactor(0);
        dropZone.expectedKey = processOrder[i];
        dropZone.isFilled = false;

        // IMPORTANTE: El dropZone debe estar dentro del root para detectar bien el arrastre
        root.add([box, stepText, dropZone]);
        slots.push(dropZone);
    }

    // 4. Crear los objetos arrastrables (desordenados)
    const shuffledOrder = ['bomba', 'viento', 'tanque', 'aspas', 'engranes'];
    shuffledOrder.forEach((key, index) => {
        const startPosX = startX + (index * gapX);
        const startPosY = dragY;

        // Contenedor visual del item
        const itemContainer = scene.add.container(startPosX, startPosY);
        itemContainer.setScrollFactor(0);

        // Fondo del item
        const itemBg = scene.add.graphics();
        itemBg.fillStyle(0xf6eddc, 1);
        itemBg.fillRoundedRect(-80, -80, 160, 160, 16);
        itemBg.lineStyle(4, 0x8a4b25, 1);
        itemBg.strokeRoundedRect(-80, -80, 160, 160, 16);

        // Imagen del item (Asegúrate de cargar: 'item-viento', 'item-aspas', etc.)
        const textureKey = scene.textures.exists(`item-${key}`) ? `item-${key}` : 'story-placeholder';
        const icon = scene.add.image(0, 0, textureKey).setOrigin(0.5);

        // Ajustar tamaño del icono si es muy grande
        const fit = Math.min(120 / Math.max(1, icon.width), 120 / Math.max(1, icon.height));
        icon.setScale(fit);

        itemContainer.add([itemBg, icon]);
        itemContainer.setSize(160, 160); // Importante para que sea interactivo
        itemContainer.setInteractive({ useHandCursor: true });
        scene.input.setDraggable(itemContainer);

        itemContainer.processKey = key;
        itemContainer.originalX = startPosX;
        itemContainer.originalY = startPosY;
        itemContainer.bgGraphics = itemBg; // Guardar referencia para pintarlo de verde al acertar

        root.add(itemContainer);
        draggables.push(itemContainer);
    });

    // 5. Mensaje de validación inferior
    const messageText = scene.add.text(960, 880, '', {
        fontFamily: 'fredoka', fontSize: '32px', color: '#ffffff', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5);
    root.add(messageText);

    let resolveDone;
    const donePromise = new Promise((resolve) => { resolveDone = resolve; });

    // 6. Lógica de Eventos Drag & Drop
    const onDragStart = (pointer, gameObject) => {
        if (!draggables.includes(gameObject)) return;
        scene.children.bringToTop(root); // Subir el minijuego
        root.bringToTop(gameObject); // Subir la pieza por encima de las demás
    };

    const onDrag = (pointer, gameObject, dragX, dragY) => {
        if (!draggables.includes(gameObject)) return;
        gameObject.x = dragX;
        gameObject.y = dragY;
    };

    const onDrop = (pointer, gameObject, dropZone) => {
        if (!draggables.includes(gameObject)) return;
        if (!dropZone || !dropZone.x || !dropZone.y) {
            gameObject.x = gameObject.originalX;
            gameObject.y = gameObject.originalY;
            gameObject.currentZone = null;
            return;
        }

        // Si la zona ya tiene otra imagen, devolver la otra a su posición original superior
        draggables.forEach(other => {
            if (other !== gameObject && other.currentZone === dropZone) {
                other.x = other.originalX;
                other.y = other.originalY;
                other.currentZone = null;
            }
        });

        // Centrar en la zona
        gameObject.x = dropZone.x;
        gameObject.y = dropZone.y;
        gameObject.currentZone = dropZone;
    };

    const onDragEnd = (pointer, gameObject, dropped) => {
        if (!draggables.includes(gameObject)) return;

        if (!dropped || !gameObject.currentZone) {
            // Volver a la posición inicial si no se soltó en una zona válida
            gameObject.x = gameObject.originalX;
            gameObject.y = gameObject.originalY;
            gameObject.currentZone = null;
        }

        // Resetear visualmente todas las cajas al estado neutral
        draggables.forEach((item) => {
            item.bgGraphics.clear();
            item.bgGraphics.fillStyle(0xf6eddc, 1);
            item.bgGraphics.fillRoundedRect(-80, -80, 160, 160, 16);
            item.bgGraphics.lineStyle(4, 0x8a4b25, 1);
            item.bgGraphics.strokeRoundedRect(-80, -80, 160, 160, 16);
        });
        messageText.setText('');

        // Verificar si todas las zonas están ocupadas para proceder a validar
        const placedCount = draggables.filter((item) => !!item.currentZone).length;

        if (placedCount === 5) {
            let isCorrect = true;

            // Validar si el orden es el correcto
            draggables.forEach((item) => {
                if (!item.currentZone || item.currentZone.expectedKey !== item.processKey) {
                    isCorrect = false;
                }
            });

            if (isCorrect) {
                // Éxito: Todo verde
                messageText.setText('¡Excelente! Has organizado correctamente el funcionamiento del molino.');
                messageText.setColor('#9df0a8');

                draggables.forEach((item) => {
                    item.bgGraphics.clear();
                    item.bgGraphics.fillStyle(0xd9f4df, 1);
                    item.bgGraphics.fillRoundedRect(-80, -80, 160, 160, 16);
                    item.bgGraphics.lineStyle(6, 0x2b9348, 1);
                    item.bgGraphics.strokeRoundedRect(-80, -80, 160, 160, 16);
                    item.disableInteractive(); // Bloquear movimiento
                });

                scene.input.off('dragstart', onDragStart);
                scene.input.off('drag', onDrag);
                scene.input.off('drop', onDrop);
                scene.input.off('dragend', onDragEnd);

                playUiSound(scene, 'success-bell', 0.8);
                scene.time.delayedCall(2500, () => {
                    root.destroy(true);
                    scene.input.setTopOnly(prevTopOnly);
                    if (this.pauseButton) {
                        this.pauseButton.setVisible(true);
                        if (pauseWasInteractive) this.pauseButton.setInteractive({ useHandCursor: true });
                    }
                    resolveDone();
                });
            } else {
                // Error: Todo rojo
                messageText.setText('El orden no es correcto. Inténtalo nuevamente.');
                messageText.setColor('#ffb3b3');

                if (scene.cache.audio?.exists('wrong-option')) {
                    scene.sound.play('wrong-option', { volume: 0.7 });
                }

                draggables.forEach((item) => {
                    item.bgGraphics.clear();
                    item.bgGraphics.fillStyle(0xffe6e6, 1);
                    item.bgGraphics.fillRoundedRect(-80, -80, 160, 160, 16);
                    item.bgGraphics.lineStyle(6, 0xd62828, 1);
                    item.bgGraphics.strokeRoundedRect(-80, -80, 160, 160, 16);
                });
            }
        }
    };

    scene.input.on('dragstart', onDragStart);
    scene.input.on('drag', onDrag);
    scene.input.on('drop', onDrop);
    scene.input.on('dragend', onDragEnd);

    return donePromise;
}

export async function runInsertRodMinigame(id, options = []) {
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
    root.setDepth(1050); // Debajo del overlay de pausa (1100+), encima de la escena.
    root.setScrollFactor(0);

    const backdrop = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.62).setScrollFactor(0);
    root.add(backdrop);

    const title = scene.add.text(960, 132, 'Arrastra la varilla hasta la entrada', {
        fontFamily: 'fredoka',
        fontSize: '38px',
        color: '#fce1b4',
        fontStyle: '700',
    }).setOrigin(0.5);
    title.setScrollFactor(0);
    root.add(title);

    const instruction = scene.add.text(960, 182, 'Solo entra por arriba de la bomba', {
        fontFamily: 'fredoka',
        fontSize: '28px',
        color: '#ffffff',
    }).setOrigin(0.5);
    instruction.setScrollFactor(0);
    root.add(instruction);

    const pump = scene.add.image(960, scene.cameras.main.height - 28, 'entrada_bomba').setOrigin(0.5, 1);
    const rod = scene.add.image(pump.x + 250, pump.y - 80, 'varilla_nueva').setOrigin(0.5, 1);
    rod.setScrollFactor(0);
    pump.setScrollFactor(0);
    // Orden de dibujo en container: la varilla debe quedar detrás de la bomba.
    root.add([rod, pump]);

    const pumpWidth = pump.displayWidth || 240;
    const pumpHeight = pump.displayHeight || 240;
    const pumpLeft = pump.x - pumpWidth / 2;
    const pumpRight = pump.x + pumpWidth / 2;
    const openingInset = 150;
    const openingLeft = pumpLeft + openingInset;
    const openingRight = pumpRight - openingInset;
    const entryTopY = pump.y - pumpHeight - 28;
    const clampTopY = 210;
    const completeY = pump.y;

    const arrow = scene.add.text(pump.x, entryTopY - 38, '↓', {
        fontFamily: 'fredoka',
        fontSize: '62px',
        color: '#fce94f',
    }).setOrigin(0.5).setScrollFactor(0);
    root.add(arrow);

    const arrowPulse = scene.tweens.add({
        targets: arrow,
        y: arrow.y + 14,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
    });

    rod.setInteractive({ useHandCursor: true });
    scene.input.setDraggable(rod, true);
    UIHelpers.attachHoverPop(scene, rod, 0.35);

    let pressed = false;
    let completed = false;
    let resolveDone;
    const donePromise = new Promise((resolve) => { resolveDone = resolve; });

    const rodHalfWidth = () => (rod.displayWidth * rod.scaleX) / 2;
    const rodLeftAt = (x) => x - rodHalfWidth();
    const rodRightAt = (x) => x + rodHalfWidth();
    const isFullyInsideOpeningAt = (x) =>
        rodLeftAt(x) > openingLeft && rodRightAt(x) < openingRight;
    const overlapsPumpWidthAt = (x) =>
        rodRightAt(x) > pumpLeft && rodLeftAt(x) < pumpRight;

    const finish = async () => {
        if (completed) return;
        completed = true;
        if (scene.cache.audio?.exists('success-bell')) {
            scene.sound.play('success-bell', { volume: 0.7 });
        }
        arrowPulse.stop();
        arrow.destroy();
        rod.disableInteractive();

        scene.tweens.add({
            targets: rod,
            x: pump.x,
            y: completeY,
            duration: 120,
            ease: 'Sine.out',
            onComplete: () => {
                scene.time.delayedCall(220, () => resolveDone());
            },
        });
    };

    rod.on('pointerdown', () => {
        pressed = true;
        rod.setScale(0.97);
    });
    rod.on('pointerup', () => {
        pressed = false;
        rod.setScale(1);
    });
    rod.on('pointerout', () => {
        if (!pressed) return;
        pressed = false;
        rod.setScale(1);
    });

    rod.on('drag', (pointer, dragX, dragY) => {
        if (completed) return;
        const currentlyInsideEntry = rod.y >= entryTopY && isFullyInsideOpeningAt(rod.x);
        let nextX = Phaser.Math.Clamp(dragX, 120, scene.scale.width - 120);
        let nextY = Phaser.Math.Clamp(dragY, clampTopY, completeY);

        // Colision con "paredes internas" (gaps de 100 px por lado):
        // si intenta entrar por arriba sin estar alineada, se bloquea en el borde superior.
        const enteringByTop = nextY >= entryTopY;
        const insideOpeningAtNextX = isFullyInsideOpeningAt(nextX);
        const overPumpWidth = overlapsPumpWidthAt(nextX);
        if (enteringByTop && overPumpWidth && !insideOpeningAtNextX) {
            if (currentlyInsideEntry) {
                // Ya estaba adentro: no permitir salida lateral.
                nextX = rod.x;
            } else {
                const crossedTopThisFrame = rod.y < entryTopY && nextY >= entryTopY;
                if (crossedTopThisFrame) {
                    // Choque desde arriba (ya estaba correcto): no dejar bajar.
                    nextY = Math.min(nextY, entryTopY - 1);
                } else {
                    // Choque lateral exterior: comportamiento de muro (sin salto).
                    nextX = rod.x;
                }
            }
        }
        rod.setPosition(nextX, nextY);

        // Completa solo si llegó al fondo y la varilla está totalmente dentro del canal.
        if (isFullyInsideOpeningAt(nextX) && nextY >= completeY - 3) {
            finish();
        }
    });

    await donePromise;

    this.minigames.set(id, options[0] ?? 'respuesta1');
    root.destroy(true);
    scene.input.setTopOnly(prevTopOnly);
    if (this.pauseButton) {
        this.pauseButton.setVisible(true);
        if (pauseWasInteractive) this.pauseButton.setInteractive({ useHandCursor: true });
    }
}

const getSafeTexture = (scene, key, alternatives = []) => {
    const candidates = [key, ...(Array.isArray(alternatives) ? alternatives : [])].filter(Boolean);
    for (const candidate of candidates) {
        if (scene.textures.exists(candidate)) return candidate;
    }
    if (scene.textures.exists('story-placeholder')) return 'story-placeholder';
    return null;
};

const restoreMinigameUi = (runner, prevTopOnly, root, pauseWasInteractive) => {
    const scene = runner.scene;
    root?.destroy(true);
    scene.input.setTopOnly(prevTopOnly);
    if (runner.pauseButton) {
        runner.pauseButton.setVisible(true);
        if (pauseWasInteractive) runner.pauseButton.setInteractive({ useHandCursor: true });
    }
};

const createChapter3Shell = async (runner, titleText, hintText) => {
    const scene = runner.scene;
    scene.input.enabled = true;
    const prevTopOnly = scene.input.topOnly;
    scene.input.setTopOnly(true);

    let pauseWasInteractive = false;
    if (runner.pauseButton) {
        pauseWasInteractive = runner.pauseButton.input?.enabled ?? false;
        runner.pauseButton.disableInteractive();
        runner.pauseButton.setVisible(false);
    }

    const root = scene.add.container(0, 0).setDepth(2200).setScrollFactor(0);
    const backdrop = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.76).setScrollFactor(0);
    const panel = scene.add.graphics();
    panel.fillStyle(0x1f1a16, 0.96);
    panel.fillRoundedRect(170, 74, 1580, 900, 24);
    panel.lineStyle(5, 0xfce1b4, 0.82);
    panel.strokeRoundedRect(170, 74, 1580, 900, 24);

    const title = scene.add.text(960, 126, titleText, {
        fontFamily: 'fredoka',
        fontSize: '42px',
        color: '#fce1b4',
        align: 'center',
    }).setOrigin(0.5);
    const hint = scene.add.text(960, 178, hintText, {
        fontFamily: 'fredoka',
        fontSize: '25px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 1320 },
    }).setOrigin(0.5);

    root.add([backdrop, panel, title, hint]);
    await runner.animateContainerIn(root);
    return { scene, root, prevTopOnly, pauseWasInteractive };
};

export async function runClassifyToolsMinigame(id, options = []) {
    const shell = await createChapter3Shell(
        this,
        'Clasifica herramientas y proteccion',
        'Arrastra cada elemento a su grupo correcto.'
    );
    const { scene, root, prevTopOnly, pauseWasInteractive } = shell;

    const groups = {
        tools: { label: 'Herramientas', x: 590, color: 0x4ea1ff },
        safety: { label: 'Protección', x: 1330, color: 0x2b9348 },
    };
    const items = [
        { key: 'item-pintura', label: 'Pintura', group: 'tools' },
        { key: 'item-brocha', label: 'Brocha', group: 'tools' },
        { key: 'item-aceite', label: 'Aceite', group: 'tools' },
        { key: 'item-llave', label: 'Llave', group: 'tools' },
        { key: 'item-cortatubos', label: 'Cortatubos', group: 'tools' },
        { key: 'item-trapo', label: 'Trapo', group: 'tools' },
        { key: 'item-cepillo', label: 'Cepillo', group: 'tools' },
        { key: 'item-guantes', label: 'Guantes', group: 'safety' },
        { key: 'item-gafas', label: 'Gafas', group: 'safety' },
        { key: 'item-casco', label: 'Casco', group: 'safety' },
        { key: 'item-botas', label: 'Botas', group: 'safety' },
        { key: 'item-tapabocas', label: 'Tapabocas', group: 'safety' },
    ];
    const itemsStartX = 300;
    const itemsSpacingX = 270;
    const itemsRow1Y = 835;
    const itemsRow2Y = 923;

    const zoneGraphics = {};
    const drawZone = (groupKey) => {
        const group = groups[groupKey];
        group.bounds = {
            left: group.x - 310,
            right: group.x + 310,
            top: 255,
            bottom: 775,
        };
        const frame = scene.add.graphics();
        frame.fillStyle(0xfaf4e8, 1);
        frame.fillRoundedRect(group.x - 310, 255, 620, 520, 18);
        frame.lineStyle(5, group.color, 0.95);
        frame.strokeRoundedRect(group.x - 310, 255, 620, 520, 18);

        const label = scene.add.text(group.x, 230, group.label, {
            fontFamily: 'fredoka',
            fontSize: '34px',
            color: '#ffffff',
        }).setOrigin(0.5);
        root.add([frame, label]);
        zoneGraphics[groupKey] = { frame, label };
        return group;
    };

    drawZone('tools');
    drawZone('safety');
    const zoneEntries = Object.entries(groups);
    const cards = [];
    items.forEach((item, index) => {
        const x = itemsStartX + (index % 6) * itemsSpacingX;
        const y = index < 6 ? itemsRow1Y : itemsRow2Y;
        const card = scene.add.container(x, y).setSize(104, 78).setScrollFactor(0);
        const bg = scene.add.graphics();
        const render = (color = 0xf6eddc, stroke = 0x8a4b25) => {
            bg.clear();
            bg.fillStyle(color, 1);
            bg.fillRoundedRect(-52, -39, 104, 78, 12);
            bg.lineStyle(3, stroke, 0.95);
            bg.strokeRoundedRect(-52, -39, 104, 78, 12);
        };
        render();
        const textureKey = getSafeTexture(scene, item.key);
        const icon = textureKey ? scene.add.image(0, -8, textureKey).setOrigin(0.5) : null;
        if (icon) icon.setScale(Math.min(42 / Math.max(1, icon.width), 34 / Math.max(1, icon.height)));
        const label = scene.add.text(0, 23, item.label, {
            fontFamily: 'fredoka',
            fontSize: '17px',
            color: '#2f241e',
            align: 'center',
            wordWrap: { width: 92 },
        }).setOrigin(0.5);
        card.add([bg, ...(icon ? [icon] : []), label]);
        card.expectedGroup = item.group;
        card.originalX = x;
        card.originalY = y;
        card.render = render;
        card.setInteractive({ useHandCursor: true });
        scene.input.setDraggable(card);
        root.add(card);
        cards.push(card);
    });

    let correctCount = 0;
    let resolveDone;
    const donePromise = new Promise((resolve) => { resolveDone = resolve; });
    const off = [];

    let highlightedZone = null;
    const clearZoneHighlight = () => {
        if (highlightedZone) {
            const g = groups[highlightedZone];
            zoneGraphics[highlightedZone].frame.clear();
            zoneGraphics[highlightedZone].frame.fillStyle(0xfaf4e8, 1);
            zoneGraphics[highlightedZone].frame.fillRoundedRect(g.x - 310, 255, 620, 520, 18);
            zoneGraphics[highlightedZone].frame.lineStyle(5, g.color, 0.95);
            zoneGraphics[highlightedZone].frame.strokeRoundedRect(g.x - 310, 255, 620, 520, 18);
            highlightedZone = null;
        }
    };

    const onDrag = (pointer, gameObject, dragX, dragY) => {
        if (!cards.includes(gameObject) || gameObject.locked) return;
        gameObject.setPosition(dragX, dragY);
        const over = getDropGroupKey(dragX, dragY);
        if (over !== highlightedZone) {
            clearZoneHighlight();
            if (over) {
                highlightedZone = over;
                const g = groups[over];
                zoneGraphics[over].frame.clear();
                zoneGraphics[over].frame.fillStyle(0xe8f5e9, 1);
                zoneGraphics[over].frame.fillRoundedRect(g.x - 310, 255, 620, 520, 18);
                zoneGraphics[over].frame.lineStyle(6, 0x2b9348, 1);
                zoneGraphics[over].frame.strokeRoundedRect(g.x - 310, 255, 620, 520, 18);
            }
        }
    };
    const getDropGroupKey = (x, y) => {
        const entry = zoneEntries.find(([, group]) => (
            x >= group.bounds.left &&
            x <= group.bounds.right &&
            y >= group.bounds.top &&
            y <= group.bounds.bottom
        ));
        return entry?.[0] ?? null;
    };
    const getStoredPosition = (groupKey, placedIndex) => {
        const group = groups[groupKey];
        const col = placedIndex % 4;
        const row = Math.floor(placedIndex / 4);
        return {
            x: group.bounds.left + 92 + col * 145,
            y: group.bounds.top + 76 + row * 104,
        };
    };
    const onDragEnd = (pointer, gameObject) => {
        clearZoneHighlight();
        if (!cards.includes(gameObject) || gameObject.locked) return;
        const groupKey = getDropGroupKey(gameObject.x, gameObject.y);
        if (!groupKey) {
            gameObject.setPosition(gameObject.originalX, gameObject.originalY);
            return;
        }

        if (gameObject.expectedGroup === groupKey) {
            gameObject.locked = true;
            gameObject.disableInteractive();
            gameObject.render(0xd9f4df, 0x2b9348);
            const placedIndex = cards.filter((card) => card.locked && card.expectedGroup === groupKey).length - 1;
            const storedPosition = getStoredPosition(groupKey, placedIndex);
            gameObject.setPosition(storedPosition.x, storedPosition.y);
            correctCount += 1;
            playUiSound(scene, 'success-bell', 0.35);
            if (correctCount >= cards.length) scene.time.delayedCall(650, resolveDone);
            return;
        }
        gameObject.render(0xffd9d9, 0xff4d4d);
        playUiSound(scene, 'wrong-option', 0.65);
        scene.time.delayedCall(400, () => {
            if (!gameObject.destroyed) gameObject.render();
        });
        gameObject.setPosition(gameObject.originalX, gameObject.originalY);
    };
    scene.input.on('drag', onDrag);
    scene.input.on('dragend', onDragEnd);
    off.push(() => scene.input.off('drag', onDrag), () => scene.input.off('dragend', onDragEnd));

    await donePromise;
    off.forEach((fn) => fn());
    this.minigames.set(id, options[0] ?? 'respuesta1');
    restoreMinigameUi(this, prevTopOnly, root, pauseWasInteractive);
}

export async function runCleanMillMinigame(id, options = []) {
    const shell = await createChapter3Shell(
        this,
        'Limpia el molino',
        'Toma el cepillo de la derecha y pasalo sobre la suciedad para limpiar el molino.'
    );
    const { scene, root, prevTopOnly, pauseWasInteractive } = shell;

    const dirtyKey = getSafeTexture(scene, 'molino-danado', ['molinoDanado']);
    const cleanKey = getSafeTexture(scene, 'molino_medio');
    const brushKey = getSafeTexture(scene, 'cepillo');

    if (!dirtyKey) {
        restoreMinigameUi(this, prevTopOnly, root, pauseWasInteractive);
        this.minigames.set(id, options[0] ?? 'respuesta1');
        return;
    }

    const dirtyTex = scene.textures.get(dirtyKey);
    const imgW = dirtyTex.getSourceImage().width;
    const imgH = dirtyTex.getSourceImage().height;
    const scale = Math.min(840 / Math.max(1, imgW), 630 / Math.max(1, imgH));
    const dispW = Math.round(imgW * scale);
    const dispH = Math.round(imgH * scale);

    const millCenterX = 960;
    const millCenterY = 520;

    const cleanMill = scene.add.image(millCenterX, millCenterY, cleanKey || dirtyKey)
        .setOrigin(0.5)
        .setScale(scale);
    root.add(cleanMill);

    const overlayRt = scene.add.renderTexture(millCenterX, millCenterY, dispW, dispH);
    overlayRt.setOrigin(0.5);
    const tmp = scene.make.image({ key: dirtyKey, add: false });
    tmp.setOrigin(0.5).setScale(scale);
    overlayRt.draw(tmp, dispW / 2, dispH / 2);
    tmp.destroy();
    root.add(overlayRt);

    const brushSize = 40;
    const gridCellSize = 30;
    const gridCols = Math.max(1, Math.ceil(dispW / gridCellSize));
    const gridRows = Math.max(1, Math.ceil(dispH / gridCellSize));
    const gridCleaned = new Array(gridCols * gridRows).fill(false);
    let totalCleaned = 0;

    const brushCursor = brushKey
        ? scene.add.image(0, 0, brushKey).setOrigin(0.5).setScrollFactor(0).setDepth(2350).setScale(0.25)
        : scene.add.text(0, 0, '🧹', { fontSize: '36px' }).setOrigin(0.5).setScrollFactor(0).setDepth(2350);
    brushCursor.setAlpha(0);

    const sideBrushX = millCenterX + dispW / 2 + 100;
    const sideBrushY = millCenterY + 20;
    const sideBrushScale = 0.35;
    const sideBrush = scene.add.image(sideBrushX, sideBrushY, brushKey || 'cepillo')
        .setOrigin(0.5)
        .setScale(0)
        .setDepth(2350)
        .setInteractive({ useHandCursor: true });
    scene.tweens.add({
        targets: sideBrush,
        scale: sideBrushScale,
        duration: 550,
        ease: 'Back.easeOut',
    });
    scene.tweens.add({
        targets: sideBrush,
        y: sideBrushY - 8,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
    });

    let resolveDone;
    const donePromise = new Promise((resolve) => { resolveDone = resolve; });
    let finished = false;
    let painting = false;
    let brushGrabbed = false;
    let lastEraseX = -9999;
    let lastEraseY = -9999;

    const progress = scene.add.text(960, 870, 'Limpieza: 0%', {
        fontFamily: 'fredoka', fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5);
    root.add(progress);

    const eraseShape = scene.make.graphics({ add: false });
    eraseShape.fillStyle(0x000000, 1);

    const updateProgress = () => {
        if (finished) return;
        const pct = Math.min(100, Math.round((totalCleaned / (gridCols * gridRows)) * 100));
        progress.setText(`Limpieza: ${pct}%`);
        if (pct >= 85) {
            finished = true;
            brushCursor.destroy();
            if (brushSound.isPlaying) brushSound.stop();
            if (sideBrush && !sideBrush.destroyed) sideBrush.destroy();
            scene.input.setDefaultCursor('default');
            progress.setColor('#9df0a8');
            progress.setText('¡Molino limpio!');
            playUiSound(scene, 'success-bell', 0.65);
            scene.time.delayedCall(700, resolveDone);
        }
    };

    const eraseAt = (px, py) => {
        if (finished) return;
        const dist = Phaser.Math.Distance.Between(px, py, lastEraseX, lastEraseY);
        if (dist < 8) return;
        lastEraseX = px;
        lastEraseY = py;

        const localX = Math.round(px - (millCenterX - dispW / 2));
        const localY = Math.round(py - (millCenterY - dispH / 2));
        if (localX < -brushSize || localY < -brushSize || localX > dispW + brushSize || localY > dispH + brushSize) return;

        eraseShape.clear();
        eraseShape.fillCircle(0, 0, brushSize);
        overlayRt.erase(eraseShape, localX, localY);

        const minC = Math.max(0, Math.floor((localX - brushSize) / gridCellSize));
        const maxC = Math.min(gridCols - 1, Math.floor((localX + brushSize) / gridCellSize));
        const minR = Math.max(0, Math.floor((localY - brushSize) / gridCellSize));
        const maxR = Math.min(gridRows - 1, Math.floor((localY + brushSize) / gridCellSize));
        let newCells = 0;
        for (let c = minC; c <= maxC; c++) {
            for (let r = minR; r <= maxR; r++) {
                const idx = r * gridCols + c;
                if (!gridCleaned[idx]) {
                    gridCleaned[idx] = true;
                    newCells++;
                }
            }
        }
        if (newCells > 0) {
            totalCleaned += newCells;
            updateProgress();
        }
    };

    const brushSound = scene.sound.add('brush-sound', {volume: 0.7, loop: true})

    const onDown = (pointer) => {
        if (finished || !brushGrabbed) return;
        painting = true;
        brushCursor.setPosition(pointer.x, pointer.y);
        eraseAt(pointer.x, pointer.y);
    };
    const onMove = (pointer) => {
        if (finished || !brushGrabbed) return;
        brushCursor.setPosition(pointer.x, pointer.y);
        if (painting) {
            if (!brushSound.isPlaying) brushSound.play();
            eraseAt(pointer.x, pointer.y);
        }
    };
    const onUp = () => {
        if (brushSound.isPlaying) brushSound.stop();
        painting = false;
    };

    sideBrush.on('pointerdown', (pointer) => {
        if (finished) return;
        brushGrabbed = true;
        scene.tweens.killTweensOf(sideBrush);
        sideBrush.destroy();
        brushCursor.setAlpha(1).setPosition(pointer.x, pointer.y);
        scene.input.setDefaultCursor('none');
    });

    scene.input.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);

    scene.events.on('shutdown', () => {
        scene.input.off('pointerdown', onDown);
        scene.input.off('pointermove', onMove);
        scene.input.off('pointerup', onUp);
        scene.input.setDefaultCursor('default');
        if (overlayRt && !overlayRt.destroyed) overlayRt.destroy();
        if (eraseShape && !eraseShape.destroyed) eraseShape.destroy();
    });

    await donePromise;
    if (scene.molinoBase && !scene.molinoBase.destroyed) {
        const mx = scene.molinoBase.x;
        const my = scene.molinoBase.y;
        const ms = scene.molinoBase.scaleX;
        scene.molinoBase.destroy();
        const medioKey = getSafeTexture(scene, 'molino_medio');
        scene.molinoBase = scene.add.image(mx, my, medioKey || 'molino_medio').setOrigin(0, 0).setScale(ms);
        scene.molinoBase.setDepth(120);
    }
    if (scene.molinoDanado && !scene.molinoDanado.destroyed) {
        const mx = scene.molinoDanado.x;
        const my = scene.molinoDanado.y;
        const ms = scene.molinoDanado.scaleX;
        scene.molinoDanado.destroy();
        const medioKey = getSafeTexture(scene, 'molino_medio');
        scene.molinoDanado = scene.add.image(mx, my, medioKey || 'molino_medio').setOrigin(0, 0).setScale(ms);
        scene.molinoDanado.setDepth(120);
    }
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.input.setDefaultCursor('default');
    if (overlayRt && !overlayRt.destroyed) overlayRt.destroy();
    if (eraseShape && !eraseShape.destroyed) eraseShape.destroy();
    this.minigames.set(id, options[0] ?? 'respuesta1');
    restoreMinigameUi(this, prevTopOnly, root, pauseWasInteractive);
}

export async function runPaintMillMinigame(id, options = []) {
    // ─── Shell ───────────────────────────────────────────────────────────────
    const shell = await createChapter3Shell(
        this,
        'Restaura las partes del molino',
        'Elige un color y pinta cada pieza con la brocha.'
    );
    const { scene, root, prevTopOnly, pauseWasInteractive } = shell;
    const wait = (ms) => new Promise(r => scene.time.delayedCall(ms, r));

    // ─── Palette colors ───────────────────────────────────────────────────────
    const COLORS = [
        { key: 'naranja', label: 'Naranja', fill: 0xFF8C42, stroke: 0xD4762D },
        { key: 'marron', label: 'Marrón', fill: 0x7D4E2D, stroke: 0x4A2A12 },
        { key: 'beige', label: 'Beige', fill: 0xD9BA96, stroke: 0xB08060 },
    ];

    // ─── Layout & erase constants ─────────────────────────────────────────────
    const BRUSH_SIZE = 30;
    const GRID_CELL = 16;
    const SINGLE_CX = 845;   // center X of the single-part display area
    const SINGLE_CY = 490;   // center Y
    const MAX_PART_W = 680;   // max display width for a part
    const MAX_PART_H = 500;   // max display height for a part
    const NAV_Y = SINGLE_CY;
    const NAV_L_X = 210;   // left arrow button center X
    const NAV_R_X = 1480;  // right arrow button center X
    const NAV_R = 40;    // click hit radius for nav buttons
    // aspas & rotor display size: same fixed diameter so they look identical in size
    const ASPAS_DIAM = Math.round(Math.min(MAX_PART_W, MAX_PART_H) * 0.75);

    // ─── Parts definition ─────────────────────────────────────────────────────
    const PARTS_DEF = [
        { id: 'torre', label: 'Torre', damageKey: 'parte_Torre_medio', cleanKey: 'parte_Torre', correctColor: 'naranja', coverageThreshold: 0.32 },
        { id: 'aspas', label: 'Aspas', damageKey: 'parte_Aspas_medio', cleanKey: 'parte_Aspas', correctColor: 'beige', coverageThreshold: 0.55 },
        { id: 'rotor', label: 'Rotor', damageKey: 'parte_Rotor_medio', cleanKey: 'parte_Rotor', correctColor: 'marron', coverageThreshold: 0.61 },
        { id: 'veleta', label: 'Veleta', damageKey: 'parte_Veleta_medio', cleanKey: 'parte_Veleta', correctColor: 'beige', coverageThreshold: 0.30 },
        { id: 'bomba', label: 'Bomba', damageKey: 'parte_bomba_medio', cleanKey: 'parte_bomba', correctColor: 'beige', coverageThreshold: 0.15 },
    ];

    // ─── State ────────────────────────────────────────────────────────────────
    let selectedColor = null;
    let painting = false;
    let completedCount = 0;
    let currentPartIdx = 0;
    let brushGrabbed = false;
    let resolveDone;
    const donePromise = new Promise(r => { resolveDone = r; });
    const eraseShape = scene.make.graphics({ add: false });

    // ─── Brush cursor (brocha → cepillo → círculo) ────────────────────────────
    const brushKey = scene.textures.exists('brocha') ? 'brocha'
        : scene.textures.exists('cepillo') ? 'cepillo'
            : null;
    const brushDot = brushKey
        ? scene.add.image(0, 0, brushKey)
            .setOrigin(0.2, 0.9).setScale(0.28)   // origin near bristle tip
            .setScrollFactor(0).setDepth(2350).setAlpha(0)
        : scene.add.circle(0, 0, BRUSH_SIZE * 0.5, 0xffffff, 0.55)
            .setScrollFactor(0).setDepth(2350).setAlpha(0);
    // brushDot is added to root AFTER all other children so it renders on top

    // ─── Feedback objects ─────────────────────────────────────────────────────
    const wrongMsg = scene.add.text(SINGLE_CX, 290, '', {
        fontFamily: 'fredoka', fontSize: '26px', color: '#ff7b7b',
        stroke: '#1a1208', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(2365);
    root.add(wrongMsg);

    const POOL_SIZE = 28;
    const splashPool = Array.from({ length: POOL_SIZE }, () =>
        scene.add.circle(0, 0, Phaser.Math.Between(3, 8), 0xffffff, 0.85)
            .setAlpha(0).setDepth(2355)
    );
    splashPool.forEach(d => root.add(d));
    let splashIdx = 0;

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function srcSize(key) {
        const s = scene.textures.get(key).getSourceImage();
        return { w: s.width, h: s.height };
    }

    function hitTestPart(p, wx, wy) {
        // Full bounding box for all parts — allows painting the entire image
        return wx >= p.overlayLeft - 4 && wx <= p.overlayLeft + p.dispW + 4 &&
            wy >= p.overlayTop - 4 && wy <= p.overlayTop + p.dispH + 4;
    }

    function getPartAt(wx, wy) {
        const p = parts[currentPartIdx];
        if (!p || p.completed) return null;
        return hitTestPart(p, wx, wy) ? p : null;
    }

    function spawnSplash(wx, wy, fill) {
        for (let i = 0; i < 5; i++) {
            const dot = splashPool[splashIdx++ % POOL_SIZE];
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const dist = Phaser.Math.Between(6, 28);
            dot.setPosition(wx + Math.cos(angle) * dist, wy + Math.sin(angle) * dist)
                .setFillStyle(fill, 0.85).setScale(Phaser.Math.FloatBetween(0.5, 1.4)).setAlpha(1);
            scene.tweens.add({
                targets: dot, alpha: 0, duration: 400,
                delay: Phaser.Math.Between(0, 60), ease: 'Sine.out',
            });
        }
    }

    function eraseAt(p, wx, wy) {
        const lx = wx - p.overlayLeft;
        const ly = wy - p.overlayTop;
        if (lx < -BRUSH_SIZE || ly < -BRUSH_SIZE || lx > p.dispW + BRUSH_SIZE || ly > p.dispH + BRUSH_SIZE) return;
        eraseShape.clear();
        eraseShape.fillCircle(0, 0, BRUSH_SIZE);
        p.overlay.erase(eraseShape, lx, ly);
        const minC = Math.max(0, Math.floor((lx - BRUSH_SIZE) / GRID_CELL));
        const maxC = Math.min(p.gCols - 1, Math.floor((lx + BRUSH_SIZE) / GRID_CELL));
        const minR = Math.max(0, Math.floor((ly - BRUSH_SIZE) / GRID_CELL));
        const maxR = Math.min(p.gRows - 1, Math.floor((ly + BRUSH_SIZE) / GRID_CELL));
        let newCells = 0;
        for (let c = minC; c <= maxC; c++) {
            for (let r = minR; r <= maxR; r++) {
                const idx = r * p.gCols + c;
                if (!p.gridCleaned[idx]) { p.gridCleaned[idx] = true; newCells++; }
            }
        }
        if (newCells > 0) {
            p.cleanedCells += newCells;
            updateProgress(p);
        }
    }

    function updateProgress(p) {
        const denom = Math.max(1, (p.totalOpaqueCells || p.totalCells || 1) * (p.coverageThreshold || 1));
        const displayPct = Math.min(100, Math.round((p.cleanedCells / denom) * 100));
        if (parts[currentPartIdx] === p) updatePartInfoText();
        if (displayPct >= 100 && !p.completed) completePart(p);
    }

    function shakePart(p) {
        if (p._shaking) return;
        p._shaking = true;
        const ox = p.restored.x, oox = p.overlay.x;
        scene.tweens.add({
            targets: p.restored, x: ox + 7, yoyo: true, repeat: 4, duration: 38,
            onComplete: () => { p.restored.setX(ox); p._shaking = false; },
        });
        scene.tweens.add({
            targets: p.overlay, x: oox + 7, yoyo: true, repeat: 4, duration: 38,
            onComplete: () => p.overlay.setX(oox),
        });
    }

    function showWrongMsg(msg, wx, wy) {
        const baseY = Math.max(130, wy - 45);
        wrongMsg.setText(msg).setPosition(wx, baseY).setAlpha(1);
        scene.tweens.killTweensOf(wrongMsg);
        scene.tweens.add({
            targets: wrongMsg, alpha: 0, y: baseY - 55, duration: 1200, ease: 'Sine.out',
            onComplete: () => wrongMsg.setY(baseY),
        });
    }

    function selectColor(c) {
        selectedColor = c.key;
        COLORS.forEach(cc => { if (cc._swatch) cc._swatch.setStrokeStyle(3, cc.stroke); });
        c._swatch.setStrokeStyle(5, 0xffffff);
    }

    function paintPart(wx, wy) {
        const p = getPartAt(wx, wy);
        if (!p) return;
        if (!selectedColor) {
            showWrongMsg('Primero elige un color', SINGLE_CX, SINGLE_CY - 80);
            return;
        }
        if (!brushGrabbed) {
            showWrongMsg('Toma la brocha para pintar', SINGLE_CX, SINGLE_CY - 80);
            return;
        }
        if (selectedColor !== p.correctColor) {
            showWrongMsg('Ese no es el color correcto', wx, wy);
            shakePart(p);
            return;
        }
        const fill = COLORS.find(c => c.key === selectedColor)?.fill ?? 0xffffff;
        eraseAt(p, wx, wy);
        if (painting) spawnSplash(wx, wy, fill);
    }

    // ─── Navigation helpers ───────────────────────────────────────────────────

    function updatePartInfoText() {
        if (!partInfoText || partInfoText.destroyed) return;
        const p = parts[currentPartIdx];
        if (!p) return;
        const denom = Math.max(1, (p.totalOpaqueCells || p.totalCells || 1) * (p.coverageThreshold || 1));
        const pct = Math.min(100, Math.round((p.cleanedCells / denom) * 100));
        const status = p.completed ? '✓ Listo' : `${pct}%`;
        partInfoText.setText(`${p.label}  ·  ${currentPartIdx + 1} de ${parts.length}  ·  ${status}`);
    }

    function updateDots() {
        if (!dots || dots.length === 0) return;
        dots.forEach((d, i) => {
            const p = parts[i];
            if (p.completed) d.setFillStyle(0x9df0a8, 1).setAlpha(1);
            else if (i === currentPartIdx) d.setFillStyle(0xfce1b4, 1).setAlpha(1);
            else d.setFillStyle(0x5a4535, 1).setAlpha(0.6);
        });
    }

    function showPart(idx) {
        parts.forEach((p, i) => {
            const v = (i === idx);
            if (p.restored && !p.restored.destroyed) p.restored.setVisible(v);
            if (p.overlay && !p.overlay.destroyed) p.overlay.setVisible(v);
        });
        currentPartIdx = idx;
        updatePartInfoText();
        updateDots();
        updateNavState();
    }

    function navigate(dir) {
        const cur = parts[currentPartIdx];
        if (cur && !cur.completed) { showWrongMsg('Termina de pintar la pieza antes de avanzar', SINGLE_CX, SINGLE_CY - 80); playUiSound(scene, 'wrong', 0.25); return; }
        const idx = (currentPartIdx + dir + parts.length) % parts.length;
        showPart(idx);
        playUiSound(scene, 'pop', 0.3);
        const btn = dir < 0 ? navLeft : navRight;
        if (btn && !btn.destroyed) {
            scene.tweens.add({ targets: btn, scaleX: 1.25, scaleY: 1.25, duration: 80, yoyo: true });
        }
    }

    function updateNavState() {
        const cur = parts[currentPartIdx];
        const locked = cur && !cur.completed;
        const a = locked ? 0.32 : 1;
        if (navLeft && !navLeft.destroyed) navLeft.setAlpha(a);
        if (navRight && !navRight.destroyed) navRight.setAlpha(a);
    }

    function completePart(p) {
        p.completed = true;
        completedCount++;
        if (p.overlay && !p.overlay.destroyed) p.overlay.destroy();

        playUiSound(scene, 'pop', 0.6);
        scene.time.delayedCall(85, () => playUiSound(scene, 'success-bell', 0.32));

        const colorFill = COLORS.find(c => c.key === p.correctColor)?.fill ?? 0xffffff;
        const flash = scene.add.rectangle(SINGLE_CX, SINGLE_CY, p.dispW + 10, p.dispH + 10, 0xffffff, 0.5);
        root.add(flash);
        scene.tweens.add({
            targets: flash, alpha: 0, scaleX: 1.2, scaleY: 1.2, duration: 550, ease: 'Sine.out',
            onComplete: () => { if (!flash.destroyed) flash.destroy(); },
        });
        for (let i = 0; i < 10; i++) spawnSplash(SINGLE_CX, SINGLE_CY, colorFill);

        // pop animation for the restored piece
        if (p.restored && !p.restored.destroyed) {
            p.restored.setScale(p.scale * 0.92);
            scene.tweens.add({ targets: p.restored, scale: p.scale * 1.06, duration: 420, ease: 'Back.out' });
        }

        progressText.setText(`Partes restauradas: ${completedCount} / ${parts.length}`);
        updatePartInfoText();
        updateDots();
        updateNavState();

        if (completedCount >= parts.length) {
            finishGame();
        } else {
            // Auto-avanzar a la siguiente pieza (la siguiente no completada)
            let nextIdx = -1;
            for (let i = 1; i < parts.length; i++) {
                const idx = (currentPartIdx + i) % parts.length;
                if (!parts[idx].completed) { nextIdx = idx; break; }
            }
            if (nextIdx !== -1) scene.time.delayedCall(700, () => showPart(nextIdx));
        }
    }

    async function finishGame() {
        scene.input.setDefaultCursor('default');
        brushDot.setAlpha(0);

        const allRestored = parts.map(p => p.restored).filter(s => s && !s.destroyed);
        const toFade = [
            ...allRestored, progressText, partInfoText,
            ...dots, navLeft, navRight,
            ...COLORS.flatMap(c => [c._swatch, c._label]),
            palBg, palLabel,
        ].filter(s => s && !s.destroyed);
        await new Promise(r => scene.tweens.add({
            targets: toFade, alpha: 0, duration: 600, ease: 'Sine.in', onComplete: r,
        }));

        await buildRestoredMill();

        const finalMsg = scene.add.text(960, 420, '¡Molino restaurado!', {
            fontFamily: 'fredoka', fontSize: '52px', color: '#fce1b4',
            stroke: '#1a1208', strokeThickness: 5,
        }).setOrigin(0.5).setAlpha(0);
        root.add(finalMsg);
        scene.tweens.add({ targets: finalMsg, alpha: 1, y: 320, duration: 700, ease: 'Back.out' });
        playUiSound(scene, 'success-bell', 0.85);

        await wait(2800);
        resolveDone();
    }

    async function buildRestoredMill() {
        if (!scene.textures.exists('molino-base') || !scene.textures.exists('molino-aspas')) {
            const fb = scene.add.image(960, 530, 'molino_medio').setOrigin(0.5).setScale(0.38).setAlpha(0);
            root.add(fb);
            await new Promise(r => scene.tweens.add({ targets: fb, alpha: 1, duration: 700, ease: 'Sine.in', onComplete: r }));
            return;
        }
        const baseSrc = scene.textures.get('molino-base').getSourceImage();
        const baseScale = Math.min(340 / baseSrc.width, 400 / baseSrc.height);
        const baseX = Math.round(960 - baseSrc.width * baseScale / 2);
        const baseY = Math.round(830 - baseSrc.height * baseScale);

        const millBase = scene.add.image(baseX, baseY, 'molino-base')
            .setOrigin(0, 0).setScale(baseScale).setAlpha(0);
        root.add(millBase);

        const aspasX = baseX + Math.round(705 * baseScale);
        const aspasY = baseY + Math.round(175 * baseScale);
        const millAspas = scene.add.image(aspasX, aspasY, 'molino-aspas')
            .setOrigin(0.5).setScale(baseScale).setAlpha(0);
        root.add(millAspas);

        const toShow = [millBase, millAspas];
        if (scene.textures.exists('moving-piece')) {
            const mpX = baseX + Math.round(703 * baseScale);
            const mpBaseY = baseY + Math.round(1736 * baseScale);
            const mpTopY = baseY + Math.round(984 * baseScale);
            const mp = scene.add.image(mpX, mpBaseY, 'moving-piece')
                .setOrigin(0.5, 1).setScale(baseScale).setAlpha(0);
            root.add(mp);
            toShow.push(mp);
            scene.tweens.add({
                targets: mp, y: mpTopY,
                duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 400,
            });
        }

        await new Promise(r => scene.tweens.add({
            targets: toShow, alpha: 1, duration: 800, ease: 'Sine.in', onComplete: r,
        }));
        scene.tweens.add({ targets: millAspas, angle: 360, duration: 3000, ease: 'Linear', repeat: -1 });
    }

    // ─── createParts: each part centered at (SINGLE_CX, SINGLE_CY) with per-pixel mask ─
    function createParts() {
        const built = [];
        for (const def of PARTS_DEF) {
            const dKey = getSafeTexture(scene, def.damageKey);
            const cKey = getSafeTexture(scene, def.cleanKey);
            if (!dKey || !cKey) continue;

            const srcImg = scene.textures.get(dKey).getSourceImage();
            const sz = { w: srcImg.width, h: srcImg.height };
            const cleanSrcImg = scene.textures.get(cKey).getSourceImage();
            const cleanSz = { w: cleanSrcImg.width, h: cleanSrcImg.height };

            // Force consistent size for aspas/rotor; compute separate scale per image
            // so overlay (dKey) and restored (cKey) always display at the same visual size.
            let scale = Math.min(MAX_PART_W / sz.w, MAX_PART_H / sz.h);
            let cleanScale = Math.min(MAX_PART_W / cleanSz.w, MAX_PART_H / cleanSz.h);
            if (def.id === 'aspas' || def.id === 'rotor') {
                const target = ASPAS_DIAM;
                scale = target / Math.max(sz.w, sz.h);
                cleanScale = target / Math.max(cleanSz.w, cleanSz.h);
            }
            const dispW = Math.round(sz.w * scale);
            const dispH = Math.round(sz.h * scale);
            const overlayLeft = Math.round(SINGLE_CX - dispW / 2);
            const overlayTop = Math.round(SINGLE_CY - dispH / 2);

            const restored = scene.add.image(SINGLE_CX, SINGLE_CY, cKey)
                .setOrigin(0.5, 0.5).setScale(cleanScale).setVisible(false);
            root.add(restored);

            const overlay = scene.add.renderTexture(SINGLE_CX, SINGLE_CY, dispW, dispH)
                .setOrigin(0.5, 0.5).setVisible(false);
            const tmp = scene.make.image({ key: dKey, add: false });
            tmp.setOrigin(0.5, 0.5).setScale(scale);
            overlay.draw(tmp, dispW / 2, dispH / 2);
            // Build opaque-cell mask by sampling the scaled image on a canvas
            const gCols = Math.max(1, Math.ceil(dispW / GRID_CELL));
            const gRows = Math.max(1, Math.ceil(dispH / GRID_CELL));
            const grid = new Array(gCols * gRows).fill(false);
            let totalOpaque = 0;
            try {
                const cv = document.createElement('canvas');
                cv.width = dispW; cv.height = dispH;
                const cx = cv.getContext('2d');
                cx.clearRect(0, 0, dispW, dispH);
                cx.drawImage(srcImg, 0, 0, dispW, dispH);
                const imgd = cx.getImageData(0, 0, dispW, dispH).data;
                for (let r = 0; r < gRows; r++) {
                    for (let c = 0; c < gCols; c++) {
                        const sx = Math.min(dispW - 1, Math.floor((c + 0.5) * GRID_CELL));
                        const sy = Math.min(dispH - 1, Math.floor((r + 0.5) * GRID_CELL));
                        const idx = (sy * dispW + sx) * 4 + 3; // alpha channel
                        const a = imgd[idx];
                        const cellIdx = r * gCols + c;
                        if (a > 16) { grid[cellIdx] = false; totalOpaque++; }
                        else { grid[cellIdx] = true; /* already transparent */ }
                    }
                }
            } catch (e) {
                // Fallback: consider all cells opaque
                for (let i = 0; i < grid.length; i++) { grid[i] = false; }
                totalOpaque = grid.length;
            }

            tmp.destroy();
            root.add(overlay);

            built.push({
                ...def, restored, overlay,
                scale: cleanScale, dispW, dispH,
                overlayLeft, overlayTop,
                overlayCX: SINGLE_CX, overlayCY: SINGLE_CY,
                gCols, gRows,
                gridCleaned: grid,
                cleanedCells: 0, totalOpaqueCells: totalOpaque,
                coverageThreshold: 0.99, // ~95% of opaque pixels must be painted
                completed: totalOpaque === 0, _shaking: false,
            });
        }
        return built;
    }

    const parts = createParts();

    if (parts.length === 0) {
        restoreMinigameUi(this, prevTopOnly, root, pauseWasInteractive);
        this.minigames.set(id, options[0] ?? 'respuesta1');
        return;
    }

    // ─── Part info text ───────────────────────────────────────────────────────
    const partInfoText = scene.add.text(SINGLE_CX, 838, '', {
        fontFamily: 'fredoka', fontSize: '22px', color: '#fce1b4',
    }).setOrigin(0.5);
    root.add(partInfoText);

    // ─── Dots progress indicator ──────────────────────────────────────────────
    const DOT_GAP = 30;
    const DOT_Y = 872;
    const dotsX0 = SINGLE_CX - ((parts.length - 1) / 2) * DOT_GAP;
    const dots = parts.map((_, i) => {
        const dot = scene.add.circle(dotsX0 + i * DOT_GAP, DOT_Y, 8, 0x5a4535, 1).setAlpha(0.6);
        root.add(dot);
        return dot;
    });

    // ─── Overall progress text ────────────────────────────────────────────────
    const progressText = scene.add.text(SINGLE_CX, 906, `Partes restauradas: 0 / ${parts.length}`, {
        fontFamily: 'fredoka', fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5);
    root.add(progressText);

    // ─── Navigation arrows ────────────────────────────────────────────────────
    const navStyle = {
        fontFamily: 'fredoka', fontSize: '64px', color: '#fce1b4',
        stroke: '#1a1208', strokeThickness: 4,
    };
    const navLeft = scene.add.text(NAV_L_X, NAV_Y, '‹', navStyle).setOrigin(0.5);
    const navRight = scene.add.text(NAV_R_X, NAV_Y, '›', navStyle).setOrigin(0.5);
    root.add(navLeft);
    root.add(navRight);

    // ─── Palette (right side) and brocha pickup ───────────────────────────────
    const PAL_X = 1600;
    const PAL_Y0 = 360;
    const SW_R = 34;
    const SW_GAP = 90;

    const palBg = scene.add.graphics();
    palBg.fillStyle(0x1a1208, 0.82);
    const palHeight = 40 + COLORS.length * SW_GAP + 20;
    const palTop = PAL_Y0 - 80;
    palBg.fillRoundedRect(PAL_X - 64, palTop, 128, palHeight, 16);
    root.add(palBg);

    const palLabel = scene.add.text(PAL_X, PAL_Y0 - 58, 'PINTURA', {
        fontFamily: 'fredoka', fontSize: '17px', color: '#fce1b4',
    }).setOrigin(0.5);
    root.add(palLabel);

    COLORS.forEach((c, i) => {
        const sy = PAL_Y0 + i * SW_GAP;
        const swatch = scene.add.circle(PAL_X, sy, SW_R, c.fill)
            .setStrokeStyle(3, c.stroke).setInteractive({ useHandCursor: true });
        root.add(swatch);
        const lbl = scene.add.text(PAL_X, sy + SW_R + 9, c.label, {
            fontFamily: 'fredoka', fontSize: '13px', color: '#fce1b4',
        }).setOrigin(0.5);
        root.add(lbl);
        c._swatch = swatch;
        c._label = lbl;
        swatch.on('pointerdown', () => selectColor(c));
        UIHelpers.attachHoverPop(scene, swatch, 0.18);
    });

    // brocha pickup item (below color swatches, fully outside the palette rect)
    const BROCHA_MARGIN_TOP = 80;
    const brochaTop = palTop + palHeight + BROCHA_MARGIN_TOP;
    const brochaY = brochaTop + 50; // account for icon half-height
    const brochaIcon = brushKey
        ? scene.add.image(PAL_X, brochaY, brushKey).setScale(0).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(2360)
        : scene.add.circle(PAL_X, brochaY, 22, 0xffffff, 1).setInteractive({ useHandCursor: true });
    root.add(brochaIcon);
    // pop-in + idle float animation (same pattern as sideBrush in clean-mill minigame)
    scene.tweens.add({ targets: brochaIcon, scale: 0.65, duration: 550, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: brochaIcon, y: brochaY - 8, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const brochaArrow = scene.add.text(PAL_X, brochaY - 100, '⬇', { fontFamily: 'fredoka', fontSize: '28px', color: '#fce1b4' }).setOrigin(0.5);
    root.add(brochaArrow);

    function setBrochaGrabbed(v) {
        brushGrabbed = !!v;
        if (!brochaIcon || brochaIcon.destroyed) return;
        scene.tweens.killTweensOf(brochaIcon);
        if (brushGrabbed) {
            brochaIcon.setVisible(false);
            brochaArrow.setVisible(false);
            brushDot.setAlpha(1);
            scene.__defaultCursor = 'none';
            scene.input.setDefaultCursor('none');
        } else {
            brochaIcon.setVisible(true).setScale(0.65);
            brochaArrow.setVisible(true);
            brushDot.setAlpha(0);
            scene.__defaultCursor = _prevDefaultCursor;
            scene.input.setDefaultCursor(_prevDefaultCursor);
        }
    }
    brochaIcon.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation();
        setBrochaGrabbed(!brushGrabbed);
        playUiSound(scene, 'pop', 0.3);
    });

    // ─── Show first part ──────────────────────────────────────────────────────
    showPart(0);

    // ─── Input handlers ───────────────────────────────────────────────────────
    const _prevDefaultCursor = scene.__defaultCursor ?? 'default';

    const onDown = (ptr) => {
        brushDot.setPosition(ptr.x, ptr.y).setAlpha(brushGrabbed ? 1 : 0);
        // Explicit brocha click fallback (only when icon is visible on screen)
        try {
            if (brochaIcon && !brochaIcon.destroyed && brochaIcon.visible) {
                const r = Math.max(28, Math.min(brochaIcon.displayWidth, brochaIcon.displayHeight) / 2 + 12);
                if (Phaser.Math.Distance.Between(ptr.x, ptr.y, brochaIcon.x, brochaIcon.y) <= r) {
                    setBrochaGrabbed(true);
                    playUiSound(scene, 'pop', 0.3);
                    return;
                }
            }
        } catch (e) { /* ignore */ }
        // Palette check (reliable bypass for container input offset)
        for (let i = 0; i < COLORS.length; i++) {
            const sy = PAL_Y0 + i * SW_GAP;
            if (Phaser.Math.Distance.Between(ptr.x, ptr.y, PAL_X, sy) <= SW_R + 10) {
                selectColor(COLORS[i]);
                return;
            }
        }
        // Navigation arrows check
        if (Phaser.Math.Distance.Between(ptr.x, ptr.y, NAV_L_X, NAV_Y) <= NAV_R) { navigate(-1); return; }
        if (Phaser.Math.Distance.Between(ptr.x, ptr.y, NAV_R_X, NAV_Y) <= NAV_R) { navigate(+1); return; }
        // Paint (only if brocha grabbed)
        painting = !!brushGrabbed;
        paintPart(ptr.x, ptr.y);
    };

    const splatSound = scene.sound.add('splat-sound', {volume: 0.7, loop: true})

    const onMove = (ptr) => {
        brushDot.setPosition(ptr.x, ptr.y).setAlpha(brushGrabbed ? 1 : 0);
        if (painting) {
            if (!splatSound.isPlaying) splatSound.play();
            paintPart(ptr.x, ptr.y);
        }
    };
    const onUp = () => { 
        if (splatSound.isPlaying) splatSound.stop();
        painting = false; 
    };

    scene.input.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);

    scene.events.on('shutdown', () => {
        scene.input.off('pointerdown', onDown);
        scene.input.off('pointermove', onMove);
        scene.input.off('pointerup', onUp);
        scene.__defaultCursor = _prevDefaultCursor;
        scene.input.setDefaultCursor(_prevDefaultCursor);
        if (eraseShape && !eraseShape.destroyed) eraseShape.destroy();
        if (brushDot && !brushDot.destroyed) brushDot.destroy();
    });

    await donePromise;

    // Replace background mill with the clean painted version
    if (scene.molinoBase && !scene.molinoBase.destroyed) {
        const mx = scene.molinoBase.x;
        const my = scene.molinoBase.y;
        const ms = scene.molinoBase.scaleX;
        const mo = { x: scene.molinoBase.originX, y: scene.molinoBase.originY };
        const md = scene.molinoBase.depth;
        scene.molinoBase.destroy();
        const limpio = getSafeTexture(scene, 'molino-limpio') ?? getSafeTexture(scene, 'molino_medio');
        scene.molinoBase = scene.add.image(mx, my, limpio).setOrigin(mo.x, mo.y).setScale(ms).setDepth(md);
    }

    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.__defaultCursor = _prevDefaultCursor;
    scene.input.setDefaultCursor(_prevDefaultCursor);
    if (eraseShape && !eraseShape.destroyed) eraseShape.destroy();
    if (brushDot && !brushDot.destroyed) brushDot.destroy();
    this.minigames.set(id, options[0] ?? 'respuesta1');
    restoreMinigameUi(this, prevTopOnly, root, pauseWasInteractive);


}

export async function runLubricateMillMinigame(id, options = []) {
    const shell = await createChapter3Shell(
        this,
        'Lubrica el convertidor',
        'Arrastra cada pieza hasta su lugar en el convertidor.',
    );
    const { scene, root, prevTopOnly, pauseWasInteractive } = shell;

    const CX = 950;
    const CY = 570;

    // Tamaño real de la imagen compuesta original del convertidor
    const MASTER_W = 1868;
    const MASTER_H = 3788;

    // Misma lógica de escala que usabas para la imagen compuesta
    const maxDim = 640;
    const compositeScale = Math.min(maxDim / MASTER_W, maxDim / MASTER_H, 1.2);

    // Esquina superior-izquierda del lienzo maestro, en coordenadas de la escena
    const originX = CX - (MASTER_W * compositeScale) / 2;
    const originY = CY - (MASTER_H * compositeScale) / 2;

    // ── PIEZAS, EN ORDEN DE PROFUNDIDAD (de atrás hacia adelante) ──────────
    // Este orden corresponde al de las capas de Figma "Group 86" (imagen 2),
    // leídas de abajo hacia arriba: chasis -> contenedor -> anillo lubricante
    // -> anillo de pistón -> piñón pequeño -> piñón grande -> biela (frente).
    // Los valores ox/oy siguen siendo PROVISIONALES: actívalos con precisión
    // real usando CALIBRATION_MODE (ver abajo) y pega los valores impresos
    // en consola aquí.
    const PARTS = [
        { key: 'eng-chasis',            w: 1722, h: 3788, ox: 83,  oy: 0    },
        { key: 'eng-contenedor',        w: 1868, h: 1070, ox: 0,   oy: 2450 },
        { key: 'eng-anillo-lubricante', w: 602,  h: 602,  ox: 420, oy: 1420  },
        { key: 'eng-anillo-piston',     w: 632,  h: 632,  ox: 310, oy: 1220  },
        { key: 'eng-pinon-pequeno',     w: 455,  h: 455,  ox: 60,  oy: 2600 },
        { key: 'eng-pinon-grande',      w: 1335, h: 1335, ox: 420, oy: 2020 },
        { key: 'eng-biela',             w: 1190, h: 1629, ox: 500, oy: 1400  },
    ];
    // ────────────────────────────────────────────────────────────────────

    // true  -> modo calibración: cada pieza aparece sobre su lugar correcto,
    //          la arrastras un poco para ajustar y lees ox/oy por consola.
    // false -> modo juego: las piezas salen dispersas y hay que arrastrarlas
    //          hasta encajarlas en su posición correcta.
    const CALIBRATION_MODE = false;

    // Distancia (en px de pantalla) a la que se considera "encajada" una pieza
    const SNAP_TOLERANCE = 28;

    const overlay = scene.add.rectangle(CX, CY, 1400, 780, 0x000000, 0);
    root.add(overlay);

    let guide = null;
    if (scene.textures.exists('eng-convertidor')) {
        guide = scene.add.image(CX, CY, 'eng-convertidor')
            .setOrigin(0.5)
            .setScale(compositeScale)
            .setAlpha(CALIBRATION_MODE ? 0.3 : 0.15);
        root.add(guide);
    }

    const instruc = scene.add.text(
        CX,
        220,
        CALIBRATION_MODE
            ? 'Modo calibración: arrastra y revisa la consola'
            : 'Arrastra cada pieza a su lugar',
        { fontFamily: 'fredoka', fontSize: '20px', color: '#fce1b4' },
    ).setOrigin(0.5).setAlpha(0.85);
    root.add(instruc);

    // Posición correcta (destino) de cada pieza, ya en coordenadas de escena
    const withTargets = PARTS
        .filter((p) => scene.textures.exists(p.key))
        .map((p) => ({
            part: p,
            targetX: originX + (p.ox + p.w / 2) * compositeScale,
            targetY: originY + (p.oy + p.h / 2) * compositeScale,
        }));

    const totalParts = withTargets.length;
    let placedCount = 0;

    // Puntos de partida dispersos dentro del panel del minijuego, sin tapar título
    const scatterSpots = [
        { x: 400, y: 450 },
        { x: 1500, y: 350 },
        { x: 600, y: 570 },
        { x: 1500, y: 570 },
        { x: 600, y: 800 },
        { x: 1500, y: 800 },
        { x: 600, y: 300 },
    ];

    // ── Crear piezas arrastrables (misma técnica que classifyTools / ordenar_proceso) ──
    // El orden del array PARTS define la profundidad: primera = abajo (menor depth),
    // última = arriba (mayor depth).
    const draggableItems = [];

    withTargets.forEach(({ part, targetX, targetY }, i) => {
        const startX = CALIBRATION_MODE ? targetX : scatterSpots[i % scatterSpots.length].x;
        const startY = CALIBRATION_MODE ? targetY : scatterSpots[i % scatterSpots.length].y;

        const tex = scene.textures.get(part.key).getSourceImage();
        const w = Math.round(tex.width * compositeScale);
        const h = Math.round(tex.height * compositeScale);

        const depth = i; // primera en array = menor depth (abajo)

        const wrapper = scene.add.container(startX, startY).setSize(w, h).setScrollFactor(0);
        const img = scene.add.image(0, 0, part.key).setOrigin(0.5).setScale(compositeScale);
        wrapper.add(img);
        wrapper.setDepth(depth);
        wrapper.setInteractive({ useHandCursor: true });
        scene.input.setDraggable(wrapper);
        root.add(wrapper);

        draggableItems.push({
            wrapper, img, part, targetX, targetY,
            placed: false,
            startX, startY, depth,
        });
    });

    // ── Eventos de arrastre en scene.input (mismo patrón que ordenar_proceso) ──
    let resolveDone;
    const donePromise = new Promise((r) => { resolveDone = r; });

    const onDragStart = (pointer, gameObject) => {
        const item = draggableItems.find(d => d.wrapper === gameObject);
        if (!item || item.placed) return;
        scene.children.bringToTop(root);
        root.bringToTop(gameObject);
    };

    const onDrag = (pointer, gameObject, dragX, dragY) => {
        const item = draggableItems.find(d => d.wrapper === gameObject);
        if (!item || item.placed) return;
        gameObject.x = dragX;
        gameObject.y = dragY;
    };

    const onDragEnd = (pointer, gameObject, dropped) => {
        const item = draggableItems.find(d => d.wrapper === gameObject);
        if (!item || item.placed) return;

        if (CALIBRATION_MODE) {
            const ox = Math.round((gameObject.x - originX) / compositeScale - item.part.w / 2);
            const oy = Math.round((gameObject.y - originY) / compositeScale - item.part.h / 2);
            console.log(`{ key: '${item.part.key}', w: ${item.part.w}, h: ${item.part.h}, ox: ${ox}, oy: ${oy} },`);
            return;
        }

        const dist = Phaser.Math.Distance.Between(gameObject.x, gameObject.y, item.targetX, item.targetY);
        if (dist <= SNAP_TOLERANCE) {
            

            item.placed = true;
            placedCount += 1;

            // Restaurar profundidad correcta al encajar
            gameObject.setDepth(item.depth);

            scene.tweens.add({
                targets: gameObject,
                x: item.targetX,
                y: item.targetY,
                duration: 120,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    playUiSound(scene, 'success-bell', 0.6);
                    scene.tweens.add({
                        targets: gameObject,
                        scaleX: 1.15,
                        scaleY: 1.15,
                        duration: 120,
                        ease: 'Quad.easeOut',
                        yoyo: true,
                    });
                },
            });
            gameObject.disableInteractive();

            if (placedCount >= totalParts) {
                instruc.setText('¡El convertidor rechina! Aplica aceite en los 3 puntos.');
                scene.time.delayedCall(400, startOilingPhase);
            }
        } else if (!dropped) {
            scene.tweens.add({
                targets: gameObject,
                x: item.startX,
                y: item.startY,
                duration: 200,
                ease: 'Back.easeOut',
            });
        }
    };

    scene.input.on('dragstart', onDragStart);
    scene.input.on('drag', onDrag);
    scene.input.on('dragend', onDragEnd);

    // ── Fase de aceite: después de armar el convertidor ──────────────────────────
    let oilListeners = [];

    function startOilingPhase() {
        // Efecto de rechinar
        playUiSound(scene, 'wrong-option', 0.25);
        if (guide) {
            scene.tweens.add({
                targets: guide,
                x: guide.x + 5,
                duration: 40,
                yoyo: true,
                repeat: 6,
                onComplete: () => { guide.x = CX; },
            });
        }

        const oilKeys = ['eng-pinon-grande', 'eng-biela', 'eng-anillo-lubricante'];
        const oilTargets = draggableItems.filter(d => oilKeys.includes(d.part.key));
        let oiledCount = 0;

        // Marcadores de puntos de aceite (círculos pulsantes)
        const oilPoints = oilTargets.map((item) => {
            const dot = scene.add.circle(item.targetX, item.targetY, 22, 0xff4444, 0.85)
                .setDepth(300);
            root.add(dot);
            scene.tweens.add({
                targets: dot,
                scaleX: 1.4,
                scaleY: 1.4,
                alpha: 0.3,
                duration: 600,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.inOut',
            });
            return { item, dot, oiled: false };
        });

        // Pote de aceite (envuelto en container con setSize, como el resto)
        const oilScale = 0.4;
        let oilTexW = 120, oilTexH = 120;
        if (scene.textures.exists('item-aceite')) {
            const src = scene.textures.get('item-aceite').getSourceImage();
            oilTexW = Math.round(src.width * oilScale);
            oilTexH = Math.round(src.height * oilScale);
        }
        const oilCanWrapper = scene.add.container(CX + 480, 300)
            .setSize(oilTexW, oilTexH).setScrollFactor(0).setDepth(310).setScale(0);
        const oilCanImg = scene.add.image(0, 0, 'item-aceite')
            .setOrigin(0.5).setScale(oilScale);
        oilCanWrapper.add(oilCanImg);
        root.add(oilCanWrapper);

        scene.tweens.add({
            targets: oilCanWrapper,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut',
        });

        scene.time.delayedCall(600, () => {
            if (!oilCanWrapper.destroyed) {
                oilCanWrapper.setInteractive({ useHandCursor: true });
                scene.input.setDraggable(oilCanWrapper);
            }
        });

        const onOilDragStart = (pointer, gameObject) => {
            if (gameObject !== oilCanWrapper) return;
            scene.children.bringToTop(root);
            root.bringToTop(gameObject);
        };

        const onOilDrag = (pointer, gameObject, dragX, dragY) => {
            if (gameObject !== oilCanWrapper) return;
            gameObject.x = dragX;
            gameObject.y = dragY;
        };

        const onOilDragEnd = (pointer, gameObject) => {
            if (gameObject !== oilCanWrapper) return;

            const hitPoint = oilPoints.find(p => {
                if (p.oiled) return false;
                const dist = Phaser.Math.Distance.Between(gameObject.x, gameObject.y, p.item.targetX, p.item.targetY);
                return dist <= 55;
            });
            if (!hitPoint) {
                scene.tweens.add({
                    targets: gameObject,
                    x: CX + 480,
                    y: 300,
                    duration: 250,
                    ease: 'Back.easeOut',
                });
                return;
            }

            // Aceite aplicado
            hitPoint.oiled = true;
            oiledCount += 1;

            scene.tweens.killTweensOf(hitPoint.dot);
            hitPoint.dot.setFillStyle(0x44ff44, 0.9);
            hitPoint.dot.setScale(1.2);
            scene.tweens.add({
                targets: hitPoint.dot,
                scaleX: 0,
                scaleY: 0,
                alpha: 0,
                duration: 350,
                ease: 'Quad.easeIn',
            });

            playUiSound(scene, 'water-drop', 0.55);
            scene.tweens.add({
                targets: gameObject,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100,
                yoyo: true,
                onComplete: () => { if (!gameObject.destroyed) gameObject.setScale(1); },
            });

            if (oiledCount >= 3) {
                instruc.setText('¡Convertidor lubricado!');
                scene.tweens.add({
                    targets: gameObject,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => gameObject.destroy(),
                });
                oilListeners.forEach(fn => fn());

                playUiSound(scene, 'success-bell', 0.85);
                scene.time.delayedCall(1500, resolveDone);
            }
        };

        scene.input.on('dragstart', onOilDragStart);
        scene.input.on('drag', onOilDrag);
        scene.input.on('dragend', onOilDragEnd);
        oilListeners = [
            () => scene.input.off('dragstart', onOilDragStart),
            () => scene.input.off('drag', onOilDrag),
            () => scene.input.off('dragend', onOilDragEnd),
        ];
    }

    if (CALIBRATION_MODE) {
        overlay.setInteractive();
        overlay.on('pointerdown', () => resolveDone());
    }

    await donePromise;

    scene.input.off('dragstart', onDragStart);
    scene.input.off('drag', onDrag);
    scene.input.off('dragend', onDragEnd);
    oilListeners.forEach(fn => fn());
    overlay.destroy();

    this.minigames.set(id, options[0] ?? 'respuesta1');
    restoreMinigameUi(this, prevTopOnly, root, pauseWasInteractive);
}