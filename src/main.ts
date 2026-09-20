import './styles.css';
import { requireElement } from './ui/dom';
import { Converter } from './ui/converter';
import { registerServiceWorker } from './ui/offline';
import { setupTheme } from './ui/theme';
import { trackViewportHeight } from './ui/viewport';

trackViewportHeight();
setupTheme(requireElement<HTMLButtonElement>('#theme'));
registerServiceWorker();
void new Converter().start();
