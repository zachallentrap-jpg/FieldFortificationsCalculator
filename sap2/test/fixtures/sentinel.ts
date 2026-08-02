// The one sentinel scenario for byte-goldens (G-8) and golden regeneration.
import type { ComputeInputs } from '../../src/engine/compute';

export const SENTINEL_INPUTS: ComputeInputs = {
  position: 'one_man', threat: 'ind-mtr-81', soil: 'loam', standard: 'deliberate',
  revetment: 'none', coverMaterial: 'soil', machineAssist: false,
};
