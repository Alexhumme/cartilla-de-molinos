import { GameStorage } from './storage.js';

const UI_STRINGS = {
    es: {
        new_game: 'Nueva partida',
        continue: 'Continuar',
        settings: 'Ajustes',
        info: 'Información',
        hello: 'Hola',
        music: 'Música',
        language: 'Idioma',
        back_to_menu: 'Volver al menú',
        whats_name: 'Como te llamas?',
        name_placeholder: 'Escribe tu nombre',
        menu: 'Menú',
        play: 'Jugar',
        chapter: 'Capitulo',
    },
    wayuunaiki: {
        new_game: 'Jekettu pusheiktia',
        continue: 'Pulakaa suchikuwaya',
        settings: 'Anouktia',
        info: 'Achiki',
        hello: 'Jamayaa',
        music: 'Jayeechi',
        language: 'Anüikii',
        back_to_menu: 'Piita emüin aneekülee',
        whats_name: 'Kasaichi pünülia?',
        name_placeholder: 'Pushaja pünülia',
        menu: 'Aneekülee',
        play: 'Asheiktaa',
        chapter: "Shi'ipajee",
    },
};

export const UIHelpers = {
    setGameCursor(scene) {
        if (!scene?.input) return;
        scene.__defaultCursor = 'url(assets/cursor-arrow.png), pointer';
        scene.__hoverCursor = 'url(assets/cursor-pointer.png), pointer';
        scene.input.setDefaultCursor(scene.__defaultCursor);
    },

    getText(key) {
        const lang = GameStorage.getLanguage() || 'es';
        return UI_STRINGS[lang]?.[key] ?? UI_STRINGS.es[key] ?? key;
    },

    attachHoverPop(scene, target, volume = 0.4) {
        if (!target?.on) return;
        target.on('pointerover', () => {
            if (scene.cache.audio?.exists('pop')) {
                scene.sound.play('pop', { volume });
            }
            if (scene.input && scene.__hoverCursor) {
                scene.input.setDefaultCursor(scene.__hoverCursor);
            }
        });
        target.on('pointerout', () => {
            if (scene.input && scene.__defaultCursor) {
                scene.input.setDefaultCursor(scene.__defaultCursor);
            }
        });
    },
};
