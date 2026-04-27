// Enfoque: comandos y estado de personajes (entrada, mirada, emoción, lipsync, caminar).
// Estas funciones se ejecutan con `this` enlazado a StoryRunner.

import { normalizeKeyword } from '../parser.js';

export function ensureCharacterSprite(name) {
    name = this.resolveCharacterName(name);
    if (this.characters.has(name)) return this.characters.get(name);
    const textureKey = this.getCharacterTextureKey(name, {
        emotion: 'idle',
        facing: 'mira_jugador',
        mouth: 1,
    });

    const sprite = this.scene.add.image(-300, 780, textureKey).setOrigin(0, 0);
    const useWorld = !!this.scene?.useWorldCharacters;
    sprite.setScrollFactor(useWorld ? 1 : 0);
    sprite.setDepth(200);
    this.characters.set(name, sprite);
    this.characterState.set(name, {
        emotion: 'idle',
        facing: 'mira_jugador',
        mouth: 1,
        flipX: false,
        baseY: 180,
        isWalking: false,
        walkBobTween: null,
    });
    return sprite;
}

export function getCharacterTextureForState(name, state) {
    const emotion = state.emotion || 'idle';
    const facing = state.facing || 'mira_jugador';
    const mouth = state.mouth || 1;
    const key = `char-${name}-${facing}-${emotion}-${mouth}`;
    if (this.scene.textures.exists(key)) return key;

    const mouthClosed = `char-${name}-${facing}-${emotion}-1`;
    if (this.scene.textures.exists(mouthClosed)) return mouthClosed;

    const fallbackEmotionMouth = `char-${name}-${facing}-idle-${mouth}`;
    if (this.scene.textures.exists(fallbackEmotionMouth)) return fallbackEmotionMouth;

    const fallbackEmotion = `char-${name}-${facing}-idle-1`;
    if (this.scene.textures.exists(fallbackEmotion)) return fallbackEmotion;

    const fallbackFacing = `char-${name}-mira_jugador-idle-1`;
    if (this.scene.textures.exists(fallbackFacing)) return fallbackFacing;

    const legacyIdle = `char-${name}-idle`;
    if (this.scene.textures.exists(legacyIdle)) return legacyIdle;

    return this.placeholderTextureKey || 'story-placeholder';
}

export function setCharacterStatePartial(name, partial) {
    name = this.resolveCharacterName(name);
    this.ensureCharacter(name);
    const prev = this.characterState.get(name) ?? {
        emotion: 'idle',
        facing: 'mira_jugador',
        mouth: 1,
        flipX: false,
        baseY: 180,
        isWalking: false,
        walkBobTween: null,
    };
    const next = { ...prev, ...partial };
    this.characterState.set(name, next);
    const sprite = this.characters.get(name);
    if (sprite) {
        sprite.setTexture(this.getCharacterTextureKey(name, next));
        sprite.setFlipX(!!next.flipX);
    }
}

export function setCharacterEmotionState(name, emotion) {
    name = this.resolveCharacterName(name);
    if (!emotion) return;
    if (this.scene.bgScrollActive && (this.scene.bgScrollWalkers || []).includes(name)) return;
    this.setCharacterState(name, { emotion });
}

export function getCharacterTarget(name, direction) {
    const normalized = (name || '').toLowerCase();
    const sprite = this.ensureCharacter(name);
    const cam = this.scene.cameras.main;
    const useWorld = !!this.scene?.useWorldCharacters;
    const sceneWidth = this.scene.scale.width || 1920;
    if (direction === 'derecha') {
        const rightEdgeX = (useWorld ? cam.scrollX : 0) + sceneWidth - 30;
        return { x: rightEdgeX - sprite.displayWidth, y: 180 };
    }
    if (normalized === 'jouktai') {
        return { x: 30, y: 180 };
    }
    if (normalized === 'kai') {
        return { x: 480, y: 180 };
    }
    return { x: 30, y: 180 };
}

export function getSpeakingFacingAuto(name) {
    const othersVisible = Array.from(this.characters.keys()).some((charName) => {
        if (charName === name) return false;
        const sprite = this.characters.get(charName);
        return !!sprite && sprite.visible !== false && sprite.alpha > 0;
    });
    return othersVisible ? 'mira_lado' : 'mira_jugador';
}

export function getSpeakerFlipAuto(name, facing) {
    if (facing !== 'mira_lado') return false;
    const self = this.characters.get(name);
    if (!self) return false;
    let nearest = null;
    this.characters.forEach((sprite, charName) => {
        if (charName === name || !sprite || sprite.visible === false) return;
        if (!nearest || Math.abs(sprite.x - self.x) < Math.abs(nearest.x - self.x)) {
            nearest = sprite;
        }
    });
    if (!nearest) return false;
    return nearest.x < self.x;
}

export function startCharacterLipSync(name) {
    this.stopLipSync(name);
    let frameIndex = 0;
    const sequence = [2, 3, 2, 1];
    this.characterLipEvents.set(name, this.scene.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => {
            this.setCharacterState(name, { mouth: sequence[frameIndex % sequence.length] });
            frameIndex += 1;
        },
    }));
}

export function stopCharacterLipSync(name) {
    const event = this.characterLipEvents.get(name);
    if (event) {
        event.remove(false);
        this.characterLipEvents.delete(name);
    }
    this.setCharacterState(name, { mouth: 1 });
}

export function startCharacterWalkBob(name) {
    const sprite = this.characters.get(name);
    const state = this.characterState.get(name);
    if (!sprite || !state || state.isWalking) return;
    state.isWalking = true;
    state.baseY = sprite.y;
    const runCycle = () => {
        if (!state.isWalking) return;
        this.scene.tweens.add({
            targets: sprite,
            y: state.baseY - 14,
            duration: 170,
            ease: 'Sine.out',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: sprite,
                    y: state.baseY,
                    duration: 280,
                    ease: 'Sine.in',
                    onComplete: runCycle,
                });
            },
        });
    };
    runCycle();
}

export function stopCharacterWalkBob(name) {
    const sprite = this.characters.get(name);
    const state = this.characterState.get(name);
    if (!sprite || !state) return;
    state.isWalking = false;
    this.scene.tweens.killTweensOf(sprite);
    sprite.y = state.baseY ?? sprite.y;
}

export async function handleCharacterCommand(tokens) {
    const name = this.resolveCharacterName(tokens[1]);
    const normalizedTokens = tokens.map((token) => normalizeKeyword(token));
    const actionIndex = normalizedTokens.findIndex((token) => token === 'entra');
    const action = actionIndex >= 0 ? 'entra' : normalizeKeyword(tokens[2] ?? '');

    if (!name) return;
    const emotionIndex = normalizedTokens.findIndex((token) => token === 'emocion' || token === 'expresion');
    const lookIndex = normalizedTokens.findIndex((token) => token === 'mira');
    const sayIndex = normalizedTokens.findIndex((token) => token === 'habla' || token === 'dice');

    if (emotionIndex >= 0) {
        this.setCharacterEmotion(name, tokens[emotionIndex + 1]);
    }

    if (lookIndex >= 0) {
        const lookRaw = normalizeKeyword(tokens[lookIndex + 1] ?? '');
        const isAutoLook = lookRaw === 'auto';
        const facing = (lookRaw === 'lado' || lookRaw === 'mira_lado')
            ? 'mira_lado'
            : 'mira_jugador';
        const state = this.characterState.get(name) ?? {};
        this.setCharacterState(name, {
            facing,
            mouth: 1,
            flipX: state.flipX ?? false,
            manualFacing: !isAutoLook,
        });
    }

    if (action === 'entra') {
        const directionToken = actionIndex >= 0 ? tokens[actionIndex + 1] : tokens[3];
        const direction = normalizeKeyword(directionToken ?? 'izquierda');
        await this.characterEnter(name, direction);
    }

    if (sayIndex >= 0) {
        const dialogTokens = tokens.slice(sayIndex + 1);
        const dialogData = this.parseDialogTokens(dialogTokens);
        this.lastDialogMap = dialogData.map;
        this.lastDialogImageKey = dialogData.imageKeys;
        const text = this.resolveDialogText(dialogData.map);
        await this.showDialog(name, text, { imageKeys: dialogData.imageKeys });
    }
}

export async function runCharacterEnter(name, direction) {
    name = this.resolveCharacterName(name);
    const sprite = this.ensureCharacter(name);
    const startX = direction === 'derecha' ? 2300 : -300;
    const targetPos = this.getCharacterTargetPosition(name, direction);
    const targetX = targetPos.x;
    const cam = this.scene.cameras.main;
    const useWorld = !!this.scene?.useWorldCharacters;
    const targetY = useWorld ? cam.scrollY + targetPos.y : targetPos.y;
    this.setCharacterState(name, {
        emotion: 'camina',
        mouth: 1,
        facing: 'mira_lado',
        flipX: direction === 'derecha',
    });
    sprite.x = startX;
    sprite.y = targetY;
    this.setCharacterState(name, { baseY: targetY });
    this.startWalkBob(name);

    this.startWalkingSound();
    await new Promise((resolve) => {
        this.scene.tweens.add({
            targets: sprite,
            x: targetX,
            duration: 1200,
            ease: 'Sine.out',
            onComplete: () => {
                this.stopWalkBob(name);
                this.setCharacterState(name, { emotion: 'idle', mouth: 1 });
                this.stopWalkingSound();
                resolve();
            },
        });
    });
}
