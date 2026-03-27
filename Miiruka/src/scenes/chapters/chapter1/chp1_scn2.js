import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';

export class Chp1_scn2 extends Phaser.Scene {
    constructor() {
        super('Chp1_scn2');
    }

    preload() {
        // Guion del capítulo (texto editable).
        this.load.text('ch1_script', 'assets/scripts/chapter1.txt');
        // Audio ambiente.
        this.load.audio('birds', 'assets/sounds/pajaros.mp3');

        // Assets del fondo desierto.
        this.load.image('sky', 'assets/desert/sky.png');
        this.load.image('bg_layer1', 'assets/desert/bg_layer1.png');
        this.load.image('bg_layer2', 'assets/desert/bg_layer2.png');
        this.load.image('bg_layer3', 'assets/desert/bg_layer3.png');
        this.load.image('bg_layer4', 'assets/desert/bg_layer4.png');
        this.load.image('sun1', 'assets/desert/sol1.png');
        this.load.image('sun2', 'assets/desert/sol2.png');
        this.load.image('cap1f', 'assets/chapters/cap1f.png');
        this.load.image('pause-icon', 'assets/Settings.jpg');

        // Carga dinámica de personajes y emociones usados en el guion.
        this.load.on('filecomplete-text-ch1_script', (key, type, data) => {
            const characters = collectCharacterAssets(data);
            characters.forEach((emotions, name) => {
                this.load.image(`char-${name}-idle`, `assets/characters/${name}/${name}-idle.png`);
                emotions.forEach((emotion) => {
                    this.load.image(`char-${name}-${emotion}`, `assets/characters/${name}/${name}-${emotion}.png`);
                });
            });
        });
    }

    create() {
        // Transición de entrada.
        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Audio de ambiente.
        this.birdsSounds = this.sound.add('birds', { volume: 1 });
        this.birdsSounds.play();

        // Fondo estático (sin paneo inicial).
        const worldHeight = 2000;
        this.cameras.main.setBounds(0, 0, 1920, worldHeight);
        this.cameras.main.scrollY = 800;
        this.add.image(960, 0, 'sky').setOrigin(0.5, 0);
        this.sun1 = this.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        this.sun2 = this.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        this.add.image(1920, 1230, 'bg_layer1').setScrollFactor(0.7);
        this.add.image(1920, 1260, 'bg_layer2').setScrollFactor(0.8);
        this.add.image(1920, 1300, 'bg_layer3').setScrollFactor(0.9);
        this.add.image(1920, 1340, 'bg_layer4').setScrollFactor(1);

        // Inicializa el runner del guion.
        const scriptText = this.cache.text.get('ch1_script');
        this.storyRunner = new StoryRunner(this, scriptText);
        this.storyRunner.initUI();

        this.time.delayedCall(0, async () => {
            await this.storyRunner.run('Desarrollo');
            await this.storyRunner.run('Final');
        });
    }

    update(time, delta) {
        // Detiene animaciones si está en pausa.
        if (this.storyRunner?.isPaused) return;
        const speed = 0.0001 * delta;
        if (this.sun1) this.sun1.rotation += speed;
        if (this.sun2) this.sun2.rotation -= speed * 0.6;
    }
}
