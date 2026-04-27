import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';
import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';

export class Chp2_scn2 extends Phaser.Scene {
    constructor() {
        super('Chp2_scn2');
    }

    preload() {
        // Guion del capítulo (texto editable).
        this.load.text('ch2_script', 'assets/scripts/chapter2.txt');
        // Audio ambiente.
        this.load.audio('walk', 'assets/sounds/walk.mp3');
        this.load.audio('gametheme', 'assets/sounds/gametheme.mp3');
        this.load.audio('pop', 'assets/sounds/pop.mp3');
        this.load.audio('pop-img-recuadro', 'assets/sounds/pop-img-recuadro.mp3');
        this.load.audio('wrong-option', 'assets/sounds/wrong_option.mp3');

        // Assets del fondo desierto.
        this.load.image('sky', 'assets/desert/sky.png');
        this.load.image('bg_layer_taller', 'assets/background_taller.png');
        this.load.image('sun1', 'assets/desert/sol1.png');
        this.load.image('sun2', 'assets/desert/sol2.png');
        this.load.image('cap1f', 'assets/chapters/cap1f.png');
        this.load.image('pause-icon', 'assets/ui/settings.png');
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a');
        this.load.audio('success-bell', 'assets/sounds/success_bell.mp3');
        // Ilustraciones para recuadro explicativo.
        this.load.image('cc-aspas', 'assets/juegos/conectar_conceptos/astas.png');
        this.load.image('cc-bomba', 'assets/juegos/conectar_conceptos/bomba.png');
        this.load.image('cc-convertidor', 'assets/juegos/conectar_conceptos/convertidor.png');
        this.load.image('cc-pinion', 'assets/juegos/conectar_conceptos/piñon.png');

        // Carga dinámica de personajes y emociones usados en el guion.
        this.load.on('filecomplete-text-ch2_script', (key, type, data) => {
            const characters = collectCharacterAssets(data);
            characters.forEach((emotions, name) => {
                const states = new Set(['idle', 'camina', ...Array.from(emotions)]);
                const facings = ['mira_jugador', 'mira_lado'];
                facings.forEach((facing) => {
                    states.forEach((state) => {
                        for (let mouth = 1; mouth <= 3; mouth += 1) {
                            this.load.image(
                                `char-${name}-${facing}-${state}-${mouth}`,
                                `assets/characters/${name}/${facing}/${state}/${mouth}_.png`
                            );
                        }
                    });
                });
            });
        });
    }

    create() {
        UIHelpers.setGameCursor(this);
        GameStorage.setLastChapter(1);
        // Transición de entrada.
        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Audio de ambiente.


        // Fondo estático (sin paneo inicial).
        const worldHeight = 2000;
        this.cameras.main.setBounds(0, 0, 1920, worldHeight);
        this.cameras.main.scrollY = 800;
        this.add.image(960, 0, 'sky').setOrigin(0.5, 0).setScrollFactor(0);
        this.sun1 = this.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        this.sun2 = this.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        const layer = this.add.tileSprite(960, 1130, 1920, 1080, 'bg_layer_taller').setScrollFactor(0.7);

        this.bgLayers = [
            { sprite: layer, speed: 0.15 },
        ];
        this.bgScrollActive = false;
        this.bgScrollDirection = -1;
        this.bgScrollSpeed = 8;
        this.faultyMillElapsed = 0;

        // Inicializa el runner del guion.
        const scriptText = this.cache.text.get('ch2_script');
        this.storyRunner = new StoryRunner(this, scriptText);
        this.storyRunner.initUI();

        this.time.delayedCall(0, async () => {
            await this.storyRunner.run('Desarrollo');
            this.storyRunner.resetWalkingSound();
        });
    }

    update(time, delta) {
        // Detiene animaciones si está en pausa.
        if (this.storyRunner?.isPaused) return;
        const speed = 0.0001 * delta;
        if (this.sun1) this.sun1.rotation += speed;
        if (this.sun2) this.sun2.rotation -= speed * 0.6;
        if (this.molinoAspas) {
            this.faultyMillElapsed += delta / 1000;
            const cycle = 1.45;
            const t = (this.faultyMillElapsed % cycle) / cycle;
            let spinSpeed = 0.18;
            if (t < 0.34) {
                spinSpeed = Phaser.Math.Linear(0.18, 1.55, t / 0.34);
            } else if (t < 0.44) {
                spinSpeed = Phaser.Math.Linear(1.55, -0.48, (t - 0.34) / 0.10);
            } else if (t < 0.68) {
                spinSpeed = Phaser.Math.Linear(-0.48, 1.35, (t - 0.44) / 0.24);
            } else if (t < 0.78) {
                spinSpeed = Phaser.Math.Linear(1.35, -0.42, (t - 0.68) / 0.10);
            } else {
                spinSpeed = Phaser.Math.Linear(-0.42, 1.2, (t - 0.78) / 0.22);
            }
            const wobble = Math.sin(this.faultyMillElapsed * 23) * 0.06;
            this.molinoAspas.rotation += (spinSpeed + wobble) * (delta / 1000);
        }

        if (this.bgScrollActive && this.bgLayers) {
            const step = (this.bgScrollSpeed * delta) / 1000;
            this.bgLayers.forEach(({ sprite, speed: layerSpeed }) => {
                sprite.tilePositionX += step * this.bgScrollDirection * layerSpeed * 40;
            });
        }
    }
}
