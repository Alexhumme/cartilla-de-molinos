import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';
import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';

export class Chp1_scn5 extends Phaser.Scene {
    constructor() {
        super('Chp1_scn5');
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

        // Molino y aspas.
        this.load.image('molino-base', 'assets/juegos/molino/molino_sin_aspas.png');
        this.load.image('molino-aspas', 'assets/juegos/molino/aspas.png');

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
        this.useWorldCharacters = true;
        // Transición de entrada.
        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Audio de ambiente.
        this.birdsSounds = this.sound.add('birds', { volume: 1 });
        this.birdsSounds.play();

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

        // Inicializa el runner del guion.
        const scriptText = this.cache.text.get('ch1_script');
        this.storyRunner = new StoryRunner(this, scriptText);
        this.storyRunner.initUI();

        this.time.delayedCall(0, async () => {
            this.placeMill();
            await this.storyRunner.run('Llegada');
        });
    }

    placeMill() {
        const baseTexture = this.textures.get('molino-base')?.getSourceImage();
        const baseWidth = baseTexture?.width ?? 600;
        const baseHeight = baseTexture?.height ?? 900;
        const baseScale = 1;
        const cam = this.cameras.main;
        const baseX = 1200;
        const baseBottom = cam.scrollY + this.scale.height - 60;
        const baseY = baseBottom - baseHeight * baseScale;

        const molinoBase = this.add.image(baseX, baseY, 'molino-base').setOrigin(0, 0).setScale(baseScale);
        molinoBase.setDepth(120);

        const shadowWidth = baseWidth * baseScale * 0.6;
        const shadowHeight = 46;
        const shadowOffsetX = -157;
        const shadowX = baseX + baseWidth * baseScale * 0.5 + shadowOffsetX;
        const shadowY = baseY + baseHeight * baseScale - 20;
        const shadow = this.add.ellipse(shadowX, shadowY, shadowWidth, shadowHeight, 0xF3CE9E, 0.8);
        shadow.setDepth(110);
        shadow.setBlendMode(Phaser.BlendModes.MULTIPLY);

        const aspasX = baseX + 370;
        const aspasY = baseY + 370;
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

        if (this.bgScrollActive && this.bgLayers) {
            const step = (this.bgScrollSpeed * delta) / 1000;
            this.bgLayers.forEach(({ sprite, speed: layerSpeed }) => {
                sprite.tilePositionX += step * this.bgScrollDirection * layerSpeed * 40;
            });
        }
    }
}
