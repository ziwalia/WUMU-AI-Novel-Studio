import type { WizardStep } from '@/types'
import { StepProjectInfo } from './steps/StepProjectInfo'
import { StepArchitecture } from './steps/StepArchitecture'
import { StepVolume } from './steps/StepVolume'
import { StepBlueprint } from './steps/StepBlueprint'
import { StepDraft } from './steps/StepDraft'
import { StepReview } from './steps/StepReview'
import { StepRewrite } from './steps/StepRewrite'
import { StepFinalize } from './steps/StepFinalize'
import { StepExport } from './steps/StepExport'

const STEP_COMPONENTS: Record<WizardStep, React.ComponentType> = {
  'project-info': StepProjectInfo,
  'architecture': StepArchitecture,
  'volume': StepVolume,
  'blueprint': StepBlueprint,
  'draft': StepDraft,
  'review': StepReview,
  'rewrite': StepRewrite,
  'finalize': StepFinalize,
  'export': StepExport,
}

interface StepRendererProps {
  step: WizardStep
}

export function StepRenderer({ step }: StepRendererProps) {
  const Component = STEP_COMPONENTS[step]
  return <Component />
}
