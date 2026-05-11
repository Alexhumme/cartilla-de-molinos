export const attachLoadingOverlay = (scene, title = 'Cargando...') => {
    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const barWidth = 700;
    const barHeight = 46;

    const loadingPanel = scene.add.graphics();
    loadingPanel.fillStyle(0x000000, 0.42);
    loadingPanel.fillRoundedRect(centerX - 420, centerY - 120, 840, 220, 28);

    const progressTrack = scene.add.graphics();
    progressTrack.fillStyle(0x8b4c1d, 1);
    progressTrack.fillRoundedRect(centerX - barWidth / 2 - 4, centerY - barHeight / 2 - 4, barWidth + 8, barHeight + 8, 16);
    progressTrack.fillStyle(0xf0c18a, 1);
    progressTrack.fillRoundedRect(centerX - barWidth / 2, centerY - barHeight / 2, barWidth, barHeight, 14);

    const progressFill = scene.add.graphics();
    const loadingText = scene.add.text(centerX, centerY - 62, title, {
        fontFamily: 'fredoka',
        fontSize: '42px',
        color: '#fce1b4',
        fontStyle: '700',
    }).setOrigin(0.5);
    const percentText = scene.add.text(centerX, centerY + 58, '0%', {
        fontFamily: 'fredoka',
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: '700',
    }).setOrigin(0.5);

    const onProgress = (value) => {
        const clamped = Phaser.Math.Clamp(value, 0, 1);
        progressFill.clear();
        progressFill.fillStyle(0x63a711, 1);
        progressFill.fillRoundedRect(
            centerX - barWidth / 2,
            centerY - barHeight / 2,
            barWidth * clamped,
            barHeight,
            14
        );
        percentText.setText(`${Math.round(clamped * 100)}%`);
    };

    const destroyOverlay = () => {
        progressFill.destroy();
        progressTrack.destroy();
        loadingPanel.destroy();
        loadingText.destroy();
        percentText.destroy();
        scene.load.off('progress', onProgress);
    };

    scene.load.on('progress', onProgress);
    scene.load.once('complete', destroyOverlay);
    scene.events.once('shutdown', destroyOverlay);
    scene.events.once('destroy', destroyOverlay);
    return destroyOverlay;
};
