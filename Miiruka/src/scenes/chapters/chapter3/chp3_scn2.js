import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';
import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';
import { attachLoadingOverlay } from '../../../utils/loadingOverlay.js';
import { addSkyBackground, addDesertLayer } from '../../../utils/backgrounds.js';

export class Chp3_scn2 extends Phaser.Scene {
    constructor() {
        super('Chp3_scn2');
    }

    preload() {
        attachLoadingOverlay(this, 'Cargando capítulo...');
        this.load.text('ch3_script', 'assets/scripts/chapter3.txt');
        this.load.audio('birds', 'assets/sounds/birds.mp3');
        this.load.audio('walk', 'assets/sounds/walk.mp3');
        this.load.audio('gametheme', 'assets/sounds/gametheme.mp3');
        this.load.audio('pop', 'assets/sounds/pop.mp3');
        this.load.audio('wrong-option', 'assets/sounds/wrong_option.mp3');
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a');
        this.load.audio('success-bell', 'assets/sounds/success_bell.mp3');

        this.load.image('sky', 'assets/desert/sky.png');
        this.load.image('bg_layer1', 'assets/desert/bg_layer1.png');
        this.load.image('bg_layer2', 'assets/desert/bg_layer2.png');
        this.load.image('bg_layer3', 'assets/desert/bg_layer3.png');
        this.load.image('bg_layer4', 'assets/desert/bg_layer4.png');
        this.load.image('sun1', 'assets/desert/sol1.png');
        this.load.image('sun2', 'assets/desert/sol2.png');
        this.load.image('cap1f', 'assets/chapters/cap1f.png');
        this.load.image('pause-icon', 'assets/ui/settings.png');

        this.load.image('item-pintura', 'assets/items/pintura.png');
        this.load.image('item-brocha', 'assets/items/brocha.png');
        this.load.image('item-aceite', 'assets/items/aceite.png');
        this.load.image('item-llave', 'assets/items/llave.png');
        this.load.image('item-cortatubos', 'assets/items/cortatubos.png');
        this.load.image('item-trapo', 'assets/items/trapo.png');
        this.load.image('item-cepillo', 'assets/items/cepillo.png');
        this.load.image('item-guantes', 'assets/items/guantes.png');
        this.load.image('item-gafas', 'assets/items/gafas.png');
        this.load.image('item-casco', 'assets/items/casco.png');
        this.load.image('item-botas', 'assets/items/botas.png');
        this.load.image('item-tapabocas', 'assets/items/tapabocas.png');

        this.load.on('filecomplete-text-ch3_script', (key, type, data) => {
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
        GameStorage.setLastChapter(3);
        this.cameras.main.fadeIn(600, 0, 0, 0);

        this.birdsSounds = this.sound.add('birds', { volume: 1 });
        this.birdsSounds.play();

        this.cameras.main.setBounds(0, 0, 1920, 2000);
        this.cameras.main.scrollY = 800;
        addSkyBackground(this);
        this.sun1 = this.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        this.sun2 = this.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        const layer1 = addDesertLayer(this, 'bg_layer1', 1230, 0.7);
        const layer2 = addDesertLayer(this, 'bg_layer2', 1260, 0.8);
        const layer3 = addDesertLayer(this, 'bg_layer3', 1300, 0.9);
        const layer4 = addDesertLayer(this, 'bg_layer4', 1340, 1);

        this.bgLayers = [
            { sprite: layer1, speed: 0.15 },
            { sprite: layer2, speed: 0.22 },
            { sprite: layer3, speed: 0.3 },
            { sprite: layer4, speed: 0.4 },
        ];
        this.bgScrollActive = false;
        this.bgScrollDirection = -1;
        this.bgScrollSpeed = 8;

        const scriptText = this.cache.text.get('ch3_script');
        this.storyRunner = new StoryRunner(this, scriptText);
        this.storyRunner.initUI();

        this.time.delayedCall(0, async () => {
            await this.storyRunner.run('Encuentro');
            this.storyRunner.resetWalkingSound();
        });
    }

    update(time, delta) {
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
