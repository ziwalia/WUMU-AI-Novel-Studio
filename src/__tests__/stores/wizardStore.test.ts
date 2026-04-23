import { describe, it, expect, beforeEach } from 'vitest'
import { useWizardStore } from '@/stores/wizardStore'

describe('wizardStore', () => {
  beforeEach(() => {
    useWizardStore.setState({ completedSteps: [], isAutoMode: false, isGenerating: false })
  })

  it('marks steps as completed', () => {
    useWizardStore.getState().markStepCompleted('project-info')
    expect(useWizardStore.getState().completedSteps).toContain('project-info')
  })

  it('does not duplicate completed steps', () => {
    useWizardStore.getState().markStepCompleted('project-info')
    useWizardStore.getState().markStepCompleted('project-info')
    expect(useWizardStore.getState().completedSteps).toEqual(['project-info'])
  })

  it('returns correct step status', () => {
    useWizardStore.getState().markStepCompleted('project-info')

    const get = useWizardStore.getState().getStepStatus
    expect(get('project-info', 'architecture')).toBe('completed')
    expect(get('architecture', 'architecture')).toBe('active')
    expect(get('draft', 'architecture')).toBe('pending')
  })

  it('checks navigation eligibility', () => {
    expect(useWizardStore.getState().canNavigateTo('project-info')).toBe(true)
    expect(useWizardStore.getState().canNavigateTo('architecture')).toBe(false)

    useWizardStore.getState().markStepCompleted('project-info')
    expect(useWizardStore.getState().canNavigateTo('architecture')).toBe(true)
  })

  it('resets state', () => {
    useWizardStore.getState().markStepCompleted('project-info')
    useWizardStore.getState().setAutoMode(true)
    useWizardStore.getState().reset()

    expect(useWizardStore.getState().completedSteps).toEqual([])
    expect(useWizardStore.getState().isAutoMode).toBe(false)
  })
})
