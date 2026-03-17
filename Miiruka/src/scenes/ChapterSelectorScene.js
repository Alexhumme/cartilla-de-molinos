import { toColorString } from '../utils/colors.js';

const ChapterState = {
    LOCKED: 'locked',
    AVAILABLE: 'available',
    COMPLETED: 'completed'
};

// "Every great game begins with a single scene. Let's make this one unforgettable!"
export class ChapterSelectorScene extends Phaser.Scene {
    constructor() {
        super('Capitulos');

    }

    init(data) {
        // Initialize scene
        this.data = data;
    }

    preload() {
        // Load assets
        this.load.audio('pop', 'assets/sounds/pop.mp3')
        this.load.audio('birds', 'assets/sounds/birds.mp3')
        this.load.image('gradient', 'assets/background_gradient.png');
        this.load.image('gears', 'assets/background_gears.svg');

        this.load.image('cap1', 'assets/chapters/cap1.png');
        this.load.image('cap1f', 'assets/chapters/cap1f.png');
        this.load.image('cap2', 'assets/chapters/cap2.png');
        this.load.image('cap2f', 'assets/chapters/cap2f.png');
        this.load.image('cap3', 'assets/chapters/cap3.png');
        this.load.image('cap3f', 'assets/chapters/cap3f.png');
        this.load.image('nocap', 'assets/chapters/nocap.png');
    }

    createChapterCard(title, image, description, i, state) {

        const colors =
            state ===
                ChapterState.AVAILABLE ? {
                shadow: 0x843a96,
                paper: 0xd58ee0,
                btnPaper: 0x63a711,
                light: 0xfce1b4
            } : state === ChapterState.LOCKED ? {
                shadow: 0x9e9e9e,
                paper: 0xececec,
                btnPaper: 0xececec,
                light: 0xa2a2a2
            } : state === ChapterState.COMPLETED && {
                shadow: 0x843a96,
                paper: 0xd58ee0,
                btnPaper: 0xd58ee0,
                light: 0x843a96
            };

        const border = this.add.graphics();
        border.fillStyle(colors.shadow);
        border.fillRoundedRect(16 - 211, 0 - 380, 410, 700, 16);
        const body = this.add.graphics();
        body.fillStyle(colors.paper);
        body.fillRoundedRect(0 - 211, 0 - 380, 410, 700, 16);

        const titleText = this.add.text(205 - 211, 60 - 380, title,
            {
                fontFamily: 'fredoka',
                fontStyle: 'bold',
                fontSize: 48,
                color: toColorString(colors.shadow),
            }
        ).setOrigin(0.5)

        const img = this.add.image
            (0-180, 0-285, state === ChapterState.LOCKED ? 'nocap' : image).setOrigin(0);

        const desc = this.add.text(
            32 - 211, 406 - 380,
            state === ChapterState.LOCKED ?
                'Completa el capitulo anterior para jugar este capitulo' : description,
            {
                fontFamily: 'fredoka',
                fontSize: '32px',
                color: toColorString(colors.shadow),
                fontStyle: '600',
                wordWrap: { width: 352 }
            });

        const stateLbl = this.add.container(30 - 211, 570 - 380)
        const stateBorder = this.add.graphics();
        stateBorder.fillStyle(colors.light);
        stateBorder.fillRoundedRect(0, 0, 352, 100, 16);
        const stateBody = this.add.graphics();
        stateBody.fillStyle(colors.btnPaper);
        stateBody.fillRoundedRect(6, 6, 341, 89, 16);
        const stateText = this.add.text(176, 45,
            state === ChapterState.AVAILABLE ? 'Jugar' :
                state === ChapterState.LOCKED ? 'Bloqueado' :
                    state === ChapterState.COMPLETED && 'Completado',
            {
                fontFamily: 'fredoka',
                fontSize: '52px',
                color: toColorString(colors.light)
            }).setOrigin(0.5);

        stateLbl.add([stateBorder, stateBody, stateText])
        stateLbl.setSize(700, 200)

        const cardBody = this.add.container(0, 0, [
            body,
            titleText,
            img,
            desc,
            stateLbl
        ])
        cardBody.setSize(422, 760)

        if (state != ChapterState.LOCKED) {
            cardBody.setInteractive({ useHandCursor: true })
            cardBody.on('pointerdown', () => {
                this.popSound.play();

                this.cameras.main.fadeOut(500, 0,0,0)
                this.cameras.main.once('camerafadeoutcomplete', ()=> {
                    this.scene.start(`Chp${i}_scn1`)
                })
                
            });

            cardBody.on('pointerover', () => {
                cardBody.setPosition(cardBody.x, cardBody.y - 16);
            });

            cardBody.on('pointerout', () => {
                cardBody.setPosition(cardBody.x, cardBody.y + 16);
            });

            cardBody.on('pointerdown', () => {
                cardBody.setPosition(cardBody.x, cardBody.y + 31);
            });

            cardBody.on('pointerup', () => {
                cardBody.setPosition(cardBody.x, cardBody.y - 31);
            });
        }

        const card = this.add.container(500 + (i - 1) * 420, 700, [
            border,
            cardBody,
        ])

        return card
    }

    create() {

        this.cameras.main.fadeIn(500, 0, 0, 0);

        this.popSound = this.sound.add('pop', { volume: 0.5 });
        this.cardList = this.add.container(0, 0)

        this.add.image(960, 540, 'gradient');
        this.gears = this.add.tileSprite(
            0, 0,
            this.scale.width,
            this.scale.height, 'gears'
        ).setOrigin(0, 0);
        this.gears.tilePositionX = this.data.gearsOffsetX;
        this.gears.tilePositionY = this.data.gearsOffsetY;


        const titleStyle = {
            fontFamily: 'fredoka',
            fill: '#FCE1B4',
        }
        this.add.text(680, 70, 'Miiruku',
            { ...titleStyle, fontStyle: 'bold', fontSize: '128px', }).setOrigin(0, 0);
        this.add.text(485, 210, 'Selecciona un capitulo para comenzar',
            { ...titleStyle, fontStyle: '', fontSize: '48px', }).setOrigin(0, 0);

        this.createChapterCard(
            'Capitulo 1', 'cap1',
            'Ayuda a Jouktai y Kai a buscar agua y aprende de su importancia y uso responsable',
            1, ChapterState.AVAILABLE
        )
        this.createChapterCard(
            'Capitulo 2', 'cap2',
            'El molino esta fallando y algo podria estar dañado, arreglalo con Jouktai y Kamanewaa',
            2, ChapterState.AVAILABLE
        )
        this.createChapterCard(
            'Capitulo 3', 'cap3',
            'EL molino tambien necesita amor y cuidado, ayuda riendo con Jouktai y a Martin',
            3, ChapterState.AVAILABLE
        )
    }

    update() {

        this.gears.tilePositionY += 0.3;
        this.gears.tilePositionX += 0.1;
    }
}
