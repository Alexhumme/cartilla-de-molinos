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

    const target = { x: 200, y: 460 };
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
    const handleHeight = handleTexture?.height ?? 202;
    const pivotX = 101;
    const pivotY = 101;
    const handle = scene.add.image(0, 0, 'grifo-manija')
        .setOrigin(pivotX / handleWidth, pivotY / handleHeight);
    handle.setDepth(2);

    const handleSize = Math.min(handleWidth, handleHeight);
    const radius = handleSize * 0.38;
    const startAngle = -Math.PI / 2;
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

    const root = scene.add.container(0, 0);
    this.recuadroContent.add(root);
    this.recuadroItems.push(root);

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
        itemRoot.setInteractive(new Phaser.Geom.Rectangle(-56, -56, 112, 112), Phaser.Geom.Rectangle.Contains);
        itemRoot.input.cursor = 'pointer';
        UIHelpers.attachHoverPop(scene, itemRoot, 0.3);

        root.add(itemRoot);
        return { pair, itemRoot, drawBg, solved: false, y };
    });

    const rightEntries = pairs.map((pair, index) => {
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
        itemRoot.setInteractive(new Phaser.Geom.Rectangle(-boxW / 2, -boxH / 2, boxW, boxH), Phaser.Geom.Rectangle.Contains);
        itemRoot.input.cursor = 'pointer';
        UIHelpers.attachHoverPop(scene, itemRoot, 0.3);
        root.add(itemRoot);
        return { pair, itemRoot, drawBg, solved: false, y };
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
        leftEntry.itemRoot.on('pointerover', () => {
            if (!leftEntry.solved && leftEntry !== activeLeft) leftEntry.drawBg(true, false);
            playUiSound(scene, 'pop', 0.22);
        });
        leftEntry.itemRoot.on('pointerout', () => {
            if (!leftEntry.solved && leftEntry !== activeLeft) leftEntry.drawBg(false, false);
        });
        leftEntry.itemRoot.on('pointerdown', () => {
            if (leftEntry.solved) return;
            activeLeft = leftEntry;
            resetLeftActiveVisuals();
            leftEntry.drawBg(true, false);
            playUiSound(scene, 'pop', 0.7);
        });
    });

    rightEntries.forEach((rightEntry) => {
        rightEntry.itemRoot.on('pointerover', () => {
            if (!rightEntry.solved) rightEntry.drawBg(true, false);
            playUiSound(scene, 'pop', 0.22);
        });
        rightEntry.itemRoot.on('pointerout', () => {
            if (!rightEntry.solved) rightEntry.drawBg(false, false);
        });
        rightEntry.itemRoot.on('pointerdown', () => {
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
    scene.input.setTopOnly(prevTopOnly);
}
