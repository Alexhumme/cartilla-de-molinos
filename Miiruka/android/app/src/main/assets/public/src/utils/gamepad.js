export class GamepadCursor {
  static attach(scene, config = {}) {
    if (scene._gamepadCursorAttached) return;
    scene._gamepadCursorAttached = true;

    const cursorKey = config.cursorKey || "gamepad-cursor";
    const activeCursorKey = config.activeCursorKey || "gamepad-cursor-active";

    scene.gamepadCursorConfig = {
      cursorKey,
      activeCursorKey,
      speed: config.speed || 820,
    };

    // -----------------------------
    // Cursor
    // -----------------------------

    const cursor = scene.add
      .image(scene.scale.width / 2, scene.scale.height / 2, cursorKey)
      .setOrigin(0, 0)
      .setDepth(10000)
      .setVisible(false)
      .setScale(0.8);

    scene.gamepadCursor = cursor;

    // -----------------------------
    // Activar plugin gamepad
    // -----------------------------

    if (!scene.input.gamepad) {
      scene.input.gamepad = scene.input.manager.gamepad;
    }

    // -----------------------------
    // Desactivar modo gamepad al mover mouse
    // -----------------------------

    scene.disableGamepadMode = (pointer) => {
      const event = pointer?.event;

      if (event?.pointerType && event.pointerType !== "mouse") {
        return;
      }

      GamepadCursor.setMode(scene, false);
    };

    scene.input.on("pointermove", scene.disableGamepadMode);
    scene.input.on("pointerdown", scene.disableGamepadMode);

    // -----------------------------
    // Cleanup
    // -----------------------------

    scene.events.once("shutdown", () => {
      scene.input.off("pointermove", scene.disableGamepadMode);
      scene.input.off("pointerdown", scene.disableGamepadMode);

      GamepadCursor.setMouseHidden(scene, false);

      if (scene.gamepadCursor) {
        scene.gamepadCursor.destroy();
        scene.gamepadCursor = null;
      }

      scene._gamepadCursorAttached = false;
    });
  }

  // OBTERNER TODOS LOS ELEMENTOS INTERACTIVOS

  static getInteractiveObjects(scene) {
    const result = [];

    const scan = (list) => {
      list.forEach((obj) => {
        if (!obj) return;

        if (!obj.active) return;

        if (!obj.visible) return;

        // interactivo
        if (obj.input?.enabled) {
          result.push(obj);
        }

        // containers anidados
        if (obj.list?.length) {
          scan(obj.list);
        }
      });
    };

    scan(scene.children.list);

    return result;
  }

  // FUNCION PRINCIPAL

  static update(scene, delta = 16.67) {
    if (!scene.gamepadCursor) return;

    const hasPad = this.hasConnectedGamepad(scene);

    if (!hasPad) {
      this.setMode(scene, false);
      return;
    }

    const input = this.getStrongestInput(scene);

    let moveX = input?.moveX || 0;
    let moveY = input?.moveY || 0;

    const moving = moveX !== 0 || moveY !== 0;

    scene.gamepadCursor.setTexture(
      moving
        ? scene.gamepadCursorConfig.activeCursorKey
        : scene.gamepadCursorConfig.cursorKey,
    );

    if (input?.active) {
      this.setMode(scene, true);
    }

    scene.gamepadCursor.setVisible(scene.gamepadModeActive);

    // --------------------------------
    // Movimiento
    // --------------------------------

    if (moving) {
      const length = Math.hypot(moveX, moveY);

      if (length > 1) {
        moveX /= length;
        moveY /= length;
      }

      const dt = Math.min(delta / 1000, 0.05);
      const margin = 28;
      const cam = scene.cameras.main;

      const minX = cam.scrollX + margin;
      const maxX = cam.scrollX + cam.width - margin;

      const minY = cam.scrollY + margin;
      const maxY = cam.scrollY + cam.height - margin;

      scene.gamepadCursor.x = Phaser.Math.Clamp(
        scene.gamepadCursor.x + moveX * scene.gamepadCursorConfig.speed * dt,
        minX,
        maxX,
      );

      scene.gamepadCursor.y = Phaser.Math.Clamp(
        scene.gamepadCursor.y + moveY * scene.gamepadCursorConfig.speed * dt,
        minY,
        maxY,
      );
    }

    // --------------------------------
    // Hover detection
    // --------------------------------

    let hovering = false;

    const interactives = this.getInteractiveObjects(scene);
    const hoveredObjects = [];

    interactives.forEach((obj) => {
      let bounds;

      try {
        bounds = obj.getBounds();
      } catch {
        return;
      }

      const isOver = Phaser.Geom.Rectangle.Contains(
        bounds,
        scene.gamepadCursor.x,
        scene.gamepadCursor.y,
      );

      if (isOver) {
        hovering = true;

        hoveredObjects.push(obj);

        if (!obj._gpHover) {
          obj._gpHover = true;

          obj.emit("pointerover");
        }
      } else if (obj._gpHover) {
        obj._gpHover = false;

        obj.emit("pointerout");
      }
    });

    scene._gamepadHoveredObjects = hoveredObjects;

    scene.gamepadCursor.setTexture(
      hovering
        ? scene.gamepadCursorConfig.activeCursorKey
        : scene.gamepadCursorConfig.cursorKey,
    );

    // --------------------------------
    // Botones 0 y 5
    // --------------------------------

    const pad = this.getConnectedGamepad(scene);

    if (!pad) return;

    const pressed =
      this.isButtonPressed(pad, 0) || this.isButtonPressed(pad, 5);

    if (pressed && !scene._gamepadPressLock) {
      scene._gamepadPressLock = true;

      const fakePointer = {
        x: scene.gamepadCursor.x,
        y: scene.gamepadCursor.y,
        worldX: scene.gamepadCursor.x,
        worldY: scene.gamepadCursor.y,
        isDown: true,
        gamepad: true,
      };

      // CLICK GLOBAL
      scene.input.emit("pointerdown", fakePointer);

      // CLICK SOBRE OBJETOS
      (scene._gamepadHoveredObjects || []).forEach((obj) => {
        if (!obj.input?.enabled) return;

        obj.emit("pointerdown", fakePointer);

        scene.time.delayedCall(80, () => {
          obj.emit("pointerup", fakePointer);
        });
      });
    }

    if (!pressed) {
      scene._gamepadPressLock = false;
    }

    // --------------------------------
    // DRAG CON GATILLO DERECHO (7)
    // --------------------------------

    const dragPressed = this.isButtonPressed(pad, 7);

    // INICIO DRAG

    if (dragPressed && !scene._gamepadDragging) {
      scene._gamepadDragging = true;

      const fakePointer = {
        x: scene.gamepadCursor.x,
        y: scene.gamepadCursor.y,
        worldX: scene.gamepadCursor.x,
        worldY: scene.gamepadCursor.y,
        isDown: true,
        gamepad: true,
      };

      scene.input.emit("pointerdown", fakePointer);

      scene._gamepadDraggedObjects = [...(scene._gamepadHoveredObjects || [])];

      scene._gamepadDraggedObjects.forEach((obj) => {
        if (!obj.input?.enabled) return;

        obj.emit("dragstart", fakePointer);
        obj.emit("pointerdown", fakePointer);
      });
    }

    // DRAGGING

    if (dragPressed && scene._gamepadDragging) {
      const fakePointer = {
        x: scene.gamepadCursor.x,
        y: scene.gamepadCursor.y,
        worldX: scene.gamepadCursor.x,
        worldY: scene.gamepadCursor.y,
        isDown: true,
        gamepad: true,
      };

      scene.input.emit("pointermove", fakePointer);

      (scene._gamepadDraggedObjects || []).forEach((obj) => {
        if (!obj.input?.enabled) return;

        obj.emit("drag", fakePointer);
      });
    }

    // FIN DRAG

    if (!dragPressed && scene._gamepadDragging) {
      scene._gamepadDragging = false;

      const fakePointer = {
        x: scene.gamepadCursor.x,
        y: scene.gamepadCursor.y,
        worldX: scene.gamepadCursor.x,
        worldY: scene.gamepadCursor.y,
        isDown: false,
        gamepad: true,
      };

      scene.input.emit("pointerup", fakePointer);

      (scene._gamepadDraggedObjects || []).forEach((obj) => {
        if (!obj.input?.enabled) return;

        obj.emit("dragend", fakePointer);
        obj.emit("pointerup", fakePointer);
      });

      scene._gamepadDraggedObjects = [];
    }

    // PAUSA

    const startPressed = this.isButtonPressed(pad, 9);
    if (startPressed && !scene._gamepadStartLock) {
      scene._gamepadStartLock = true;

      if (scene.storyRunner?.togglePause) {
        scene.storyRunner.togglePause();
      }
    }

    if (!startPressed) {
      scene._gamepadStartLock = false;
    }
  }

  // =====================================================
  // Helpers
  // =====================================================

  static getConnectedGamepads(scene) {
    if (scene.input.gamepad) {
      const phaserPads = scene.input.gamepad.gamepads || [];

      const connected = phaserPads.filter(
        (pad) => !!pad && pad.connected !== false,
      );

      if (connected.length > 0) {
        return connected;
      }
    }

    const pads = navigator.getGamepads?.() || [];

    return Array.from(pads).filter((pad) => !!pad && pad.connected !== false);
  }

  static getConnectedGamepad(scene) {
    return this.getConnectedGamepads(scene)[0] || null;
  }

  static hasConnectedGamepad(scene) {
    return !!this.getConnectedGamepad(scene);
  }

  static readAxis(pad, index) {
    if (pad?.pad?.axes) {
      const value = pad.pad.axes[index];

      if (typeof value === "number") {
        return value;
      }
    }

    if (pad?.leftStick && pad?.rightStick) {
      if (index === 0) return pad.leftStick.x;
      if (index === 1) return pad.leftStick.y;
      if (index === 2) return pad.rightStick.x;
      if (index === 3) return pad.rightStick.y;
    }

    const axis = pad?.axes?.[index];

    if (typeof axis === "number") {
      return axis;
    }

    if (typeof axis?.getValue === "function") {
      return axis.getValue();
    }

    if (typeof axis?.value === "number") {
      return axis.value;
    }

    return 0;
  }

  static isButtonPressed(pad, index) {
    const button = pad?.buttons?.[index];

    if (!button) return false;

    if (typeof button === "number") {
      return button > 0.5;
    }

    return !!(button.pressed || button.value > 0.5);
  }

  static sampleInput(scene, pad) {
    const deadzone = 0.18;

    const normalize = (v) => {
      const value = Math.abs(v) < deadzone ? 0 : Number(v) || 0;
      return Phaser.Math.Clamp(value, -1, 1);
    };

    const moveX = normalize(this.readAxis(pad, 0));
    const moveY = normalize(this.readAxis(pad, 1));

    const anyButtonPressed = (pad?.buttons || []).some((button) => {
      if (typeof button === "number") {
        return button > 0.5;
      }

      return !!(button?.pressed || button?.value > 0.5);
    });

    return {
      moveX,
      moveY,
      active: moveX !== 0 || moveY !== 0 || anyButtonPressed,
    };
  }

  static getStrongestInput(scene) {
    return this.getConnectedGamepads(scene).reduce((best, pad) => {
      const sample = this.sampleInput(scene, pad);

      const strength = Math.hypot(sample.moveX, sample.moveY);

      if (
        !best ||
        strength > best.strength ||
        (!best.active && sample.active)
      ) {
        return {
          ...sample,
          strength,
        };
      }

      return best;
    }, null);
  }

  static setMode(scene, active) {
    if (scene.gamepadModeActive === active) return;

    scene.gamepadModeActive = active;

    this.setMouseHidden(scene, active);

    if (scene.gamepadCursor) {
      scene.gamepadCursor.setVisible(active && this.hasConnectedGamepad(scene));
    }
  }

  static setMouseHidden(scene, hidden) {
    if (scene.mouseHiddenByGamepad === hidden) return;

    scene.mouseHiddenByGamepad = hidden;

    if (hidden) {
      scene.input.setDefaultCursor("none");

      if (scene.game.canvas) {
        scene.game.canvas.style.cursor = "none";
      }

      return;
    }

    if (scene.game.canvas) {
      scene.game.canvas.style.cursor = "";
    }
  }
}
