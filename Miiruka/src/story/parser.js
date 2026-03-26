const normalize = (value) =>
    value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ');

const extractTokens = (line) => {
    const matches = [...line.matchAll(/\[([^\]]*)\]/g)];
    return matches.map((match) => match[1].trim()).filter(Boolean);
};

export const parseScript = (text) => {
    const scenes = [];
    let currentScene = null;

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const tokens = extractTokens(trimmed);
        if (tokens.length === 0) continue;

        const keyword = normalize(tokens[0]);
        if (keyword === 'escena' || keyword === 'scene') {
            const name = tokens[1] || 'SinNombre';
            currentScene = { name, events: [] };
            scenes.push(currentScene);
            continue;
        }

        if (!currentScene) {
            currentScene = { name: 'Default', events: [] };
            scenes.push(currentScene);
        }

        currentScene.events.push({
            tokens,
            line: trimmed,
        });
    }

    scenes.forEach((scene) => {
        const labelMap = new Map();
        scene.events.forEach((event, index) => {
            const key = normalize(event.tokens[0] ?? '');
            if (key === 'label' || key === 'etiqueta') {
                const name = event.tokens[1];
                if (name) labelMap.set(name, index);
            }
        });
        scene.labelMap = labelMap;
    });

    return {
        scenes,
        sceneMap: new Map(scenes.map((scene) => [scene.name, scene])),
    };
};

export const collectCharacterAssets = (text) => {
    const characters = new Map();

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const tokens = extractTokens(trimmed);
        if (tokens.length === 0) continue;

        const keyword = normalize(tokens[0]);
        if (keyword !== 'personaje' && keyword !== 'char') continue;

        const name = tokens[1];
        if (!name) continue;

        const emotions = characters.get(name) ?? new Set();

        const normalizedTokens = tokens.map((token) => normalize(token));
        const emotionIndex = normalizedTokens.findIndex((token) => token === 'emocion' || token === 'expresion');
        if (emotionIndex >= 0 && tokens[emotionIndex + 1]) {
            emotions.add(tokens[emotionIndex + 1]);
        }

        characters.set(name, emotions);
    }

    return characters;
};

export const normalizeKeyword = normalize;
