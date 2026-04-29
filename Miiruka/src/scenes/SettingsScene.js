import { UIHelpers } from '../utils/ui.js';
import { GameStorage } from '../utils/storage.js';
import { AudioManager } from '../utils/audio.js';
import { addFullScreenImage } from '../utils/backgrounds.js';

export class SettingsScene extends Phaser.Scene {
    constructor() {
        super('Configuracion');
    }

    preload() {
        this.load.audio('pop', 'assets/sounds/pop.mp3');
        this.load.audio('gametheme', 'assets/sounds/gametheme.mp3');
        this.load.image('gradient', 'assets/background_gradient.png');
        this.load.image('gears', 'assets/background_gears.svg');
        this.load.svg('music-icon', 'assets/ui/music-note.svg');
    }

    create() {
        UIHelpers.setGameCursor(this);
        this.popSound = this.sound.add('pop', { volume: 0.8 });
        addFullScreenImage(this, 'gradient');
        this.gears = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'gears')
            .setOrigin(0, 0);

        const titleStyle = {
            fontFamily: 'fredoka',
            fill: '#FCE1B4',
        };
        this.add.text(960, 120, UIHelpers.getText('settings'), {
            ...titleStyle,
            fontSize: '96px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(960, 340, UIHelpers.getText('music'), {
            fontFamily: 'fredoka',
            fontSize: '48px',
            color: '#FCE1B4'
        }).setOrigin(0.5);

        this.createMusicToggle(960, 460);

        this.add.text(960, 600, UIHelpers.getText('language'), {
            fontFamily: 'fredoka',
            fontSize: '48px',
            color: '#FCE1B4'
        }).setOrigin(0.5);

        this.createLanguageToggle(960, 700);
        this.createBackButton(960, 900, UIHelpers.getText('back_to_menu'));
    }

    createMusicToggle(x, y) {
        const container = this.add.container(x, y);
        const size = 100;
        const bg = this.add.graphics();
        bg.fillStyle(0x8b4c1d, 1);
        bg.fillRoundedRect(-size / 2, -size / 2, size, size, 14);
        const inner = this.add.graphics();
        inner.fillStyle(0xf0c18a, 1);
        inner.fillRoundedRect(-size / 2 + 6, -size / 2 + 6, size - 12, size - 12, 12);

        const icon = this.add.image(0, 0, 'music-icon').setOrigin(0.5);
        icon.setScale(0.4);
        icon.setTint(0x6a3a1b);

        const muteLine = this.add.graphics();
        muteLine.lineStyle(6, 0xc0392b, 1);
        muteLine.lineBetween(-32, 32, 32, -32);

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

    createBackButton(x, y, label) {
        const text = this.add.text(0, 0, label, {
            fontSize: '52px',
            fill: '#6a3a1b',
            fontFamily: 'fredoka',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        const paddingX = 70;
        const paddingY = 16;
        const width = text.width + paddingX * 2;
        const height = text.height + paddingY * 2;

        const border = this.add.graphics();
        border.fillStyle(0x8b4c1d);
        border.fillRoundedRect(-width / 2, -height / 2, width + 10, height + 10, 16);
        const body = this.add.graphics();
        body.fillStyle(0xf0c18a);
        body.fillRoundedRect(-width / 2, -height / 2, width, height, 16);

        body.setAbove(border);
        text.setAbove(body);

        const button = this.add.container(x, y, [border, body, text]);
        button.setSize(width, height);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => {
            this.sound.play('pop', { volume: 0.8 });
            this.scene.start('Inicio');
        });
        button.on('pointerover', () => {
            button.setScale(1.05);
        });
        button.on('pointerout', () => {
            button.setScale(1);
        });
        UIHelpers.attachHoverPop(this, button, 0.35);
        return button;
    }

    createLanguageToggle(x, y) {
        const container = this.add.container(x, y);
        const width = 520;
        const height = 84;
        const radius = 18;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        bg.fillStyle(0xefe5f0, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

        const activePill = this.add.graphics();

        const leftText = this.add.text(-width / 4, 0, 'Español', {
            fontFamily: 'fredoka',
            fontSize: '26px',
            color: '#6a5c6f',
        }).setOrigin(0.5);
        const rightText = this.add.text(width / 4, 0, 'Wayuu', {
            fontFamily: 'fredoka',
            fontSize: '26px',
            color: '#6a5c6f',
        }).setOrigin(0.5);

        const hitLeft = this.add.rectangle(-width / 4, 0, width / 2, height, 0xffffff, 0.001);
        const hitRight = this.add.rectangle(width / 4, 0, width / 2, height, 0xffffff, 0.001);
        hitLeft.setInteractive({ useHandCursor: true });
        hitRight.setInteractive({ useHandCursor: true });
        UIHelpers.attachHoverPop(this, hitLeft, 0.35);
        UIHelpers.attachHoverPop(this, hitRight, 0.35);

        const render = (lang) => {
            activePill.clear();
            activePill.fillStyle(0x63a711, 1);
            if (lang === 'wayuunaiki') {
                activePill.fillRoundedRect(0, -height / 2 + 6, width / 2, height - 12, radius);
            } else {
                activePill.fillRoundedRect(-width / 2, -height / 2 + 6, width / 2, height - 12, radius);
            }
            leftText.setColor(lang === 'es' ? '#ffffff' : '#6a5c6f');
            rightText.setColor(lang === 'wayuunaiki' ? '#ffffff' : '#6a5c6f');
        };

        const current = GameStorage.getLanguage() || 'es';
        render(current);

        hitLeft.on('pointerdown', () => {
            GameStorage.setLanguage('es');
            render('es');
        });
        hitRight.on('pointerdown', () => {
            GameStorage.setLanguage('wayuunaiki');
            render('wayuunaiki');
        });

        container.add([shadow, bg, activePill, leftText, rightText, hitLeft, hitRight]);
        container.setSize(width, height);
        return container;
    }

    update() {
        this.gears.tilePositionY += 0.3;
        this.gears.tilePositionX += 0.1;
    }
}
