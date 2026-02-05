import { GameStorage } from '../utils/storage.js'

export class StartScene extends Phaser.Scene {
    constructor() {
        super("Inicio")
    }
    preload() {
        // UI
        this.load.audio('pop', 'assets/sounds/pop.mp3')
        this.load.image('gradient', 'assets/background_gradient.png');
        this.load.image('gears', 'assets/background_gears.svg');
        this.load.image('illustration', 'assets/background_start_illustration.png');
        this.load.image('delete', 'assets/delete.png');

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

        return button;
    }

    showGreeting() {
        this.createButton(900, 880, 'Entrar', () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);

            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('Capitulos', {
                    gearsOffsetX: this.gears.tilePositionX,
                    gearsOffsetY: this.gears.tilePositionY,
                })
            })

        });

        const greeting = this.add.text(
            1770, 75,
            'Hola, ' + GameStorage.getName(),
            {
                fontSize: '46px',
                fontFamily: 'fredoka',
                fill: '#FCE1B4'
            }
        );

        greeting.x = greeting.x - greeting.width - 50

        this.createClearDataButton()
    }

    createClearDataButton() {
        const clearBtn = this.add.image(1790, 100, 'delete')
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        clearBtn.on('pointerdown', () => {
            this.showConfirmDialog();
        });
    }

    showConfirmDialog() {
        const bg = this.add.rectangle(960, 540, 600, 300, 0x000000, 0.7);

        const txt = this.add.text(960, 500,
            '¿Seguro que quieres borrar tus datos?',
            {
                fontFamily: 'fredoka',
                fontSize: '32px',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: 500 }
            }
        ).setOrigin(0.5);

        const yesBtn = this.add.text(860, 620, 'Sí', {
            fontSize: '32px',
            backgroundColor: '#c0392b',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive();

        const noBtn = this.add.text(1060, 620, 'No', {
            fontSize: '32px',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive();

        yesBtn.on('pointerdown', () => {
            GameStorage.clear();
            this.scene.restart();
        });

        noBtn.on('pointerdown', () => {
            bg.destroy();
            txt.destroy();
            yesBtn.destroy();
            noBtn.destroy();
        });
    }

    askForName() {
        this.add.text(
            960, 800,
            'Como te llamas?',
            {
                fontSize: '46px',
                fontFamily: 'fredoka',
                fill: '#521461',
                fontStyle: '800'
            }
        ).setOrigin(0.5);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Escribe tu nombre';
        input.style.position = 'absolute';
        input.style.top = '84%';
        input.style.left = '50%';
        input.style.transform = 'translate(-50%, -50%)';
        input.style.fontSize = '16px';
        input.style.padding = '10px';
        input.style.borderRadius = '8px';
        input.style.borderColor = 'transparent'
        input.maxLength = 15;
        input.style.textAlign = 'center';


        document.body.appendChild(input);

        const confirmBtn = this.add.text(960, 1020, 'Continuar', {
            fontFamily: 'fredoka',
            fontSize: '48px',
            backgroundColor: '#63a711',
            padding: { x: 30, y: 15 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        confirmBtn.on('pointerdown', () => {
            const name = input.value.trim();

            if (name.length > 0) {
                GameStorage.setName(name);
                input.remove();
                this.scene.restart();
            }
        });
    }

    create() {
        this.popSound = this.sound.add('pop', { volume: 0.5 });
        this.add.image(960, 540, 'gradient');
        this.gears = this.add.tileSprite(
            0, 0,
            this.scale.width,
            this.scale.height, 'gears'
        ).setOrigin(0, 0);
        this.add.image(960, 650, 'illustration').setOrigin(0.5);

        const titleStyle = {
            fontFamily: 'fredoka',
            fill: '#FCE1B4',
        }

        this.add.text(66, 154, 'Miiruku',
            { ...titleStyle, fontStyle: 'bold', fontSize: '300px', }).setOrigin(0, 0);
        this.add.text(82, 464, 'Aprende jugando sobre el cuidado de los molinos',
            { ...titleStyle, fontSize: '64px', wordWrap: { width: 831 } }).setOrigin(0, 0);


        if (GameStorage.hasName()) {
            this.showGreeting();
        } else {
            this.askForName();
        }

    }

    update() {
        this.gears.tilePositionY += 0.3;
        this.gears.tilePositionX += 0.1;
    }
}