import { DocumentBlock } from "./GovernmentHighlighter";

export const TOP_DUMMY_BLOCKS: DocumentBlock[] = [
  {
    type: "normal",
    content: "1. Section 4(a) of the National Technology Initiative Act mandates the alignment of advanced cognitive agents with critical safety standards. All executive departments must establish auditing frameworks for multi-agent interactions within thirty (30) days of this directive.",
  },
  {
    type: "spacer",
    content: ""
  },
  {
    type: "normal",
    content: "2. The primary objective is to ensure transparency and prevent operational conflicts in decentralized systems."
  },
  {
    type: "spacer",
    content: ""
  }
];

export const BOTTOM_DUMMY_BLOCKS: DocumentBlock[] = [
  {
    type: "spacer",
    content: ""
  },
  {
    type: "normal",
    content: "4. Comprehensive risk assessments must be executed prior to the deployment of any autonomous decision-making loops in production environments. Evaluation metrics should prioritize safety thresholds, alignment guarantees, and transparent audit trails."
  },
  {
    type: "spacer",
    content: ""
  },
  {
    type: "normal",
    content: "5. Federal agencies are required to submit quarterly progress reports detailing cognitive agents' operational logs, security audits, and compliance milestones to the Technology Regulation Committee."
  },
  {
    type: "spacer",
    content: ""
  },
  {
    type: "normal",
    content: "6. Continuous monitoring and fallback mechanisms must be integrated into all systems. In the event of anomalous behavioral drift, immediate intervention protocols shall be triggered to suspend processing and restore system safety."
  }
];

export const getTopDummyWordCount = () => {
  let count = 0;
  TOP_DUMMY_BLOCKS.forEach(block => {
    const lines = block.content.split('\n');
    lines.forEach(line => {
      const words = line.split(/\s+/).filter(w => w);
      count += words.length;
    });
  });
  return count;
};
