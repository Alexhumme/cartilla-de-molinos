import { GameStorage } from '../utils/storage.js'
import { AudioManager } from '../utils/audio.js';
import { UIHelpers } from '../utils/ui.js';

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
        const canvasRect = this.game.canvas.getBoundingClientRect();
        const inputX = canvasRect.left + canvasRect.width * 0.5;
        const inputY = canvasRect.top + canvasRect.height * 0.82;

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

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = UIHelpers.getText('name_placeholder');
        input.style.position = 'absolute';
        input.style.left = `${inputX}px`;
        input.style.top = `${inputY}px`;
        input.style.transform = 'translate(-50%, -50%)';
        input.style.fontSize = '20px';
        input.style.padding = '12px 16px';
        input.style.borderRadius = '12px';
        input.style.border = '3px solid #8b4c1d';
        input.style.background = '#f0c18a';
        input.style.color = '#6a3a1b';
        input.style.outline = 'none';
        input.maxLength = 15;
        input.style.textAlign = 'center';

        document.body.appendChild(input);

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
            const name = input.value.trim();

            if (name.length > 0) {
                GameStorage.startNewGame(name);
                input.remove();
                promptText.destroy();
                confirmBtn.destroy();
                if (this.nameInputResizeHandler) {
                    this.scale.off('resize', this.nameInputResizeHandler);
                    this.nameInputResizeHandler = null;
                }
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

        this.nameInputResizeHandler = () => {
            const rect = this.game.canvas.getBoundingClientRect();
            input.style.left = `${rect.left + rect.width * 0.5}px`;
            input.style.top = `${rect.top + rect.height * 0.82}px`;
        };
        this.scale.on('resize', this.nameInputResizeHandler);
    }

    create() {
        UIHelpers.setGameCursor(this);
        this.popSound = this.sound.add('pop', { volume: 0.8 });
        this.add.image(960, 540, 'gradient');
        this.gears = this.add.tileSprite(
            0, 0,
            this.scale.width,
            this.scale.height, 'gears'
        ).setOrigin(0, 0);
        this.add.image(960, 650, 'illustration').setOrigin(0.5);

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
}
