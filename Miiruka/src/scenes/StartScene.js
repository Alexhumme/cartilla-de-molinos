import { GameStorage } from '../utils/storage.js'
import { AudioManager } from '../utils/audio.js';
import { UIHelpers } from '../utils/ui.js';
import { addFullScreenImage } from '../utils/backgrounds.js';

export class StartScene extends Phaser.Scene {
    constructor() {
        super("Inicio")
    }
    preload() {
        // UI
        this.load.audio('pop', 'assets/sounds/pop.mp3')
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a')
        this.load.audio('gametheme', 'assets/sounds/gametheme.mp3');
        this.load.image('gradient', 'assets/background_gradient.png');
        this.load.image('gears', 'assets/background_gears.svg');
        this.load.image('illustration', 'assets/background_start_illustration.png');

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
    }

    update() {
        this.gears.tilePositionY += 0.3;
        this.gears.tilePositionX += 0.1;
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
}
