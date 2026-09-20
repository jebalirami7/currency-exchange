import './styles.css';
import { Converter } from './ui/converter';
import { trackViewportHeight } from './ui/viewport';

trackViewportHeight();
void new Converter().start();
