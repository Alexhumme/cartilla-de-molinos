import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';
import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';

export class Chp1_scn1 extends Phaser.Scene {
    constructor() {
        super('Chp1_scn1');
    }

    init() {
        // Initialize scene
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
        // Minijuego: girar grifo.
        this.load.image('grifo-cano', 'assets/juegos/girar_grifo/caño.png');
        this.load.image('grifo-manija', 'assets/juegos/girar_grifo/manija.png');
        this.load.audio('success-bell', 'assets/sounds/success_bell.mp3');
        this.load.audio('metal-squeak', 'assets/juegos/girar_grifo/metal-squeak.mp3');
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a');
        // Objetos escena 1.
        this.load.image('mucura', 'assets/mucura.png');
        this.load.image('fuente', 'assets/fuente.png');

        // Carga dinámica de personajes y emociones usados en el guion.
        this.load.on('filecomplete-text-ch1_script', (key, type, data) => {
            const characters = collectCharacterAssets(data);
            characters.forEach((emotions, name) => {
                this.load.image(`char-${name}-idle`, `assets/characters/${name}/${name}-idle.png`);
                this.load.image(`char-${name}-camina`, `assets/characters/${name}/${name}-camina.png`);
                emotions.forEach((emotion) => {
                    this.load.image(`char-${name}-${emotion}`, `assets/characters/${name}/${name}-${emotion}.png`);
                });
            });
        });
    }

    create() {
        UIHelpers.setGameCursor(this);
        GameStorage.setLastChapter(1);
        // Audio de ambiente.
        this.birdsSounds = this.sound.add('birds', { volume: 1 });
        this.birdsSounds.play();

        // Inicializa el runner del guion.
        const scriptText = this.cache.text.get('ch1_script');
        this.storyRunner = new StoryRunner(this, scriptText);
        this.storyRunner.initUI();
        this.time.delayedCall(0, () => this.storyRunner.run('Inicio'));
    }

    update(time, delta) {
        // Detiene animaciones si está en pausa.
        if (this.storyRunner?.isPaused) return;
        const speed = 0.0001 * delta;

        if (this.sun1) this.sun1.rotation += speed;
        if (this.sun2) this.sun2.rotation -= speed * 0.6;
    }

}
