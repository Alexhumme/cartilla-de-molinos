// "Every great game begins with a single scene. Let's make this one unforgettable!"
export class Chp1_scn1 extends Phaser.Scene {
    constructor() {
        super('Chp1_scn1');
    }

    init() {
        // Initialize scene
    }

    preload() {
        // Load assets
    }

    create() {
        // Create game objects
        const worldHeight = 2000;
        this.cameras.main.setBounds(0, 0, 1920, worldHeight);
        const cam = this.cameras.main;
        this.birdsSounds = this.sound.add('birds', { volume: 1 });

        this.birdsSounds.play();

        // Empieza arriba (cerca del sol)
        cam.scrollY = 0;

        cam.fadeIn(500, 0, 0, 0);
        cam.once('camerafadeincomplete', () => {
            this.input.enabled = false;
            this.tweens.add({
                targets: cam,
                scrollY: 800,        // hasta dónde baja
                duration: 6000,      // 4 segundos
                ease: 'Sine.inOut',
                onComplete: () => {
                    this.input.enabled = true;
                }
            });
        })

        this.add.image(960, 0, 'sky').setOrigin(0.5,0);
        this.sun1 = this.add.image(1440, 400, 'sun1').setScrollFactor(0.6);
        this.sun2 = this.add.image(1440, 400, 'sun2').setScrollFactor(0.6);
        this.add.image(1920, 1230, 'bg_layer1').setScrollFactor(0.7);
        this.add.image(1920, 1260, 'bg_layer2').setScrollFactor(0.8);
        this.add.image(1920, 1300, 'bg_layer3').setScrollFactor(0.9);
        this.add.image(1920, 1340, 'bg_layer4').setScrollFactor(1);
    }

    update(time, delta) {
        const speed = 0.0001 * delta;

        this.sun1.rotation += speed;
        this.sun2.rotation -= speed * 0.6;
    }

}
