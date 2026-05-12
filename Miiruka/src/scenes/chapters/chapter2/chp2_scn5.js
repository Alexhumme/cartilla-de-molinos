import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';
import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';
import { attachLoadingOverlay } from '../../../utils/loadingOverlay.js';
import { addWorkshopLayer, addSkyBackground } from '../../../utils/backgrounds.js';

export class Chp2_scn5 extends Phaser.Scene {
    constructor() {
        super('Chp2_scn5');
    }

    preload() {
        attachLoadingOverlay(this, 'Cargando capítulo...');
        // Guion del capítulo (texto editable).
        this.load.text('ch2_script', 'assets/scripts/chapter2.txt');
        // Audio ambiente.
        this.load.audio('birds', 'assets/sounds/birds.mp3');
        this.load.audio('walk', 'assets/sounds/walk.mp3');
        this.load.audio('gametheme', 'assets/sounds/gametheme.mp3');
        this.load.audio('pop', 'assets/sounds/pop.mp3');
        this.load.audio('success-bell', 'assets/sounds/success_bell.mp3');

        // Assets del fondo desierto.
        this.load.image('sky', 'assets/desert/sky.png');
        this.load.image('bg_layer_taller', 'assets/background_taller.png');
        this.load.image('sun1', 'assets/desert/sol1.png');
        this.load.image('sun2', 'assets/desert/sol2.png');
        this.load.image('cap1f', 'assets/chapters/cap1f.png');
        this.load.image('pause-icon', 'assets/ui/settings.png');
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a');

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
        this.useWorldCharacters = true;
        // Transición de entrada.
        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Audio de ambiente.
        

        // Fondo estático (sin paneo inicial).
        const worldTop = -2000;
        const worldHeight = 5000;
        this.cameras.main.setBounds(0, worldTop, this.scale.width, worldHeight);
        this.cameras.main.scrollY = 800;
        addSkyBackground(this);
        this.sun1 = this.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        this.sun2 = this.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        const layer = addWorkshopLayer(this, 'bg_layer_taller', 1350);

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
            await this.storyRunner.run('Despedida');
        });
    }


    getCameraPanDistance() {
        if (!this.molinoAspas) return 520;
        const cam = this.cameras.main;
        const target = (cam.scrollY + this.scale.height / 2) - this.molinoAspas.y;
        return Math.max(0, Math.round(target));
    }
 
    update(time, delta) {
        // Detiene animaciones si está en pausa.
        if (this.storyRunner?.isPaused) return;
        const speed = 0.0001 * delta;
        if (this.sun1) this.sun1.rotation += speed;
        if (this.sun2) this.sun2.rotation -= speed * 0.6;
    }
}
