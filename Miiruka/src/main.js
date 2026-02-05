import { StartScene } from './scenes/StartScene.js';
import { ChapterSelectorScene } from './scenes/ChapterSelectorScene.js'
import chapter1Scenes from './scenes/chapters/chapter1/index.js'

const config = {
    type: Phaser.AUTO,
    title: 'Miiruku',
    description: '',
    parent: 'game-container',
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    pixelArt: false,
    scene: [
        StartScene,
        ChapterSelectorScene,
        ...chapter1Scenes
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
}

new Phaser.Game(config);
            