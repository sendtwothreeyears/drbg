import { Application } from "pixi.js";
import { Game } from "./engine/Game.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./engine/types.js";
import { SnakeScene } from "./scenes/SnakeScene.js";

async function bootstrap() {
  const app = new Application();
  await app.init({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: 0x1a1a2e,
  });

  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app element");
  container.appendChild(app.canvas);

  const game = new Game(app);
  game.loadScene(new SnakeScene());
}

bootstrap().catch(console.error);
