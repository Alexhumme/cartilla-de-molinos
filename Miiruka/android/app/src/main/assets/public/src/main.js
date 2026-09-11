import { StartScene } from './scenes/StartScene.js';
import { ChapterSelectorScene } from './scenes/ChapterSelectorScene.js'
import { InfoScene } from './scenes/InfoScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import chapter1Scenes from './scenes/chapters/chapter1/index.js'
import chapter2Scenes from './scenes/chapters/chapter2/index.js'
import chapter3Scenes from './scenes/chapters/chapter3/index.js'

const config = {
    type: Phaser.AUTO,
    title: 'Miiruku',
    description: '',
    parent: 'game-container',
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    pixelArt: false,
    input: {
        gamepad: true,
    },
    scene: [
        StartScene,
        ChapterSelectorScene,
        InfoScene,
        SettingsScene,
        ...chapter1Scenes,
        ...chapter2Scenes,
        ...chapter3Scenes
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
}

new Phaser.Game(config);
            
