import { toColorString } from '../utils/colors.js';
import { GameStorage } from '../utils/storage.js';
import { UIHelpers } from '../utils/ui.js';

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
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a')
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
        this.load.image('star-holder', 'assets/ui/star-holder.png');
        this.load.image('star', 'assets/ui/star.png');
    }

    createChapterCard(title, image, description, i, state, summary) {

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

        const progressText = this.add.text(
            32 - 211, 560 - 380,
            `Progreso: ${summary.completedScenes}/${summary.totalScenes} escenas`,
            {
                fontFamily: 'fredoka',
                fontSize: '28px',
                color: toColorString(colors.shadow),
                fontStyle: '600',
            }
        );

        const starRow = this.add.container(0, 262);
        const holders = [];
        const filledStars = [];
        const starCount = Math.max(0, Math.min(3, Number(summary.stars) || 0));
        for (let index = 0; index < 3; index += 1) {
            const x = -58 + index * 58;
            const holder = this.add.image(x, 0, 'star-holder').setDisplaySize(46, 46);
            holders.push(holder);
            starRow.add(holder);
            if (index < starCount) {
                const star = this.add.image(x, 0, 'star').setDisplaySize(30, 30);
                filledStars.push(star);
                starRow.add(star);
            }
        }
        const dimAlpha = state === ChapterState.LOCKED ? 0.55 : 1;
        holders.forEach((holder) => holder.setAlpha(dimAlpha));
        filledStars.forEach((star) => star.setAlpha(dimAlpha));

        const cardBody = this.add.container(0, 0, [
            body,
            titleText,
            img,
            desc,
            progressText,
            starRow
        ])
        cardBody.setSize(422, 760)

        if (state != ChapterState.LOCKED) {
            cardBody.setInteractive({ useHandCursor: true })
            cardBody.on('pointerdown', () => {
                this.sound.play('pop', { volume: 0.8 });

                const resumeScene = GameStorage.getResumeScene(i);
                this.cameras.main.fadeOut(500, 0,0,0)
                this.cameras.main.once('camerafadeoutcomplete', ()=> {
                    this.scene.start(`Chp${i}_scn${resumeScene}`)
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

            UIHelpers.attachHoverPop(this, cardBody, 0.35);
        }

        const card = this.add.container(500 + (i - 1) * 420, 700, [
            border,
            cardBody,
        ])

        return card
    }

    create() {

        UIHelpers.setGameCursor(this);
        this.cameras.main.fadeIn(500, 0, 0, 0);

        this.popSound = this.sound.add('pop', { volume: 0.8 });
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

        this.createBackButton(120, 110, UIHelpers.getText('menu'));
        this.createDownloadButton(1770, 110);

        const isCompleted = (chapter) => GameStorage.isChapterCompleted(chapter);
        const isUnlocked = (chapter) => GameStorage.isChapterUnlocked(chapter);
        const getSummary = (chapter) => GameStorage.getChapterProgressSummary(chapter);

        this.createChapterCard(
            `${UIHelpers.getText('chapter')} 1`, 'cap1',
            'Ayuda a Jouktai y Kai a buscar agua y aprende de su importancia y uso responsable',
            1,
            isCompleted(1) ? ChapterState.COMPLETED : ChapterState.AVAILABLE,
            getSummary(1)
        )
        this.createChapterCard(
            `${UIHelpers.getText('chapter')} 2`, 'cap2',
            'El molino esta fallando y algo podria estar dañado, arreglalo con Jouktai y Kamanewaa',
            2,
            isCompleted(2) ? ChapterState.COMPLETED : (isUnlocked(2) ? ChapterState.AVAILABLE : ChapterState.LOCKED),
            getSummary(2)
        )
        this.createChapterCard(
            `${UIHelpers.getText('chapter')} 3`, 'cap3',
            'EL molino tambien necesita amor y cuidado, ayuda riendo con Jouktai y a Martin',
            3,
            isCompleted(3) ? ChapterState.COMPLETED : (isUnlocked(3) ? ChapterState.AVAILABLE : ChapterState.LOCKED),
            getSummary(3)
        )
    }

    update() {

        this.gears.tilePositionY += 0.3;
        this.gears.tilePositionX += 0.1;
    }

    createBackButton(x, y, label) {
        const text = this.add.text(0, 0, label, {
            fontSize: '36px',
            fill: '#6a3a1b',
            fontFamily: 'fredoka',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        const paddingX = 36;
        const paddingY = 10;
        const width = text.width + paddingX * 2;
        const height = text.height + paddingY * 2;

        const border = this.add.graphics();
        border.fillStyle(0x8b4c1d);
        border.fillRoundedRect(-width / 2, -height / 2, width + 8, height + 8, 12);
        const body = this.add.graphics();
        body.fillStyle(0xf0c18a);
        body.fillRoundedRect(-width / 2, -height / 2, width, height, 12);

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

    createDownloadButton(x, y) {
        const size = 76;
        const button = this.add.container(x, y);
        const border = this.add.graphics();
        border.fillStyle(0x8b4c1d);
        border.fillRoundedRect(-size / 2, -size / 2, size, size, 14);
        const body = this.add.graphics();
        body.fillStyle(0xf0c18a);
        body.fillRoundedRect(-size / 2 + 5, -size / 2 + 5, size - 10, size - 10, 12);
        const icon = this.add.graphics();
        icon.lineStyle(5, 0x6a3a1b, 1);
        icon.lineBetween(0, -16, 0, 10);
        icon.lineBetween(-10, 2, 0, 14);
        icon.lineBetween(10, 2, 0, 14);
        icon.lineBetween(-16, 18, 16, 18);

        button.add([border, body, icon]);
        button.setSize(size, size);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => {
            this.sound.play('pop', { volume: 0.8 });
            GameStorage.downloadProgressCertificate();
        });
        button.on('pointerover', () => button.setScale(1.05));
        button.on('pointerout', () => button.setScale(1));
        UIHelpers.attachHoverPop(this, button, 0.35);

        const label = this.add.text(x - 120, y - 2, 'Descargar progreso', {
            fontFamily: 'fredoka',
            fontSize: '24px',
            color: '#FCE1B4',
        }).setOrigin(1, 0.5);

        return { button, label };
    }
}
