import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';
import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';

export class Chp2_scn5 extends Phaser.Scene {
    constructor() {
        super('Chp2_scn5');
    }

    preload() {
        // Guion del capítulo (texto editable).
        this.load.text('ch2_script', 'assets/scripts/chapter2.txt');
        // Audio ambiente.
        this.load.audio('birds', 'assets/sounds/birds.mp3');
        this.load.audio('walk', 'assets/sounds/walk.mp3');
        this.load.audio('gametheme', 'assets/sounds/gametheme.mp3');
        this.load.audio('pop', 'assets/sounds/pop.mp3');
        this.load.audio('success-bell', 'assets/sounds/success_bell.mp3');
        this.load.audio('chirrido', 'assets/sounds/chirrido.mp3');

        // Assets del fondo desierto.
        this.load.image('sky', 'assets/desert/sky.png');
        this.load.image('bg_layer1', 'assets/desert/bg_layer1.png');
        this.load.image('bg_layer2', 'assets/desert/bg_layer2.png');
        this.load.image('bg_layer3', 'assets/desert/bg_layer3.png');
        this.load.image('bg_layer4', 'assets/desert/bg_layer4.png');
        this.load.image('sun1', 'assets/desert/sol1.png');
        this.load.image('sun2', 'assets/desert/sol2.png');
        this.load.image('cap1f', 'assets/chapters/cap1f.png');
        this.load.image('pause-icon', 'assets/ui/settings.png');
        this.load.audio('dialog-pop', 'assets/sounds/dialog-pop.m4a');

        // Molino y aspas.
        this.load.image('molino-base', 'assets/juegos/molino/molino_con_bomba_sin_aspas.png');
        this.load.image('molino-aspas', 'assets/juegos/molino/aspas.png');

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
        this.cameras.main.setBounds(0, worldTop, 1920, worldHeight);
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
        this.faultyMillElapsed = 0;

        // Inicializa el runner del guion.
        const scriptText = this.cache.text.get('ch2_script');
        this.storyRunner = new StoryRunner(this, scriptText);
        this.storyRunner.initUI();

        this.time.delayedCall(0, async () => {
            this.placeMill();
            await this.storyRunner.run('Despedida');
        });
    }

    placeMill() {
        const baseTexture = this.textures.get('molino-base')?.getSourceImage();
        const baseWidth = baseTexture?.width ?? 600;
        const baseHeight = baseTexture?.height ?? 900;
        const baseScale = 1;
        const cam = this.cameras.main;
        const baseX = 800;
        const baseBottom = cam.scrollY + this.scale.height - 60;
        const baseY = baseBottom - baseHeight * baseScale;

        const molinoBase = this.add.image(baseX, baseY, 'molino-base').setOrigin(0, 0).setScale(baseScale);
        molinoBase.setDepth(120);

        const shadowWidth = baseWidth * baseScale * 0.6;
        const shadowHeight = 46;
        const shadowOffsetX = -127;
        const shadowX = baseX + baseWidth * baseScale * 0.5 + shadowOffsetX;
        const shadowY = baseY + baseHeight * baseScale - 20;
        const shadow = this.add.ellipse(shadowX, shadowY, shadowWidth, shadowHeight, 0xF3CE9E, 0.8);
        shadow.setDepth(110);
        shadow.setBlendMode(Phaser.BlendModes.MULTIPLY);

        const aspasX = baseX + 705;
        const aspasY = baseY + 175;
        const aspas = this.add.image(aspasX, aspasY, 'molino-aspas').setOrigin(0.5, 0.5);
        aspas.setDepth(130);

        this.molinoAspas = aspas;
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
        if (this.molinoAspas) {
            this.faultyMillElapsed += delta / 1000;
            const cycle = 1.45;
            const t = (this.faultyMillElapsed % cycle) / cycle;
            let speed = 0.18;
            if (t < 0.34) {
                speed = Phaser.Math.Linear(0.18, 1.55, t / 0.34);
            } else if (t < 0.44) {
                speed = Phaser.Math.Linear(1.55, -0.48, (t - 0.34) / 0.10);
            } else if (t < 0.68) {
                speed = Phaser.Math.Linear(-0.48, 1.35, (t - 0.44) / 0.24);
            } else if (t < 0.78) {
                speed = Phaser.Math.Linear(1.35, -0.42, (t - 0.68) / 0.10);
            } else {
                speed = Phaser.Math.Linear(-0.42, 1.2, (t - 0.78) / 0.22);
            }
            const wobble = Math.sin(this.faultyMillElapsed * 23) * 0.06;
            this.molinoAspas.rotation += (speed + wobble) * (delta / 1000);
        }

        if (this.bgScrollActive && this.bgLayers) {
            const step = (this.bgScrollSpeed * delta) / 1000;
            this.bgLayers.forEach(({ sprite, speed: layerSpeed }) => {
                sprite.tilePositionX += step * this.bgScrollDirection * layerSpeed * 40;
            });
        }
    }
}
