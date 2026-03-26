import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';

export class Chp1_scn2 extends Phaser.Scene {
    constructor() {
        super('Chp1_scn2');
    }

    preload() {
        this.load.text('ch1_script', 'assets/scripts/chapter1.txt');
        this.load.audio('birds', 'assets/sounds/pajaros.mp3');

        this.load.image('sky', 'assets/desert/sky.png');
        this.load.image('bg_layer1', 'assets/desert/bg_layer1.png');
        this.load.image('bg_layer2', 'assets/desert/bg_layer2.png');
        this.load.image('bg_layer3', 'assets/desert/bg_layer3.png');
        this.load.image('bg_layer4', 'assets/desert/bg_layer4.png');
        this.load.image('sun1', 'assets/desert/sol1.png');
        this.load.image('sun2', 'assets/desert/sol2.png');
        this.load.image('cap1f', 'assets/chapters/cap1f.png');
        this.load.image('pause-icon', 'assets/Settings.jpg');

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
        this.cameras.main.fadeIn(600, 0, 0, 0);

        this.birdsSounds = this.sound.add('birds', { volume: 1 });
        this.birdsSounds.play();

        const scriptText = this.cache.text.get('ch1_script');
        this.storyRunner = new StoryRunner(this, scriptText);
        this.storyRunner.initUI();

        this.time.delayedCall(0, async () => {
            await this.storyRunner.run('Desarrollo');
            await this.storyRunner.run('Final');
        });
    }

    update(time, delta) {
        if (this.storyRunner?.isPaused) return;
        const speed = 0.0001 * delta;
        if (this.sun1) this.sun1.rotation += speed;
        if (this.sun2) this.sun2.rotation -= speed * 0.6;
    }
}
