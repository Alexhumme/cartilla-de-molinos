export const getGameSize = (scene) => ({
    width: scene.scale?.width || 1920,
    height: scene.scale?.height || 1080,
});

export const addFullScreenImage = (scene, key, depth = 0) => {
    const { width, height } = getGameSize(scene);
    const image = scene.add.image(width / 2, height / 2, key).setOrigin(0.5);
    image.setDisplaySize(width, height);
    image.setScrollFactor(0);
    image.setDepth(depth);
    return image;
};

export const addSkyBackground = (scene, depth = 0) => {
    const { width, height } = getGameSize(scene);
    const image = scene.add.image(width / 2, height / 2, 'sky').setOrigin(0.5);
    image.setDisplaySize(width, height);
    image.setScrollFactor(0);
    image.setDepth(depth);
    return image;
};

export const addDesertLayer = (scene, key, y, scrollFactor, options = {}) => {
    const { width } = getGameSize(scene);
    const texture = scene.textures.get(key)?.getSourceImage();
    const textureWidth = texture?.width || width;
    const textureHeight = texture?.height || 1080;
    const layerWidth = options.width || width * 2.3;
    const layerHeight = options.height || Math.round(layerWidth * (textureHeight / textureWidth));
    const x = options.x ?? layerWidth / 2;
    const layer = scene.add.tileSprite(x, y, layerWidth, layerHeight, key);
    layer.setOrigin(0.5);
    layer.setScrollFactor(scrollFactor);
    layer.setTileScale(layerWidth / textureWidth, layerHeight / textureHeight);
    layer.tilePositionX = 0;
    layer.tilePositionY = 0;
    if (typeof options.depth === 'number') layer.setDepth(options.depth);
    return layer;
};
