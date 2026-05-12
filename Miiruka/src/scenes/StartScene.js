import { GameStorage } from '../utils/storage.js'
import { AudioManager } from '../utils/audio.js';
import { UIHelpers } from '../utils/ui.js';
import { addFullScreenImage } from '../utils/backgrounds.js';
import { attachLoadingOverlay } from '../utils/loadingOverlay.js';

export class StartScene extends Phaser.Scene {
    constructor() {
        super("Inicio")
    }
    preload() {
        attachLoadingOverlay(this, 'Cargando...');

        // UI
        this.load.audio('pop', 'assets/sounds/pop.mp3')
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a')
        this.load.audio('gametheme', 'assets/sounds/gametheme.mp3');
        this.load.image('gradient', 'assets/background_gradient.png');
        this.load.image('gears', 'assets/background_gears.svg');
        this.load.image('illustration', 'assets/background_start_illustration.png');
        this.load.image('gamepad-cursor', 'assets/ui/cursor-arrow.png');
        this.load.image('gamepad-cursor-active', 'assets/ui/cursor-pointer.png');

        // Desierto
        this.load.image('sky', 'assets/desert/sky.png');
        this.load.image('bg_layer1', 'assets/desert/bg_layer1.png');
        this.load.image('bg_layer2', 'assets/desert/bg_layer2.png');
        this.load.image('bg_layer3', 'assets/desert/bg_layer3.png');
        this.load.image('bg_layer4', 'assets/desert/bg_layer4.png');

        this.load.image('sun1', 'assets/desert/sol1.png');
        this.load.image('sun2', 'assets/desert/sol2.png');
    }

    createButton(x, y, label, callback) {
        const paddingX = 50;
        const paddingY = 10;

        const text = this.add.text(0, 0, label,
            {
                fontSize: '96px',
                fill: '#FCE1B4',
                fontFamily: 'fredoka',
            }).setOrigin(0.5);

        const width = text.width + paddingX * 2;
        const height = text.height + paddingY * 2;

        const border = this.add.graphics();
        border.fillStyle(0xfce1b4);
        border.fillRoundedRect(0 - width / 2, 0 - height / 2, width + 10, height + 10, 16);
        const body = this.add.graphics();
        body.fillStyle(0x63a711);
        body.fillRoundedRect(0 - width / 2, 0 - height / 2, width, height, 16);

        body.setAbove(border);
        text.setAbove(body);

        // Contenedor
        const button = this.add.container(x, y, [
            border,
            body,
            text
        ]);

        button.setSize(width, height);
        button.setInteractive({ useHandCursor: true });

        button.on('pointerdown', () => {
            this.sound.play('pop', { volume: 0.8 });
            callback();
        });

        button.on('pointerover', () => {
            button.setScale(1.05);
        });

        button.on('pointerout', () => {
            button.setScale(1);
        });

        button.on('pointerdown', () => {
            button.setScale(0.95);
        });

        button.on('pointerup', () => {
            button.setScale(1.05);
        });

        UIHelpers.attachHoverPop(this, button, 0.35);
        return button;
    }

    askForName(onComplete) {
        if (this.namePromptActive) return;
        this.namePromptActive = true;

        const promptText = this.add.text(
            960, 800,
            UIHelpers.getText('whats_name'),
            {
                fontSize: '46px',
                fontFamily: 'fredoka',
                fill: '#521461',
                fontStyle: '800'
            }
        ).setOrigin(0.5);

        const inputContainer = this.add.container(960, 885);
        const inputBorder = this.add.graphics();
        const inputBody = this.add.graphics();
        const inputCaret = this.add.text(0, 0, '|', {
            fontFamily: 'fredoka',
            fontSize: '36px',
            color: '#6a3a1b',
        }).setOrigin(0.5);
        const inputText = this.add.text(0, 0, UIHelpers.getText('name_placeholder'), {
            fontFamily: 'fredoka',
            fontSize: '34px',
            color: '#8f6f4f',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        const inputW = 680;
        const inputH = 88;
        let focused = false;
        let currentName = '';

        const drawInput = () => {
            inputBorder.clear();
            inputBody.clear();
            inputBorder.fillStyle(focused ? 0x6a3a1b : 0x8b4c1d);
            inputBorder.fillRoundedRect(-inputW / 2, -inputH / 2, inputW + 10, inputH + 10, 14);
            inputBody.fillStyle(0xf0c18a);
            inputBody.fillRoundedRect(-inputW / 2, -inputH / 2, inputW, inputH, 14);
            const showPlaceholder = currentName.length === 0;
            inputText.setText(showPlaceholder ? UIHelpers.getText('name_placeholder') : currentName);
            inputText.setColor(showPlaceholder ? '#8f6f4f' : '#6a3a1b');
            inputCaret.setVisible(focused);
            const textRight = Math.min((inputText.width / 2) + 18, inputW / 2 - 26);
            inputCaret.setX(showPlaceholder ? 0 : textRight);
        };

        inputContainer.add([inputBorder, inputBody, inputText, inputCaret]);
        inputContainer.setSize(inputW, inputH);
        inputContainer.setInteractive({ useHandCursor: true });
        drawInput();

        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'text';
        hiddenInput.maxLength = 15;
        hiddenInput.autocomplete = 'off';
        hiddenInput.autocorrect = 'off';
        hiddenInput.autocapitalize = 'words';
        hiddenInput.spellcheck = false;
        hiddenInput.style.position = 'absolute';
        hiddenInput.style.left = '8px';
        hiddenInput.style.top = '8px';
        hiddenInput.style.width = '1px';
        hiddenInput.style.height = '1px';
        hiddenInput.style.border = '0';
        hiddenInput.style.padding = '0';
        hiddenInput.style.margin = '0';
        hiddenInput.style.pointerEvents = 'none';
        hiddenInput.style.opacity = '0';
        const inputHost = this.game.canvas?.parentElement || document.body;
        const hostStyle = window.getComputedStyle(inputHost);
        if (hostStyle.position === 'static') {
            inputHost.style.position = 'relative';
        }
        inputHost.appendChild(hiddenInput);

        const syncName = () => {
            currentName = hiddenInput.value.slice(0, 15);
            drawInput();
        };

        hiddenInput.addEventListener('input', syncName);
        inputContainer.on('pointerdown', () => {
            focused = true;
            drawInput();
            hiddenInput.focus();
        });
        this.input.on('pointerdown', (pointer) => {
            if (pointer.event?.target === this.game.canvas) return;
            if (!inputContainer.getBounds().contains(pointer.x, pointer.y)) {
                focused = false;
                drawInput();
            }
        });

        const btnLabel = this.add.text(0, 0, UIHelpers.getText('continue'), {
            fontFamily: 'fredoka',
            fontSize: '42px',
            fill: '#6a3a1b',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        const paddingX = 50;
        const paddingY = 14;
        const width = btnLabel.width + paddingX * 2;
        const height = btnLabel.height + paddingY * 2;
        const border = this.add.graphics();
        border.fillStyle(0x8b4c1d);
        border.fillRoundedRect(-width / 2, -height / 2, width + 8, height + 8, 14);
        const body = this.add.graphics();
        body.fillStyle(0xf0c18a);
        body.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
        body.setAbove(border);
        btnLabel.setAbove(body);

        const confirmBtn = this.add.container(960, 980, [border, body, btnLabel]);
        confirmBtn.setSize(width, height);
        confirmBtn.setInteractive({ useHandCursor: true });

        confirmBtn.on('pointerdown', () => {
            const name = currentName.trim();

            if (name.length > 0) {
                GameStorage.startNewGame(name);
                hiddenInput.removeEventListener('input', syncName);
                hiddenInput.remove();
                promptText.destroy();
                inputContainer.destroy();
                confirmBtn.destroy();
                this.namePromptActive = false;
                if (onComplete) onComplete();
            }
        });

        confirmBtn.on('pointerover', () => {
            confirmBtn.setScale(1.05);
        });
        confirmBtn.on('pointerout', () => {
            confirmBtn.setScale(1);
        });
        UIHelpers.attachHoverPop(this, confirmBtn, 0.35);
        this.tweens.add({
            targets: inputCaret,
            alpha: 0.2,
            yoyo: true,
            repeat: -1,
            duration: 450,
            ease: 'Sine.inOut',
        });
    }

    create() {
        UIHelpers.setGameCursor(this);
        
        // Ensure Phaser gamepad plugin is active
        if (!this.input.gamepad) {
            this.input.gamepad = this.input.manager.gamepad;
        }
        
        this.disableGamepadMode = (pointer) => {
            const event = pointer?.event;
            if (event?.pointerType && event.pointerType !== 'mouse') return;
            this.setGamepadModeActive(false);
        };
        this.input.on('pointermove', this.disableGamepadMode);
        this.input.on('pointerdown', this.disableGamepadMode);
        this.events.once('shutdown', () => {
            if (this.disableGamepadMode) {
                this.input.off('pointermove', this.disableGamepadMode);
                this.input.off('pointerdown', this.disableGamepadMode);
                this.disableGamepadMode = null;
            }
            this.setMouseCursorHiddenByGamepad(false);
        });
        this.popSound = this.sound.add('pop', { volume: 0.8 });
        addFullScreenImage(this, 'gradient');
        this.gears = this.add.tileSprite(
            0, 0,
            this.scale.width,
            this.scale.height, 'gears'
        ).setOrigin(0, 0);
        this.add.image(960, 650, 'illustration').setOrigin(0.5).setDisplaySize(1920, 873);

        AudioManager.ensureLoopingMusic(this, 'gametheme', 0.7);
        this.sound.once('unlocked', () => {
            AudioManager.ensureLoopingMusic(this, 'gametheme', 0.7);
        });
        this.input.once('pointerdown', () => {
            AudioManager.ensureLoopingMusic(this, 'gametheme', 0.7);
        });

        const titleStyle = {
            fontFamily: 'fredoka',
            fill: '#FCE1B4',
        }

        this.add.text(66, 154, 'Miiruku',
            { ...titleStyle, fontStyle: 'bold', fontSize: '300px', }).setOrigin(0, 0);
        this.add.text(82, 464, 'Aprende jugando sobre el cuidado de los molinos',
            { ...titleStyle, fontSize: '64px', wordWrap: { width: 831 } }).setOrigin(0, 0);

        const menuBaseX = 960;
        const buttonGap = 110;
        const buttonCount = 4;
        const menuBaseY = 840 - (buttonGap * (buttonCount - 1)) / 2;

        const hasSave = GameStorage.hasSave();

        this.menuButtons = [];

        const continueBtn = this.createMenuButton(menuBaseX, menuBaseY, UIHelpers.getText('continue'), () => {
            this.startChapterSelection();
        }, !hasSave);

        const newGameBtn = this.createMenuButton(menuBaseX, menuBaseY + buttonGap, UIHelpers.getText('new_game'), () => {
            GameStorage.clear();
            this.hideMenuButtons();
            this.askForName(() => {
                this.startChapterSelection();
            });
        });

        const settingsBtn = this.createMenuButton(menuBaseX, menuBaseY + buttonGap * 2, UIHelpers.getText('settings'), () => {
            this.scene.start('Configuracion', {
                gearsOffsetX: this.gears.tilePositionX,
                gearsOffsetY: this.gears.tilePositionY,
            });
        });

        const infoBtn = this.createMenuButton(menuBaseX, menuBaseY + buttonGap * 3, UIHelpers.getText('info'), () => {
            this.scene.start('Informacion', {
                gearsOffsetX: this.gears.tilePositionX,
                gearsOffsetY: this.gears.tilePositionY,
            });
        });

        this.menuButtons.push(newGameBtn, continueBtn, settingsBtn, infoBtn);
        this.menuButtons.forEach((btn) => btn.setDepth(5));

        const name = GameStorage.getName();
        if (name) {
            const greeting = this.add.text(1770, 75, `${UIHelpers.getText('hello')}, ${name}`, {
                fontSize: '46px',
                fontFamily: 'fredoka',
                fill: '#FCE1B4'
            });
            greeting.x = greeting.x - greeting.width - 50;
        }

        this.createFullscreenButton(1648, 980);
        this.createMusicToggle(1760, 980);
        this.createGamepadIndicator(96, 984);
        this.createGamepadCursor();
        //this.createGamepadDebugPanel();
    }

    update(time, delta) {
        this.gears.tilePositionY += 0.3;
        this.gears.tilePositionX += 0.1;
        this.updateGamepadCursor(delta);
        this.updateGamepadDebugPanel();
    }

    startChapterSelection() {
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('Capitulos', {
                gearsOffsetX: this.gears.tilePositionX,
                gearsOffsetY: this.gears.tilePositionY,
            });
        });
    }

    hideMenuButtons() {
        if (!this.menuButtons) return;
        this.menuButtons.forEach((btn) => {
            btn.setVisible(false);
            if (btn.disableInteractive) btn.disableInteractive();
        });
    }

    createMenuButton(x, y, label, onClick, disabled = false) {
        const paddingX = 42;
        const paddingY = 12;
        const text = this.add.text(0, 0, label, {
            fontSize: '40px',
            fill: disabled ? '#c3a27c' : '#6a3a1b',
            fontFamily: 'fredoka',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const width = text.width + paddingX * 2;
        const height = text.height + paddingY * 2;

        const border = this.add.graphics();
        border.fillStyle(disabled ? 0x9b7a58 : 0x8b4c1d);
        border.fillRoundedRect(-width / 2, -height / 2, width + 10, height + 10, 16);
        const body = this.add.graphics();
        body.fillStyle(disabled ? 0xe0c4a5 : 0xf0c18a);
        body.fillRoundedRect(-width / 2, -height / 2, width, height, 16);

        body.setAbove(border);
        text.setAbove(body);

        const button = this.add.container(x, y, [border, body, text]);
        button.setSize(width, height);

        if (!disabled) {
            button.setInteractive({ useHandCursor: true });
            button.on('pointerdown', () => {
                this.sound.play('pop', { volume: 0.8 });
                onClick();
            });
            button.on('pointerover', () => {
                button.setScale(1.05);
            });
            button.on('pointerout', () => {
                button.setScale(1);
            });
            button.on('pointerdown', () => {
                button.setScale(0.96);
            });
            button.on('pointerup', () => {
                button.setScale(1.05);
            });
            UIHelpers.attachHoverPop(this, button, 0.35);
        } else {
            button.setAlpha(0.7);
        }

        return button;
    }

    createMusicToggle(x, y) {
        const container = this.add.container(x, y);
        const size = 86;
        const bg = this.add.graphics();
        bg.fillStyle(0x8b4c1d, 1);
        bg.fillRoundedRect(-size / 2, -size / 2, size, size, 14);
        const inner = this.add.graphics();
        inner.fillStyle(0xf0c18a, 1);
        inner.fillRoundedRect(-size / 2 + 6, -size / 2 + 6, size - 12, size - 12, 12);

        const icon = this.add.graphics();
        icon.lineStyle(5, 0x6a3a1b, 1);
        icon.beginPath();
        icon.moveTo(-8, 20);
        icon.lineTo(-8, -16);
        icon.lineTo(14, -22);
        icon.lineTo(14, 12);
        icon.strokePath();
        icon.fillStyle(0x6a3a1b, 1);
        icon.fillCircle(-8, 22, 7);
        icon.fillCircle(14, 14, 7);

        const muteLine = this.add.graphics();
        muteLine.lineStyle(5, 0xb25a48, 1);
        muteLine.lineBetween(-22, 22, 22, -22);

        container.add([bg, inner, icon, muteLine]);
        container.setSize(size, size);
        container.setInteractive({ useHandCursor: true });

        const render = () => {
            const enabled = GameStorage.getMusicEnabled();
            muteLine.setVisible(!enabled);
        };
        render();

        container.on('pointerdown', () => {
            const next = !GameStorage.getMusicEnabled();
            if (next && GameStorage.getMusicVolume() <= 0) {
                GameStorage.setMusicVolume(0.7);
            }
            AudioManager.setMusicEnabled(this, 'gametheme', next, 0.7);
            render();
        });
        container.on('pointerover', () => {
            container.setScale(1.06);
        });
        container.on('pointerout', () => {
            container.setScale(1);
        });
        UIHelpers.attachHoverPop(this, container, 0.35);

        return container;
    }

    createFullscreenButton(x, y) {
        const container = this.add.container(x, y);
        const size = 86;
        const bg = this.add.graphics();
        bg.fillStyle(0x8b4c1d, 1);
        bg.fillRoundedRect(-size / 2, -size / 2, size, size, 14);
        const inner = this.add.graphics();
        inner.fillStyle(0xf0c18a, 1);
        inner.fillRoundedRect(-size / 2 + 6, -size / 2 + 6, size - 12, size - 12, 12);

        const icon = this.add.graphics();
        const drawIcon = () => {
            icon.clear();
            icon.lineStyle(5, 0x6a3a1b, 1);
            const isFullscreen = !!document.fullscreenElement;
            if (isFullscreen) {
                icon.lineBetween(-24, -10, -10, -10);
                icon.lineBetween(-10, -24, -10, -10);
                icon.lineBetween(24, -10, 10, -10);
                icon.lineBetween(10, -24, 10, -10);
                icon.lineBetween(-24, 10, -10, 10);
                icon.lineBetween(-10, 24, -10, 10);
                icon.lineBetween(24, 10, 10, 10);
                icon.lineBetween(10, 24, 10, 10);
            } else {
                icon.lineBetween(-24, -24, -8, -24);
                icon.lineBetween(-24, -24, -24, -8);
                icon.lineBetween(24, -24, 8, -24);
                icon.lineBetween(24, -24, 24, -8);
                icon.lineBetween(-24, 24, -8, 24);
                icon.lineBetween(-24, 24, -24, 8);
                icon.lineBetween(24, 24, 8, 24);
                icon.lineBetween(24, 24, 24, 8);
            }
        };
        drawIcon();

        container.add([bg, inner, icon]);
        container.setSize(size, size);
        container.setInteractive({ useHandCursor: true });

        const lockLandscape = async () => {
            const orientation = globalThis.screen?.orientation;
            if (!orientation?.lock) return;
            try {
                await orientation.lock('landscape');
            } catch (error) {
                // Algunos navegadores solo permiten bloquear orientación en PWA/fullscreen.
            }
        };

        const enterFullscreen = async () => {
            const target = this.game.canvas?.parentElement || document.documentElement;
            if (target.requestFullscreen) {
                await target.requestFullscreen();
            } else if (target.webkitRequestFullscreen) {
                target.webkitRequestFullscreen();
            } else {
                this.scale.startFullscreen();
            }
            await lockLandscape();
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
            } else if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            }
        };

        container.on('pointerdown', async () => {
            this.sound.play('pop', { volume: 0.8 });
            try {
                if (document.fullscreenElement || this.scale.isFullscreen) {
                    await exitFullscreen();
                } else {
                    await enterFullscreen();
                }
            } finally {
                drawIcon();
            }
        });
        container.on('pointerover', () => {
            container.setScale(1.06);
        });
        container.on('pointerout', () => {
            container.setScale(1);
        });
        UIHelpers.attachHoverPop(this, container, 0.35);

        this.fullscreenChangeHandler = () => drawIcon();
        document.addEventListener('fullscreenchange', this.fullscreenChangeHandler);
        document.addEventListener('webkitfullscreenchange', this.fullscreenChangeHandler);
        this.events.once('shutdown', () => {
            if (this.fullscreenChangeHandler) {
                document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler);
                document.removeEventListener('webkitfullscreenchange', this.fullscreenChangeHandler);
                this.fullscreenChangeHandler = null;
            }
        });

        return container;
    }

    createGamepadIndicator(x, y) {
        const container = this.add.container(x, y);
        container.setDepth(20);
        container.setVisible(false);

        const halo = this.add.circle(0, 0, 58, 0xfce1b4, 0.18);
        halo.setStrokeStyle(4, 0xfce1b4, 0.45);

        const icon = this.add.graphics();
        icon.fillStyle(0xf0c18a, 1);
        icon.lineStyle(5, 0x8b4c1d, 1);
        icon.fillRoundedRect(-50, -26, 100, 56, 22);
        icon.strokeRoundedRect(-50, -26, 100, 56, 22);
        icon.fillStyle(0x6a3a1b, 1);
        icon.fillRoundedRect(-36, -3, 22, 8, 3);
        icon.fillRoundedRect(-29, -10, 8, 22, 3);
        icon.fillCircle(25, -10, 5);
        icon.fillCircle(37, 2, 5);
        icon.fillCircle(13, 2, 5);
        icon.fillCircle(25, 14, 5);

        container.add([halo, icon]);

        const refresh = () => {
            container.setVisible(this.hasConnectedGamepad());
        };

        this.gamepadStatusHandler = refresh;
        window.addEventListener('gamepadconnected', this.gamepadStatusHandler);
        window.addEventListener('gamepaddisconnected', this.gamepadStatusHandler);
        this.gamepadPollEvent = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: refresh,
        });

        this.tweens.add({
            targets: halo,
            alpha: 0.35,
            scaleX: 1.08,
            scaleY: 1.08,
            yoyo: true,
            repeat: -1,
            duration: 900,
            ease: 'Sine.inOut',
        });

        this.events.once('shutdown', () => {
            if (this.gamepadStatusHandler) {
                window.removeEventListener('gamepadconnected', this.gamepadStatusHandler);
                window.removeEventListener('gamepaddisconnected', this.gamepadStatusHandler);
                this.gamepadStatusHandler = null;
            }
            if (this.gamepadPollEvent) {
                this.gamepadPollEvent.remove(false);
                this.gamepadPollEvent = null;
            }
        });

        refresh();
        return container;
    }

    getConnectedGamepad() {
        return this.getConnectedGamepads()[0] || null;
    }

    getConnectedGamepads() {
        // Try Phaser gamepads first
        if (this.input.gamepad) {
            const phaserPads = this.input.gamepad.gamepads || [];
            const connected = phaserPads.filter((pad) => !!pad && pad.connected !== false);
            if (connected.length > 0) {
                return connected;
            }
        }
        
        // Fallback to navigator API
        const pads = navigator.getGamepads?.() || [];
        const nativePads = Array.from(pads).filter((pad) => !!pad && pad.connected !== false);
        return nativePads;
    }

    hasConnectedGamepad() {
        return !!this.getConnectedGamepad();
    }

    readGamepadAxis(pad, index) {
        // Try reading from the native gamepad inside the Phaser wrapper
        if (pad?.pad && pad.pad.axes) {
            const nativeAxis = pad.pad.axes[index];
            if (typeof nativeAxis === 'number') {
                return nativeAxis;
            }
        }
        
        // For Phaser wrapped gamepads, use the stick objects directly
        if (pad?.leftStick && pad?.rightStick) {
            if (index === 0) return pad.leftStick.x;
            if (index === 1) return pad.leftStick.y;
            if (index === 2) return pad.rightStick.x;
            if (index === 3) return pad.rightStick.y;
        }
        
        // For native gamepads, try the axes array
        const axis = pad?.axes?.[index];
        
        // If axis is undefined, return 0
        if (axis === undefined || axis === null) {
            return 0;
        }
        
        // If axis is a number, return it directly
        if (typeof axis === 'number') {
            return axis;
        }
        
        // If axis is an object with getValue method, call it
        if (typeof axis.getValue === 'function') {
            const value = axis.getValue();
            if (typeof value === 'number') {
                return value;
            }
        }
        
        // If axis has a value property
        if (typeof axis.value === 'number') {
            return axis.value;
        }
        
        // Fallback to pad.getAxisValue if available
        if (typeof pad?.getAxisValue === 'function') {
            const value = pad.getAxisValue(index);
            if (typeof value === 'number') {
                return value;
            }
        }
        
        return 0;
    }

    isGamepadButtonPressed(pad, index, alias) {
        const button = pad?.buttons?.[index];
        if (button?.pressed || button?.value > 0.5) return true;
        if (typeof button === 'number' && button > 0.5) return true;
        const aliasButton = pad?.[alias];
        if (aliasButton?.pressed || aliasButton?.value > 0.5) return true;
        if (aliasButton?.isDown) return true;
        return aliasButton === true;
    }

    sampleGamepadInput(pad) {
        const deadzone = 0.18;
        const normalizeAxis = (value) => {
            const raw = Math.abs(value) < deadzone ? 0 : Number(value) || 0;
            return Phaser.Math.Clamp(raw, -1, 1);
        };

        // Only check axes that actually exist on this gamepad
        const maxAxes = pad?.axes?.length || 0;
        const axisPairs = [
            [0, 1],  // Left stick - available on all gamepads
            [2, 3],  // Right stick - only if axesLength >= 4
            [6, 7],  // Some gamepads have additional axes
        ].filter(([x, y]) => x < maxAxes && y < maxAxes);

        let moveX = 0;
        let moveY = 0;
        let bestStrength = 0;
        axisPairs.forEach(([xIndex, yIndex]) => {
            const x = normalizeAxis(this.readGamepadAxis(pad, xIndex));
            const y = normalizeAxis(this.readGamepadAxis(pad, yIndex));
            const strength = Math.hypot(x, y);
            if (strength > bestStrength) {
                bestStrength = strength;
                moveX = x;
                moveY = y;
            }
        });

        // D-pad detection: try standard mapping (buttons 12-15) first
        let dpadX = (this.isGamepadButtonPressed(pad, 15, 'right') ? 1 : 0)
            - (this.isGamepadButtonPressed(pad, 14, 'left') ? 1 : 0);
        let dpadY = (this.isGamepadButtonPressed(pad, 13, 'down') ? 1 : 0)
            - (this.isGamepadButtonPressed(pad, 12, 'up') ? 1 : 0);
        
        // For Pro Controller and some other gamepads: try axes 4 and 5 (D-pad as axes)
        if (dpadX === 0 && dpadY === 0 && maxAxes >= 6) {
            const padAxisX = this.readGamepadAxis(pad, 4);
            const padAxisY = this.readGamepadAxis(pad, 5);
            if (Math.abs(padAxisX) > deadzone) dpadX = padAxisX > 0 ? 1 : -1;
            if (Math.abs(padAxisY) > deadzone) dpadY = padAxisY > 0 ? 1 : -1;
        }
        
        if (dpadX !== 0 || dpadY !== 0) {
            moveX = dpadX;
            moveY = dpadY;
        }

        const anyButtonPressed = (pad?.buttons || []).some((button) => {
            if (typeof button === 'number') return button > 0.5;
            return !!(button?.pressed || button?.value > 0.5);
        });

        return {
            moveX,
            moveY,
            active: moveX !== 0 || moveY !== 0 || anyButtonPressed,
        };
    }

    getStrongestGamepadInput() {
        return this.getConnectedGamepads().reduce((best, pad) => {
            const sample = this.sampleGamepadInput(pad);
            const strength = Math.hypot(sample.moveX, sample.moveY);
            if (!best || strength > best.strength || (!best.active && sample.active)) {
                return { ...sample, strength };
            }
            return best;
        }, null);
    }

    setGamepadModeActive(active) {
        if (this.gamepadModeActive === active) return;
        this.gamepadModeActive = active;
        this.setMouseCursorHiddenByGamepad(active);
        if (this.gamepadCursor) {
            this.gamepadCursor.setVisible(active && this.hasConnectedGamepad());
            if (!active) this.gamepadCursor.setTexture('gamepad-cursor');
        }
    }

    setMouseCursorHiddenByGamepad(hidden) {
        if (this.mouseHiddenByGamepad === hidden) return;
        this.mouseHiddenByGamepad = hidden;
        if (hidden) {
            this.input.setDefaultCursor('none');
            if (this.game.canvas) this.game.canvas.style.cursor = 'none';
            return;
        }
        UIHelpers.setGameCursor(this);
        if (this.game.canvas) this.game.canvas.style.cursor = '';
    }

    createGamepadCursor() {
        const cursor = this.add.image(960, 540, 'gamepad-cursor').setOrigin(0, 0);
        cursor.setDepth(10000);
        cursor.setVisible(false);
        cursor.setScale(0.8);
        this.gamepadCursor = cursor;
        this.gamepadCursorSpeed = 820;
        return cursor;
    }

    createGamepadDebugPanel() {
        const panel = this.add.container(24, 24);
        panel.setDepth(10001);

        const bg = this.add.graphics();
        const text = this.add.text(16, 14, 'Gamepad debug: esperando control...', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
            lineSpacing: 4,
        });
        text.setOrigin(0, 0);

        panel.add([bg, text]);
        this.gamepadDebugPanel = panel;
        this.gamepadDebugBg = bg;
        this.gamepadDebugText = text;
        this.drawGamepadDebugBg();
    }

    drawGamepadDebugBg() {
        if (!this.gamepadDebugBg || !this.gamepadDebugText) return;
        const width = Math.max(520, this.gamepadDebugText.width + 32);
        const height = Math.max(90, this.gamepadDebugText.height + 28);
        this.gamepadDebugBg.clear();
        this.gamepadDebugBg.fillStyle(0x000000, 0.68);
        this.gamepadDebugBg.fillRoundedRect(0, 0, width, height, 12);
        this.gamepadDebugBg.lineStyle(2, 0xfce1b4, 0.85);
        this.gamepadDebugBg.strokeRoundedRect(0, 0, width, height, 12);
    }

    updateGamepadDebugPanel() {
        if (!this.gamepadDebugText) return;

        const pads = this.getConnectedGamepads();
        if (pads.length === 0) {
            const phaserGps = this.input.gamepad?.gamepads || [];
            const text = `Phaser gamepads: ${phaserGps.length}, awaiting control...`;
            this.gamepadDebugText.setText(text);
            this.drawGamepadDebugBg();
            return;
        }

        const pad = pads[0];
        
        // Log which source the pad comes from
        const phaserGps = this.input.gamepad?.gamepads || [];
        const fromPhaser = phaserGps.includes(pad);
        
        // Log detailed pad structure once
        if (!this.lastLoggedPadId || this.lastLoggedPadId !== pad.id) {
            this.lastLoggedPadId = pad.id;
            console.log('Gamepad source: ' + (fromPhaser ? 'PHASER' : 'NAVIGATOR'));
            console.log('Phaser gamepads count:', phaserGps.length);
            console.log('axes array:', pad.axes);
            console.log('axes[0]:', pad.axes?.[0], typeof pad.axes?.[0]);
            console.log('buttons[0]:', pad.buttons?.[0]);
        }
        
        // Try moving an axis and show raw values
        const rawAxes = [];
        for (let i = 0; i < 4; i++) {
            const axis = pad.axes?.[i];
            if (typeof axis === 'number') {
                rawAxes.push(`${i}:${axis.toFixed(2)}`);
            } else if (axis && typeof axis.getValue === 'function') {
                rawAxes.push(`${i}:${axis.getValue().toFixed(2)}`);
            }
        }
        
        const axes = Array.from({ length: Math.max(8, pad.axes?.length || 0) }, (_, index) => {
            const value = this.readGamepadAxis(pad, index);
            return `${index}:${value.toFixed(2)}`;
        });
        
        const pressedButtons = Array.from(pad.buttons || [])
            .map((button, index) => {
                const value = typeof button === 'number' ? button : button?.value || 0;
                const pressed = typeof button === 'number' ? value > 0.5 : !!button?.pressed || value > 0.5;
                return pressed ? `${index}:${value.toFixed(2)}` : null;
            })
            .filter(Boolean);
        
        const input = this.getStrongestGamepadInput();
        const lines = [
            'Gamepad debug temporal',
            `id: ${pad.id || 'sin id'} (${fromPhaser ? 'Phaser' : 'Navigator'})`,
            `axes: ${pad.axes?.length || 0} | buttons: ${pad.buttons?.length || 0}`,
            `raw axes (0-3): ${rawAxes.join('  ')}`,
            `axes (0-7): ${axes.join('  ')}`,
            `buttons: ${pressedButtons.length ? pressedButtons.join('  ') : 'ninguno'}`,
            `cursor: x=${(input?.moveX || 0).toFixed(2)} y=${(input?.moveY || 0).toFixed(2)} activo=${!!input?.active}`,
        ];

        this.gamepadDebugText.setText(lines.join('\n'));
        this.drawGamepadDebugBg();
    }

    updateGamepadCursor(delta = 16.67) {
        if (!this.gamepadCursor) return;

        const hasPad = this.hasConnectedGamepad();
        if (!hasPad) {
            this.setGamepadModeActive(false);
            return;
        }

        const input = this.getStrongestGamepadInput();
        let moveX = input?.moveX || 0;
        let moveY = input?.moveY || 0;

        const isActive = moveX !== 0 || moveY !== 0;
        this.gamepadCursor.setTexture(isActive ? 'gamepad-cursor-active' : 'gamepad-cursor');
        if (input?.active) this.setGamepadModeActive(true);
        this.gamepadCursor.setVisible(this.gamepadModeActive);

        if (moveX === 0 && moveY === 0) return;

        const length = Math.hypot(moveX, moveY);
        if (length > 1) {
            moveX /= length;
            moveY /= length;
        }

        const dt = Math.min(delta / 1000, 0.05);
        const margin = 28;
        this.gamepadCursor.x = Phaser.Math.Clamp(
            this.gamepadCursor.x + moveX * this.gamepadCursorSpeed * dt,
            margin,
            this.scale.width - margin
        );
        this.gamepadCursor.y = Phaser.Math.Clamp(
            this.gamepadCursor.y + moveY * this.gamepadCursorSpeed * dt,
            margin,
            this.scale.height - margin
        );
    }
}
