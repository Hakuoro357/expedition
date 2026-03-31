import Phaser from "phaser";

type ButtonOptions = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  /** Optional render depth (for overlays) */
  depth?: number;
};

export function createButton(options: ButtonOptions): Phaser.GameObjects.Container {
  const { scene, x, y, width, height, label, onClick, depth } = options;

  const background = scene.add
    .rectangle(0, 0, width, height, 0x2d6a5d, 0.95)
    .setStrokeStyle(2, 0xd8c59d);

  const text = scene.add.text(0, 0, label, {
    fontFamily: "Georgia",
    fontSize: "18px",
    color: "#f7edd8",
  });
  text.setOrigin(0.5);

  const container = scene.add.container(x, y, [background, text]);
  container.setSize(width, height);

  if (depth !== undefined) {
    container.setDepth(depth);
  }

  // In Phaser 3.60+ Containers default to origin (0.5, 0.5), so displayOriginX/Y
  // are added before the hit-area check. Use a top-left Rectangle so the effective
  // world-space hit box is correctly centred on the container's position.
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  );

  container.on("pointerdown", onClick);
  container.on("pointerover", () => {
    background.setFillStyle(0x367867, 1);
  });
  container.on("pointerout", () => {
    background.setFillStyle(0x2d6a5d, 0.95);
  });

  return container;
}
