import type { Block } from 'payload'

export const Code: Block = {
  slug: 'code',
  interfaceName: 'CodeBlock',
  fields: [
    {
      name: 'language',
      type: 'select',
      defaultValue: 'text',
      options: [
        { label: 'Plain text', value: 'text' },
        { label: 'Python', value: 'python' },
        { label: 'PowerShell', value: 'powershell' },
        { label: 'Shell', value: 'bash' },
        { label: 'C / C++', value: 'c' },
        { label: 'Assembly', value: 'asm' },
        { label: 'JavaScript', value: 'javascript' },
        { label: 'TypeScript', value: 'typescript' },
        { label: 'JSON', value: 'json' },
        { label: 'HTML / XML', value: 'markup' },
        { label: 'SQL', value: 'sql' },
        { label: 'CSS', value: 'css' },
      ],
    },
    {
      name: 'code',
      type: 'code',
      label: false,
      required: true,
    },
  ],
}
