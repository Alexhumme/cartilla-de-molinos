import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';
import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';

export class Chp1_scn3 extends Phaser.Scene {
    constructor() {
        super('Chp1_scn3');
    }

    preload() {
        // Guion del capítulo (texto editable).
        this.load.text('ch1_script', 'assets/scripts/chapter1.txt');
        // Audio ambiente.
        this.load.audio('birds', 'assets/sounds/birds.mp3');
        this.load.audio('walk', 'assets/sounds/walk.mp3');
        this.load.audio('gametheme', 'assets/sounds/gametheme.mp3');
        this.load.audio('pop', 'assets/sounds/pop.mp3');

        // Assets del fondo desierto.
        this.load.image('sky', 'assets/desert/sky.png');
        this.load.image('bg_layer1', 'assets/desert/bg_layer1.png');
        this.load.image('bg_layer2', 'assets/desert/bg_layer2.png');
        this.load.image('bg_layer3', 'assets/desert/bg_layer3.png');
        this.load.image('bg_layer4', 'assets/desert/bg_layer4.png');
        this.load.image('sun1', 'assets/desert/sol1.png');
        this.load.image('sun2', 'assets/desert/sol2.png');
        this.load.image('cap1f', 'assets/chapters/cap1f.png');
        this.load.image('pause-icon', 'assets/settings.png');
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a');
        // Ilustraciones de apoyo (pop).
        this.load.image('item-sol-caliente', 'assets/items/sopa-caliente.png');
        this.load.image('item-no-agua', 'assets/items/no-agua.png');
        this.load.image('item-lavanderia', 'assets/items/lavanderia.png');
        this.load.image('item-ducha', 'assets/items/ducha.png');
        this.load.image('item-molino-danado', 'assets/items/molinoDanado.png');
        this.load.image('item-tuberia', 'assets/items/tuberia.png');
        this.load.image('item-gota-vida', 'assets/items/gota-vida.png');

        // Carga dinámica de personajes y emociones usados en el guion.
        this.load.on('filecomplete-text-ch1_script', (key, type, data) => {
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
        this.birdsSounds = this.sound.add('birds', { volume: 1 });
        this.birdsSounds.play();

        // Fondo estático (sin paneo inicial).
        const worldHeight = 2000;
        this.cameras.main.setBounds(0, 0, 1920, worldHeight);
        this.cameras.main.scrollY = 800;
        this.add.image(960, 0, 'sky').setOrigin(0.5, 0).setScrollFactor(0);
        this.sun1 = this.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        this.sun2 = this.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        const layer1 = this.add.tileSprite(960, 1230, 1920, 1080, 'bg_layer1').setScrollFactor(0.7);
        const layer2 = this.add.tileSprite(960, 1260, 1920, 1080, 'bg_layer2').setScrollFactor(0.8);
        const layer3 = this.add.tileSprite(960, 1300, 1920, 1080, 'bg_layer3').setScrollFactor(0.9);
        const layer4 = this.add.tileSprite(960, 1340, 1920, 1080, 'bg_layer4').setScrollFactor(1);

        this.bgLayers = [
            { sprite: layer1, speed: 0.15 },
            { sprite: layer2, speed: 0.22 },
            { sprite: layer3, speed: 0.3 },
            { sprite: layer4, speed: 0.4 },
        ];
        this.bgScrollActive = false;
        this.bgScrollDirection = -1;
        this.bgScrollSpeed = 8;

        // Inicializa el runner del guion.
        const scriptText = this.cache.text.get('ch1_script');
        this.storyRunner = new StoryRunner(this, scriptText);
        this.storyRunner.initUI();

        this.time.delayedCall(0, async () => {
            await this.storyRunner.run('Encuentro');
        });
    }

    update(time, delta) {
        // Detiene animaciones si está en pausa.
        if (this.storyRunner?.isPaused) return;
        const speed = 0.0001 * delta;
        if (this.sun1) this.sun1.rotation += speed;
        if (this.sun2) this.sun2.rotation -= speed * 0.6;

        if (this.bgScrollActive && this.bgLayers) {
            const step = (this.bgScrollSpeed * delta) / 1000;
            this.bgLayers.forEach(({ sprite, speed: layerSpeed }) => {
                sprite.tilePositionX += step * this.bgScrollDirection * layerSpeed * 40;
            });
        }
    }
}
