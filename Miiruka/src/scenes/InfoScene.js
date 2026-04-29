import { UIHelpers } from '../utils/ui.js';
import { addFullScreenImage } from '../utils/backgrounds.js';

export class InfoScene extends Phaser.Scene {
    constructor() {
        super('Informacion');
    }

    preload() {
        this.load.audio('pop', 'assets/sounds/pop.mp3');
        this.load.image('gradient', 'assets/background_gradient.png');
        this.load.image('gears', 'assets/background_gears.svg');
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
        this.add.text(960, 120, UIHelpers.getText('info'), {
            ...titleStyle,
            fontSize: '96px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const bodyStyle = {
            fontFamily: 'fredoka',
            fontSize: '36px',
            color: '#FCE1B4',
            align: 'center',
            wordWrap: { width: 1400 }
        };

        const infoText = [
            'Proyecto educativo sobre el cuidado del agua y los molinos.',
            'Créditos al SENA.',
            'Créditos a Sennova.',
            'Proyecto IAP Zona Caribe I.',
            'Derechos reservados.',
            'Créditos de desarrollo: Equipo del proyecto Miiruku.',
        ].join('\n\n');

        this.add.text(960, 420, infoText, bodyStyle).setOrigin(0.5);

        this.createBackButton(960, 900, UIHelpers.getText('back_to_menu'));
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

    update() {
        this.gears.tilePositionY += 0.3;
        this.gears.tilePositionX += 0.1;
    }
}
