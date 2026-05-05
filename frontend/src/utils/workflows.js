export const WORKFLOWS = [
  {
    id: 'general',
    label: 'Ask',
    shortLabel: 'Ask',
    description: 'General-purpose answer',
    instruction: '',
  },
  {
    id: 'summary',
    label: 'Summary',
    shortLabel: 'Summary',
    description: 'Concise brief with key points',
    instruction: `Format the response as a structured summary.

Use this shape:
# Summary
## Key Points
- ...
## Details
- ...
## Follow-ups
- ...`,
  },
  {
    id: 'translation',
    label: 'Translation',
    shortLabel: 'Translate',
    description: 'Translate with review notes',
    instruction: `Translate the user's content. Preserve meaning, tone, names, numbers, and formatting.

Use this shape:
# Translation
## Translated Text
...
## Notes
- ...`,
  },
  {
    id: 'comparison',
    label: 'Comparison',
    shortLabel: 'Compare',
    description: 'Compare options in a table',
    instruction: `Compare the items or documents requested by the user.

Use this shape:
# Comparison
| Criteria | Option A | Option B | Notes |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

## Recommendation
- ...`,
  },
  {
    id: 'report',
    label: 'Report',
    shortLabel: 'Report',
    description: 'Business-ready report',
    instruction: `Write a business-ready report.

Use this shape:
# Report
## Executive Summary
...
## Findings
- ...
## Risks
- ...
## Recommendations
- ...`,
  },
  {
    id: 'actions',
    label: 'Action Items',
    shortLabel: 'Actions',
    description: 'Owners, tasks, and next steps',
    instruction: `Extract or produce action items.

Use this shape:
# Action Items
| Task | Owner | Due Date | Status |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

## Open Questions
- ...`,
  },
];

export const DEFAULT_WORKFLOW_ID = 'general';

export const getWorkflowById = (workflowId) => {
  return WORKFLOWS.find((workflow) => workflow.id === workflowId) || WORKFLOWS[0];
};

export const applyWorkflowInstruction = (text, workflowId) => {
  const workflow = getWorkflowById(workflowId);
  if (!workflow.instruction) return text;

  return `${workflow.instruction}

User request:
${text}`;
};
