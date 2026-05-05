import { applyWorkflowInstruction, getWorkflowById } from './workflows';

describe('workflow helpers', () => {
  it('leaves general requests unchanged', () => {
    expect(applyWorkflowInstruction('hello', 'general')).toBe('hello');
  });

  it('adds workflow structure for report requests', () => {
    const prompt = applyWorkflowInstruction('Summarize the launch plan', 'report');
    expect(prompt).toContain('# Report');
    expect(prompt).toContain('User request:\nSummarize the launch plan');
  });

  it('falls back to the general workflow for unknown ids', () => {
    expect(getWorkflowById('missing').id).toBe('general');
  });
});
