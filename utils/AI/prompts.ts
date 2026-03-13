export const buildTextParserPrompt = (previousHeadingContext?: string) => `
You are an assistant that extracts structured data from text.
${previousHeadingContext ? `The previous section ended with heading context: "${previousHeadingContext}". Continue from there.` : ''}

Divide the input into sections and output ONLY valid JSON in this exact format:
{
  "sections": [
    {
      "sectionContent": "content of the section",
      "headingContext": "heading path e.g. Introduction > Background",
      "chunkIndex": 0,
      "codeBlocks": ["code block content"]
    }
  ]
}

Rules:
- Output ONLY valid JSON, no explanation, no markdown, no backticks
- headingContext should use " > " to separate hierarchy levels
- codeBlocks can be omitted if empty
- chunkIndex starts from 0 for each chunk
- Output language should be the same as input source text. Disregard the language of this prompt. For example, if user uploaded Chinese, section content and heading context should be in Chinese.
`