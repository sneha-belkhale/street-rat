import initWebScene from './HKAlley';
import initTestScene from './TestScene';

const scene = process.env.REACT_APP_SCENE;

document.body.style.margin = '0';

switch (scene) {
  case 'main':
    initWebScene();
    break;
  case 'test':
    initTestScene();
    break;
  default:
    initWebScene();
}
