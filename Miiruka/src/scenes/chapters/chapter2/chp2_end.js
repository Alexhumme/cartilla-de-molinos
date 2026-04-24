import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';

export class Chp2_end extends Phaser.Scene {
    constructor() {
        super('Chp2_end');
    }

    preload() {
        // UI y fondos estilo pantalla de inicio.
        this.load.audio('pop', 'assets/sounds/pop.mp3');
        this.load.audio('chapter-completed', 'assets/sounds/chapter-completed.mp3');
        this.load.image('gradient', 'assets/background_gradient.png');
        this.load.image('gears', 'assets/background_gears.svg');
        this.load.image('cap2f', 'assets/chapters/cap2f.png');
    }

    // Botón estilo StartScene.
    createButton(x, y, label, callback) {
        const paddingX = 50;
        const paddingY = 10;

        const text = this.add.text(0, 0, label, {
            fontSize: '64px',
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

        const button = this.add.container(x, y, [
            border,
            body,
            text
        ]);

        button.setSize(width, height);
        button.setInteractive({ useHandCursor: true });

        button.on('pointerdown', () => {
            this.popSound.play();
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

    create() {
        UIHelpers.setGameCursor(this);
        GameStorage.commitChapterSession(1);
        // Transición de entrada.
        this.cameras.main.fadeIn(600, 0, 0, 0);
        this.popSound = this.sound.add('pop', { volume: 0.5 });
        this.chapterCompletedSound = this.sound.add('chapter-completed', { volume: 0.75 });
        this.chapterCompletedSound.play();

        // Fondo con engranes en movimiento.
        this.add.image(960, 540, 'gradient');
        this.gears = this.add.tileSprite(
            0, 0,
            this.scale.width,
            this.scale.height, 'gears'
        ).setOrigin(0, 0);

        // Mensajes principales.
        this.add.text(960, 120, '¡Capítulo completado!', {
            fontFamily: 'fredoka',
            fontSize: '96px',
            color: '#FCE1B4',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(960, 240, '¡Felicitaciones por arreglar el molino!', {
            fontFamily: 'fredoka',
            fontSize: '48px',
            color: '#FCE1B4'
        }).setOrigin(0.5);

        // Imagen de capítulo completado.
        this.add.image(960, 560, 'cap2f').setOrigin(0.5).setScale(0.8);

        // Botón para volver a la selección de capítulos.
        this.createButton(960, 920, 'Volver a capítulos', () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('Capitulos', {
                    gearsOffsetX: this.gears.tilePositionX,
                    gearsOffsetY: this.gears.tilePositionY,
                });
            });
        });
    }

    update() {
        // Animación de engranes.
        this.gears.tilePositionY += 0.3;
        this.gears.tilePositionX += 0.1;
    }
}
