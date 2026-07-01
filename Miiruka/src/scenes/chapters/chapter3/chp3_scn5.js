import { collectCharacterAssets } from '../../../story/parser.js';
import { StoryRunner } from '../../../story/storyRunner.js';
import { GameStorage } from '../../../utils/storage.js';
import { UIHelpers } from '../../../utils/ui.js';
import { attachLoadingOverlay } from '../../../utils/loadingOverlay.js';
import { addSkyBackground, addDesertLayer } from '../../../utils/backgrounds.js';

export class Chp3_scn5 extends Phaser.Scene {
    constructor() {
        super('Chp3_scn5');
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

        this.load.image('molino_medio', 'assets/juegos/quitar_polvo/molino_medio.png');
        this.load.image('cepillo', 'assets/juegos/quitar_polvo/cepillo.png');
        this.load.image('brocha', 'assets/juegos/pintar_partes/brocha.png');
        this.load.image('molino-limpio', 'assets/juegos/pintar_partes/molino_limpio.png');
        this.load.image('molino-base', 'assets/juegos/molino/molino_con_bomba_sin_aspas.png');
        this.load.image('molino-aspas', 'assets/juegos/molino/aspas.png');
        this.load.image('moving-piece', 'assets/juegos/moving_piece.png');
        this.load.image('parte_Aspas', 'assets/juegos/pintar_partes/Aspas.png');
        this.load.image('parte_Aspas_medio', 'assets/juegos/pintar_partes/aspas_medio.png');
        this.load.image('parte_Torre', 'assets/juegos/pintar_partes/Torre.png');
        this.load.image('parte_Torre_medio', 'assets/juegos/pintar_partes/torre_medio.png');
        this.load.image('parte_Rotor', 'assets/juegos/pintar_partes/Rotor.png');
        this.load.image('parte_Rotor_medio', 'assets/juegos/pintar_partes/buje_rotor_medio.png');
        this.load.image('parte_Veleta', 'assets/juegos/pintar_partes/Veleta.png');
        this.load.image('parte_Veleta_medio', 'assets/juegos/pintar_partes/veleta_medio.png');
        this.load.image('parte_bomba', 'assets/juegos/pintar_partes/bomba.png');
        this.load.image('parte_bomba_medio', 'assets/juegos/pintar_partes/bomba_medio.png');

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
        this.useWorldCharacters = true;
        this.cameras.main.fadeIn(600, 0, 0, 0);

        this.birdsSounds = this.sound.add('birds', { volume: 1 });
        this.birdsSounds.play();

        const worldTop = -2000;
        const worldHeight = 5000;
        this.cameras.main.setBounds(0, worldTop, 1920, worldHeight);
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
            this.placeMill();
            await this.storyRunner.run('Proteccion');
            this.storyRunner.resetWalkingSound();
        });
    }

    placeMill() {
        const baseTexture = this.textures.get('molino_medio')?.getSourceImage();
        const baseWidth = baseTexture?.width ?? 600;
        const baseHeight = baseTexture?.height ?? 900;
        const baseScale = 1;
        const cam = this.cameras.main;
        const baseX = 800;
        const baseBottom = cam.scrollY + this.scale.height - 60;
        const baseY = baseBottom - baseHeight * baseScale + 25;

        this.molinoBase = this.add.image(baseX, baseY, 'molino_medio').setOrigin(0, 0).setScale(baseScale);
        this.molinoBase.setDepth(120);

    }

    updateMovingPiece(delta) {
        if (!this.movingPiece) return;
        const spinSpeed = Number(this.molinoAutoSpinSpeed ?? 0) * 0.2;
        if (spinSpeed <= 0.01) {
            this.movingPiece.y = this.movingPieceBaseY;
            return;
        }
        const dt = delta / 1000;
        this.movingPiecePhase += dt * Phaser.Math.Clamp(0.9 + spinSpeed * 0.25, 0.9, 2.8);
        const cycle = (this.movingPiecePhase % 1 + 1) % 1;
        const upDown = cycle < 0.5 ? (cycle / 0.5) : (1 - (cycle - 0.5) / 0.5);
        const eased = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp(upDown, 0, 1));
        this.movingPiece.y = Phaser.Math.Linear(this.movingPieceBaseY, this.movingPieceTopY, eased);
    }

    getCameraPanDistance() {
        if (!this.molinoAspas) return 520;
        const cam = this.cameras.main;
        const target = (cam.scrollY + this.scale.height / 2) - this.molinoAspas.y;
        return Math.max(0, Math.round(target));
    }

    update(time, delta) {
        if (this.storyRunner?.isPaused) return;
        const speed = 0.0001 * delta;
        if (this.sun1) this.sun1.rotation += speed;
        if (this.sun2) this.sun2.rotation -= speed * 0.6;
        if (this.molinoAspas && (this.molinoAutoSpinSpeed ?? 0) > 0) {
            this.molinoAspas.rotation += this.molinoAutoSpinSpeed * (delta / 1000);
        }
        this.updateMovingPiece(delta);

        if (this.bgScrollActive && this.bgLayers) {
            const step = (this.bgScrollSpeed * delta) / 1000;
            this.bgLayers.forEach(({ sprite, speed: layerSpeed }) => {
                sprite.tilePositionX += step * this.bgScrollDirection * layerSpeed * 40;
            });
        }
    }
}
