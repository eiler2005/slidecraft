/**
 * Optional engines register themselves here. Each module only detects external
 * software at runtime; nothing proprietary is imported or bundled.
 */
import { artifactToolEngine } from './artifact-tool.ts';
import { htmlEngine, htmlPdfEngine } from './html.ts';
import { pptxConvertEngine } from './pptx-convert.ts';
import { registerEngine } from './registry.ts';

registerEngine(htmlEngine);
registerEngine(htmlPdfEngine);
registerEngine(pptxConvertEngine);
registerEngine(artifactToolEngine);
